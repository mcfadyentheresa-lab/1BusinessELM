import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WarningInsert {
  estimate_item_id: number | null;
  estimate_id: number | null;
  warning_type: string;
  message: string;
  percent_diff: string | null;
}

interface EstimateItem {
  id: number;
  category_id: number | null;
  custom_category: string | null;
  room: string | null;
  quantity: string;
  unit_type: string;
  unit_cost: string;
  material_cost: string;
  cost_categories: { name: string } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // --- Auth: verify JWT + admin role ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = (profile as any)?.role ?? userData.user.app_metadata?.role ?? null;
    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse input ---
    let body: { estimate_id?: number } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const estimateId = body.estimate_id;
    if (!estimateId || typeof estimateId !== "number") {
      return new Response(JSON.stringify({ error: "estimate_id (number) is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 1. Fetch the estimate ---
    const { data: estimate, error: estErr } = await db
      .from("project_estimates")
      .select("id, project_id, name, status")
      .eq("id", estimateId)
      .maybeSingle();
    if (estErr) throw estErr;
    if (!estimate) {
      return new Response(JSON.stringify({ error: "Estimate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 2. Fetch estimate_items joined to cost_categories ---
    const { data: items, error: itemsErr } = await db
      .from("estimate_items")
      .select("id, category_id, custom_category, room, quantity, unit_type, unit_cost, material_cost, cost_categories(name)")
      .eq("estimate_id", estimateId);
    if (itemsErr) throw itemsErr;
    const estimateItems: EstimateItem[] = (items ?? []) as unknown as EstimateItem[];

    // --- 3. Fetch project region ---
    const { data: project, error: projErr } = await db
      .from("projects")
      .select("id, name, region")
      .eq("id", estimate.project_id)
      .maybeSingle();
    if (projErr) throw projErr;
    const projectRegion = (project as any)?.region ?? null;
    const projectName = (project as any)?.name ?? null;

    // --- 4. Fetch active market_rates for categories present in items ---
    const categoryIds = estimateItems
      .map((i) => i.category_id)
      .filter((c): c is number => c !== null);
    const uniqueCategoryIds = [...new Set(categoryIds)];

    let marketRates: Array<{
      category_id: number;
      unit_type: string;
      low_rate: string;
      high_rate: string;
      typical_rate: string;
    }> = [];
    if (uniqueCategoryIds.length > 0) {
      const { data: rates, error: ratesErr } = await db
        .from("market_rates")
        .select("category_id, unit_type, low_rate, high_rate, typical_rate")
        .eq("is_active", true)
        .in("category_id", uniqueCategoryIds);
      if (ratesErr) throw ratesErr;
      marketRates = (rates ?? []) as any;
    }

    // --- 5. Fetch active regional_modifiers for the project's region ---
    let regionalModifiers: Array<{ name: string; value: string; unit: string }> = [];
    if (projectRegion) {
      const { data: mods, error: modsErr } = await db
        .from("regional_modifiers")
        .select("name, value, unit")
        .eq("region", projectRegion)
        .eq("is_active", true);
      if (modsErr) throw modsErr;
      regionalModifiers = (mods ?? []) as any;
    }

    // --- Run deterministic checks ---
    const warnings: WarningInsert[] = [];

    // Build a lookup: category_id -> first matching market_rate
    const rateByCategory = new Map<number, typeof marketRates[number]>();
    for (const r of marketRates) {
      if (!rateByCategory.has(r.category_id)) rateByCategory.set(r.category_id, r);
    }

    // PRICE OUTLIER
    for (const item of estimateItems) {
      if (item.category_id === null) continue;
      const rate = rateByCategory.get(item.category_id);
      if (!rate) continue;
      const unitCost = parseFloat(item.unit_cost);
      const low = parseFloat(rate.low_rate);
      const high = parseFloat(rate.high_rate);
      const typical = parseFloat(rate.typical_rate);
      if (isNaN(unitCost) || isNaN(low) || isNaN(high)) continue;
      if (unitCost < low || unitCost > high) {
        const pctDiff = typical > 0
          ? (((unitCost - typical) / typical) * 100).toFixed(0)
          : null;
        const catName = item.cost_categories?.name ?? "this category";
        warnings.push({
          estimate_item_id: item.id,
          estimate_id: null,
          warning_type: "price_outlier",
          message: `${catName}: unit cost $${unitCost.toFixed(2)} is outside the typical market range of $${low.toFixed(2)}–$${high.toFixed(2)} (typical: $${typical.toFixed(2)}).`,
          percent_diff: pctDiff,
        });
      }
    }

    // UNCATEGORIZED
    for (const item of estimateItems) {
      if (item.category_id === null && item.custom_category) {
        warnings.push({
          estimate_item_id: item.id,
          estimate_id: null,
          warning_type: "uncategorized",
          message: `Line item "${item.custom_category}" has no standard category assigned. Assign a real cost category for accurate reporting and market-rate comparison.`,
          percent_diff: null,
        });
      }
    }

    // ZERO_COST
    for (const item of estimateItems) {
      const uc = parseFloat(item.unit_cost);
      const mc = parseFloat(item.material_cost);
      if ((isNaN(uc) || uc === 0) && (isNaN(mc) || mc === 0)) {
        warnings.push({
          estimate_item_id: item.id,
          estimate_id: null,
          warning_type: "zero_cost",
          message: `This line item has $0.00 for both labour and material — it is likely incomplete.`,
          percent_diff: null,
        });
      }
    }

    // DUPLICATE — group by (room, category_id), flag all but the first in each group
    const groupKey = (item: EstimateItem) => `${item.room ?? ""}|${item.category_id ?? "null"}`;
    const seenGroups = new Map<string, number>();
    for (const item of estimateItems) {
      if (item.category_id === null) continue;
      const key = groupKey(item);
      const count = seenGroups.get(key) ?? 0;
      if (count > 0) {
        const catName = item.cost_categories?.name ?? "this category";
        const roomLabel = item.room ?? "no room";
        warnings.push({
          estimate_item_id: item.id,
          estimate_id: null,
          warning_type: "duplicate",
          message: `Duplicate entry: "${catName}" in ${roomLabel} already appears ${count} time${count > 1 ? "s" : ""} in this estimate. Consolidate or confirm this is intentional.`,
          percent_diff: null,
        });
      }
      seenGroups.set(key, count + 1);
    }

    // MISSING_REGIONAL_MODIFIER — one warning if any active modifiers exist for the region
    if (projectRegion && regionalModifiers.length > 0) {
      const modList = regionalModifiers
        .map((m) => `${m.name} (+${m.value}${m.unit === "percent" ? "%" : ` ${m.unit}`})`)
        .join(", ");
      warnings.push({
        estimate_item_id: null,
        estimate_id: estimateId,
        warning_type: "missing_modifier",
        message: `This region (${projectRegion}) has active pricing modifiers that may apply: ${modList}. Confirm whether site conditions warrant applying these.`,
        percent_diff: null,
      });
    }

    // --- AI check: MISSING_SCOPE ---
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let aiParseFailed = false;
    if (anthropicKey && estimateItems.length > 0) {
      const presentCategories = estimateItems
        .map((i) => i.cost_categories?.name ?? i.custom_category ?? null)
        .filter((n): n is string => n !== null);
      const uniquePresent = [...new Set(presentCategories)];
      const missingScopeWarnings = await runMissingScopeCheck(
        anthropicKey,
        uniquePresent,
        projectName,
      );
      if (missingScopeWarnings === null) {
        aiParseFailed = true;
      } else {
        for (const msg of missingScopeWarnings) {
          warnings.push({
            estimate_item_id: null,
            estimate_id: estimateId,
            warning_type: "missing_scope",
            message: msg,
            percent_diff: null,
          });
        }
      }
    }

    // --- Before inserting: delete existing non-ignored warnings for this estimate ---
    // Estimate-level warnings (estimate_id = estimateId, ignored = false)
    await db
      .from("estimate_warnings")
      .delete()
      .eq("estimate_id", estimateId)
      .eq("ignored", false);

    // Item-level warnings for items in this estimate (ignored = false)
    const itemIds = estimateItems.map((i) => i.id);
    if (itemIds.length > 0) {
      await db
        .from("estimate_warnings")
        .delete()
        .in("estimate_item_id", itemIds)
        .eq("ignored", false);
    }

    // --- Insert all new warnings in a single batch ---
    let insertedRows: any[] = [];
    if (warnings.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from("estimate_warnings")
        .insert(warnings as any)
        .select("id, estimate_item_id, estimate_id, warning_type, message, percent_diff, ignored");
      if (insertErr) throw insertErr;
      insertedRows = inserted ?? [];
    }

    // --- Build counts ---
    const counts: Record<string, number> = {
      price_outlier: 0,
      uncategorized: 0,
      zero_cost: 0,
      duplicate: 0,
      missing_modifier: 0,
      missing_scope: 0,
    };
    for (const w of insertedRows) {
      if (counts[w.warning_type] !== undefined) counts[w.warning_type]++;
    }

    return new Response(JSON.stringify({
      warnings: insertedRows,
      counts,
      ai_parse_failed: aiParseFailed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// -------------------------------------------------------
// MISSING_SCOPE check via Anthropic (claude-haiku-4-5)
// Follows project-watcher's auth pattern exactly.
// Returns array of warning messages, or null if parse fails.
// -------------------------------------------------------
async function runMissingScopeCheck(
  apiKey: string,
  presentCategories: string[],
  projectName: string | null,
): Promise<string[] | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        system:
          "You are a construction cost estimating expert reviewing a contractor's line items. " +
          "You ONLY output strict JSON. " +
          'Respond with exactly: {"missing": ["gap1", "gap2", ...]}. ' +
          "IMPORTANT: This estimate is almost certainly PARTIAL and in-progress — it is not a finished estimate. " +
          "Do NOT flag the absence of entire unrelated trades just because a complete project would eventually need them " +
          "(e.g. do not flag 'no plumbing yet' on an estimate that only has insulation and painting — those trades may simply be added later). " +
          "INSTEAD, identify only SPECIFIC, NON-OBVIOUS gaps that are IMPLIED by the line items that ARE already present — " +
          "things a careful reviewer would catch because they commonly accompany, enable, or protect work already scoped. " +
          "Examples of the kind of gap to flag: insulation present but no vapour barrier/air-sealing line; painting present but no surface prep/patching/priming line; drywall present but no taping/mudding line. " +
          "Return AT MOST 3 gaps, and ONLY if you have genuine confidence they are relevant GIVEN WHAT IS ALREADY THERE. " +
          "Return FEWER (including zero) rather than padding to reach 3 — an empty array is the correct answer when nothing genuinely implied is missing. " +
          "Each gap must be a single short clause that JUSTIFIES the flag by tying it to what is already in the estimate " +
          "(e.g. \"Insulation is present but no vapour barrier — commonly paired to control moisture\" rather than just \"Vapour barrier\"). " +
          "Do not include any other text.",
        messages: [{
          role: "user",
          content:
            `Project: ${projectName ?? "Unknown"}\n` +
            `Cost categories already in the estimate: ${presentCategories.length > 0 ? presentCategories.join(", ") : "none"}.\n\n` +
            "This is a partial, in-progress estimate. Given ONLY the categories already present above, what specific, non-obvious scope gaps are implied by the existing line items? " +
            "Do not list trades that are simply absent and could be added later. Only flag gaps that the existing line items imply should already be here. At most 3, fewer if you are not confident.",
        }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const missing: unknown = parsed.missing;
    if (!Array.isArray(missing)) return null;
    const messages = missing
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      .map((m) => m.trim())
      .slice(0, 3);
    return messages;
  } catch {
    return null;
  }
}
