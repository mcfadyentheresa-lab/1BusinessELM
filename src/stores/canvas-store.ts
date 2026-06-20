import { create } from "zustand";
import type { CanvasElement } from "@/shared/database.types";
import { supabase } from "@/lib/supabase";

type ElementsMap = Record<number, CanvasElement>;

interface CanvasState {
  boardId: number | null;
  elements: ElementsMap;
  loading: boolean;
  undoStack: ElementsMap[];
  compareIds: number[];
  setBoardId: (id: number | null) => void;
  setElements: (els: CanvasElement[]) => void;
  addElement: (el: CanvasElement) => void;
  updateElement: (id: number, patch: Partial<CanvasElement>) => void;
  removeElement: (id: number) => void;
  moveElement: (id: number, x: number, y: number) => void;
  setLoading: (v: boolean) => void;
  pushUndo: () => void;
  popUndo: () => void;
  addToCompare: (id: number) => void;
  removeFromCompare: (id: number) => void;
  toggleCompare: (id: number) => void;
  clearCompare: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  boardId: null,
  elements: {},
  loading: false,
  undoStack: [],
  compareIds: [],
  setBoardId: (id) => set({ boardId: id }),
  setElements: (els) => {
    const map: ElementsMap = {};
    for (const el of els) map[el.id] = el;
    set({ elements: map });
  },
  addElement: (el) => set((s) => ({ elements: { ...s.elements, [el.id]: el } })),
  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements[id]
        ? { ...s.elements, [id]: { ...s.elements[id], ...patch } }
        : s.elements,
    })),
  removeElement: (id) =>
    set((s) => {
      const next = { ...s.elements };
      delete next[id];
      return { elements: next };
    }),
  moveElement: (id, x, y) =>
    set((s) => ({
      elements: s.elements[id]
        ? { ...s.elements, [id]: { ...s.elements[id], x, y } }
        : s.elements,
    })),
  setLoading: (v) => set({ loading: v }),
  pushUndo: () => set((s) => ({ undoStack: [...s.undoStack.slice(-49), s.elements] })),
  popUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({ elements: prev, undoStack: undoStack.slice(0, -1) });
  },
  addToCompare: (id) => set((s) => ({ compareIds: s.compareIds.includes(id) ? s.compareIds : [...s.compareIds, id] })),
  removeFromCompare: (id) => set((s) => ({ compareIds: s.compareIds.filter((c) => c !== id) })),
  toggleCompare: (id) => {
    const { compareIds } = get();
    if (compareIds.includes(id)) get().removeFromCompare(id);
    else get().addToCompare(id);
  },
  clearCompare: () => set({ compareIds: [] }),
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSavePositions(boardId: number, delay = 1500) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const elements = Object.values(useCanvasStore.getState().elements);
    if (!elements.length) return;
    const updates = elements.map((el) => ({
      id: el.id,
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: Math.round(el.width),
      height: Math.round(el.height ?? 0),
      z_index: Math.round(el.z_index),
    }));
    for (const u of updates) {
      await supabase.from("canvas_elements").update({ x: u.x, y: u.y, width: u.width, height: u.height, z_index: u.z_index }).eq("id", u.id);
    }
  }, delay);
}

export function cancelPendingSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
