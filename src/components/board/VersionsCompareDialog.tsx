import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useBoardSnapshots, type BoardSnapshot } from "@/hooks/use-projects";
import { ZoomIn, ZoomOut, Minus, Clock } from "lucide-react";
import type { CanvasElement } from "@/shared/database.types";

interface VersionsCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  currentElements: CanvasElement[];
  onRestore: (snapshot: BoardSnapshot) => void;
}

function MiniBoard({
  elements,
  label,
  zoom,
  pan,
}: {
  elements: CanvasElement[];
  label: string;
  zoom: number;
  pan: { x: number; y: number };
}) {
  if (!elements.length) {
    return (
      <div className="flex-1 rounded-xl border border-border bg-muted flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Empty board</p>
      </div>
    );
  }

  // Compute bounds
  const xs = elements.map((e) => e.x);
  const ys = elements.map((e) => e.y);
  const x2s = elements.map((e) => e.x + e.width);
  const y2s = elements.map((e) => e.y + e.height);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return (
    <div className="flex-1 rounded-xl border border-border bg-muted overflow-hidden relative">
      <div className="absolute top-2 left-2 z-10">
        <Badge variant="secondary" className="text-[10px]">{label}</Badge>
      </div>
      <div
        className="w-full h-full overflow-hidden"
        style={{ cursor: "default" }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          {elements.map((el) => {
            const c = (el.content as Record<string, unknown>) ?? {};
            const isImage = el.type === "image";
            const imgUrl = isImage ? (c.url as string) : null;
            const bgColor = el.type === "color_swatch" ? (c.hex as string) : undefined;
            const text = typeof c.text === "string" ? c.text : typeof c.title === "string" ? c.title : "";

            return (
              <div
                key={el.id}
                style={{
                  position: "absolute",
                  left: (el.x - minX) * zoom + 8,
                  top: (el.y - minY) * zoom + 8,
                  width: el.width * zoom,
                  height: el.height * zoom,
                  backgroundColor: bgColor ?? (isImage ? undefined : "rgba(0,0,0,0.06)"),
                  borderRadius: 4,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                {imgUrl ? (
                  <img src={imgUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
                ) : text ? (
                  <span
                    className="text-foreground/70"
                    style={{
                      fontSize: Math.max(6, Math.min(11, el.height * zoom * 0.3)),
                      padding: 2,
                      display: "block",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {text}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function parseBoardElements(snapshot: BoardSnapshot): CanvasElement[] {
  try {
    const data = snapshot.canvas_data as { elements?: CanvasElement[] } | null;
    return data?.elements ?? [];
  } catch {
    return [];
  }
}

export function VersionsCompareDialog({
  open,
  onOpenChange,
  boardId,
  currentElements,
  onRestore,
}: VersionsCompareDialogProps) {
  const { data: snapshots, isLoading } = useBoardSnapshots(boardId);
  const [leftIdx, setLeftIdx] = useState(0);
  const [zoom, setZoom] = useState(0.08);
  const [pan] = useState({ x: 0, y: 0 });

  const snapshotsArr: BoardSnapshot[] = (snapshots ?? []) as BoardSnapshot[];
  const leftSnap = snapshotsArr[leftIdx];
  const leftElements = leftSnap ? parseBoardElements(leftSnap) : [];

  const diffAdded = currentElements.filter(
    (el) => !leftElements.some((le) => le.id === el.id)
  ).length;
  const diffRemoved = leftElements.filter(
    (el) => !currentElements.some((ce) => ce.id === el.id)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Compare Versions
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ) : snapshotsArr.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-center border border-dashed border-border rounded-xl">
            <Clock className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">No saved versions</p>
            <p className="text-xs text-muted-foreground">Save a version from the versions panel to compare.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Snapshot selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {snapshotsArr.map((snap, i) => (
                <button
                  key={snap.id}
                  type="button"
                  onClick={() => setLeftIdx(i)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    i === leftIdx
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                >
                  {snap.name}
                </button>
              ))}
            </div>

            {/* Diff stats */}
            {leftSnap && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Comparing <strong className="text-foreground">{leftSnap.name}</strong> → Current</span>
                <Separator orientation="vertical" className="h-3" />
                {diffAdded > 0 && <span className="text-green-600">+{diffAdded} added</span>}
                {diffRemoved > 0 && <span className="text-red-600">−{diffRemoved} removed</span>}
                {diffAdded === 0 && diffRemoved === 0 && <span className="text-muted-foreground">No changes</span>}
              </div>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-1 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setZoom((z) => Math.max(0.03, z - 0.02))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setZoom((z) => Math.min(0.3, z + 0.02))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Side-by-side boards */}
            <div className="flex gap-3 h-64">
              <MiniBoard elements={leftElements} label={leftSnap?.name ?? "Snapshot"} zoom={zoom} pan={pan} />
              <MiniBoard elements={currentElements} label="Current" zoom={zoom} pan={pan} />
            </div>

            {leftSnap && (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { onRestore(leftSnap); onOpenChange(false); }}
                >
                  Restore "{leftSnap.name}"
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
