import { useCallback } from "react";

const STORAGE_KEY = "asl-recent-projects";
const MAX_RECENT = 10;

interface RecentProject {
  projectId: number;
  boardId?: number;
  visitedAt: string;
}

function loadRecent(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentProject[];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function useRecentProjects() {
  const trackProject = useCallback((projectId: number, boardId?: number) => {
    const existing = loadRecent().filter((r) => r.projectId !== projectId);
    const next: RecentProject[] = [
      { projectId, boardId, visitedAt: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX_RECENT);
    saveRecent(next);
  }, []);

  const getRecent = useCallback((): RecentProject[] => {
    return loadRecent();
  }, []);

  return { trackProject, getRecent };
}
