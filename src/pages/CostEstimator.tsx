import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
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
import { Plus, Trash2, Lock, Loader2, Save, ShieldCheck, AlertTriangle, Info, Package } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
  assembly_id: string | null;
  material_from_assembly: boolean;
}

interface EstimateWarning {
  id: number;
  estimate_item_id: number | null;
  estimate_id: number | null;
  warning_type: string;
  message: string;
  percent_diff: string | null;
  ignored: boolean;
}

interface AuditResponse {
  warnings: EstimateWarning[];
  counts: Record<string, number>;
  ai_parse_failed?: boolean;
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
  assembly_id: null,
  material_from_assembly: false,
};

function calcItemTotal(item: LineItem): number {
  const qty = parseFloat(item.quantity || "0");
  const labor = parseFloat(item.unit_cost || "0") * qty;
  const material = parseFloat(item.material_cost || "0") * qty;
  return labor + material;
}

const UNIT_LABEL: Record<string, string> = {
  sq_ft: "sq ft",
  linear_ft: "linear ft",
  hour: "hour",
  unit: "unit",
  day: "day",
};

function labourPlaceholder(unitType: string): string {
  const label = UNIT_LABEL[unitType] ?? "unit";
  if (unitType === "hour") return "Labour per hour (total crew)";
  if (unitType === "day") return "Labour per day (total crew)";
  return `Labour per ${label}`;
}

function materialPlaceholder(unitType: string): string {
  const label = UNIT_LABEL[unitType] ?? "unit";
  return `Material per ${label}`;
}

function formatQty(q: string): string {
  const n = parseFloat(q || "0");
  if (!isFinite(n) || n === 0) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatRate(r: string): string {
  const n = parseFloat(r || "0");
  if (!isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemMathCaption(item: LineItem): { labour: string; material: string } | null {
  const unitLabel = UNIT_LABEL[item.unit_type] ?? "unit";
  const qty = parseFloat(item.quantity || "0");
  const labourRate = parseFloat(item.unit_cost || "0");
  const materialRate = parseFloat(item.material_cost || "0");
  if (qty === 0 && labourRate === 0 && materialRate === 0) return null;
  const labourTotal = labourRate * qty;
  const materialTotal = materialRate * qty;
  return {
    labour: `${formatQty(item.quantity)} ${unitLabel} × ${formatRate(item.unit_cost)}/${unitLabel} = ${formatCurrency(labourTotal)} labour`,
    material: `${formatQty(item.quantity)} ${unitLabel} × ${formatRate(item.material_cost)}/${unitLabel} = ${formatCurrency(materialTotal)} material`,
  };
}

interface MarketRate {
  category_id: number;
  unit_type: string;
  low_rate: string;
  high_rate: string;
  typical_rate: string;
}

interface AssemblyMaterial {
  material_name: string;
  qty_per_sqft: number;
  unit_cost: number;
  waste_pct: number;
}

interface EstimateAssembly {
  id: number;
  name: string;
  category_id: number;
  quality_tier: string | null;
  materials: AssemblyMaterial[];
}

function findMarketRate(rates: MarketRate[], categoryId: string, unitType: string): MarketRate | null {
  return rates.find((r) => String(r.category_id) === categoryId && r.unit_type === unitType) ?? null;
}

function calcAssemblyMaterialCost(materials: AssemblyMaterial[]): number {
  return materials.reduce((sum, m) => {
    return sum + m.qty_per_sqft * m.unit_cost * (1 + m.waste_pct / 100);
  }, 0);
}

export default function CostEstimator() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const projectId = parseInt(id);
  const { user } = useAuth();

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

  const { data: marketRates = [] } = useQuery<MarketRate[]>({
    queryKey: ["market-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_rates")
        .select("category_id, unit_type, low_rate, high_rate, typical_rate")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as MarketRate[];
    },
  });

  const { data: assemblies = [] } = useQuery<EstimateAssembly[]>({
    queryKey: ["estimate-assemblies"],
    queryFn: async () => {
      const [{ data: aRows, error: aErr }, { data: mRows, error: mErr }] = await Promise.all([
        supabase.from("estimate_assemblies").select("id, name, category_id, quality_tier").eq("is_active", true).order("name"),
        supabase.from("assembly_materials").select("assembly_id, material_name, qty_per_sqft, unit_cost, waste_pct"),
      ]);
      if (aErr) throw aErr;
      if (mErr) throw mErr;
      const byAssembly = new Map<number, AssemblyMaterial[]>();
      for (const m of mRows ?? []) {
        const arr = byAssembly.get(m.assembly_id) ?? [];
        arr.push(m as AssemblyMaterial);
        byAssembly.set(m.assembly_id, arr);
      }
      return (aRows ?? []).map((a) => ({
        id: a.id, name: a.name, category_id: a.category_id ?? 0,
        quality_tier: a.quality_tier, materials: byAssembly.get(a.id) ?? [],
      })) as EstimateAssembly[];
    },
  });

  const estimateId = estimate?.id ?? null;

  const { data: warnings = [], refetch: refetchWarnings } = useQuery<EstimateWarning[]>({
    queryKey: ["estimate-warnings", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_warnings")
        .select("id, estimate_item_id, estimate_id, warning_type, message, percent_diff, ignored")
        .eq("estimate_id", estimateId)
        .order("id");
      if (error) throw error;
      return (data ?? []) as EstimateWarning[];
    },
    enabled: !!estimateId,
  });

  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [markupEnabled, setMarkupEnabled] = useState(true);
  const [markupPct, setMarkupPct] = useState("25");
  const [contingencyPct, setContingencyPct] = useState("0");
  const [managementFeeEnabled, setManagementFeeEnabled] = useState(false);
  const [managementFeePct, setManagementFeePct] = useState("15");
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);

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
          assembly_id: null,
          material_from_assembly: false,
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

  const itemLevelByItem = useMemo(() => {
    const map = new Map<number, EstimateWarning[]>();
    for (const w of warnings) {
      if (w.estimate_item_id != null) {
        const arr = map.get(w.estimate_item_id) ?? [];
        arr.push(w);
        map.set(w.estimate_item_id, arr);
      }
    }
    return map;
  }, [warnings]);

  const estimateLevelWarnings = useMemo(
    () => warnings.filter((w) => w.estimate_id != null && w.estimate_item_id == null),
    [warnings],
  );
  const activeEstimateLevel = estimateLevelWarnings.filter((w) => !w.ignored);
  const ignoredEstimateLevel = estimateLevelWarnings.filter((w) => w.ignored);
  const ignoredCount = warnings.filter((w) => w.ignored).length;
  const activeWarningCount = warnings.filter((w) => !w.ignored).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      let newEstimateId = estimate?.id;
      if (!newEstimateId) {
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
        newEstimateId = data.id;
      } else {
        await supabase.from("project_estimates").update({
          markup_enabled: markupEnabled,
          markup_percent: markupPct,
          contingency_percent: contingencyPct,
          management_fee_enabled: managementFeeEnabled,
          management_fee_percent: managementFeePct,
        }).eq("id", newEstimateId);
        await supabase.from("estimate_items").delete().eq("estimate_id", newEstimateId);
      }
      if (items.length > 0) {
        const toInsert = items.map((item) => ({
          estimate_id: newEstimateId,
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

  const handleAudit = async () => {
    if (!estimateId) return;
    setAuditing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not signed in", variant: "destructive" });
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-auditor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ estimate_id: estimateId }),
      });
      const json: AuditResponse = await res.json();
      if (!res.ok) {
        throw new Error(json && (json as any).error ? (json as any).error : `Audit failed (${res.status})`);
      }
      const fresh = await refetchWarnings();
      const freshActive = (fresh.data ?? []).filter((w) => !w.ignored).length;
      toast({ title: `Audit complete — ${freshActive} warning${freshActive !== 1 ? "s" : ""} found` });
    } catch (e: any) {
      toast({ title: "Audit failed", description: e.message, variant: "destructive" });
    }
    setAuditing(false);
  };

  const ignoreMutation = useMutation({
    mutationFn: async ({ warningId, ignore }: { warningId: number; ignore: boolean }) => {
      const patch = ignore
        ? { ignored: true, ignored_by: user?.id ?? null, ignored_at: new Date().toISOString() }
        : { ignored: false, ignored_by: null, ignored_at: null };
      const { error } = await supabase.from("estimate_warnings").update(patch).eq("id", warningId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchWarnings();
      qc.invalidateQueries({ queryKey: ["estimate-warnings", estimateId] });
    },
    onError: (e: any) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const isLocked = estimate?.status !== "draft" && estimate != null;
  const busy = saving || auditing;

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
        <div className="flex items-center gap-2 mt-1">
          <Button
            onClick={handleAudit}
            disabled={!estimateId || busy || isLocked}
            variant="outline"
            className="gap-2 relative"
          >
            {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Run Audit
            {activeWarningCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {activeWarningCount}
              </span>
            )}
          </Button>
          <Button onClick={handleSave} disabled={busy || isLocked} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save estimate
          </Button>
        </div>
      </div>

      {/* Line items */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>Add labour and material line items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item, idx) => {
              const itemWarnings = item.id ? (itemLevelByItem.get(item.id) ?? []) : [];
              const activeItemWarnings = itemWarnings.filter((w) => !w.ignored);
              const ignoredItemWarnings = itemWarnings.filter((w) => w.ignored);
              const marketRate = item.category_id ? findMarketRate(marketRates, item.category_id, item.unit_type) : null;
              const rowAssemblies = item.category_id ? assemblies.filter((a) => String(a.category_id) === item.category_id) : [];
              return (
                <div key={idx}>
                  <div className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-muted/30 border border-border/60">
                    <div className="col-span-12 sm:col-span-3">
                      <Select
                        value={item.category_id}
                        onValueChange={(v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, category_id: v, assembly_id: null, material_from_assembly: false } : it))}
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
                          placeholder={labourPlaceholder(item.unit_type)}
                          value={item.unit_cost}
                          onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_cost: e.target.value } : it))}
                          disabled={isLocked}
                        />
                        {(item.unit_type === "hour" || item.unit_type === "day") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Labour rate guidance"
                                tabIndex={-1}
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-snug">
                              Enter the total cost for this rate, not a per-person rate. E.g. 3 workers at $75/hr = enter $225.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {marketRate && (
                        <p className="text-[10px] text-muted-foreground/70 leading-tight mt-1 px-0.5">
                          Typical: ${formatRate(marketRate.typical_rate)}/{UNIT_LABEL[item.unit_type] ?? "unit"} (range ${formatRate(marketRate.low_rate)}–${formatRate(marketRate.high_rate)})
                        </p>
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          className="h-8 text-xs pl-5"
                          placeholder={materialPlaceholder(item.unit_type)}
                          value={item.material_cost}
                          onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, material_cost: e.target.value, material_from_assembly: false } : it))}
                          disabled={isLocked}
                        />
                      </div>
                      {item.material_from_assembly && (
                        <div className="flex items-center gap-1 mt-0.5 px-0.5">
                          <Package className="h-2.5 w-2.5 text-muted-foreground/60" />
                          <span className="text-[9px] text-muted-foreground/60">from assembly</span>
                        </div>
                      )}
                      {rowAssemblies.length > 0 && !isLocked && (
                        <Select
                          value={item.assembly_id ?? ""}
                          onValueChange={(v) => {
                            if (v === "none") {
                              setItems((prev) => prev.map((it, i) => i === idx ? { ...it, assembly_id: null, material_from_assembly: false } : it));
                            } else {
                              const assembly = rowAssemblies.find((a) => String(a.id) === v);
                              if (assembly) {
                                const cost = calcAssemblyMaterialCost(assembly.materials ?? []);
                                setItems((prev) => prev.map((it, i) => i === idx ? { ...it, assembly_id: v, material_cost: cost.toFixed(2), material_from_assembly: true } : it));
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-6 text-[10px] mt-0.5"><SelectValue placeholder="Use assembly…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {rowAssemblies.map((a) => (
                              <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.quality_tier ? ` (${a.quality_tier})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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
                  {(() => {
                    const cap = itemMathCaption(item);
                    if (!cap) return null;
                    const showLabour = parseFloat(item.unit_cost || "0") > 0;
                    const showMaterial = parseFloat(item.material_cost || "0") > 0;
                    if (!showLabour && !showMaterial) return null;
                    return (
                      <p className="px-3 pt-1.5 text-[10px] text-muted-foreground tabular-nums leading-snug" style={{ fontFamily: "var(--font-mono)" }}>
                        {showLabour && <span className="mr-3">{cap.labour}</span>}
                        {showMaterial && <span>{cap.material}</span>}
                      </p>
                    );
                  })()}
                  {activeItemWarnings.length > 0 && (
                    <div className="ml-3 mr-3 mb-1 space-y-1.5">
                      {activeItemWarnings.map((w) => (
                        <WarningRow
                          key={w.id}
                          warning={w}
                          onIgnore={() => ignoreMutation.mutate({ warningId: w.id, ignore: true })}
                          disabling={ignoreMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                  {showIgnored && ignoredItemWarnings.length > 0 && (
                    <div className="ml-3 mr-3 mb-1 space-y-1.5">
                      {ignoredItemWarnings.map((w) => (
                        <WarningRow
                          key={w.id}
                          warning={w}
                          onUnignore={() => ignoreMutation.mutate({ warningId: w.id, ignore: false })}
                          disabling={ignoreMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!isLocked && (
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setItems((p) => [...p, { ...EMPTY_LINE_ITEM }])}>
              <Plus className="h-4 w-4" /> Add line item
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Estimate-level warnings panel */}
      {(activeEstimateLevel.length > 0 || (showIgnored && ignoredEstimateLevel.length > 0) || ignoredCount > 0) && (
        <Card className="mb-4 border-amber-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">Estimate-level warnings</CardTitle>
                {activeEstimateLevel.length > 0 && (
                  <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                    {activeEstimateLevel.length} active
                  </Badge>
                )}
              </div>
              {ignoredCount > 0 && (
                <button
                  onClick={() => setShowIgnored((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showIgnored ? "Hide ignored" : `Show ignored (${ignoredCount})`}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {activeEstimateLevel.map((w) => (
              <WarningRow
                key={w.id}
                warning={w}
                onIgnore={() => ignoreMutation.mutate({ warningId: w.id, ignore: true })}
                disabling={ignoreMutation.isPending}
              />
            ))}
            {showIgnored && ignoredEstimateLevel.map((w) => (
              <WarningRow
                key={w.id}
                warning={w}
                onUnignore={() => ignoreMutation.mutate({ warningId: w.id, ignore: false })}
                disabling={ignoreMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

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

function WarningRow({
  warning,
  onIgnore,
  onUnignore,
  disabling,
}: {
  warning: EstimateWarning;
  onIgnore?: () => void;
  onUnignore?: () => void;
  disabling: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
        warning.ignored
          ? "border-border/40 bg-muted/20 text-muted-foreground line-through"
          : "border-amber-500/30 bg-amber-500/5 text-amber-900"
      }`}
    >
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${warning.ignored ? "text-muted-foreground" : "text-amber-500"}`} />
        <div className="min-w-0">
          <p className="leading-snug">{warning.message}</p>
          {warning.percent_diff && !warning.ignored && (
            <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-700 tabular-nums">
              {warning.percent_diff}% variance
            </span>
          )}
        </div>
      </div>
      {!warning.ignored && onIgnore && (
        <button
          onClick={onIgnore}
          disabled={disabling}
          className="shrink-0 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-50"
        >
          Ignore
        </button>
      )}
      {warning.ignored && onUnignore && (
        <button
          onClick={onUnignore}
          disabled={disabling}
          className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Unignore
        </button>
      )}
    </div>
  );
}
