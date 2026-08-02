import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SuggestedCategory {
  category_id: number;
  reason: string;
  quantity?: number | null;
  quantity_source?: string | null;
}

interface AssemblyWithMaterials {
  id: number;
  name: string;
  category_id: number;
  assembly_materials: Array<{
    qty_per_sqft: string;
    unit_cost: string;
    waste_pct: string;
  }>;
}

interface UploadedFileRef {
  url: string;
  mime_type: string;
  name: string;
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
    let body: { project_id?: number; files?: UploadedFileRef[] } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const projectId = body.project_id;
    if (!projectId || typeof projectId !== "number") {
      return new Response(JSON.stringify({ error: "project_id (number) is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uploadedFiles = Array.isArray(body.files) ? body.files : [];

    // --- 1. Fetch the project ---
    const { data: project, error: projErr } = await db
      .from("projects")
      .select("id, name, description, address, city")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr) throw projErr;
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 2. Fetch ALL cost_categories ---
    const { data: categories, error: catErr } = await db
      .from("cost_categories")
      .select("id, name, default_unit_type")
      .order("id");
    if (catErr) throw catErr;
    const validCategoryIds = new Set((categories ?? []).map((c: any) => c.id));
    const categoryNameById = new Map((categories ?? []).map((c: any) => [c.id, c.name]));

    // --- 3. Fetch ALL active market_rates ---
    const { data: rates, error: ratesErr } = await db
      .from("market_rates")
      .select("category_id, unit_type, low_rate, high_rate, typical_rate")
      .eq("is_active", true);
    if (ratesErr) throw ratesErr;
    const rateByCategory = new Map<number, any>();
    for (const r of rates ?? []) {
      if (!rateByCategory.has(r.category_id)) rateByCategory.set(r.category_id, r);
    }

    // --- 4. Fetch ALL active estimate_assemblies with assembly_materials ---
    const { data: assemblies, error: asmErr } = await db
      .from("estimate_assemblies")
      .select("id, name, category_id, assembly_materials(qty_per_sqft, unit_cost, waste_pct)")
      .eq("is_active", true);
    if (asmErr) throw asmErr;
    const assembliesByCategory = new Map<number, Array<{ id: number; name: string; material_cost_per_unit: number }>>();
    for (const asm of (assemblies ?? []) as unknown as AssemblyWithMaterials[]) {
      const materialCostPerUnit = (asm.assembly_materials ?? []).reduce((sum, m) => {
        const qty = parseFloat(m.qty_per_sqft) || 0;
        const cost = parseFloat(m.unit_cost) || 0;
        const waste = parseFloat(m.waste_pct) || 0;
        return sum + qty * cost * (1 + waste / 100);
      }, 0);
      const rounded = Math.round(materialCostPerUnit * 100) / 100;
      const arr = assembliesByCategory.get(asm.category_id) ?? [];
      arr.push({ id: asm.id, name: asm.name, material_cost_per_unit: rounded });
      assembliesByCategory.set(asm.category_id, arr);
    }

    // --- 5. Run AI call to suggest categories ---
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let aiSuggestions: SuggestedCategory[] = [];
    let aiParseFailed = false;

    if (anthropicKey) {
      const result = await suggestCategories(anthropicKey, project, categories ?? [], uploadedFiles);
      if (result === null) {
        aiParseFailed = true;
      } else {
        aiSuggestions = result;
      }
    }

    // --- 6. Validate + enrich each suggestion ---
    const suggestions = aiSuggestions
      .filter((s) => validCategoryIds.has(s.category_id))
      .slice(0, 10)
      .map((s) => {
        const categoryId = s.category_id;
        const categoryName = categoryNameById.get(categoryId) ?? "Unknown";
        const rate = rateByCategory.get(categoryId);
        const asms = assembliesByCategory.get(categoryId) ?? [];
        const hasRate = !!rate;
        const hasAssemblies = asms.length > 0;
        const hasQuantity = typeof s.quantity === "number" && s.quantity > 0;
        return {
          category_id: categoryId,
          category_name: categoryName,
          reason: s.reason,
          unit_type: rate?.unit_type ?? null,
          market_rate: hasRate
            ? { typical: rate.typical_rate, low: rate.low_rate, high: rate.high_rate }
            : null,
          assemblies: hasAssemblies ? asms : [],
          no_rate_data: !hasRate && !hasAssemblies,
          quantity: hasQuantity ? s.quantity! : null,
          quantity_source: hasQuantity ? (s.quantity_source ?? null) : null,
        };
      });

    return new Response(JSON.stringify({ suggestions, ai_parse_failed: aiParseFailed }), {
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
// AI category suggestion via Anthropic (claude-haiku-4-5)
// Returns array of {category_id, reason, quantity?, quantity_source?}, or null if parse fails.
// When files are provided, media content blocks are included and the prompt
// instructs the model to extract real quantities from the documents/images.
// When no files are provided, behavior is identical to the original (text-only, no quantities).
// -------------------------------------------------------
async function suggestCategories(
  apiKey: string,
  project: { name: string; description: string | null; address: string | null; city: string | null },
  categories: Array<{ id: number; name: string; default_unit_type: string }>,
  files: UploadedFileRef[],
): Promise<SuggestedCategory[] | null> {
  try {
    const categoryList = categories
      .map((c) => `${c.id}: ${c.name} (${c.default_unit_type})`)
      .join("\n");

    const projectDescription = [
      `Name: ${project.name}`,
      project.description ? `Description: ${project.description}` : null,
      project.address ? `Address: ${project.address}` : null,
      project.city ? `City: ${project.city}` : null,
    ].filter(Boolean).join("\n");

    const hasFiles = files.length > 0;

    const systemPrompt = hasFiles
      ? "You are a construction cost estimating expert. Given a project name, description, and uploaded plans/measurements (images and/or PDFs), you suggest which cost categories from a provided list are likely relevant to this project AND extract real quantities from the uploaded materials. " +
        "This is a STARTING POINT for a human estimator to edit — it is NOT a final estimate. " +
        "CRITICAL RULES:\n" +
        "1. You may ONLY suggest categories from the provided list. NEVER invent a new category name or id.\n" +
        "2. When uploaded files are provided, extract real measurements/quantities ONLY from what is visibly and legibly present in the provided images/documents. Tie each extracted quantity to a specific category suggestion. The quantity must be a number (e.g. square footage, linear footage, unit count).\n" +
        "3. NEVER estimate, guess, or fabricate a quantity that is not legible/derivable from the actual provided material. If a category is relevant but no quantity is visible in the files, set quantity to null and quantity_source to null.\n" +
        "4. For each quantity-bearing suggestion, include a quantity_source field set to the source file name (e.g. \"extracted from uploaded file: floor-plan.pdf\").\n" +
        "5. Return categories in priority order (most relevant first), up to 10 for a full renovation.\n" +
        "6. If the project has no description or details to reason from, return an EMPTY array. Do NOT pad with generic categories — returning fewer or zero is correct when you lack information.\n" +
        "7. Each reason must be one short clause explaining why this category fits the project.\n" +
        'Output ONLY strict JSON: {"suggested_categories": [{"category_id": <number from the list>, "reason": "<one short clause>", "quantity": <number or null>, "quantity_source": "<source file name or null>"}]}. ' +
        "Do not include any other text."
      : "You are a construction cost estimating expert. Given a project name and description, you suggest which cost categories from a provided list are likely relevant to this project. " +
        "This is a STARTING POINT for a human estimator to edit — it is NOT a final estimate. " +
        "CRITICAL RULES:\n" +
        "1. You may ONLY suggest categories from the provided list. NEVER invent a new category name or id.\n" +
        "2. Do NOT guess quantities, square footage, room counts, or any measurement. That information is not available and must not be fabricated.\n" +
        "3. Return categories in priority order (most relevant first), up to 10 for a full renovation.\n" +
        "4. If the project has no description or details to reason from, return an EMPTY array. Do NOT pad with generic categories — returning fewer or zero is correct when you lack information.\n" +
        "5. Each reason must be one short clause explaining why this category fits the project.\n" +
        'Output ONLY strict JSON: {"suggested_categories": [{"category_id": <number from the list>, "reason": "<one short clause>"}]}. ' +
        "Do not include any other text.";

    // Build media content blocks (images/documents first, text last)
    const contentBlocks: Array<Record<string, any>> = [];

    for (const file of files) {
      if (file.mime_type === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "url", url: file.url },
        });
      } else if (
        file.mime_type === "image/jpeg" ||
        file.mime_type === "image/jpg" ||
        file.mime_type === "image/png" ||
        file.mime_type === "image/webp" ||
        file.mime_type === "image/gif"
      ) {
        contentBlocks.push({
          type: "image",
          source: { type: "url", url: file.url },
        });
      }
    }

    const textPrompt =
      `Available cost categories (id: name (unit_type)):\n${categoryList}\n\n` +
      `Project:\n${projectDescription}\n\n` +
      (hasFiles
        ? `Uploaded files: ${files.map((f) => f.name).join(", ")}\n\n` +
          "Which of these categories are likely relevant to this project? " +
          "For each category, extract any real quantity visible in the uploaded files (dimensions, areas, counts). " +
          "Only include a quantity if it is directly legible from the uploaded material. " +
          "Set quantity_source to the file name where the quantity was found. " +
          "If a category is relevant but no quantity is visible, set quantity to null. " +
          "Remember: only use category ids from the list above, never guess quantities, and return an empty array if there is not enough project information to make a confident suggestion."
        : "Which of these categories are likely relevant to this project? Remember: only use category ids from the list above, do not guess quantities, and return an empty array if there is not enough project information to make a confident suggestion.");

    contentBlocks.push({ type: "text", text: textPrompt });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: hasFiles ? 2048 : 1024,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: contentBlocks,
        }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const suggested: unknown = parsed.suggested_categories;
    if (!Array.isArray(suggested)) return null;
    return suggested
      .filter((s: any) => typeof s === "object" && s !== null && typeof s.category_id === "number" && typeof s.reason === "string")
      .map((s: any) => {
        const result: SuggestedCategory = { category_id: s.category_id, reason: s.reason.trim() };
        if (hasFiles) {
          if (typeof s.quantity === "number" && s.quantity > 0) {
            result.quantity = s.quantity;
            result.quantity_source = typeof s.quantity_source === "string" ? s.quantity_source.trim() : null;
          } else {
            result.quantity = null;
            result.quantity_source = null;
          }
        }
        return result;
      })
      .slice(0, 10);
  } catch {
    return null;
  }
}
