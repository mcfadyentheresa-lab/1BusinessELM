import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EstimateItem {
  id: number;
  category_id: number | null;
  custom_category: string | null;
  room: string | null;
  quantity: string;
  unit_type: string;
  unit_cost: string;
  material_cost: string;
  notes: string | null;
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

    // --- Auth: verify JWT + admin role (identical to estimate-auditor) ---
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
      .select("id, category_id, custom_category, room, quantity, unit_type, unit_cost, material_cost, notes, cost_categories(name)")
      .eq("estimate_id", estimateId);
    if (itemsErr) throw itemsErr;
    const estimateItems: EstimateItem[] = (items ?? []) as unknown as EstimateItem[];

    // --- 3. Run AI clarity check ---
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let aiParseFailed = false;
    const flags: { item_reference: string; issue: string }[] = [];

    if (anthropicKey && estimateItems.length > 0) {
      const result = await runClientClarityCheck(anthropicKey, estimateItems);
      if (result === null) {
        aiParseFailed = true;
      } else {
        flags.push(...result);
      }
    }

    // --- 4. Match flags to estimate_items, build warning inserts ---
    const warningInserts: {
      estimate_item_id: number | null;
      estimate_id: number | null;
      warning_type: string;
      message: string;
      percent_diff: string | null;
      source: string;
    }[] = [];

    for (const flag of flags) {
      const matchedItem = matchItemToFlag(estimateItems, flag.item_reference);
      if (matchedItem) {
        warningInserts.push({
          estimate_item_id: matchedItem.id,
          estimate_id: estimateId,
          warning_type: "unclear_scope",
          message: flag.issue,
          percent_diff: null,
          source: "client_review",
        });
      } else {
        warningInserts.push({
          estimate_item_id: null,
          estimate_id: estimateId,
          warning_type: "unclear_scope",
          message: `[${flag.item_reference}] ${flag.issue}`,
          percent_diff: null,
          source: "client_review",
        });
      }
    }

    // --- 5. Delete existing non-ignored client_review warnings for this estimate ---
    await db
      .from("estimate_warnings")
      .delete()
      .eq("estimate_id", estimateId)
      .eq("source", "client_review")
      .eq("ignored", false);

    // Also delete item-level client_review warnings for items in this estimate
    const itemIds = estimateItems.map((i) => i.id);
    if (itemIds.length > 0) {
      await db
        .from("estimate_warnings")
        .delete()
        .in("estimate_item_id", itemIds)
        .eq("source", "client_review")
        .eq("ignored", false);
    }

    // --- 6. Insert new warnings ---
    let insertedRows: any[] = [];
    if (warningInserts.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from("estimate_warnings")
        .insert(warningInserts as any)
        .select("id, estimate_item_id, estimate_id, warning_type, message, percent_diff, ignored, source");
      if (insertErr) throw insertErr;
      insertedRows = inserted ?? [];
    }

    await db
      .from("project_estimates")
      .update({ last_client_reviewed_at: new Date().toISOString() })
      .eq("id", estimateId);

    return new Response(JSON.stringify({
      warnings: insertedRows,
      count: insertedRows.length,
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
// Client clarity check via Anthropic (claude-haiku-4-5)
// Reviews line items from a CLIENT's perspective —
// checks whether a client would understand what they're paying for.
// Returns array of flags, or null if parse fails.
// -------------------------------------------------------
async function runClientClarityCheck(
  apiKey: string,
  items: EstimateItem[],
): Promise<{ item_reference: string; issue: string }[] | null> {
  try {
    const itemList = items.map((i) => {
      const catName = i.cost_categories?.name ?? i.custom_category ?? "(uncategorized)";
      const room = i.room ?? "(no room)";
      const notes = i.notes ?? "(none)";
      const qty = i.quantity ?? "?";
      const unit = i.unit_type ?? "?";
      return `- ${catName} | Room: ${room} | Qty: ${qty} ${unit} | Notes: ${notes}`;
    }).join("\n");

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
          "You are reviewing a contractor's estimate line items from the perspective of a CLIENT " +
          "who is reading this estimate to understand what they are paying for. " +
          "You are NOT checking whether prices are correct — ignore pricing entirely. " +
          "You are checking whether a client would understand exactly what work is included in each line item " +
          "based on its category name, room, and notes. " +
          "You ONLY output strict JSON. " +
          'Respond with exactly: {"unclear_items": [{"item_reference": "short description identifying the item by room + category", "issue": "one clause explaining what is ambiguous"}]}. ' +
          "IMPORTANT RULES:\n" +
          "1. Only flag items that are genuinely UNCLEAR as written — where a client would not know what they're paying for.\n" +
          "   Examples of genuinely unclear: a bare category+room with no notes explaining scope; " +
          "wording that leaves it ambiguous whether labour, materials, delivery, or disposal are included; " +
          "a vague custom category name that doesn't describe the actual work.\n" +
          "2. Do NOT flag items that are simply short but clear — e.g. \"Insulation, attic, 5601 sq ft\" is fine " +
          "if it's an otherwise well-defined trade with a clear category name. Short is not the same as unclear.\n" +
          "3. This is a PARTIAL, in-progress estimate — do NOT flag missing line items or entire trades that are absent. " +
          "Only flag unclear wording on items that DO exist.\n" +
          "4. Cap: at most 3 flags. Return FEWER (including zero) rather than padding. " +
          'An empty array {"unclear_items": []} is the correct answer when everything is clear.\n' +
          "5. Each flag must reference the SPECIFIC line item by its room + category name, " +
          "and explain in one clause what is ambiguous about it.\n" +
          "Do not include any other text.",
        messages: [{
          role: "user",
          content:
            "Below are the line items in this estimate. Review each one from a client's perspective " +
            "and flag only those where a client would genuinely not understand what they're paying for.\n\n" +
            itemList,
        }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const unclear: unknown = parsed.unclear_items;
    if (!Array.isArray(unclear)) return null;
    const valid = unclear
      .filter((u): u is { item_reference: string; issue: string } =>
        typeof u === "object" && u !== null &&
        typeof (u as any).item_reference === "string" &&
        typeof (u as any).issue === "string"
      )
      .map((u) => ({ item_reference: u.item_reference.trim(), issue: u.issue.trim() }))
      .slice(0, 3);
    return valid;
  } catch {
    return null;
  }
}

// -------------------------------------------------------
// Best-effort matching: match an AI-returned item_reference
// string back to a real estimate_item by room + category.
// -------------------------------------------------------
function matchItemToFlag(
  items: EstimateItem[],
  itemReference: string,
): EstimateItem | null {
  const ref = itemReference.toLowerCase();

  // Strategy 1: exact room + category name match
  for (const item of items) {
    const catName = (item.cost_categories?.name ?? item.custom_category ?? "").toLowerCase();
    const room = (item.room ?? "").toLowerCase();
    if (room && catName && ref.includes(room) && ref.includes(catName)) {
      return item;
    }
  }

  // Strategy 2: room match only (if reference mentions a specific room)
  for (const item of items) {
    const room = (item.room ?? "").toLowerCase();
    if (room && ref.includes(room)) {
      return item;
    }
  }

  // Strategy 3: category name match only
  for (const item of items) {
    const catName = (item.cost_categories?.name ?? item.custom_category ?? "").toLowerCase();
    if (catName && ref.includes(catName)) {
      return item;
    }
  }

  // Strategy 4: partial category match (first word of category)
  for (const item of items) {
    const catName = (item.cost_categories?.name ?? item.custom_category ?? "").toLowerCase();
    if (catName) {
      const firstWord = catName.split(/\s+/)[0];
      if (firstWord.length > 3 && ref.includes(firstWord)) {
        return item;
      }
    }
  }

  return null;
}
