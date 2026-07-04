import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Sofa, Trash2, Check, Loader2 } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning"> = {
  draft: "secondary",
  complete: "success",
};

// ── FurniturePlannerPanel ──────────────────────────────────────────────────
// Embedded in FurnitureSidePanel on the canvas. Shows a lightweight
// per-project furniture list (name + room + status) with quick-add inline.

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

const PIECE_TYPES = [
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
];

function NewPlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [pieceName, setPieceName] = useState("");
  const [pieceType, setPieceType] = useState("dining_table");
  const [styleDirection, setStyleDirection] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!pieceName.trim()) throw new Error("Piece name is required");
      const { error } = await supabase.from("table_redesign_plans").insert({
        piece_name: pieceName.trim(),
        piece_type: pieceType,
        style_direction: styleDirection.trim() || null,
        notes: notes.trim() || null,
        status: "draft",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plan created" });
      qc.invalidateQueries({ queryKey: ["table-redesign-plans"] });
      setPieceName(""); setPieceType("dining_table"); setStyleDirection(""); setNotes("");
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed to create plan", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Redesign Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Piece Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Antique Walnut Dining Table"
              value={pieceName}
              onChange={(e) => setPieceName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Piece Type</Label>
            <Select value={pieceType} onValueChange={setPieceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIECE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Style Direction</Label>
            <Input
              placeholder="e.g. Mid-century modern, bleached wood"
              value={styleDirection}
              onChange={(e) => setStyleDirection(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any additional context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !pieceName.trim()}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TableRedesignPlanner() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: plans, isLoading } = useQuery({
    queryKey: ["table-redesign-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("table_redesign_plans")
        .select("*, project:projects(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <NewPlanDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>Redesign Planner</h1>
          <p className="text-sm text-muted-foreground mt-1">Furniture redesign and concept planning</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New plan</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : (plans ?? []).length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <Sofa className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-foreground mb-1">No redesign plans yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create a plan to track furniture redesign concepts and materials.</p>
          <Button className="gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Create plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(plans ?? []).map((plan: any) => (
            <div key={plan.id} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
              {plan.concept_image_url ? (
                <img src={plan.concept_image_url} alt={plan.piece_name} className="w-full h-40 object-cover" />
              ) : plan.before_image_url ? (
                <img src={plan.before_image_url} alt={plan.piece_name} className="w-full h-40 object-cover opacity-75" />
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center">
                  <Sofa className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-serif)" }}>{plan.piece_name}</h3>
                  <Badge variant={STATUS_VARIANT[plan.status] ?? "secondary"} className="text-[10px] shrink-0">{plan.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground capitalize mb-1">{plan.piece_type.replace(/_/g, " ")}</p>
                {plan.project?.name && <p className="text-xs text-muted-foreground">{plan.project.name}</p>}
                {plan.style_direction && <p className="text-xs text-muted-foreground mt-2 italic truncate">{plan.style_direction}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
