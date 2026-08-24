import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Trash2, Lock, Loader2, Save, ShieldCheck, AlertTriangle, Info, Package, Eye, Gauge, Sparkles, Paperclip, X, FileText, ArrowLeft, ChevronRight, Pencil, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useUpload } from "@/hooks/use-upload";

import { type LineItem, calcItemTotal, computeEstimateTotals, lineItemHasInvalidNumbers } from "@/lib/estimate-math";

interface EstimateWarning {
  id: number;
  estimate_item_id: number | null;
  estimate_id: number | null;
  warning_type: string;
  message: string;
  percent_diff: string | null;
  ignored: boolean;
  source: string;
}

interface EstimateStatusHistoryEntry {
  id: number;
  action: "approved" | "unlocked";
  reason: string | null;
  performed_at: string;
  profiles: { name: string } | null;
}

interface AuditResponse {
  warnings: EstimateWarning[];
  counts: Record<string, number>;
  ai_parse_failed?: boolean;
}

interface ClientReviewResponse {
  warnings: EstimateWarning[];
  count: number;
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
  ai_suggested: false,
};

/**
 * Strips a quantity/cost input down to a valid non-negative decimal (or
 * empty string, so the field can still be cleared while editing). Applied
 * to the full resulting value on every change, so it also sanitizes paste
 * — not just keystrokes.
 */
function sanitizeNumericInput(value: string): string {
  if (value === "") return "";
  const digitsAndDots = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = digitsAndDots.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

function hasContent(item: LineItem): boolean {
  if (item.category_id) return true;
  if (item.custom_category.trim()) return true;
  if (parseFloat(item.unit_cost || "0") !== 0) return true;
  if (parseFloat(item.material_cost || "0") !== 0) return true;
  if (item.room.trim()) return true;
  if (item.notes.trim()) return true;
  return false;
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
  const { projectId: projectIdParam, estimateId: estimateIdParam } = useParams<{ projectId: string; estimateId: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const projectId = parseInt(projectIdParam);
  const estimateIdFromRoute = parseInt(estimateIdParam);
  const { user } = useAuth();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("name, code, region").eq("id", projectId).maybeSingle();
      return data;
    },
  });

  const { data: estimate, isLoading: estimateLoading } = useQuery({
    queryKey: ["estimate", estimateIdFromRoute],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_estimates")
        .select("*, items:estimate_items(*)")
        .eq("id", estimateIdFromRoute)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!estimateIdFromRoute,
  });

  const { data: estimateDocument } = useQuery({
    queryKey: ["estimate-document", estimate?.document_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, url")
        .eq("id", estimate!.document_id as number)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!estimate?.document_id,
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

  const { data: statusHistory = [] } = useQuery<EstimateStatusHistoryEntry[]>({
    queryKey: ["estimate-status-history", estimateIdFromRoute],
    queryFn: async () => {
      if (!estimateIdFromRoute) return [];
      const { data, error } = await supabase
        .from("estimate_status_history")
        .select("id, action, reason, performed_at, profiles(name)")
        .eq("estimate_id", estimateIdFromRoute)
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EstimateStatusHistoryEntry[];
    },
    enabled: !!estimateIdFromRoute,
  });

  const [approving, setApproving] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [attachingDocument, setAttachingDocument] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const estimateId = estimateIdFromRoute;

  useEffect(() => {
    if (Number.isNaN(estimateIdFromRoute)) {
      navigate(`/project/${projectId}/estimates`);
    }
  }, [estimateIdFromRoute, projectId, navigate]);

  if (Number.isNaN(estimateIdFromRoute)) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { data: warnings = [], refetch: refetchWarnings } = useQuery<EstimateWarning[]>({
    queryKey: ["estimate-warnings", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_warnings")
        .select("id, estimate_item_id, estimate_id, warning_type, message, percent_diff, ignored, source")
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
  const [reviewing, setReviewing] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftSuggestions, setDraftSuggestions] = useState<any[] | null>(null);
  const [draftSelections, setDraftSelections] = useState<Record<number, { checked: boolean; assemblyId: string | null }>>({});
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useUpload();

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
          assembly_id: i.assembly_id != null ? String(i.assembly_id) : null,
          material_from_assembly: i.material_from_assembly ?? false,
          ai_suggested: i.ai_suggested ?? false,
        })));
      }
    }
  }, [estimate]);

  const { subtotal, contingency, markup, managementFee, total } =
    computeEstimateTotals(items, { contingencyPct, markupEnabled, markupPct, managementFeeEnabled, managementFeePct });

  const hasInvalidItems = items.some(lineItemHasInvalidNumbers);

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

  const auditWarnings = useMemo(() => warnings.filter((w) => w.source === "audit"), [warnings]);
  const clientReviewWarnings = useMemo(() => warnings.filter((w) => w.source === "client_review"), [warnings]);

  const estimateLevelWarnings = useMemo(
    () => auditWarnings.filter((w) => w.estimate_id != null && w.estimate_item_id == null),
    [auditWarnings],
  );
  const activeEstimateLevel = estimateLevelWarnings.filter((w) => !w.ignored);
  const ignoredEstimateLevel = estimateLevelWarnings.filter((w) => w.ignored);

  const clientReviewEstimateLevel = useMemo(
    () => clientReviewWarnings.filter((w) => w.estimate_id != null && w.estimate_item_id == null),
    [clientReviewWarnings],
  );
  const activeClientReviewEstimateLevel = clientReviewEstimateLevel.filter((w) => !w.ignored);
  const ignoredClientReviewEstimateLevel = clientReviewEstimateLevel.filter((w) => w.ignored);

  const ignoredCount = ignoredEstimateLevel.length;
  const activeWarningCount = auditWarnings.filter((w) => !w.ignored).length;
  const activeClientReviewCount = clientReviewWarnings.filter((w) => !w.ignored).length;

  const confidenceScore = useMemo(() => {
    const active = auditWarnings.filter((w) => !w.ignored);
    const costComplCount = active.filter((w) => ["price_outlier", "zero_cost", "duplicate"].includes(w.warning_type)).length;
    const scopeCount = active.filter((w) => w.warning_type === "missing_scope").length;
    const uncategorizedCount = active.filter((w) => w.warning_type === "uncategorized").length;
    const missingModCount = active.filter((w) => w.warning_type === "missing_modifier").length;
    const clientClarityCount = clientReviewWarnings.filter((w) => !w.ignored && w.warning_type === "unclear_scope").length;

    const hasRegion = project?.region != null;
    const everChecked = estimate?.last_audited_at != null && estimate?.last_client_reviewed_at != null;

    type Band = "High" | "Medium" | "Low" | "Needs review" | "Not applicable" | "Not yet reviewed";
    const bandValue = (b: Band): number | null => {
      if (b === "High") return 100;
      if (b === "Medium") return 60;
      if (b === "Low") return 20;
      if (b === "Needs review") return 40;
      return null;
    };

    const costBand: Band = costComplCount === 0 ? "High" : costComplCount <= 2 ? "Medium" : "Low";
    const scopeBand: Band = scopeCount === 0 ? "High" : scopeCount <= 2 ? "Medium" : "Low";
    const clientReviewEverRun = estimate?.last_client_reviewed_at != null;
    const clientBand: Band = !clientReviewEverRun ? "Not yet reviewed" : clientClarityCount === 0 ? "High" : clientClarityCount <= 2 ? "Medium" : "Low";
    const uncategorizedBand: Band = uncategorizedCount === 0 ? "High" : "Needs review";
    const regionalBand: Band = missingModCount > 0 ? "Needs review" : hasRegion ? "High" : "Not applicable";

    const parts = [costBand, scopeBand, clientBand, uncategorizedBand, regionalBand];
    const numeric = parts.map(bandValue).filter((v): v is number => v != null);
    const overall = numeric.length > 0 ? Math.round(numeric.reduce((a, b) => a + b, 0) / numeric.length) : null;

    return {
      everChecked, overall,
      subScores: [
        { label: "Cost completeness", band: costBand, count: costComplCount, reason: costComplCount === 0 ? "no unresolved pricing warnings" : `${costComplCount} unresolved pricing warning${costComplCount !== 1 ? "s" : ""}` },
        { label: "Scope completeness", band: scopeBand, count: scopeCount, reason: scopeCount === 0 ? "all expected scope items present" : `${scopeCount} missing scope warning${scopeCount !== 1 ? "s" : ""}` },
        { label: "Client clarity", band: clientBand, count: clientClarityCount, reason: clientBand === "Not yet reviewed" ? "client review not yet run" : clientClarityCount === 0 ? "no unclear items flagged" : `${clientClarityCount} unclear item${clientClarityCount !== 1 ? "s" : ""}` },
        { label: "Uncategorized items", band: uncategorizedBand, count: uncategorizedCount, reason: uncategorizedCount === 0 ? "all items categorized" : `${uncategorizedCount} uncategorized item${uncategorizedCount !== 1 ? "s" : ""}` },
        { label: "Regional pricing", band: regionalBand, count: missingModCount, reason: missingModCount > 0 ? `${missingModCount} unresolved regional pricing warning${missingModCount !== 1 ? "s" : ""}` : hasRegion ? "regional modifiers applied" : "no region set for this project" },
      ],
    };
  }, [auditWarnings, clientReviewWarnings, warnings, project?.region, estimate?.last_audited_at, estimate?.last_client_reviewed_at]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const realItems = items.filter(hasContent);
      const { error } = await supabase.rpc("save_estimate", {
        p_estimate_id: estimateIdFromRoute,
        p_markup_enabled: markupEnabled,
        p_markup_percent: markupPct,
        p_contingency_percent: contingencyPct,
        p_management_fee_enabled: managementFeeEnabled,
        p_management_fee_percent: managementFeePct,
        p_items: realItems.map((item) => ({
          category_id: item.category_id || null,
          custom_category: item.custom_category || null,
          room: item.room || null,
          quantity: item.quantity,
          unit_type: item.unit_type,
          unit_cost: item.unit_cost,
          material_cost: item.material_cost,
          notes: item.notes || null,
          assembly_id: item.assembly_id || null,
          material_from_assembly: item.material_from_assembly,
          ai_suggested: item.ai_suggested,
        })),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["estimate", estimateIdFromRoute] });
      qc.invalidateQueries({ queryKey: ["project-estimates", projectId] });
      toast({ title: "Estimate saved" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error saving";
      toast({ title: "Error saving", description: message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleRename = async () => {
    const name = renameValue.trim();
    if (!name) return;
    setRenaming(true);
    try {
      const { error } = await supabase.from("project_estimates").update({ name }).eq("id", estimateIdFromRoute);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["estimate", estimateIdFromRoute] });
      qc.invalidateQueries({ queryKey: ["project-estimates", projectId] });
      setRenameOpen(false);
      toast({ title: "Estimate renamed" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Rename failed";
      toast({ title: "Rename failed", description: message, variant: "destructive" });
    }
    setRenaming(false);
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { error } = await supabase.rpc("approve_estimate", { p_estimate_id: estimateIdFromRoute });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["estimate", estimateIdFromRoute] });
      qc.invalidateQueries({ queryKey: ["project-estimates", projectId] });
      qc.invalidateQueries({ queryKey: ["estimate-status-history", estimateId] });
      toast({ title: "Estimate approved and locked" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Approve failed";
      toast({ title: "Approve failed", description: message, variant: "destructive" });
    }
    setApproving(false);
  };

  const handleUnlock = async () => {
    const reason = unlockReason.trim();
    if (!reason) return;
    setUnlocking(true);
    try {
      const { error } = await supabase.rpc("unlock_estimate", { p_estimate_id: estimateIdFromRoute, p_reason: reason });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["estimate", estimateIdFromRoute] });
      qc.invalidateQueries({ queryKey: ["project-estimates", projectId] });
      qc.invalidateQueries({ queryKey: ["estimate-status-history", estimateId] });
      setUnlockOpen(false);
      setUnlockReason("");
      toast({ title: "Estimate unlocked" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unlock failed";
      toast({ title: "Unlock failed", description: message, variant: "destructive" });
    }
    setUnlocking(false);
  };

  const handleAttachDocument = async (file: File) => {
    setAttachingDocument(true);
    try {
      const result = await uploadFile(file);
      if (!result) throw new Error("Upload failed");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "file";
      const title = file.name.replace(/\.[^/.]+$/, "");
      const { error } = await supabase.rpc("attach_estimate_document", {
        p_estimate_id: estimateIdFromRoute,
        p_title: title,
        p_url: result.objectPath,
        p_type: ext,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["estimate", estimateIdFromRoute] });
      toast({ title: "Document attached" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attach failed";
      toast({ title: "Attach failed", description: message, variant: "destructive" });
    }
    setAttachingDocument(false);
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
      const freshActive = (fresh.data ?? []).filter((w) => !w.ignored && w.source === "audit").length;
      toast({ title: `Audit complete — ${freshActive} warning${freshActive !== 1 ? "s" : ""} found` });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Audit failed";
      toast({ title: "Audit failed", description: message, variant: "destructive" });
    }
    setAuditing(false);
  };

  const handleClientReview = async () => {
    if (!estimateId) return;
    setReviewing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not signed in", variant: "destructive" });
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-client-reviewer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ estimate_id: estimateId }),
      });
      const json: ClientReviewResponse = await res.json();
      if (!res.ok) {
        throw new Error(json && (json as any).error ? (json as any).error : `Client review failed (${res.status})`);
      }
      const fresh = await refetchWarnings();
      const freshActive = (fresh.data ?? []).filter((w) => !w.ignored && w.source === "client_review").length;
      toast({
        title: freshActive > 0
          ? `Client review complete — ${freshActive} item${freshActive !== 1 ? "s" : ""} flagged`
          : "Client review complete — no unclear items found",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Client review failed";
      toast({ title: "Client review failed", description: message, variant: "destructive" });
    }
    setReviewing(false);
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
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Update failed";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    },
  });

  const isLocked = estimate?.status !== "draft" && estimate != null;
  const busy = saving || auditing || reviewing || generating || approving || unlocking;

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not signed in", variant: "destructive" });
        return;
      }
      let fileRefs: { url: string; mime_type: string; name: string }[] = [];
      if (draftFiles.length > 0) {
        setUploading(true);
        for (const file of draftFiles) {
          const result = await uploadFile(file);
          if (result) {
            fileRefs.push({ url: result.objectPath, mime_type: file.type, name: file.name });
          }
        }
        setUploading(false);
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-generator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ project_id: projectId, files: fileRefs.length > 0 ? fileRefs : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Generate failed (${res.status})`);
      setDraftSuggestions(json.suggestions ?? []);
      setDraftSelections({});
    } catch (e) {
      const message = e instanceof Error ? e.message : "Generate draft failed";
      toast({ title: "Generate draft failed", description: message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleAddDraftItems = () => {
    const selected = (draftSuggestions ?? []).filter((s) => draftSelections[s.category_id]?.checked);
    if (selected.length === 0) {
      setDraftSuggestions(null);
      return;
    }
    const newItems: LineItem[] = selected.map((s) => {
      const sel = draftSelections[s.category_id];
      const chosenAssembly = sel?.assemblyId ? s.assemblies?.find((a: any) => String(a.id) === sel.assemblyId) : null;
      const cat = (categories ?? []).find((c: any) => String(c.id) === String(s.category_id));
      const hasQty = typeof s.quantity === "number" && s.quantity > 0;
      const note = hasQty && s.quantity_source ? s.quantity_source : "";
      return {
        ...EMPTY_LINE_ITEM,
        category_id: String(s.category_id),
        quantity: hasQty ? String(s.quantity) : "",
        unit_type: s.unit_type ?? cat?.default_unit_type ?? "sq_ft",
        unit_cost: s.market_rate?.typical ?? "",
        material_cost: chosenAssembly ? String(chosenAssembly.material_cost_per_unit) : "",
        notes: note,
        assembly_id: chosenAssembly ? String(chosenAssembly.id) : null,
        material_from_assembly: !!chosenAssembly,
        ai_suggested: true,
      };
    });
    setItems((prev) => [...prev, ...newItems]);
    setDraftSuggestions(null);
    setDraftSelections({});
    setDraftFiles([]);
    toast({ title: `Added ${newItems.length} draft line item${newItems.length !== 1 ? "s" : ""}` });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/project/${projectId}/estimates`)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> All estimates
      </button>
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{project?.name}{project?.code ? ` · ${project.code}` : ""}</p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => { setRenameValue(estimate?.name ?? ""); setRenameOpen(true); }}
              disabled={isLocked}
              className="group flex items-center gap-2 hover:opacity-80 transition-opacity disabled:hover:opacity-100 disabled:cursor-default"
            >
              <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
                {estimate?.name || "Cost Estimator"}
              </h1>
              {!isLocked && <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
            </button>
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
          <Button
            onClick={handleClientReview}
            disabled={!estimateId || busy || isLocked}
            variant="outline"
            className="gap-2 relative"
          >
            {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Review for Client
            {activeClientReviewCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {activeClientReviewCount}
              </span>
            )}
          </Button>
          <Button onClick={handleSave} disabled={busy || isLocked} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save estimate
          </Button>
          {isLocked ? (
            <Button onClick={() => setUnlockOpen(true)} disabled={busy} variant="outline" className="gap-2">
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Unlock
            </Button>
          ) : (
            <Button onClick={handleApprove} disabled={!estimateId || busy} variant="outline" className="gap-2">
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Approve
            </Button>
          )}
        </div>
      </div>

      {statusHistory.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-muted-foreground" /> Approval history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusHistory.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <Badge variant={entry.action === "approved" ? "success" : "secondary"} className="shrink-0 mt-0.5">
                  {entry.action === "approved" ? "Approved" : "Unlocked"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground">
                    {formatDate(entry.performed_at)} by {entry.profiles?.name ?? "Admin"}
                  </span>
                  {entry.reason && <p className="text-foreground mt-0.5">{entry.reason}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isLocked && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 text-muted-foreground" /> Client document
            </CardTitle>
            <CardDescription>Optional - attach a document (e.g. a signed proposal) to show a link on the client's estimate card.</CardDescription>
          </CardHeader>
          <CardContent>
            {estimateDocument ? (
              <a
                href={estimateDocument.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground truncate flex-1">{estimateDocument.title}</span>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">No document attached yet.</p>
            )}
            <input
              ref={documentInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAttachDocument(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 mt-2"
              disabled={attachingDocument}
              onClick={() => documentInputRef.current?.click()}
            >
              {attachingDocument ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              {estimateDocument ? "Replace document" : "Attach document"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Line items */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>Add labour and material line items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.length > 0 && (
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <div className="sm:col-span-3">Category</div>
                <div className="sm:col-span-2">Room</div>
                <div className="sm:col-span-1">Qty</div>
                <div className="sm:col-span-1">Unit</div>
                <div className="sm:col-span-2">Labour cost</div>
                <div className="sm:col-span-2">Material cost</div>
                <div className="sm:col-span-1">Total</div>
              </div>
            )}
            {items.map((item, idx) => {
              const itemWarnings = item.id ? (itemLevelByItem.get(item.id) ?? []) : [];
              const activeItemWarnings = itemWarnings.filter((w) => !w.ignored && w.source === "audit");
              const ignoredItemWarnings = itemWarnings.filter((w) => w.ignored && w.source === "audit");
              const activeClientItemWarnings = itemWarnings.filter((w) => !w.ignored && w.source === "client_review");
              const ignoredClientItemWarnings = itemWarnings.filter((w) => w.ignored && w.source === "client_review");
              const marketRate = item.category_id ? findMarketRate(marketRates, item.category_id, item.unit_type) : null;
              const rowAssemblies = item.category_id ? assemblies.filter((a) => String(a.category_id) === item.category_id) : [];
              const numbersInvalid = lineItemHasInvalidNumbers(item);
              return (
                <div key={idx}>
                  <div className={`grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-muted/30 border ${numbersInvalid ? "border-destructive/60" : "border-border/60"}`}>
                    <div className="col-span-12 sm:col-span-3">
                      <Select
                        value={item.category_id}
                        onValueChange={(v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, category_id: v, assembly_id: null, material_from_assembly: false, ai_suggested: false } : it))}
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
                        onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, room: e.target.value, ai_suggested: false } : it))}
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Input
                        className="h-8 text-xs text-right"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => { const v = sanitizeNumericInput(e.target.value); setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: v, ai_suggested: false } : it)); }}
                        inputMode="decimal"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Select
                        value={item.unit_type}
                        onValueChange={(v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_type: v, ai_suggested: false } : it))}
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
                      <p className="text-[9px] text-muted-foreground/70 mb-0.5 px-0.5 sm:hidden">Labour cost</p>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          className="h-8 text-xs pl-5"
                          placeholder={labourPlaceholder(item.unit_type)}
                          value={item.unit_cost}
                          onChange={(e) => { const v = sanitizeNumericInput(e.target.value); setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_cost: v, ai_suggested: false } : it)); }}
                          inputMode="decimal"
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
                      <p className="text-[9px] text-muted-foreground/70 mb-0.5 px-0.5 sm:hidden">Material cost</p>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          className="h-8 text-xs pl-5"
                          placeholder={materialPlaceholder(item.unit_type)}
                          value={item.material_cost}
                          onChange={(e) => { const v = sanitizeNumericInput(e.target.value); setItems((prev) => prev.map((it, i) => i === idx ? { ...it, material_cost: v, material_from_assembly: false, ai_suggested: false } : it)); }}
                          inputMode="decimal"
                          disabled={isLocked}
                        />
                      </div>
                      {item.material_from_assembly && (
                        <div className="flex items-center gap-1 mt-0.5 px-0.5">
                          <Package className="h-2.5 w-2.5 text-muted-foreground/60" />
                          <span className="text-[9px] text-muted-foreground/60">from assembly</span>
                        </div>
                      )}
                      {item.ai_suggested && (
                        <div className="flex items-center gap-1 mt-0.5 px-0.5">
                          <Sparkles className="h-2.5 w-2.5 text-primary/50" />
                          <span className="text-[9px] text-primary/50">AI-suggested</span>
                        </div>
                      )}
                      {rowAssemblies.length > 0 && !isLocked && (
                        <Select
                          value={item.assembly_id ?? ""}
                          onValueChange={(v) => {
                            if (v === "none") {
                              setItems((prev) => prev.map((it, i) => i === idx ? { ...it, assembly_id: null, material_from_assembly: false, ai_suggested: false } : it));
                            } else {
                              const assembly = rowAssemblies.find((a) => String(a.id) === v);
                              if (assembly) {
                                const cost = calcAssemblyMaterialCost(assembly.materials ?? []);
                                setItems((prev) => prev.map((it, i) => i === idx ? { ...it, assembly_id: v, material_cost: cost.toFixed(2), material_from_assembly: true, ai_suggested: false } : it));
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
                      <span className="text-xs font-medium tabular-nums flex items-center gap-1" style={{ fontFamily: "var(--font-mono)" }}>
                        {numbersInvalid && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs leading-snug">
                              Invalid quantity, unit cost, or material cost — excluded from the total until fixed.
                            </TooltipContent>
                          </Tooltip>
                        )}
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
                  {activeClientItemWarnings.length > 0 && (
                    <div className="ml-3 mr-3 mb-1 space-y-1.5">
                      {activeClientItemWarnings.map((w) => (
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
                  {showIgnored && ignoredClientItemWarnings.length > 0 && (
                    <div className="ml-3 mr-3 mb-1 space-y-1.5">
                      {ignoredClientItemWarnings.map((w) => (
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
            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setItems((p) => [...p, { ...EMPTY_LINE_ITEM }])}>
                  <Plus className="h-4 w-4" /> Add line item
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleGenerateDraft} disabled={busy || generating || uploading}>
                  {generating || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {uploading ? "Uploading files…" : generating ? "Generating…" : "Generate Draft"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setDraftFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || generating || uploading}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {draftFiles.length > 0 ? `${draftFiles.length} file${draftFiles.length !== 1 ? "s" : ""} attached` : "Attach plans"}
                </Button>
              </div>
              {draftFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {draftFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                      {file.type === "application/pdf" ? (
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="max-w-[160px] truncate text-foreground">{file.name}</span>
                      <button
                        onClick={() => setDraftFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estimate confidence score */}
      <ConfidenceScoreCard score={confidenceScore} />

      {/* Estimate-level audit warnings panel */}
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

      {/* Client clarity review warnings panel */}
      {(activeClientReviewEstimateLevel.length > 0 || (showIgnored && ignoredClientReviewEstimateLevel.length > 0)) && (
        <Card className="mb-4 border-blue-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-base">Client clarity review</CardTitle>
                {activeClientReviewEstimateLevel.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 border-blue-500/30">
                    {activeClientReviewEstimateLevel.length} active
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {activeClientReviewEstimateLevel.map((w) => (
              <WarningRow
                key={w.id}
                warning={w}
                onIgnore={() => ignoreMutation.mutate({ warningId: w.id, ignore: true })}
                disabling={ignoreMutation.isPending}
              />
            ))}
            {showIgnored && ignoredClientReviewEstimateLevel.map((w) => (
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
      {hasInvalidItems && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          One or more line items have an invalid quantity, unit cost, or material cost — flagged in red below and excluded from the total until fixed.
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Hero total */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Estimate Total</p>
              <p className="text-4xl font-semibold text-foreground tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)" }}>
                {formatCurrency(total)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Base {formatCurrency(subtotal)} · {items.filter(hasContent).length} line item{items.filter(hasContent).length !== 1 ? "s" : ""}</p>
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
                <Input className="h-7 w-16 text-xs" value={contingencyPct} onChange={(e) => setContingencyPct(sanitizeNumericInput(e.target.value))} inputMode="decimal" disabled={isLocked} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(contingency)}</p>
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs text-muted-foreground">Markup</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    25% default markup is consistent with sustainable blended markup ranges (20%-35%) documented for small, high-touch Muskoka renovation builders. Source: Muskoka builder markup research, 2026.
                  </TooltipContent>
                </Tooltip>
                <Switch checked={markupEnabled} onCheckedChange={setMarkupEnabled} disabled={isLocked} className="scale-75 origin-left" />
              </div>
              <div className="flex items-center gap-1">
                <Input className="h-7 w-16 text-xs" value={markupPct} onChange={(e) => setMarkupPct(sanitizeNumericInput(e.target.value))} inputMode="decimal" disabled={!markupEnabled || isLocked} />
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
                <Input className="h-7 w-16 text-xs" value={managementFeePct} onChange={(e) => setManagementFeePct(sanitizeNumericInput(e.target.value))} inputMode="decimal" disabled={!managementFeeEnabled || isLocked} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(managementFee)}</p>
          </div>
        </div>
      </div>

      <GenerateDraftDialog
        suggestions={draftSuggestions}
        selections={draftSelections}
        onSelections={setDraftSelections}
        onAdd={handleAddDraftItems}
        onCancel={() => { setDraftSuggestions(null); setDraftSelections({}); }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-1">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !renaming && renameValue.trim()) handleRename(); }}
              placeholder="e.g. Budget Option"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming || !renameValue.trim()}>
              {renaming && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlockOpen} onOpenChange={(o) => { setUnlockOpen(o); if (!o) setUnlockReason(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock estimate</DialogTitle>
            <DialogDescription>
              This estimate is approved and locked. Unlocking it lets you make changes, but is logged in the
              approval history with the reason below — it can't be undone quietly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-1">
            <Label htmlFor="unlock-reason">Reason for unlocking</Label>
            <Textarea
              id="unlock-reason"
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="e.g. Client requested a change to the tile allowance"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>Cancel</Button>
            <Button onClick={handleUnlock} disabled={unlocking || !unlockReason.trim()}>
              {unlocking && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Unlock estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DraftSuggestion {
  category_id: number;
  category_name: string;
  reason: string;
  unit_type: string | null;
  market_rate: { typical: string; low: string; high: string } | null;
  assemblies: Array<{ id: number; name: string; material_cost_per_unit: number }>;
  no_rate_data: boolean;
  quantity: number | null;
  quantity_source: string | null;
}

function GenerateDraftDialog({
  suggestions,
  selections,
  onSelections,
  onAdd,
  onCancel,
}: {
  suggestions: DraftSuggestion[] | null;
  selections: Record<number, { checked: boolean; assemblyId: string | null }>;
  onSelections: (s: Record<number, { checked: boolean; assemblyId: string | null }>) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const open = suggestions !== null;
  const checkedCount = Object.values(selections).filter((s) => s.checked).length;

  const toggle = (catId: number) => {
    onSelections({
      ...selections,
      [catId]: { checked: !selections[catId]?.checked, assemblyId: selections[catId]?.assemblyId ?? null },
    });
  };

  const setAssembly = (catId: number, assemblyId: string | null) => {
    onSelections({
      ...selections,
      [catId]: { checked: true, assemblyId },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggested Categories
          </DialogTitle>
          <DialogDescription>
            Review these AI-suggested categories based on your project description. Select what you want to add — nothing is pre-selected.
          </DialogDescription>
        </DialogHeader>

        {suggestions !== null && suggestions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Not enough project detail to suggest categories — try adding a project description, or add line items manually.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions?.map((s) => {
              const sel = selections[s.category_id];
              const isChecked = sel?.checked ?? false;
              const hasQty = typeof s.quantity === "number" && s.quantity > 0;
              return (
                <div key={s.category_id} className={`rounded-lg border p-3 transition-colors ${isChecked ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={isChecked} onCheckedChange={() => toggle(s.category_id)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.category_name}</span>
                        {s.unit_type && <span className="text-xs text-muted-foreground">/ {s.unit_type}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                      <div className="mt-2 space-y-1">
                        {hasQty ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Extracted qty:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-24 rounded border border-border bg-muted/30 px-2 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              value={s.quantity ?? ""}
                              onChange={(e) => {
                                onSelections({
                                  ...selections,
                                  [s.category_id]: { checked: true, assemblyId: sel?.assemblyId ?? null },
                                });
                              }}
                              data-suggestion-qty={s.category_id}
                            />
                            <span className="text-muted-foreground">{s.unit_type ?? "unit"}</span>
                            {s.quantity_source && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                                <FileText className="h-2.5 w-2.5" />
                                {s.quantity_source}
                              </span>
                            )}
                          </div>
                        ) : null}
                        {s.market_rate ? (
                          <p className="text-xs text-muted-foreground">
                            Typical: ${s.market_rate.typical}/{s.unit_type} (range ${s.market_rate.low}-${s.market_rate.high})
                          </p>
                        ) : s.no_rate_data ? (
                          <p className="text-xs text-muted-foreground italic">No rate data available — you'll need to enter costs manually</p>
                        ) : null}
                        {s.assemblies.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Assemblies (optional):</p>
                            {s.assemblies.map((a) => (
                              <label key={a.id} className="flex items-center gap-2 text-xs ml-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`assembly-${s.category_id}`}
                                  checked={sel?.assemblyId === String(a.id)}
                                  onChange={() => setAssembly(s.category_id, String(a.id))}
                                  className="h-3 w-3"
                                />
                                <span>{a.name} (${a.material_cost_per_unit}/unit)</span>
                              </label>
                            ))}
                            {isChecked && sel?.assemblyId && (
                              <label className="flex items-center gap-2 text-xs ml-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`assembly-${s.category_id}`}
                                  checked={sel.assemblyId === ""}
                                  onChange={() => setAssembly(s.category_id, "")}
                                  className="h-3 w-3"
                                />
                                <span className="text-muted-foreground">No assembly (use manual material cost)</span>
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          {suggestions !== null && suggestions.length > 0 && (
            <Button size="sm" onClick={onAdd} disabled={checkedCount === 0}>
              Add selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ConfidenceBand = "High" | "Medium" | "Low" | "Needs review" | "Not applicable" | "Not yet reviewed";

interface ConfidenceSubScore {
  label: string;
  band: ConfidenceBand;
  count: number;
  reason: string;
}

interface ConfidenceScore {
  everChecked: boolean;
  overall: number | null;
  subScores: ConfidenceSubScore[];
}

const bandColor: Record<ConfidenceBand, string> = {
  "High": "text-emerald-600",
  "Medium": "text-amber-600",
  "Low": "text-red-600",
  "Needs review": "text-orange-600",
  "Not applicable": "text-muted-foreground",
  "Not yet reviewed": "text-muted-foreground",
};

const bandBg: Record<ConfidenceBand, string> = {
  "High": "bg-emerald-500/10 border-emerald-500/30",
  "Medium": "bg-amber-500/10 border-amber-500/30",
  "Low": "bg-red-500/10 border-red-500/30",
  "Needs review": "bg-orange-500/10 border-orange-500/30",
  "Not applicable": "bg-muted/20 border-border/40",
  "Not yet reviewed": "bg-muted/20 border-border/40",
};

function ConfidenceScoreCard({ score }: { score: ConfidenceScore }) {
  if (!score.everChecked) {
    return (
      <Card className="mb-4 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base text-muted-foreground">Estimate Confidence</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Run an audit and client review to see an estimate confidence score
          </p>
        </CardContent>
      </Card>
    );
  }

  const overall = score.overall ?? 0;
  const overallColor = overall >= 80 ? "text-emerald-600" : overall >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Estimate Confidence: <span className={overallColor}>{overall}%</span></CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {score.subScores.map((s) => (
          <div key={s.label} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${bandBg[s.band]}`}>
            <div className="min-w-0">
              <span className="font-medium">{s.label}:</span>{" "}
              <span className={bandColor[s.band]}>{s.band}</span>{" "}
              <span className="text-muted-foreground">({s.reason})</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
  const isClient = warning.source === "client_review";
  const activeBorder = isClient ? "border-blue-500/30 bg-blue-500/5 text-blue-900" : "border-amber-500/30 bg-amber-500/5 text-amber-900";
  const activeIcon = isClient ? "text-blue-500" : "text-amber-500";
  const activeBtn = isClient ? "text-blue-700 hover:text-blue-900" : "text-amber-700 hover:text-amber-900";
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
        warning.ignored
          ? "border-border/40 bg-muted/20 text-muted-foreground line-through"
          : activeBorder
      }`}
    >
      <div className="flex items-start gap-2 min-w-0">
        {isClient ? (
          <Eye className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${warning.ignored ? "text-muted-foreground" : activeIcon}`} />
        ) : (
          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${warning.ignored ? "text-muted-foreground" : activeIcon}`} />
        )}
        <div className="min-w-0">
          <p className="leading-snug">{warning.message}</p>
          {warning.percent_diff && !warning.ignored && (
            <span className={`inline-block mt-0.5 text-[10px] font-semibold tabular-nums ${isClient ? "text-blue-700" : "text-amber-700"}`}>
              {warning.percent_diff}% variance
            </span>
          )}
        </div>
      </div>
      {!warning.ignored && onIgnore && (
        <button
          onClick={onIgnore}
          disabled={disabling}
          className={`shrink-0 text-[11px] font-medium transition-colors disabled:opacity-50 ${activeBtn}`}
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
