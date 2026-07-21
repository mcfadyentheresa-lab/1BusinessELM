import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Check } from "lucide-react";

// Furniture piece types shared by the board's furniture_redesign element type
// and the side-panel checklist. Kept here so both surfaces stay in sync.
export const PIECE_TYPES = [
  { value: "dining_table", label: "Dining Table" },
  { value: "coffee_table", label: "Coffee Table" },
  { value: "side_table", label: "Side Table" },
  { value: "console", label: "Console" },
  { value: "desk", label: "Desk" },
  { value: "chair", label: "Chair" },
  { value: "sofa", label: "Sofa" },
  { value: "cabinet", label: "Cabinet" },
  { value: "shelving", label: "Shelving" },
  { value: "bed_frame", label: "Bed Frame" },
  { value: "other", label: "Other" },
] as const;

interface FurnitureItem {
  id: string;
  name: string;
  room: string;
  status: "planned" | "sourcing" | "ordered" | "installed";
}

const FURNITURE_STATUS_LABELS: Record<FurnitureItem["status"], string> = {
  planned: "Planned",
  sourcing: "Sourcing",
  ordered: "Ordered",
  installed: "Installed",
};

const LS_KEY = (projectId: number) => `furniture-planner:${projectId}`;

function loadItems(projectId: number): FurnitureItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveItems(projectId: number, items: FurnitureItem[]) {
  try { localStorage.setItem(LS_KEY(projectId), JSON.stringify(items)); } catch {}
}

// Embedded in FurnitureSidePanel on the canvas. Shows a lightweight
// per-project furniture list (name + room + status) with quick-add inline.
export function FurniturePlannerPanel({ projectId }: { projectId: number }) {
  const [items, setItems] = useState<FurnitureItem[]>(() => loadItems(projectId));
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  const update = (next: FurnitureItem[]) => {
    setItems(next);
    saveItems(projectId, next);
  };

  const addItem = () => {
    if (!name.trim()) return;
    const next: FurnitureItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      room: room.trim(),
      status: "planned",
    };
    update([...items, next]);
    setName("");
    setRoom("");
  };

  const cycleStatus = (id: string) => {
    const order: FurnitureItem["status"][] = ["planned", "sourcing", "ordered", "installed"];
    update(items.map((it) => it.id !== id ? it : { ...it, status: order[(order.indexOf(it.status) + 1) % order.length] }));
  };

  const remove = (id: string) => update(items.filter((it) => it.id !== id));

  return (
    <div className="flex flex-col gap-3">
      {/* Add row */}
      <div className="flex flex-col gap-1.5">
        <Input
          placeholder="Piece name (e.g. sofa)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="h-8 text-sm"
        />
        <div className="flex gap-1.5">
          <Input
            placeholder="Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" onClick={addItem} disabled={!name.trim()} className="h-8 px-3 gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No furniture items yet — add one above.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/40 group">
              <button
                type="button"
                onClick={() => cycleStatus(it.id)}
                className="shrink-0 h-5 w-5 rounded-full border border-border flex items-center justify-center hover:bg-primary/10 transition-colors"
                title="Cycle status"
                aria-label={`Status: ${FURNITURE_STATUS_LABELS[it.status]}`}
              >
                {it.status === "installed" && <Check className="h-3 w-3 text-primary" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.name}</div>
                {it.room && <div className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-mono truncate">{it.room}</div>}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground shrink-0">
                {FURNITURE_STATUS_LABELS[it.status]}
              </span>
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
