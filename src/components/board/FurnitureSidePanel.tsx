import { useEffect, useRef, useState, useCallback } from "react";
import { Armchair, ChevronRight, ChevronLeft, GripVertical, X } from "lucide-react";
import { FurniturePlannerPanel } from "@/components/board/FurniturePlannerPanel";

interface FurnitureSidePanelProps {
  boardId: number | null;
  projectId: number;
  projectName?: string | null;
  open: boolean;
  onClose: () => void;
}

const MIN_W = 320;
const MAX_W = 640;
const DEFAULT_W = 420;
const COLLAPSED_W = 44;

function lsKey(boardId: number | null, suffix: string) {
  return `asl.furniturePanel.${boardId ?? "global"}.${suffix}`;
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1";
  } catch { return fallback; }
}

export function FurnitureSidePanel({
  boardId,
  projectId,
  projectName,
  open,
  onClose,
}: FurnitureSidePanelProps) {
  const widthKey = lsKey(boardId, "width");
  const collapsedKey = lsKey(boardId, "collapsed");

  const [width, setWidth] = useState<number>(() => readNumber(widthKey, DEFAULT_W));
  const [collapsed, setCollapsed] = useState<boolean>(() => readBool(collapsedKey, false));
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    setWidth(readNumber(widthKey, DEFAULT_W));
    setCollapsed(readBool(collapsedKey, false));
  }, [boardId, widthKey, collapsedKey]);

  useEffect(() => {
    try { localStorage.setItem(widthKey, String(width)); } catch {}
  }, [width, widthKey]);

  useEffect(() => {
    try { localStorage.setItem(collapsedKey, collapsed ? "1" : "0"); } catch {}
  }, [collapsed, collapsedKey]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (collapsed) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = dragRef.current.startX - ev.clientX;
      const next = Math.max(MIN_W, Math.min(MAX_W, dragRef.current.startW + dx));
      setWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [collapsed, width]);

  if (!open) return null;

  const isNarrow = typeof window !== "undefined" && window.innerWidth <= 640;
  const viewportCap = typeof window !== "undefined" ? Math.max(280, window.innerWidth - 40) : MAX_W;
  const expandedWidth = isNarrow ? Math.min(width, viewportCap) : width;
  const renderedWidth = collapsed ? COLLAPSED_W : expandedWidth;

  return (
    <aside
      className="fixed top-0 right-0 z-30 h-full bg-card border-l border-border/60 shadow-xl flex flex-row"
      style={{ width: renderedWidth }}
      data-testid="furniture-side-panel"
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Furniture panel"
    >
      {!collapsed && (
        <div
          onPointerDown={handlePointerDown}
          style={{ touchAction: "none" }}
          className="w-1.5 h-full cursor-col-resize hover:bg-foreground/10 transition-colors flex-shrink-0 group"
          data-testid="furniture-panel-resize"
          role="separator"
          aria-orientation="vertical"
        >
          <div className="h-full w-px bg-border/40 group-hover:bg-foreground/30 mx-auto" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-12 w-6 rounded-l-md bg-card border border-r-0 border-border/60 hover:bg-muted/50 transition-colors flex items-center justify-center"
        title={collapsed ? "Expand furniture panel" : "Collapse furniture panel"}
        aria-label={collapsed ? "Expand furniture panel" : "Collapse furniture panel"}
        data-testid="furniture-panel-collapse"
      >
        {collapsed ? (
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {collapsed ? (
        <div className="flex-1 flex flex-col items-center justify-start pt-4 gap-2 cursor-pointer" onClick={() => setCollapsed(false)} role="button" aria-label="Expand furniture panel">
          <Armchair className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" style={{ writingMode: "vertical-rl" }}>
            Furniture
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Armchair className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-sans text-base font-semibold leading-none">Furniture</h2>
              </div>
              {projectName && (
                <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase mt-1 truncate" data-testid="furniture-panel-project-link" title={`Furniture is saved against ${projectName}`}>
                  For: {projectName}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-sm p-1 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Close furniture panel" aria-label="Close furniture panel" data-testid="furniture-panel-close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3" data-testid="furniture-panel-body">
            <FurniturePlannerPanel projectId={projectId} />
          </div>

          <div className="px-4 py-2 border-t border-border/60">
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/70 uppercase flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" aria-hidden />
              Drag left edge to resize · Click chevron to collapse
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
