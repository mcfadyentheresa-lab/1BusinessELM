import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Search, Plus, ShoppingCart, ExternalLink, Loader2, Download,
  ChevronDown, Phone, Mail, MapPin, Globe, Star,
} from "lucide-react";

interface PriceForm {
  product_name: string;
  product_code: string;
  supplier_id: string;
  unit_price: string;
  unit_type: string;
  product_url: string;
  notes: string;
}

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  is_preferred: boolean;
  notes: string | null;
}

function SupplierPanel({
  supplier,
  isSelected,
  count,
  onClick,
}: {
  supplier: Supplier;
  isSelected: boolean;
  count: number;
  onClick: () => void;
}) {
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

function SupplierDetail({ supplier }: { supplier: Supplier }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
            <Phone className="h-3 w-3 shrink-0" />
            <span>{supplier.phone}</span>
          </a>
        )}
        {supplier.email && (
          <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </a>
        )}
        {supplier.address && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-px" />
            <span>{supplier.address}</span>
          </div>
        )}
        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <Globe className="h-3 w-3 shrink-0" />
            <span>Website</span>
            <ExternalLink className="h-2.5 w-2.5" />
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

export default function SupplierPrices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PriceForm>({
    product_name: "",
    product_code: "",
    supplier_id: "",
    unit_price: "",
    unit_type: "each",
    product_url: "",
    notes: "",
  });

  const { data: prices, isLoading } = useQuery({
    queryKey: ["supplier-prices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_prices")
        .select("*, supplier:suppliers(id,name,is_preferred), category:cost_categories(name)")
        .order("product_name", { ascending: true });
      return data ?? [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,phone,email,address,website,is_preferred,notes")
        .eq("is_active", true)
        .order("is_preferred", { ascending: false });
      return (data ?? []) as Supplier[];
    },
  });

  const addPrice = useMutation({
    mutationFn: async () => {
      if (!form.product_name || !form.unit_price) throw new Error("Product name and price are required");
      const { error } = await supabase.from("supplier_prices").insert({
        product_name: form.product_name,
        product_code: form.product_code || null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        unit_price: form.unit_price,
        unit_type: form.unit_type,
        product_url: form.product_url || null,
        notes: form.notes || null,
        last_updated: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Price added" });
      setOpen(false);
      setForm({ product_name: "", product_code: "", supplier_id: "", unit_price: "", unit_type: "each", product_url: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["supplier-prices"] });
    },
    onError: (e: any) => toast({ title: "Failed to add price", description: e.message, variant: "destructive" }),
  });

  const selectedSupplier = suppliers?.find((s) => s.id === selectedSupplierId) ?? null;

  const countBySupplierId = (prices ?? []).reduce<Record<number, number>>((acc, p: any) => {
    const sid = p.supplier?.id;
    if (sid) acc[sid] = (acc[sid] ?? 0) + 1;
    return acc;
  }, {});

  const categories = Array.from(
    new Set((prices ?? []).map((p: any) => p.category?.name).filter(Boolean))
  ).sort() as string[];

  const filtered = (prices ?? []).filter((p: any) => {
    const matchesSupplier = selectedSupplierId === null || p.supplier?.id === selectedSupplierId;
    const matchesCategory = selectedCategory === "all" || p.category?.name === selectedCategory;
    const matchesSearch =
      !search ||
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.notes ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesSupplier && matchesCategory && matchesSearch;
  });

  const isAdmin = user?.role === "admin";

  const toggleNotes = (id: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ["Product Name", "Product Code", "Supplier", "Category", "Unit Price (CAD)", "Unit Type", "Notes", "URL"],
      ...(filtered ?? []).map((p: any) => [
        p.product_name,
        p.product_code ?? "",
        p.supplier?.name ?? "",
        p.category?.name ?? "",
        parseFloat(p.unit_price).toFixed(2),
        p.unit_type.replace(/_/g, " "),
        p.notes ?? "",
        p.product_url ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Supplier sidebar — desktop only */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
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
            <SupplierPanel
              key={s.id}
              supplier={s}
              isSelected={selectedSupplierId === s.id}
              count={countBySupplierId[s.id] ?? 0}
              onClick={() => setSelectedSupplierId(selectedSupplierId === s.id ? null : s.id)}
            />
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Resources</p>
              <h1
                className="text-3xl font-bold text-foreground leading-tight"
                style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}
              >
                Supplier Price Book
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track material prices from your suppliers
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2 mt-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExportCSV}
                  disabled={!prices || prices.length === 0}
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Price
                </Button>
              </div>
            )}
          </div>

          {/* Supplier detail card — shown when a supplier is selected */}
          {selectedSupplier && (
            <div className="mb-5">
              <SupplierDetail supplier={selectedSupplier} />
            </div>
          )}

          {/* Mobile supplier selector */}
          <div className="lg:hidden mb-4">
            <Select
              value={selectedSupplierId === null ? "all" : String(selectedSupplierId)}
              onValueChange={(v) => setSelectedSupplierId(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers ({prices?.length ?? 0})</SelectItem>
                {(suppliers ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} ({countBySupplierId[s.id] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setSelectedCategory("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs border transition-colors",
                  selectedCategory === "all"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                All
              </button>
              {categories.map((cat) => (
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
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Search + result count */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by product name, code, or notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground shrink-0">
              {filtered.length} {filtered.length === 1 ? "product" : "products"}
            </p>
          </div>

          {/* Price table */}
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : filtered.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Product</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Category</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Price</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Updated</th>
                    <th className="px-2 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p: any) => {
                    const hasNotes = !!p.notes;
                    const isExpanded = expandedNotes.has(p.id);
                    return (
                      <>
                        <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors", isExpanded && "bg-muted/20")}>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-foreground leading-snug">{p.product_name}</span>
                                  {p.product_url && (
                                    <a
                                      href={p.product_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted-foreground hover:text-primary shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {p.product_code && (
                                    <span
                                      className="text-[10px] text-muted-foreground"
                                      style={{ fontFamily: "var(--font-mono)" }}
                                    >
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
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {p.category?.name ? (
                              <span className="text-xs text-muted-foreground">{p.category.name}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/30">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="font-semibold text-foreground block"
                              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                            >
                              {formatCurrency(parseFloat(p.unit_price))}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {p.unit_type.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {p.last_updated
                                ? new Date(p.last_updated).toLocaleDateString("en-CA", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "—"}
                            </span>
                          </td>
                          <td className="px-2 py-3 w-8 text-center">
                            {hasNotes && (
                              <button
                                onClick={() => toggleNotes(p.id)}
                                className={cn(
                                  "rounded p-1 transition-colors",
                                  isExpanded
                                    ? "text-primary bg-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                                title="Toggle source notes"
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 transition-transform duration-150",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </button>
                            )}
                          </td>
                        </tr>
                        {hasNotes && isExpanded && (
                          <tr key={`${p.id}-notes`} className="bg-muted/10">
                            <td colSpan={5} className="px-4 pb-3 pt-0">
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
              <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No products match</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || selectedSupplierId !== null || selectedCategory !== "all"
                  ? "Try adjusting your filters."
                  : "Add receipts to projects to build your price book automatically."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add price dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Product Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. 2x4 Lumber 8ft"
                value={form.product_name}
                onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Product Code</Label>
                <Input
                  placeholder="SKU or code"
                  value={form.product_code}
                  onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit Price <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.unit_price}
                  onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Type</Label>
                <Select value={form.unit_type} onValueChange={(v) => setForm((f) => ({ ...f, unit_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="each">Each</SelectItem>
                    <SelectItem value="per linear ft">Per linear ft</SelectItem>
                    <SelectItem value="sq_ft">Sq ft</SelectItem>
                    <SelectItem value="board_ft">Board ft</SelectItem>
                    <SelectItem value="per sheet">Per sheet</SelectItem>
                    <SelectItem value="per bag">Per bag</SelectItem>
                    <SelectItem value="roll">Roll</SelectItem>
                    <SelectItem value="gallon">Gallon</SelectItem>
                    <SelectItem value="litre">Litre</SelectItem>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="hour">Hour</SelectItem>
                    <SelectItem value="per unit">Per unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Product URL</Label>
              <Input
                placeholder="https://…"
                value={form.product_url}
                onChange={(e) => setForm((f) => ({ ...f, product_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source / Notes</Label>
              <Input
                placeholder="e.g. Verified 2026-05-03 from receipt…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => addPrice.mutate()}
                disabled={addPrice.isPending || !form.product_name || !form.unit_price}
              >
                {addPrice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Price
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
