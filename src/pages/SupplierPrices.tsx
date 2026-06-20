import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Search, Plus, ShoppingCart, ExternalLink, Loader2, Download } from "lucide-react";

interface PriceForm {
  product_name: string;
  product_code: string;
  supplier_id: string;
  unit_price: string;
  unit_type: string;
  product_url: string;
}

export default function SupplierPrices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PriceForm>({
    product_name: "",
    product_code: "",
    supplier_id: "",
    unit_price: "",
    unit_type: "each",
    product_url: "",
  });

  const { data: prices, isLoading } = useQuery({
    queryKey: ["supplier-prices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_prices")
        .select("*, supplier:suppliers(name, is_preferred), category:cost_categories(name)")
        .order("last_updated", { ascending: false });
      return data ?? [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data ?? [];
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
        last_updated: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Price added" });
      setOpen(false);
      setForm({ product_name: "", product_code: "", supplier_id: "", unit_price: "", unit_type: "each", product_url: "" });
      qc.invalidateQueries({ queryKey: ["supplier-prices"] });
    },
    onError: (e: any) => toast({ title: "Failed to add price", description: e.message, variant: "destructive" }),
  });

  const filtered = (prices ?? []).filter((p: any) => {
    return !search ||
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const isAdmin = user?.role === "admin";

  const handleExportCSV = () => {
    const rows = [
      ["Product Name", "Product Code", "Supplier", "Category", "Unit Price (CAD)", "Unit Type", "URL"],
      ...(filtered ?? []).map((p: any) => [
        p.product_name,
        p.product_code ?? "",
        p.supplier?.name ?? "",
        p.category?.name ?? "",
        parseFloat(p.unit_price).toFixed(2),
        p.unit_type.replace(/_/g, " "),
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Resources</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>Supplier Prices</h1>
          <p className="text-sm text-muted-foreground mt-1">{prices?.length ?? 0} products · price book built from receipts</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 mt-1">
            <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={!prices || prices.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add price</Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products or suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {search && (
          <p className="text-sm text-muted-foreground shrink-0">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Product</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Supplier</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Category</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Unit price</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{p.product_name}</span>
                      {p.product_url && (
                        <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {p.product_code && <p className="text-[10px] text-muted-foreground font-mono">{p.product_code}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground">{p.supplier?.name ?? "—"}</span>
                      {p.supplier?.is_preferred && <Badge variant="success" className="text-[10px]">Preferred</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    {formatCurrency(parseFloat(p.unit_price))}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">{p.unit_type.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No supplier prices yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add receipts to projects to build your price book automatically.</p>
        </div>
      )}

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
                    {(suppliers ?? []).map((s: any) => (
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
                    <SelectItem value="linear_ft">Linear ft</SelectItem>
                    <SelectItem value="sq_ft">Sq ft</SelectItem>
                    <SelectItem value="board_ft">Board ft</SelectItem>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="gallon">Gallon</SelectItem>
                    <SelectItem value="litre">Litre</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="sheet">Sheet</SelectItem>
                    <SelectItem value="hour">Hour</SelectItem>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => addPrice.mutate()} disabled={addPrice.isPending || !form.product_name || !form.unit_price}>
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
