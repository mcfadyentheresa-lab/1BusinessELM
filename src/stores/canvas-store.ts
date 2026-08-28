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
  // Set by runPositionSave when a drag/resize position update fails to
  // persist. `at` is a fresh timestamp on every failure (even repeats of the
  // same message) so a component's useEffect keyed on this value always
  // re-fires and can surface a toast — the store has no UI of its own.
  lastSaveError: { message: string; at: number } | null;
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
  lastSaveError: null,
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
let pendingSaveBoardId: number | null = null;

async function runPositionSave(boardId: number) {
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
  let failed = 0;
  for (const u of updates) {
    const { error } = await supabase.from("canvas_elements").update({ x: u.x, y: u.y, width: u.width, height: u.height, z_index: u.z_index }).eq("id", u.id);
    if (error) {
      failed += 1;
      console.error("[Board] Failed to save element position", u.id, error);
    }
  }
  if (failed > 0) {
    useCanvasStore.setState({
      lastSaveError: {
        message: failed === 1
          ? "An element's position wasn't saved."
          : `${failed} element positions weren't saved.`,
        at: Date.now(),
      },
    });
  }
}

export function debouncedSavePositions(boardId: number, delay = 1500) {
  if (saveTimer) clearTimeout(saveTimer);
  pendingSaveBoardId = boardId;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    pendingSaveBoardId = null;
    await runPositionSave(boardId);
  }, delay);
}

// Immediately runs any pending debounced save instead of discarding it —
// used when navigating away from a board (switching boards, creating a new
// one) so the last ~1.5s of drag/resize edits aren't silently lost. Reads
// the board id it was scheduled against, so it stays correctly targeted
// even after the caller has already moved on to a different board.
export function flushPendingSave(): Promise<void> {
  if (saveTimer && pendingSaveBoardId !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    const boardId = pendingSaveBoardId;
    pendingSaveBoardId = null;
    return runPositionSave(boardId);
  }
  return Promise.resolve();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPendingSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingSave();
  });
}
