import { supabase } from "./supabase";
import type { CanvasElement } from "../shared/database.types";

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
    content: unknown;
    parent_column_id?: number | null;
  }
): Promise<CanvasElement> {
  const { data, error } = await supabase
    .from("canvas_elements")
    .insert({ board_id: boardId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCanvasElement(
  id: number,
  patch: Partial<Pick<CanvasElement, "content" | "x" | "y" | "width" | "height" | "z_index" | "parent_column_id">>
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
