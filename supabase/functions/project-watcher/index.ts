import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WatcherAlertInsert {
  project_id: number;
  category: "money" | "risk" | "decision" | "commitment";
  title: string;
  description: string | null;
  suggested_action: string | null;
  source_type: string;
  source_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    let body: { check?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine — run all checks
    }
    const requested = body.check ?? "all";
    const runAll = requested === "all";

    const summary = {
      check_a: 0,
      check_b: 0,
      check_c: 0,
      skipped_anthropic: false,
      errors: [] as string[],
    };

    // Resolve last run time for Check C (before we update it)
    const { data: runRow } = await db
      .from("watcher_runs")
      .select("last_run_at")
      .eq("id", 1)
      .maybeSingle();
    const lastRunAt: string | null = runRow?.last_run_at ?? null;

    // -------------------------------------------------------
    // Idempotency helper: skip if a non-dismissed alert exists
    // -------------------------------------------------------
    async function alertExists(sourceType: string, sourceId: string): Promise<boolean> {
      const { count } = await db
        .from("watcher_alerts")
        .select("id", { count: "exact", head: true })
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .neq("status", "dismissed");
      return (count ?? 0) > 0;
    }

    async function insertAlert(a: WatcherAlertInsert): Promise<boolean> {
      if (await alertExists(a.source_type, a.source_id)) return false;
      const { error } = await db.from("watcher_alerts").insert(a);
      if (error) {
        summary.errors.push(`insert ${a.source_type}:${a.source_id} — ${error.message}`);
        return false;
      }
      return true;
    }

    // -------------------------------------------------------
    // Check A — Unresolved estimate warnings older than 3 days
    // -------------------------------------------------------
    if (runAll || requested === "A") {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: warnings, error: wErr } = await db
        .from("estimate_warnings")
        .select(`
          id,
          warning_type,
          message,
          percent_diff,
          estimate_item_id,
          estimate_items (
            id,
            room,
            custom_category,
            category_id,
            cost_categories ( name ),
            estimate_id,
            project_estimates (
              id,
              project_id,
              name
            )
          )
        `)
        .eq("ignored", false)
        .lt("created_at", threeDaysAgo);

      if (wErr) {
        summary.errors.push(`Check A query: ${wErr.message}`);
      } else if (warnings) {
        for (const w of warnings) {
          const item = w.estimate_items as any;
          if (!item) continue;
          const est = item.project_estimates as any;
          if (!est) continue;
          const catName = (item.cost_categories as any)?.name ?? item.custom_category ?? "item";
          const inserted = await insertAlert({
            project_id: est.project_id,
            category: "money",
            title: `Unresolved estimate warning: ${catName}`,
            description: `${w.message}${w.percent_diff ? ` (variance ${w.percent_diff}%)` : ""}${item.room ? ` — room: ${item.room}` : ""}`,
            suggested_action: "Review the estimate line item and either adjust the price or acknowledge the warning.",
            source_type: "estimate_warning",
            source_id: String(w.id),
          });
          if (inserted) summary.check_a++;
        }
      }
    }

    // -------------------------------------------------------
    // Check B — Stale change orders (draft/sent, older than 5 days)
    // -------------------------------------------------------
    if (runAll || requested === "B") {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data: orders, error: oErr } = await db
        .from("change_orders")
        .select("id, number, title, status, project_id, amount, created_at")
        .in("status", ["draft", "sent"])
        .lt("created_at", fiveDaysAgo);

      if (oErr) {
        summary.errors.push(`Check B query: ${oErr.message}`);
      } else if (orders) {
        for (const co of orders) {
          const inserted = await insertAlert({
            project_id: co.project_id,
            category: "money",
            title: `Stale change order #${co.number}: ${co.title}`,
            description: `Change order #${co.number} (${co.title}) has been in "${co.status}" status for over 5 days. Amount: ${co.amount}.`,
            suggested_action: `Follow up with client on change order #${co.number}.`,
            source_type: "change_order",
            source_id: String(co.id),
          });
          if (inserted) summary.check_b++;
        }
      }
    }

    // -------------------------------------------------------
    // Check C — Possible unpriced work requests in messages
    // -------------------------------------------------------
    if (runAll || requested === "C") {
      const since = lastRunAt
        ? lastRunAt
        : new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      const { data: messages, error: mErr } = await db
        .from("messages")
        .select("id, project_id, sender_id, content, created_at")
        .gt("created_at", since)
        .order("created_at", { ascending: true });

      if (mErr) {
        summary.errors.push(`Check C query: ${mErr.message}`);
      } else if (messages && messages.length > 0) {
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

        if (!anthropicKey) {
          summary.skipped_anthropic = true;
        } else {
          for (const msg of messages) {
            const classification = await classifyMessage(msg.content, anthropicKey);
            if (!classification || !classification.is_scope_request) continue;

            // Check for an existing change_order within 5 days after the message
          const fiveDaysAfter = new Date(
              new Date(msg.created_at).getTime() + 5 * 24 * 60 * 60 * 1000,
            ).toISOString();
            const { count } = await db
              .from("change_orders")
              .select("id", { count: "exact", head: true })
              .eq("project_id", msg.project_id)
              .gte("created_at", msg.created_at)
              .lte("created_at", fiveDaysAfter);

            if ((count ?? 0) > 0) continue; // a CO was already created

            const inserted = await insertAlert({
              project_id: msg.project_id,
              category: "money",
              title: "Possible unpriced work request in client message",
              description: classification.description ?? "Client message may contain a request for additional work or scope.",
              suggested_action: "Review this request and determine whether a change order is needed.",
              source_type: "message",
              source_id: String(msg.id),
            });
            if (inserted) summary.check_c++;
          }
        }
      }
    }

    // Update last run time
    await db
      .from("watcher_runs")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({ ok: true, ...summary }), {
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
// Anthropic classifier — strict JSON, narrow prompt
// -------------------------------------------------------
async function classifyMessage(
  content: string,
  apiKey: string,
): Promise<{ is_scope_request: boolean; description: string | null } | null> {
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
        max_tokens: 256,
        system:
          "You are a construction project scope classifier. " +
          "You ONLY output strict JSON. " +
          "Determine whether the user's message contains a client request for additional work, material, or scope that is not obviously part of existing project content. " +
          'Respond with exactly: {"is_scope_request": boolean, "description": string|null}. ' +
          "If is_scope_request is true, description must be one sentence summarizing the request. " +
          "If false, description must be null. Do not include any other text.",
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      is_scope_request: !!parsed.is_scope_request,
      description: parsed.description ?? null,
    };
  } catch {
    return null;
  }
}
