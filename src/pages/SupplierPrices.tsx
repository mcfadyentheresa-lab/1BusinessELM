import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Search, Plus, Package, ExternalLink, Loader2, Download,
  ChevronDown, Phone, Mail, MapPin, Globe, Star, Layers,
  Pencil, Trash2, Copy, Calculator, Building2, ChevronRight,
  Info, Receipt, UploadCloud, CheckCircle2, AlertCircle, X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  is_preferred: boolean;
  is_active: boolean;
  notes: string | null;
}

interface Material {
  id: number;
  product_name: string;
  product_code: string | null;
  unit_price: string;
  unit_type: string;
  product_url: string | null;
  notes: string | null;
  last_updated: string | null;
  coverage_value: number | null;
  coverage_unit: string | null;
  waste_pct: number | null;
  quality_tier: string | null;
  supplier: { id: number; name: string; is_preferred: boolean } | null;
  category: { name: string } | null;
}

interface AssemblyMaterial {
  id: number;
  material_id: number | null;
  material_name: string;
  unit_type: string;
  qty_per_sqft: number;
  unit_cost: number;
  waste_pct: number;
  notes: string | null;
  sort_order: number;
}

interface Assembly {
  id: number;
  name: string;
  description: string | null;
  quality_tier: string;
  notes: string | null;
  is_active: boolean;
  category: { name: string } | null;
  assembly_materials: AssemblyMaterial[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const UNIT_TYPES = [
  "each", "per linear ft", "sq ft", "board ft", "per sheet",
  "per bag", "roll", "gallon", "litre", "lb", "kg", "box",
  "hour", "per unit", "bundle", "cubic yard",
];

const QUALITY_COLORS: Record<string, string> = {
  basic:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  mid:     "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  premium: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function calcLineEffectiveCost(line: AssemblyMaterial): number {
  return line.unit_cost * line.qty_per_sqft * (1 + (line.waste_pct ?? 0) / 100);
}

function calcAssemblyCostPerSqft(assembly: Assembly): number {
  return assembly.assembly_materials.reduce((sum, l) => sum + calcLineEffectiveCost(l), 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SupplierCard({
  supplier, isSelected, count, onClick,
}: { supplier: Supplier; isSelected: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border px-3 py-2.5 transition-all",
        isSelected
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
          {supplier.name}
        </span>
        <span className={cn(
          "shrink-0 text-[10px] rounded-full px-1.5 py-0.5 font-medium",
          isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      </div>
      {supplier.is_preferred && (
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">
          <Star className="h-2.5 w-2.5 fill-current" /> Preferred
        </span>
      )}
    </button>
  );
}

function SupplierInfoPanel({ supplier }: { supplier: Supplier }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 mb-5">
      <div>
        <h3 className="font-semibold text-foreground text-sm" style={{ fontFamily: "var(--font-serif)" }}>
          {supplier.name}
        </h3>
        {supplier.is_preferred && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
            <Star className="h-2.5 w-2.5 fill-current" /> Preferred supplier
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {supplier.phone && (
          <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-3 w-3 shrink-0" /> <span>{supplier.phone}</span>
          </a>
        )}
        {supplier.email && (
          <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{supplier.email}</span>
          </a>
        )}
        {supplier.address && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-px" /> <span>{supplier.address}</span>
          </div>
        )}
        {supplier.website && (
          <a href={supplier.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline">
            <Globe className="h-3 w-3 shrink-0" /> Website <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      {supplier.notes && (
        <p className="text-xs text-muted-foreground border-t border-border pt-2.5 leading-relaxed">
          {supplier.notes}
        </p>
      )}
    </div>
  );
}

// ─── Receipt Scan Dialog ──────────────────────────────────────────────────────

interface ParsedReceiptItem {
  product_name: string;
  product_code: string | null;
  unit_price: number;
  unit_type: string;
  supplier_name: string | null;
  notes: string | null;
  // UI state
  _include: boolean;
  _matchId: number | null; // existing material id to update
}

function ReceiptScanDialog({
  open, onOpenChange, suppliers, existingMaterials, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: Supplier[];
  existingMaterials: Material[];
  onDone: () => void;
}) {
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedReceiptItem[]>([]);
  const [applying, setApplying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setPreviewUrl(null);
    setItems([]);
    setApplying(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Images only", description: "Please upload a JPEG, PNG, or WebP receipt.", variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Too large", description: "Image must be under 15 MB.", variant: "destructive" });
      return;
    }

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setStep("processing");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-receipt", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      const json = data;

      const parsed: ParsedReceiptItem[] = (json.items ?? []).map((item: any) => {
        const nameLower = (item.product_name ?? "").toLowerCase();
        const match = existingMaterials.find(
          (m) => m.product_name.toLowerCase() === nameLower
            || (item.product_code && m.product_code?.toLowerCase() === item.product_code.toLowerCase())
        );
        return {
          product_name: item.product_name ?? "",
          product_code: item.product_code ?? null,
          unit_price: parseFloat(item.unit_price) || 0,
          unit_type: item.unit_type ?? "each",
          supplier_name: item.supplier_name ?? null,
          notes: item.notes ?? null,
          _include: true,
          _matchId: match?.id ?? null,
        };
      });

      setItems(parsed);
      setStep("review");
    } catch (e: any) {
      toast({ title: "Failed to parse receipt", description: e.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleApply = async () => {
    const selected = items.filter((i) => i._include);
    if (!selected.length) return;
    setApplying(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const resolveSupplier = (name: string | null): number | null => {
        if (!name) return null;
        const match = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
        return match?.id ?? null;
      };

      for (const item of selected) {
        const supplierId = resolveSupplier(item.supplier_name);
        if (item._matchId) {
          // Update existing
          await supabase.from("supplier_prices").update({
            unit_price: String(item.unit_price),
            unit_type: item.unit_type,
            ...(item.product_code ? { product_code: item.product_code } : {}),
            ...(supplierId ? { supplier_id: supplierId } : {}),
            ...(item.notes ? { notes: item.notes } : {}),
            last_updated: today,
          }).eq("id", item._matchId);
          // Log history
          await supabase.from("material_price_history").insert({
            material_id: item._matchId,
            unit_price: String(item.unit_price),
            notes: `Receipt scan — ${today}`,
          });
        } else {
          // Insert new
          await supabase.from("supplier_prices").insert({
            product_name: item.product_name,
            product_code: item.product_code || null,
            unit_price: String(item.unit_price),
            unit_type: item.unit_type,
            supplier_id: supplierId,
            notes: item.notes || null,
            last_updated: today,
          });
        }
      }
      toast({ title: `${selected.length} item${selected.length > 1 ? "s" : ""} updated` });
      onDone();
      handleClose(false);
    } catch (e: any) {
      toast({ title: "Failed to apply changes", description: e.message, variant: "destructive" });
    }
    setApplying(false);
  };

  const includedCount = items.filter((i) => i._include).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Scan Receipt
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Upload a photo or scan of a supplier receipt or invoice. AI will extract product names, codes, and prices.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={cn(
                "w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-14 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Drop a receipt image here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse — JPEG, PNG, WebP up to 15 MB</p>
              </div>
            </button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            {previewUrl && (
              <div className="w-32 h-32 rounded-xl overflow-hidden border border-border shadow-sm">
                <img src={previewUrl} alt="Receipt" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">AI is reading the receipt…</span>
            </div>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center gap-3 mb-3">
              {previewUrl && (
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={previewUrl} alt="Receipt" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{items.length} line items found</p>
                <p className="text-xs text-muted-foreground">
                  {items.filter((i) => i._matchId).length} match existing materials and will be updated.{" "}
                  {items.filter((i) => !i._matchId).length} are new.
                </p>
              </div>
              <button
                onClick={() => { setStep("upload"); setPreviewUrl(null); }}
                className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="w-8 px-3 py-2.5" />
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Product</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-28">Unit Price</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-28">Unit</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={idx} className={cn("transition-colors", item._include ? "bg-background hover:bg-muted/20" : "bg-muted/30 opacity-50")}>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={item._include}
                          onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, _include: e.target.checked } : it))}
                          className="accent-primary"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          className="w-full bg-transparent border-0 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1"
                          value={item.product_name}
                          onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, product_name: e.target.value } : it))}
                        />
                        {item.product_code && (
                          <span className="text-muted-foreground block mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                            {item.product_code}
                          </span>
                        )}
                        {item.supplier_name && (
                          <span className="text-muted-foreground/70">{item.supplier_name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="relative">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-muted/40 border border-border rounded px-2 pl-5 py-1 text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            value={item.unit_price}
                            onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={item.unit_type}
                          onValueChange={(v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_type: v } : it))}
                        >
                          <SelectTrigger className="h-7 text-xs border-border bg-muted/40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        {item._matchId ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Update
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                            <Plus className="h-2.5 w-2.5" /> New
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
              <p className="text-xs text-muted-foreground">
                {includedCount} of {items.length} items selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
                <Button size="sm" className="gap-2" onClick={handleApply} disabled={applying || includedCount === 0}>
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  Apply {includedCount > 0 ? `${includedCount} item${includedCount > 1 ? "s" : ""}` : ""}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Materials Tab ───────────────────────────────────────────────────────────

function MaterialsTab({
  suppliers,
}: { suppliers: Supplier[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "", product_code: "", supplier_id: "",
    unit_price: "", unit_type: "each", coverage_value: "",
    coverage_unit: "sq ft", waste_pct: "10", quality_tier: "mid",
    product_url: "", notes: "",
  });

  const { data: prices, isLoading } = useQuery({
    queryKey: ["supplier-prices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_prices")
        .select("*, supplier:suppliers(id,name,is_preferred), category:cost_categories(name)")
        .order("product_name", { ascending: true });
      return (data ?? []) as Material[];
    },
  });

  const addMaterial = useMutation({
    mutationFn: async () => {
      if (!form.product_name || !form.unit_price) throw new Error("Name and price required");
      const { error } = await supabase.from("supplier_prices").insert({
        product_name: form.product_name,
        product_code: form.product_code || null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        unit_price: form.unit_price,
        unit_type: form.unit_type,
        coverage_value: form.coverage_value ? parseFloat(form.coverage_value) : null,
        coverage_unit: form.coverage_value ? form.coverage_unit : null,
        waste_pct: parseFloat(form.waste_pct) || 10,
        quality_tier: form.quality_tier,
        product_url: form.product_url || null,
        notes: form.notes || null,
        last_updated: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Material added" });
      setAddOpen(false);
      setForm({ product_name: "", product_code: "", supplier_id: "", unit_price: "", unit_type: "each", coverage_value: "", coverage_unit: "sq ft", waste_pct: "10", quality_tier: "mid", product_url: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["supplier-prices"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isAdmin = user?.role === "admin";
  const selectedSupplier = suppliers?.find((s) => s.id === selectedSupplierId) ?? null;
  const countBySupplierId = (prices ?? []).reduce<Record<number, number>>((acc, p) => {
    const sid = p.supplier?.id;
    if (sid) acc[sid] = (acc[sid] ?? 0) + 1;
    return acc;
  }, {});

  const categories = Array.from(
    new Set((prices ?? []).map((p) => p.category?.name).filter(Boolean))
  ).sort() as string[];

  const filtered = (prices ?? []).filter((p) => {
    const matchesSupplier = selectedSupplierId === null || p.supplier?.id === selectedSupplierId;
    const matchesCategory = selectedCategory === "all" || p.category?.name === selectedCategory;
    const matchesSearch = !search
      || p.product_name.toLowerCase().includes(search.toLowerCase())
      || (p.product_code ?? "").toLowerCase().includes(search.toLowerCase())
      || (p.notes ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesSupplier && matchesCategory && matchesSearch;
  });

  const handleExportCSV = () => {
    const rows = [
      ["Product", "Code", "Supplier", "Category", "Price (CAD)", "Unit", "Coverage", "Waste %", "Tier", "Updated"],
      ...filtered.map((p) => [
        p.product_name,
        p.product_code ?? "",
        p.supplier?.name ?? "",
        p.category?.name ?? "",
        parseFloat(p.unit_price).toFixed(2),
        p.unit_type,
        p.coverage_value ? `${p.coverage_value} ${p.coverage_unit ?? ""}` : "",
        String(p.waste_pct ?? 10),
        p.quality_tier ?? "mid",
        p.last_updated ? new Date(p.last_updated).toLocaleDateString("en-CA") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing-book-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Supplier sidebar */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
        <div className="px-3 pt-5 pb-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Suppliers</p>
          <button
            onClick={() => setSelectedSupplierId(null)}
            className={cn(
              "w-full text-left rounded-lg px-3 py-2 text-sm transition-all border",
              selectedSupplierId === null
                ? "border-primary/40 bg-primary/5 text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            All suppliers
            <span className={cn(
              "ml-1.5 text-[10px] rounded-full px-1.5 py-0.5",
              selectedSupplierId === null ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {prices?.length ?? 0}
            </span>
          </button>
        </div>
        <div className="px-3 py-3 space-y-1.5 flex-1">
          {(suppliers ?? []).map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              isSelected={selectedSupplierId === s.id}
              count={countBySupplierId[s.id] ?? 0}
              onClick={() => setSelectedSupplierId(selectedSupplierId === s.id ? null : s.id)}
            />
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search name, code, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <p className="text-sm text-muted-foreground shrink-0">{filtered.length} items</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} disabled={!prices?.length}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setScanOpen(true)}>
                  <Receipt className="h-3.5 w-3.5" /> Scan Receipt
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Material
                </Button>
              </div>
            )}
          </div>

          {/* Mobile supplier select */}
          <div className="lg:hidden mb-4">
            <Select
              value={selectedSupplierId === null ? "all" : String(selectedSupplierId)}
              onValueChange={(v) => setSelectedSupplierId(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {(suppliers ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supplier detail */}
          {selectedSupplier && <SupplierInfoPanel supplier={selectedSupplier} />}

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["all", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? "all" : cat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border transition-colors",
                    selectedCategory === cat
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : filtered.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Material</th>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Category</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Price</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Coverage</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden xl:table-cell">Waste</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Updated</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const hasNotes = !!p.notes;
                    const isExpanded = expandedNotes.has(p.id);
                    const effectiveSqFtCost = p.coverage_value && p.coverage_value > 0
                      ? (parseFloat(p.unit_price) / p.coverage_value) * (1 + (p.waste_pct ?? 10) / 100)
                      : null;
                    return (
                      <>
                        <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors group", isExpanded && "bg-muted/20")}>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground leading-snug">{p.product_name}</span>
                                {p.product_url && (
                                  <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary shrink-0"
                                    onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {p.quality_tier && p.quality_tier !== "mid" && (
                                  <span className={cn("text-[9px] px-1.5 py-px rounded font-semibold uppercase tracking-wide", QUALITY_COLORS[p.quality_tier])}>
                                    {p.quality_tier}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {p.product_code && (
                                  <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                                    {p.product_code}
                                  </span>
                                )}
                                {selectedSupplierId === null && p.supplier?.name && (
                                  <span className="text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-px">
                                    {p.supplier.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">{p.category?.name ?? "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-foreground block text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                              {formatCurrency(parseFloat(p.unit_price))}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">{p.unit_type.replace(/_/g, " ")}</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden lg:table-cell">
                            {p.coverage_value ? (
                              <div>
                                <span className="text-xs text-foreground block" style={{ fontFamily: "var(--font-mono)" }}>
                                  {p.coverage_value} {p.coverage_unit}
                                </span>
                                {effectiveSqFtCost && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    ≈ {formatCurrency(effectiveSqFtCost)}/sqft
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/30">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">{p.waste_pct ?? 10}%</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {p.last_updated ? new Date(p.last_updated).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            </span>
                          </td>
                          <td className="px-2 py-3 w-8 text-center">
                            {hasNotes && (
                              <button
                                onClick={() => setExpandedNotes((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })}
                                className={cn("rounded p-1 transition-colors", isExpanded ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                              >
                                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {hasNotes && isExpanded && (
                          <tr key={`${p.id}-notes`} className="bg-muted/10">
                            <td colSpan={7} className="px-4 pb-3 pt-0">
                              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3 py-1 ml-0.5">
                                {p.notes}
                              </p>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No materials match</p>
              <p className="text-sm text-muted-foreground mt-1">Adjust filters or add a material.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add material dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Product Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. 2x6 Spruce 10ft" value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Product Code / SKU</Label>
                <Input placeholder="SKU" value={form.product_code} onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit Price <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Type</Label>
                <Select value={form.unit_type} onValueChange={(v) => setForm((f) => ({ ...f, unit_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Coverage Value</Label>
                <Input type="number" step="0.01" min="0" placeholder="e.g. 32" value={form.coverage_value} onChange={(e) => setForm((f) => ({ ...f, coverage_value: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Coverage Unit</Label>
                <Input placeholder="sq ft" value={form.coverage_unit} onChange={(e) => setForm((f) => ({ ...f, coverage_unit: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Waste %</Label>
                <Input type="number" step="1" min="0" max="50" value={form.waste_pct} onChange={(e) => setForm((f) => ({ ...f, waste_pct: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quality Tier</Label>
                <Select value={form.quality_tier} onValueChange={(v) => setForm((f) => ({ ...f, quality_tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source URL</Label>
              <Input placeholder="https://…" value={form.product_url} onChange={(e) => setForm((f) => ({ ...f, product_url: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Source, receipt date, verified notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => addMaterial.mutate()} disabled={addMaterial.isPending || !form.product_name || !form.unit_price}>
                {addMaterial.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Material
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        suppliers={suppliers}
        existingMaterials={prices ?? []}
        onDone={() => qc.invalidateQueries({ queryKey: ["supplier-prices"] })}
      />
    </div>
  );
}

// ─── Assemblies Tab ───────────────────────────────────────────────────────────

function AssemblyCard({ assembly, onEdit }: { assembly: Assembly; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const costPerSqft = calcAssemblyCostPerSqft(assembly);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-foreground leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
              {assembly.name}
            </h3>
            {assembly.quality_tier && (
              <span className={cn("text-[9px] px-1.5 py-px rounded font-semibold uppercase tracking-wide", QUALITY_COLORS[assembly.quality_tier])}>
                {assembly.quality_tier}
              </span>
            )}
            {assembly.category?.name && (
              <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1.5 py-px">
                {assembly.category.name}
              </span>
            )}
          </div>
          {assembly.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{assembly.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-mono)" }}>
            {formatCurrency(costPerSqft)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">material / sq ft</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Material</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Qty/sqft</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Unit Cost</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Waste</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium pr-5">$/sqft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assembly.assembly_materials
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((line) => (
                    <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-2.5">
                        <span className="text-foreground font-medium">{line.material_name}</span>
                        <span className="text-muted-foreground ml-1.5">({line.unit_type})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                        {line.qty_per_sqft.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(line.unit_cost)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{line.waste_pct}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground pr-5" style={{ fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(calcLineEffectiveCost(line))}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t-2 border-border">
                  <td colSpan={4} className="px-5 py-2.5 text-xs font-semibold text-foreground">
                    Total material cost per sq ft
                  </td>
                  <td className="px-4 py-2.5 pr-5 text-right font-bold text-foreground text-sm" style={{ fontFamily: "var(--font-mono)" }}>
                    {formatCurrency(costPerSqft)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between border-t border-border bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{assembly.notes ?? "Material cost only. Labour not included."}</span>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={onEdit}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssembliesTab({ suppliers }: { suppliers: Supplier[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editAssembly, setEditAssembly] = useState<Assembly | null>(null);
  const [search, setSearch] = useState("");

  const { data: assemblies, isLoading } = useQuery({
    queryKey: ["assemblies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimate_assemblies")
        .select("*, category:cost_categories(name), assembly_materials(*)")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as Assembly[];
    },
  });

  const filtered = (assemblies ?? []).filter((a) =>
    !search
    || a.name.toLowerCase().includes(search.toLowerCase())
    || (a.description ?? "").toLowerCase().includes(search.toLowerCase())
    || (a.category?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search assemblies…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground shrink-0">{filtered.length} assemblies</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Assembly
          </Button>
        )}
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 mb-5">
        <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-px shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Assemblies group materials into reusable estimating packages. Each line item calculates a <strong>material cost per sq ft</strong> based on quantity, unit cost, and waste factor. Labour is not included in v1.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AssemblyCard key={a.id} assembly={a} onEdit={() => setEditAssembly(a)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No assemblies yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create assemblies to build reusable sq-ft cost templates.</p>
        </div>
      )}

      <AddAssemblyDialog open={addOpen || editAssembly !== null} onOpenChange={(v) => { if (!v) { setAddOpen(false); setEditAssembly(null); } }} assembly={editAssembly} suppliers={suppliers} />
    </div>
  );
}

// ─── Add/Edit Assembly Dialog ────────────────────────────────────────────────

interface AssemblyLineForm {
  material_name: string;
  unit_type: string;
  qty_per_sqft: string;
  unit_cost: string;
  waste_pct: string;
  notes: string;
}

const EMPTY_LINE: AssemblyLineForm = { material_name: "", unit_type: "each", qty_per_sqft: "1", unit_cost: "0", waste_pct: "10", notes: "" };

function AddAssemblyDialog({
  open, onOpenChange, assembly, suppliers,
}: { open: boolean; onOpenChange: (v: boolean) => void; assembly: Assembly | null; suppliers: Supplier[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [tier, setTier] = useState("mid");
  const [lines, setLines] = useState<AssemblyLineForm[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  // Sync form from existing assembly
  useState(() => {
    if (assembly) {
      setName(assembly.name);
      setDescription(assembly.description ?? "");
      setNotes(assembly.notes ?? "");
      setTier(assembly.quality_tier ?? "mid");
      if (assembly.assembly_materials.length > 0) {
        setLines(assembly.assembly_materials.sort((a, b) => a.sort_order - b.sort_order).map((l) => ({
          material_name: l.material_name,
          unit_type: l.unit_type,
          qty_per_sqft: String(l.qty_per_sqft),
          unit_cost: String(l.unit_cost),
          waste_pct: String(l.waste_pct),
          notes: l.notes ?? "",
        })));
      }
    }
  });

  const previewCostPerSqft = lines.reduce((sum, l) => {
    return sum + (parseFloat(l.unit_cost) || 0) * (parseFloat(l.qty_per_sqft) || 0) * (1 + (parseFloat(l.waste_pct) || 0) / 100);
  }, 0);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let assemblyId = assembly?.id;
      if (!assemblyId) {
        const { data, error } = await supabase.from("estimate_assemblies").insert({
          name, description: description || null, notes: notes || null, quality_tier: tier,
        }).select("id").single();
        if (error) throw error;
        assemblyId = data.id;
      } else {
        const { error } = await supabase.from("estimate_assemblies").update({
          name, description: description || null, notes: notes || null, quality_tier: tier, updated_at: new Date().toISOString(),
        }).eq("id", assemblyId);
        if (error) throw error;
        await supabase.from("assembly_materials").delete().eq("assembly_id", assemblyId);
      }
      const toInsert = lines
        .filter((l) => l.material_name.trim())
        .map((l, idx) => ({
          assembly_id: assemblyId,
          material_name: l.material_name,
          unit_type: l.unit_type,
          qty_per_sqft: parseFloat(l.qty_per_sqft) || 0,
          unit_cost: parseFloat(l.unit_cost) || 0,
          waste_pct: parseFloat(l.waste_pct) || 10,
          notes: l.notes || null,
          sort_order: idx,
        }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("assembly_materials").insert(toInsert);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["assemblies"] });
      toast({ title: assembly ? "Assembly updated" : "Assembly created" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assembly ? "Edit Assembly" : "New Assembly"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Assembly Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. 2x6 Exterior Wall" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quality Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Brief description of what this assembly covers…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Material Lines</Label>
              <span className="text-xs text-muted-foreground">All quantities are per sq ft of assembly area</span>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Material</th>
                    <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-24">Unit</th>
                    <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-20">Qty/sqft</th>
                    <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-24">Unit Cost</th>
                    <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-16">Waste%</th>
                    <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-20 pr-3">$/sqft</th>
                    <th className="w-7" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => {
                    const lineCost = (parseFloat(line.unit_cost) || 0) * (parseFloat(line.qty_per_sqft) || 0) * (1 + (parseFloat(line.waste_pct) || 0) / 100);
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-7 text-xs border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="Material name…"
                            value={line.material_name}
                            onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, material_name: e.target.value } : l))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={line.unit_type} onValueChange={(v) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, unit_type: v } : l))}>
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-7 text-xs text-right"
                            type="number" step="0.0001" min="0"
                            value={line.qty_per_sqft}
                            onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, qty_per_sqft: e.target.value } : l))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">$</span>
                            <Input
                              className="h-7 text-xs pl-4 text-right"
                              type="number" step="0.01" min="0"
                              value={line.unit_cost}
                              onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, unit_cost: e.target.value } : l))}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Input
                              className="h-7 text-xs text-right"
                              type="number" step="1" min="0" max="50"
                              value={line.waste_pct}
                              onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, waste_pct: e.target.value } : l))}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right pr-3 font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                          {formatCurrency(lineCost)}
                        </td>
                        <td className="pr-2">
                          <button
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t border-border">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-foreground">
                      <button
                        onClick={() => setLines((p) => [...p, { ...EMPTY_LINE }])}
                        className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add line
                      </button>
                    </td>
                    <td colSpan={2} className="px-2 py-2 pr-3 text-right">
                      <span className="text-xs text-muted-foreground">Total: </span>
                      <span className="font-bold text-sm" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(previewCostPerSqft)}<span className="text-xs font-normal text-muted-foreground">/sqft</span></span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Assumptions, scope boundaries, phase 2 notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {assembly ? "Save Changes" : "Create Assembly"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

function SuppliersTab({ suppliers, onRefresh }: { suppliers: Supplier[]; onRefresh: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", website: "", notes: "", is_preferred: false,
  });

  const addSupplier = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("suppliers").insert({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        website: form.website || null,
        notes: form.notes || null,
        is_preferred: form.is_preferred,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Supplier added" });
      setAddOpen(false);
      setForm({ name: "", phone: "", email: "", address: "", website: "", notes: "", is_preferred: false });
      qc.invalidateQueries({ queryKey: ["suppliers-list"] });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">{suppliers.length} suppliers configured</p>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Supplier
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                  {s.name}
                </h3>
                {s.is_preferred && (
                  <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    <Star className="h-2.5 w-2.5 fill-current" /> Preferred
                  </span>
                )}
              </div>
              <Badge variant="outline" className={cn("text-[10px] shrink-0", s.is_active ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground")}>
                {s.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="space-y-1.5">
              {s.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="h-3 w-3 shrink-0" /> {s.phone}
                </a>
              )}
              {s.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{s.email}</span>
                </a>
              )}
              {s.address && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 mt-px" /> {s.address}
                </div>
              )}
              {s.website && (
                <a href={s.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <Globe className="h-3 w-3 shrink-0" /> Website <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            {s.notes && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2.5 leading-relaxed">{s.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add Supplier Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Supplier name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="(705) 000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="orders@…" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="City, ON" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input placeholder="https://…" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Contractor discount, delivery lead time…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_preferred} onCheckedChange={(v) => setForm((f) => ({ ...f, is_preferred: v }))} />
              <Label>Mark as preferred supplier</Label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => addSupplier.mutate()} disabled={addSupplier.isPending || !form.name.trim()}>
                {addSupplier.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Supplier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupplierPrices() {
  const { data: suppliers, refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,phone,email,address,website,is_preferred,is_active,notes")
        .eq("is_active", true)
        .order("is_preferred", { ascending: false });
      return (data ?? []) as Supplier[];
    },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="border-b border-border bg-background px-6 py-5 shrink-0">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Resources</p>
        <h1
          className="text-3xl font-bold text-foreground leading-tight"
          style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}
        >
          Pricing Book
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Internal material pricing, estimating assemblies, and supplier directory
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="materials" className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border bg-background shrink-0 px-6">
          <TabsList className="h-auto bg-transparent gap-0 p-0 rounded-none">
            {[
              { value: "materials", label: "Materials", icon: Package },
              { value: "assemblies", label: "Assemblies", icon: Layers },
              { value: "suppliers", label: "Suppliers", icon: Building2 },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="materials" className="flex-1 min-h-0 overflow-hidden mt-0">
          <MaterialsTab suppliers={suppliers ?? []} />
        </TabsContent>
        <TabsContent value="assemblies" className="flex-1 min-h-0 overflow-y-auto mt-0">
          <AssembliesTab suppliers={suppliers ?? []} />
        </TabsContent>
        <TabsContent value="suppliers" className="flex-1 min-h-0 overflow-y-auto mt-0">
          <SuppliersTab suppliers={suppliers ?? []} onRefresh={() => refetchSuppliers()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
