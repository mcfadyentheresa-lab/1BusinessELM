import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ElmProject {
  id: string;
  title: string;
  status: string;
  deadline?: string | null;
  priority?: number | null;
}

interface SyncPayload {
  source: string;
  projects: ElmProject[];
  pendingReviewCount: number;
  priorityTaskTitle?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Connect to the Front Door shared project using server-side secrets
    const frontDoorUrl = Deno.env.get("FRONT_DOOR_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!frontDoorUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "FRONT_DOOR_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const db = createClient(frontDoorUrl, serviceRoleKey);

    // Resolve caller's user_id from the ELM JWT
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const elmClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceRoleKey,
      );
      const { data } = await elmClient.auth.getUser(authHeader.slice(7));
      userId = data.user?.id ?? null;
    }

    const body: SyncPayload = await req.json();
    const { projects, pendingReviewCount, priorityTaskTitle } = body;

    const activeStatuses = ["active", "in_progress", "scheduled"];
    const activeProjects = projects.filter((p) => activeStatuses.includes(p.status));

    const sorted = [...activeProjects].sort((a, b) => {
      if (a.priority != null && b.priority != null) return a.priority - b.priority;
      if (a.priority != null) return -1;
      if (b.priority != null) return 1;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

    const priorityProject = sorted[0] ?? null;
    const withDeadline = activeProjects
      .filter((p) => p.deadline)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
    const nextDeadline = withDeadline[0] ?? null;
    const upcomingDeadlines = withDeadline.slice(0, 5).map((p) => ({ title: p.title, date: p.deadline! }));

    // elm_state upsert
    const elmStatePayload = {
      active_project_count: activeProjects.length,
      priority_project: priorityProject?.title ?? null,
      next_deadline_title: nextDeadline?.title ?? null,
      next_deadline_date: nextDeadline?.deadline ?? null,
      pending_review_count: pendingReviewCount,
      updated_at: new Date().toISOString(),
    };
    const elmStateQuery = userId
      ? db.from("elm_state").select("id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : db.from("elm_state").select("id").is("user_id", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const { data: existingElmState } = await elmStateQuery;
    if (existingElmState) {
      await db.from("elm_state").update(elmStatePayload).eq("id", existingElmState.id);
    } else {
      await db.from("elm_state").insert({ ...elmStatePayload, user_id: userId });
    }

    // daily_items upsert
    const today = new Date().toISOString().split("T")[0];
    const items = priorityTaskTitle
      ? [{ id: "priority-task", title: priorityTaskTitle }]
      : sorted.slice(0, 3).map((p) => ({ id: p.id, title: `Work on: ${p.title}` }));
    await Promise.all(
      items.map(async (item, idx) => {
        const sourceId = `elm-${item.id.slice(0, 16)}-${today}`;
        const { data: existing } = await db.from("daily_items").select("id").eq("source_id", sourceId).maybeSingle();
        if (existing) return;
        await db.from("daily_items").insert({
          source_app: "elm",
          source_id: sourceId,
          title: item.title,
          domain: "work",
          priority: idx + 1,
          energy_fit: "high",
          estimated_minutes: 60,
          due_today: true,
          scheduled_date: today,
          completion_state: "pending",
          is_hero: idx === 0,
          display_order: 20 + idx,
          user_id: userId,
        });
      }),
    );

    // context_snapshot insert
    await db.from("context_snapshots").insert({
      energy_level: "medium",
      weekly_focus: "Project delivery",
      capacity: "full",
      stress_level: "normal",
      upcoming_deadlines: upcomingDeadlines,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[sync-intake]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
