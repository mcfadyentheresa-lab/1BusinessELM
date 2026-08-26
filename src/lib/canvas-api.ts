import { supabase } from "./supabase";
import type { CanvasElement, Json } from "../shared/database.types";
import type { Database } from "../shared/database.types";

type CanvasElementInsert = Database["public"]["Tables"]["canvas_elements"]["Insert"];

export async function loadCanvasElements(boardId: number): Promise<CanvasElement[]> {
  const { data, error } = await supabase
    .from("canvas_elements")
    .select("*")
    .eq("board_id", boardId)
    .order("z_index");
  if (error) throw error;
  return data ?? [];
}

export async function createCanvasElement(
  boardId: number,
  payload: {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z_index: number;
    content?: Json | null;
    parent_column_id?: number | null;
    is_mockup?: boolean | null;
  }
): Promise<CanvasElement> {
  const insert: CanvasElementInsert = { board_id: boardId, ...payload };
  const { data, error } = await supabase
    .from("canvas_elements")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCanvasElement(
  id: number,
  patch: Partial<Pick<CanvasElement, "content" | "x" | "y" | "width" | "height" | "z_index" | "parent_column_id" | "is_mockup">>
): Promise<void> {
  const { error } = await supabase
    .from("canvas_elements")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCanvasElement(id: number): Promise<void> {
  const { error } = await supabase
    .from("canvas_elements")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function createCanvasElementWithId(boardId: number, el: CanvasElement): Promise<CanvasElement> {
  const insert = {
    id: el.id,
    board_id: boardId,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    z_index: el.z_index,
    content: el.content,
    parent_column_id: el.parent_column_id,
    is_mockup: el.is_mockup,
  };
  const { data, error } = await supabase
    .from("canvas_elements")
    .insert(insert as CanvasElementInsert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const RECONCILE_FIELDS = ["x", "y", "width", "height", "z_index", "content", "parent_column_id", "is_mockup"] as const;

function elementsDiffer(a: CanvasElement, b: CanvasElement): boolean {
  return RECONCILE_FIELDS.some((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
}

/**
 * Makes the server's canvas_elements rows for boardId match `target` exactly:
 * deletes rows missing from target, updates rows whose fields changed, and
 * re-creates (preserving id) rows present in target but missing on the
 * server. Powers undo and version-restore, which both need to push a known
 * elements snapshot back to the server rather than only mutate local state.
 */
export async function reconcileCanvasElements(boardId: number, target: CanvasElement[]): Promise<void> {
  const current = await loadCanvasElements(boardId);
  const currentById = new Map(current.map((e) => [e.id, e]));
  const targetById = new Map(target.map((e) => [e.id, e]));

  const toDelete = current.filter((e) => !targetById.has(e.id));
  const toRecreate = target.filter((e) => !currentById.has(e.id));
  const toUpdate = target.filter((e) => {
    const cur = currentById.get(e.id);
    return cur !== undefined && elementsDiffer(cur, e);
  });

  await Promise.all([
    ...toDelete.map((e) => deleteCanvasElement(e.id)),
    ...toUpdate.map((e) =>
      updateCanvasElement(e.id, {
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        z_index: e.z_index,
        content: e.content,
        parent_column_id: e.parent_column_id,
        is_mockup: e.is_mockup,
      })
    ),
    ...toRecreate.map((e) => createCanvasElementWithId(boardId, e)),
  ]);
}
