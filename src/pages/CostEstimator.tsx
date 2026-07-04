import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Lock, DollarSign, Loader2, Save } from "lucide-react";

interface LineItem {
  id?: number;
  category_id: string;
  custom_category: string;
  room: string;
  quantity: string;
  unit_type: string;
  unit_cost: string;
  material_cost: string;
  notes: string;
}

const EMPTY_LINE_ITEM: LineItem = {
  category_id: "",
  custom_category: "",
  room: "",
  quantity: "1",
  unit_type: "sq_ft",
  unit_cost: "0",
  material_cost: "0",
  notes: "",
};

function calcItemTotal(item: LineItem): number {
  const qty = parseFloat(item.quantity || "0");
  const labor = parseFloat(item.unit_cost || "0") * qty;
  const material = parseFloat(item.material_cost || "0") * qty;
  return labor + material;
}

export default function CostEstimator() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const projectId = parseInt(id);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("name, code").eq("id", projectId).maybeSingle();
      return data;
    },
  });

  const { data: estimate, isLoading: estimateLoading } = useQuery({
    queryKey: ["estimate", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_estimates")
        .select("*, items:estimate_items(*)")
        .eq("project_id", projectId)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .maybeSingle();
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["cost-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_categories").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [markupEnabled, setMarkupEnabled] = useState(true);
  const [markupPct, setMarkupPct] = useState("25");
  const [contingencyPct, setContingencyPct] = useState("0");
  const [managementFeeEnabled, setManagementFeeEnabled] = useState(false);
  const [managementFeePct, setManagementFeePct] = useState("15");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (estimate) {
      setMarkupEnabled(estimate.markup_enabled ?? true);
      setMarkupPct(estimate.markup_percent ?? "25");
      setContingencyPct(estimate.contingency_percent ?? "0");
      setManagementFeeEnabled(estimate.management_fee_enabled ?? false);
      setManagementFeePct(estimate.management_fee_percent ?? "15");
      if ((estimate as any).items?.length > 0) {
        setItems((estimate as any).items.map((i: any) => ({
          id: i.id,
          category_id: String(i.category_id ?? ""),
          custom_category: i.custom_category ?? "",
          room: i.room ?? "",
          quantity: i.quantity,
          unit_type: i.unit_type,
          unit_cost: i.unit_cost,
          material_cost: i.material_cost,
          notes: i.notes ?? "",
        })));
      }
    }
  }, [estimate]);

  const subtotal = items.reduce((s, item) => s + calcItemTotal(item), 0);
  const contingency = subtotal * (parseFloat(contingencyPct || "0") / 100);
  const subtotalWithContingency = subtotal + contingency;
  const markup = markupEnabled ? subtotalWithContingency * (parseFloat(markupPct || "0") / 100) : 0;
  const subtotalWithMarkup = subtotalWithContingency + markup;
  const managementFee = managementFeeEnabled ? subtotalWithMarkup * (parseFloat(managementFeePct || "0") / 100) : 0;
  const total = subtotalWithMarkup + managementFee;

  const handleSave = async () => {
    setSaving(true);
    try {
      let estimateId = estimate?.id;
      if (!estimateId) {
        const { data, error } = await supabase.from("project_estimates").insert({
          project_id: projectId,
          name: "Main Estimate",
          status: "draft",
          markup_enabled: markupEnabled,
          markup_percent: markupPct,
          contingency_percent: contingencyPct,
          management_fee_enabled: managementFeeEnabled,
          management_fee_percent: managementFeePct,
        }).select("id").single();
        if (error) throw error;
        estimateId = data.id;
      } else {
        await supabase.from("project_estimates").update({
          markup_enabled: markupEnabled,
          markup_percent: markupPct,
          contingency_percent: contingencyPct,
          management_fee_enabled: managementFeeEnabled,
          management_fee_percent: managementFeePct,
        }).eq("id", estimateId);
        await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);
      }
      if (items.length > 0) {
        const toInsert = items.map((item) => ({
          estimate_id: estimateId,
          category_id: item.category_id ? parseInt(item.category_id) : null,
          custom_category: item.custom_category || null,
          room: item.room || null,
          quantity: item.quantity,
          unit_type: item.unit_type,
          unit_cost: item.unit_cost,
          material_cost: item.material_cost,
          labor_cost: String(parseFloat(item.unit_cost) * parseFloat(item.quantity)),
          notes: item.notes || null,
        }));
        await supabase.from("estimate_items").insert(toInsert);
      }
      qc.invalidateQueries({ queryKey: ["estimate", projectId] });
      toast({ title: "Estimate saved" });
    } catch (e: any) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const isLocked = estimate?.status !== "draft" && estimate != null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{project?.name}{project?.code ? ` · ${project.code}` : ""}</p>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
              Cost Estimator
            </h1>
            {isLocked && <Badge variant="secondary" className="gap-1 shrink-0"><Lock className="h-3 w-3" /> Locked</Badge>}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || isLocked} className="gap-2 mt-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save estimate
        </Button>
      </div>

      {/* Line items */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>Add labour and material line items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-muted/30 border border-border/60">
                <div className="col-span-12 sm:col-span-3">
                  <Select
                    value={item.category_id}
                    onValueChange={(v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, category_id: v } : it))}
                    disabled={isLocked}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category…" /></SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Room"
                    value={item.room}
                    onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, room: e.target.value } : it))}
                    disabled={isLocked}
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Input
                    className="h-8 text-xs text-right"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                    disabled={isLocked}
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Select
                    value={item.unit_type}
                    onValueChange={(v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_type: v } : it))}
                    disabled={isLocked}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["sq_ft", "linear_ft", "hour", "unit", "day"].map((u) => (
                        <SelectItem key={u} value={u}>{u.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      className="h-8 text-xs pl-5"
                      placeholder="Labour/unit"
                      value={item.unit_cost}
                      onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_cost: e.target.value } : it))}
                      disabled={isLocked}
                    />
                  </div>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      className="h-8 text-xs pl-5"
                      placeholder="Material/unit"
                      value={item.material_cost}
                      onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, material_cost: e.target.value } : it))}
                      disabled={isLocked}
                    />
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-1 flex items-center justify-between">
                  <span className="text-xs font-medium tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                    {formatCurrency(calcItemTotal(item))}
                  </span>
                  {!isLocked && (
                    <button
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!isLocked && (
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setItems((p) => [...p, { ...EMPTY_LINE_ITEM }])}>
              <Plus className="h-4 w-4" /> Add line item
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Totals panel */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Hero total */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Estimate Total</p>
              <p className="text-4xl font-semibold text-foreground tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)" }}>
                {formatCurrency(total)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Base {formatCurrency(subtotal)} · {items.length} line item{items.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex flex-col gap-1.5 text-right shrink-0">
              {contingency > 0 && <p className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>+ {formatCurrency(contingency)} contingency</p>}
              {markup > 0 && <p className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>+ {formatCurrency(markup)} markup</p>}
              {managementFee > 0 && <p className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>+ {formatCurrency(managementFee)} mgmt fee</p>}
            </div>
          </div>
        </div>

        {/* Fee controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Contingency</p>
              <div className="flex items-center gap-1">
                <Input className="h-7 w-16 text-xs" value={contingencyPct} onChange={(e) => setContingencyPct(e.target.value)} disabled={isLocked} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(contingency)}</p>
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs text-muted-foreground">Markup</p>
                <Switch checked={markupEnabled} onCheckedChange={setMarkupEnabled} disabled={isLocked} className="scale-75 origin-left" />
              </div>
              <div className="flex items-center gap-1">
                <Input className="h-7 w-16 text-xs" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} disabled={!markupEnabled || isLocked} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(markup)}</p>
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs text-muted-foreground">Mgmt fee</p>
                <Switch checked={managementFeeEnabled} onCheckedChange={setManagementFeeEnabled} disabled={isLocked} className="scale-75 origin-left" />
              </div>
              <div className="flex items-center gap-1">
                <Input className="h-7 w-16 text-xs" value={managementFeePct} onChange={(e) => setManagementFeePct(e.target.value)} disabled={!managementFeeEnabled || isLocked} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(managementFee)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
