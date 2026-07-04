import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json, Photo, PlanningBoard, BoardSnapshot } from "@/shared/database.types";
import type {
  PlanningBoardPatch,
  MilestonePatch,
  SubMilestonePatch,
  CalendarEventPatch,
  ProjectPatch,
  BoardSnapshotPatch,
} from "@/lib/mappers";

// ── Planning Board CRUD ────────────────────────────────────────────────────

export function useCreatePlanningBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, name, mode }: { projectId: number; name: string; mode?: string }) => {
      const { data, error } = await supabase
        .from("planning_boards")
        .insert({ project_id: projectId, name, mode: mode ?? "design" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["planning-boards", vars.projectId] });
    },
  });
}

export function useUpdatePlanningBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, notifyUsers: _notify, ...patch }: {
      id: number;
      projectId?: number;
      name?: string;
      canvas_data?: Json;
      linked_milestone_id?: number | null;
      linked_checklist_item_id?: number | null;
      linked_calendar_event_id?: number | null;
      linked_user_ids?: string[] | null;
      linked_project_ids?: number[] | null;
      color_tag_id?: number | null;
      notifyUsers?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("planning_boards")
        .update(patch as PlanningBoardPatch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      if (vars.projectId) {
        qc.invalidateQueries({ queryKey: ["planning-boards", vars.projectId] });
      }
    },
  });
}

export function useDeletePlanningBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const { error } = await supabase.from("planning_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["planning-boards", vars.projectId] });
    },
  });
}

// ── Users ──────────────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Projects ───────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Milestones ─────────────────────────────────────────────────────────────

export function useMilestones(projectId: number) {
  return useQuery({
    queryKey: ["milestones", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*, sub_milestones(*)")
        .eq("project_id", projectId)
        .order("order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, title, date }: { projectId: number; title: string; date?: string }) => {
      const { data, error } = await supabase
        .from("milestones")
        .insert({ project_id: projectId, title, date: date ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.projectId] });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, ...patch }: { id: number; projectId: number; completed?: boolean; title?: string; date?: string; color_hex?: string }) => {
      const { error } = await supabase.from("milestones").update(patch as MilestonePatch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.projectId] });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.projectId] });
    },
  });
}

export function useCreateSubMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ milestoneId, projectId, title }: { milestoneId: number; projectId: number; title: string }) => {
      const { data, error } = await supabase
        .from("sub_milestones")
        .insert({ milestone_id: milestoneId, title })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.projectId] });
    },
  });
}

export function useUpdateSubMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, ...patch }: { id: number; projectId: number; completed?: boolean; title?: string }) => {
      const { error } = await supabase.from("sub_milestones").update(patch as SubMilestonePatch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.projectId] });
    },
  });
}

// ── Checklist Items ────────────────────────────────────────────────────────

export function useChecklistItems(projectId: number) {
  return useQuery({
    queryKey: ["checklist", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });
}

export function useCreateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, text }: { projectId: number; text: string }) => {
      const { data, error } = await supabase
        .from("checklist_items")
        .insert({ project_id: projectId, title: text, completed: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["checklist", vars.projectId] });
    },
  });
}

// ── Calendar Events ────────────────────────────────────────────────────────

export function useCalendarEvents(projectId: number) {
  return useQuery({
    queryKey: ["calendar-events", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("project_id", projectId)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, title, date, type }: { projectId: number; title: string; date: string; type?: string }) => {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({ project_id: projectId, title, date, type: type ?? "event" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.projectId] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, ...patch }: { id: number; projectId: number; title?: string; date?: string; type?: string }) => {
      const { data, error } = await supabase
        .from("calendar_events")
        .update(patch as CalendarEventPatch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.projectId] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.projectId] });
    },
  });
}

// ── Suggested Categories ───────────────────────────────────────────────────

export function useSuggestedCategories(projectId: number) {
  return useQuery<string[]>({
    queryKey: ["suggested-categories", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canvas_elements")
        .select("content")
        .eq("board_id", projectId);
      if (error) return [];
      const cats = new Set<string>();
      for (const row of data ?? []) {
        const c = row.content as Record<string, unknown> | null;
        if (c && typeof c.category === "string" && c.category.trim()) {
          cats.add(c.category.trim());
        }
      }
      return Array.from(cats).sort();
    },
    enabled: !!projectId,
  });
}

// ── Planning Boards ────────────────────────────────────────────────────────

export function usePlanningBoards(projectId: number) {
  return useQuery<PlanningBoard[]>({
    queryKey: ["planning-boards", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planning_boards")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });
}

// ── Photos ─────────────────────────────────────────────────────────────────

export function usePhotos(projectId: number) {
  return useQuery<Photo[]>({
    queryKey: ["/api/projects/:projectId/photos", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });
}

export function useCreatePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      url,
      caption,
    }: {
      projectId: number;
      url: string;
      caption?: string;
    }) => {
      const { data, error } = await supabase
        .from("photos")
        .insert({ project_id: projectId, url, caption: caption ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/projects/:projectId/photos", vars.projectId] });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; projectId: number }) => {
      const { error } = await supabase.from("photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/projects/:projectId/photos", vars.projectId] });
    },
  });
}

// ── Image upload ───────────────────────────────────────────────────────────

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<{ url: string }> => {
      const ext = file.name.split(".").pop() || "bin";
      const path = `photos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("project-assets")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("project-assets").getPublicUrl(path);
      return { url: data.publicUrl };
    },
  });
}

export function useUpdateProjectCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      file,
    }: {
      projectId: number;
      file: File;
    }): Promise<{ url: string }> => {
      const ext = file.name.split(".").pop() || "bin";
      const path = `covers/${projectId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("project-assets")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(path);
      const url = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from("projects")
        .update({ thumbnail_url: url } satisfies ProjectPatch)
        .eq("id", projectId);
      if (updateError) throw updateError;
      return { url };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

export function useRemoveProjectCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: number }) => {
      const { error } = await supabase
        .from("projects")
        .update({ thumbnail_url: null } satisfies ProjectPatch)
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

export function useUpdateFocalPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      focalX,
      focalY,
    }: {
      projectId: number;
      focalX: number;
      focalY: number;
    }) => {
      const { error } = await supabase
        .from("projects")
        .update({ hero_focal_x: focalX, hero_focal_y: focalY } satisfies ProjectPatch)
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

// ── Board Snapshots ────────────────────────────────────────────────────────

// Re-export the canonical Row type so callers can import from here.
export type { BoardSnapshot };

export function useBoardSnapshots(boardId: number) {
  return useQuery<BoardSnapshot[]>({
    queryKey: ["board-snapshots", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_snapshots")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!boardId,
  });
}

export function useCreateBoardSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, name, canvasData }: { boardId: number; name: string; canvasData: unknown }) => {
      const { data, error } = await supabase
        .from("board_snapshots")
        .insert({ board_id: boardId, name, canvas_data: canvasData as Json })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["board-snapshots", vars.boardId] });
    },
  });
}

export function useRestoreBoardSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, boardId, canvasData }: { id: number; boardId: number; canvasData: unknown }) => {
      const { error } = await supabase
        .from("planning_boards")
        .update({ canvas_data: canvasData as Json } satisfies PlanningBoardPatch)
        .eq("id", boardId);
      if (error) throw error;
      return { id, boardId };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["planning-boards"] });
      qc.invalidateQueries({ queryKey: ["board-snapshots", vars.boardId] });
    },
  });
}

export function useDeleteBoardSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, boardId }: { id: number; boardId: number }) => {
      const { error } = await supabase.from("board_snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["board-snapshots", vars.boardId] });
    },
  });
}

export function useRenameBoardSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, boardId, name }: { id: number; boardId: number; name: string }) => {
      const { error } = await supabase.from("board_snapshots").update({ name } satisfies BoardSnapshotPatch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["board-snapshots", vars.boardId] });
    },
  });
}
