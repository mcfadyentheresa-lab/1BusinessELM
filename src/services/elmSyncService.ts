import { supabase } from '@/lib/supabase';

export interface ElmProject {
  id: string;
  title: string;
  status: string;
  deadline?: string | null;
  priority?: number | null;
}

export interface ElmSyncPayload {
  projects: ElmProject[];
  pendingReviewCount: number;
  priorityTaskTitle?: string;
}

export async function syncToFrontDoor(payload: ElmSyncPayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const activeProjects = payload.projects.filter((p) => ['active', 'in_progress', 'scheduled'].includes(p.status));
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
    const withDeadline = activeProjects.filter((p) => p.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
    const nextDeadline = withDeadline[0] ?? null;
    const upcomingDeadlines = withDeadline.slice(0, 5).map((p) => ({ title: p.title, date: p.deadline! }));
    await Promise.all([
      upsertElmState(userId, activeProjects.length, priorityProject?.title ?? null, nextDeadline?.title ?? null, nextDeadline?.deadline ?? null, payload.pendingReviewCount),
      upsertDailyItems(sorted.slice(0, 3), payload.priorityTaskTitle ?? null, userId),
      upsertContextSnapshot(upcomingDeadlines),
    ]);
  } catch (err) {
    console.error('[elmSync] sync failed:', err);
  }
}

async function upsertElmState(userId: string | null, activeProjectCount: number, priorityProject: string | null, nextDeadlineTitle: string | null, nextDeadlineDate: string | null, pendingReviewCount: number) {
  const payload = { active_project_count: activeProjectCount, priority_project: priorityProject, next_deadline_title: nextDeadlineTitle, next_deadline_date: nextDeadlineDate, pending_review_count: pendingReviewCount, updated_at: new Date().toISOString() };
  const query = userId
    ? supabase.from('elm_state').select('id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    : supabase.from('elm_state').select('id').is('user_id', null).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  const { data: existing } = await query;
  if (existing) { await supabase.from('elm_state').update(payload).eq('id', existing.id); }
  else { await supabase.from('elm_state').insert({ ...payload, user_id: userId }); }
}

async function upsertDailyItems(topProjects: ElmProject[], priorityTaskTitle: string | null, userId: string | null) {
  const today = new Date().toISOString().split('T')[0];
  const items = priorityTaskTitle
    ? [{ id: 'priority-task', title: priorityTaskTitle }]
    : topProjects.map((p) => ({ id: p.id, title: `Work on: ${p.title}` }));
  await Promise.all(items.map(async (item, idx) => {
    const sourceId = `elm-${item.id.slice(0, 16)}-${today}`;
    const { data: existing } = await supabase.from('daily_items').select('id, completion_state').eq('source_id', sourceId).maybeSingle();
    if (existing) return;
    await supabase.from('daily_items').insert({ source_app: 'elm', source_id: sourceId, title: item.title, domain: 'work', priority: idx + 1, energy_fit: 'high', estimated_minutes: 60, due_today: true, scheduled_date: today, completion_state: 'pending', is_hero: idx === 0, display_order: 20 + idx, user_id: userId });
  }));
}

async function upsertContextSnapshot(upcomingDeadlines: Array<{ title: string; date: string }>) {
  await supabase.from('context_snapshots').insert({ energy_level: 'medium', weekly_focus: 'Project delivery', capacity: 'full', stress_level: 'normal', upcoming_deadlines: upcomingDeadlines });
}
