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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function syncToFrontDoor(payload: ElmSyncPayload): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[elmSync] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set — sync skipped');
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ source: 'elm', ...payload }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[elmSync] sync-intake returned', res.status, text);
    }
  } catch (err) {
    console.error('[elmSync] sync failed:', err);
  }
}
