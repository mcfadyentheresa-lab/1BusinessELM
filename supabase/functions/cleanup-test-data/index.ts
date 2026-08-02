import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const frontDoorUrl = Deno.env.get("FRONT_DOOR_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!frontDoorUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "FRONT_DOOR_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const db = createClient(frontDoorUrl, serviceRoleKey);
    const errors: string[] = [];

    const identifyTestSnapshot = (s: any): boolean => {
      try {
        const deadlines = typeof s.upcoming_deadlines === "string"
          ? JSON.parse(s.upcoming_deadlines)
          : s.upcoming_deadlines;
        return Array.isArray(deadlines) &&
          deadlines.some((d: any) => d?.title === "Verification Test Project");
      } catch { return false; }
    };

    // === PHASE 1: Query before deletion ===

    const { data: elmStateBefore, error: e1 } = await db
      .from("elm_state").select("*").is("user_id", null);
    if (e1) errors.push(`elm_state query_before: ${e1.message}`);

    const { data: dailyItemsBefore, error: e2 } = await db
      .from("daily_items").select("*").eq("source_app", "elm").ilike("title", "%Test priority task%");
    if (e2) errors.push(`daily_items query_before: ${e2.message}`);

    const { data: allSnapshotsBefore, error: e3 } = await db
      .from("context_snapshots").select("*");
    if (e3) errors.push(`context_snapshots query_before: ${e3.message}`);

    const testSnapshotsBefore = (allSnapshotsBefore || []).filter(identifyTestSnapshot);

    // === PHASE 2: Delete test rows ===

    const { data: delElm, error: de1 } = await db
      .from("elm_state").delete().is("user_id", null).select("*");
    if (de1) errors.push(`elm_state delete: ${de1.message}`);

    const { data: delDaily, error: de2 } = await db
      .from("daily_items").delete().eq("source_app", "elm").ilike("title", "%Test priority task%").select("*");
    if (de2) errors.push(`daily_items delete: ${de2.message}`);

    let delSnapshots: any[] = [];
    if (testSnapshotsBefore.length > 0) {
      const ids = testSnapshotsBefore.map((s: any) => s.id).filter((id: any) => id != null);
      if (ids.length > 0) {
        const { data, error } = await db
          .from("context_snapshots").delete().in("id", ids).select("*");
        if (error) errors.push(`context_snapshots delete: ${error.message}`);
        delSnapshots = data || [];
      } else {
        errors.push("context_snapshots: test rows have no id column, cannot delete by id");
      }
    }

    // === PHASE 3: Re-query to confirm ===

    const { data: elmStateAfter, error: ae1 } = await db
      .from("elm_state").select("*").is("user_id", null);
    if (ae1) errors.push(`elm_state query_after: ${ae1.message}`);

    const { data: dailyItemsAfter, error: ae2 } = await db
      .from("daily_items").select("*").eq("source_app", "elm").ilike("title", "%Test priority task%");
    if (ae2) errors.push(`daily_items query_after: ${ae2.message}`);

    const { data: allSnapshotsAfter, error: ae3 } = await db
      .from("context_snapshots").select("*");
    if (ae3) errors.push(`context_snapshots query_after: ${ae3.message}`);
    const testSnapshotsAfter = (allSnapshotsAfter || []).filter(identifyTestSnapshot);

    return new Response(JSON.stringify({
      before: {
        elm_state: { count: elmStateBefore?.length ?? 0, rows: elmStateBefore },
        daily_items: { count: dailyItemsBefore?.length ?? 0, rows: dailyItemsBefore },
        context_snapshots: {
          total_count: allSnapshotsBefore?.length ?? 0,
          test_count: testSnapshotsBefore.length,
          test_rows: testSnapshotsBefore,
        },
      },
      deleted: {
        elm_state: { count: delElm?.length ?? 0, rows: delElm },
        daily_items: { count: delDaily?.length ?? 0, rows: delDaily },
        context_snapshots: { count: delSnapshots.length, rows: delSnapshots },
      },
      after: {
        elm_state: { count: elmStateAfter?.length ?? 0, rows: elmStateAfter },
        daily_items: { count: dailyItemsAfter?.length ?? 0, rows: dailyItemsAfter },
        context_snapshots: {
          total_count: allSnapshotsAfter?.length ?? 0,
          test_count: testSnapshotsAfter.length,
        },
      },
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
