import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, initials } from "@/lib/utils";
import { Users, Hammer, TrendingUp, Plus, Phone, Mail, Pencil, Trash2, Loader2, Search } from "lucide-react";

interface SubForm {
  business_name: string;
  trade: string;
  phone: string;
  email: string;
  hourly_rate: string;
}

const EMPTY_SUB: SubForm = { business_name: "", trade: "", phone: "", email: "", hourly_rate: "" };

export default function CrewAndTrade() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("crew");
  const [search, setSearch] = useState("");

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [subForm, setSubForm] = useState<SubForm>(EMPTY_SUB);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "sub"; id: number } | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: crew, isLoading: crewLoading } = useQuery({
    queryKey: ["crew-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("crew_rates").select("*, profile:profiles(name, email, avatar_url)").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ["subcontractors"],
    queryFn: async () => {
      const { data } = await supabase.from("subcontractors").select("*, category:cost_categories(name)").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ["market-rates-full"],
    queryFn: async () => {
      const { data } = await supabase.from("market_rates").select("*, category:cost_categories(name)").eq("is_active", true);
      return data ?? [];
    },
  });

  const saveSub = useMutation({
    mutationFn: async () => {
      if (!subForm.business_name) throw new Error("Business name is required");
      const payload = {
        business_name: subForm.business_name,
        trade: subForm.trade || null,
        phone: subForm.phone || null,
        email: subForm.email || null,
        hourly_rate: subForm.hourly_rate ? parseFloat(subForm.hourly_rate) : null,
        is_active: true,
      };
      if (editingSub) {
        const { error } = await supabase.from("subcontractors").update(payload).eq("id", editingSub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subcontractors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingSub ? "Trade contact updated" : "Trade contact added" });
      qc.invalidateQueries({ queryKey: ["subcontractors"] });
      setSubDialogOpen(false);
      setEditingSub(null);
      setSubForm(EMPTY_SUB);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSub = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("subcontractors").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Trade contact removed" });
      qc.invalidateQueries({ queryKey: ["subcontractors"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAddSub = () => {
    setEditingSub(null);
    setSubForm(EMPTY_SUB);
    setSubDialogOpen(true);
  };

  const openEditSub = (s: any) => {
    setEditingSub(s);
    setSubForm({
      business_name: s.business_name ?? "",
      trade: s.trade ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      hourly_rate: s.hourly_rate ? String(s.hourly_rate) : "",
    });
    setSubDialogOpen(true);
  };

  const searchLower = search.toLowerCase();

  const filteredCrew = (crew ?? []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(searchLower) || c.profile?.email?.toLowerCase().includes(searchLower)
  );

  const filteredSubs = (subs ?? []).filter((s: any) =>
    !search || s.business_name?.toLowerCase().includes(searchLower) || s.trade?.toLowerCase().includes(searchLower)
  );

  const filteredRates = (rates ?? []).filter((r: any) =>
    !search || r.category?.name?.toLowerCase().includes(searchLower)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Operations</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
            Crew & Trade
          </h1>
        </div>
        {isAdmin && tab === "trades" && (
          <Button className="gap-2 mt-1" onClick={openAddSub}><Plus className="h-4 w-4" /> Add contact</Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={tab === "crew" ? "Search crew…" : tab === "trades" ? "Search contacts…" : "Search categories…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSearch(""); }}>
        {/* Tab chips */}
        <div className="flex gap-2 mb-6">
          {[
            { value: "crew", label: "Crew", icon: Users },
            { value: "trades", label: "Trade Contacts", icon: Hammer },
            { value: "rates", label: "Market Rates", icon: TrendingUp },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setTab(value); setSearch(""); }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs border transition-colors ${
                tab === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
              style={{ letterSpacing: "0.06em" }}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <TabsContent value="crew">
          {crewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : filteredCrew.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No crew matched your search" : "No active crew members"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCrew.map((c: any) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={c.profile?.avatar_url} />
                    <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground leading-tight">{c.name}</p>
                    {c.role && <p className="text-xs text-muted-foreground mt-0.5">{c.role}</p>}
                    {c.profile?.email && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{c.profile.email}</p>}
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Pay</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(parseFloat(c.pay_rate ?? "0"))}</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 text-center">
                      <p className="text-[9px] text-primary/60 uppercase tracking-widest mb-0.5">Bill</p>
                      <p className="text-sm font-semibold text-primary tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(parseFloat(c.billable_rate ?? "0"))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trades">
          {subsLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Hammer className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No contacts matched your search" : "No trade contacts added"}</p>
              {isAdmin && !search && (
                <Button variant="outline" className="mt-4 gap-2" onClick={openAddSub}><Plus className="h-4 w-4" /> Add contact</Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Business</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Trade</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Contact</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rate</th>
                    {isAdmin && <th className="w-16 px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubs.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{s.business_name}</p>
                        {s.is_preferred && <Badge variant="success" className="text-[10px] mt-0.5">Preferred</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.category?.name ?? s.trade ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {s.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                          {s.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                        {s.hourly_rate ? `${formatCurrency(parseFloat(s.hourly_rate))}/h` : s.daily_rate ? `${formatCurrency(parseFloat(s.daily_rate))}/day` : "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditSub(s)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ type: "sub", id: s.id })}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rates">
          {ratesLoading ? <Skeleton className="h-64 rounded-xl" /> : filteredRates.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No rates matched your search" : "No market rates configured"}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Unit</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Low</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Range</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Typical</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">High</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRates.map((r: any) => {
                    const low = parseFloat(r.low_rate);
                    const high = parseFloat(r.high_rate);
                    const typical = parseFloat(r.typical_rate);
                    const pct = high > low ? Math.round(((typical - low) / (high - low)) * 100) : 50;
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{r.category?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.unit_type.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{formatCurrency(low)}</td>
                        <td className="px-4 py-3 w-32">
                          <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-full" style={{ width: `${pct}%` }} />
                            <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" style={{ left: `calc(${pct}% - 5px)` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{formatCurrency(typical)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{formatCurrency(high)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit subcontractor dialog */}
      <Dialog open={subDialogOpen} onOpenChange={(v) => { setSubDialogOpen(v); if (!v) { setEditingSub(null); setSubForm(EMPTY_SUB); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSub ? "Edit trade contact" : "Add trade contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Business Name <span className="text-destructive">*</span></Label>
              <Input value={subForm.business_name} onChange={(e) => setSubForm((f) => ({ ...f, business_name: e.target.value }))} placeholder="e.g. Muskoka Tile Co." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Trade</Label>
                <Input value={subForm.trade} onChange={(e) => setSubForm((f) => ({ ...f, trade: e.target.value }))} placeholder="e.g. Tile" />
              </div>
              <div className="space-y-1.5">
                <Label>Hourly Rate</Label>
                <Input type="number" step="0.01" min="0" value={subForm.hourly_rate} onChange={(e) => setSubForm((f) => ({ ...f, hourly_rate: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={subForm.phone} onChange={(e) => setSubForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 705 555 0100" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={subForm.email} onChange={(e) => setSubForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@…" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveSub.mutate()} disabled={saveSub.isPending || !subForm.business_name}>
                {saveSub.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingSub ? "Save changes" : "Add contact"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove trade contact?</AlertDialogTitle>
            <AlertDialogDescription>This will hide the contact from the list. This action can be undone by contacting your admin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteSub.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
