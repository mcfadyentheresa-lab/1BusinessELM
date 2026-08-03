import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText, Loader2, ArrowLeft, ChevronRight } from "lucide-react";

interface EstimateWithItems {
  id: number;
  project_id: number;
  name: string;
  status: string;
  created_at: string | null;
  markup_enabled: boolean | null;
  markup_percent: string;
  contingency_percent: string | null;
  management_fee_enabled: boolean | null;
  management_fee_percent: string;
  items: Array<{ quantity: string; unit_cost: string; material_cost: string }> | null;
}

function calcLineTotal(item: { quantity: string; unit_cost: string; material_cost: string }): number {
  const qty = parseFloat(item.quantity || "0");
  const labor = parseFloat(item.unit_cost || "0") * qty;
  const material = parseFloat(item.material_cost || "0") * qty;
  return labor + material;
}

function calcEstimateTotal(est: EstimateWithItems): number {
  const items = est.items ?? [];
  const subtotal = items.reduce((s, i) => s + calcLineTotal(i), 0);
  const contingencyPct = parseFloat(est.contingency_percent || "0");
  const contingency = subtotal * (contingencyPct / 100);
  const subtotalWithContingency = subtotal + contingency;
  const markup = est.markup_enabled ? subtotalWithContingency * (parseFloat(est.markup_percent || "0") / 100) : 0;
  const subtotalWithMarkup = subtotalWithContingency + markup;
  const mgmtFee = est.management_fee_enabled ? subtotalWithMarkup * (parseFloat(est.management_fee_percent || "0") / 100) : 0;
  return subtotalWithMarkup + mgmtFee;
}

export default function EstimatesList() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", pid],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("name, code").eq("id", pid).maybeSingle();
      return data;
    },
  });

  const { data: estimates = [], isLoading } = useQuery<EstimateWithItems[]>({
    queryKey: ["project-estimates", pid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_estimates")
        .select("*, items:estimate_items(quantity, unit_cost, material_cost)")
        .eq("project_id", pid)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EstimateWithItems[];
    },
  });

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Estimate";
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("project_estimates")
        .insert({
          project_id: pid,
          name,
          status: "draft",
          markup_enabled: true,
          markup_percent: "25",
          contingency_percent: "0",
          management_fee_enabled: false,
          management_fee_percent: "25",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["project-estimates", pid] });
      setDialogOpen(false);
      setNewName("");
      navigate(`/project/${pid}/estimate/${data.id}`);
    } catch (e: any) {
      toast({ title: "Couldn't create estimate", description: e.message, variant: "destructive" });
    }
    setCreating(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(`/project/${pid}`)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Back to project
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {project?.name}{project?.code ? ` · ${project.code}` : ""}
          </p>
          <h1 className="text-2xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
            Estimates
          </h1>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Estimate
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : estimates.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No estimates yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create one to start building a cost breakdown.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((est) => (
            <button
              key={est.id}
              onClick={() => navigate(`/project/${pid}/estimate/${est.id}`)}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{est.name}</h3>
                    <Badge
                      variant={est.status === "approved" ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {est.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {est.created_at ? formatDate(est.created_at) : ""}
                    {(est.items?.length ?? 0) > 0 && ` · ${est.items!.length} line item${est.items!.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <p className="text-sm font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatCurrency(calcEstimateTotal(est))}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Estimate</DialogTitle>
            <DialogDescription>
              Give this estimate a name — e.g. "Budget Option" or "Premium Option". You can create multiple estimates for the same project and edit them independently.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Estimate name</Label>
              <Input
                placeholder="e.g. Budget Option"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && !creating) handleCreate(); }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Create estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
