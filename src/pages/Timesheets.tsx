import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Clock, Plus, Loader2, CheckCheck } from "lucide-react";
import type { TimeEntry } from "@/shared/database.types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning"> = {
  draft: "secondary",
  submitted: "warning",
  approved: "success",
};

interface LogTimeForm {
  project_id: string;
  date: string;
  hours: string;
  description: string;
}

export default function Timesheets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<LogTimeForm>({
    project_id: "",
    date: new Date().toISOString().slice(0, 10),
    hours: "",
    description: "",
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["time-entries", user?.id, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("time_entries")
        .select("*, project:projects(name), profile:profiles!user_id(name)")
        .order("date", { ascending: false })
        .limit(100);

      if (user?.role !== "admin") {
        q = q.eq("user_id", user!.id);
      }
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data ?? [];
    },
  });

  const logTime = useMutation({
    mutationFn: async () => {
      if (!form.project_id || !form.date || !form.hours) throw new Error("Fill in all required fields");
      const { error } = await supabase.from("time_entries").insert({
        project_id: parseInt(form.project_id),
        user_id: user!.id,
        date: form.date,
        hours: form.hours,
        description: form.description || null,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Time logged" });
      setOpen(false);
      setForm({ project_id: "", date: new Date().toISOString().slice(0, 10), hours: "", description: "" });
      qc.invalidateQueries({ queryKey: ["time-entries"] });
    },
    onError: (e: any) => toast({ title: "Failed to log time", description: e.message, variant: "destructive" }),
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase
        .from("time_entries")
        .update({ status: "approved" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({ title: `${ids.length} entr${ids.length === 1 ? "y" : "ies"} approved` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["time-entries"] });
    },
    onError: (e: any) => toast({ title: "Error approving entries", description: e.message, variant: "destructive" }),
  });

  const totalHours = entries?.reduce((s, e) => s + parseFloat(e.hours || "0"), 0) ?? 0;
  const approvedHours = entries?.filter((e) => e.status === "approved").reduce((s, e) => s + parseFloat(e.hours || "0"), 0) ?? 0;
  const pendingCount = entries?.filter((e) => e.status === "submitted").length ?? 0;
  const draftCount = entries?.filter((e) => e.status === "draft").length ?? 0;

  const STATUS_FILTERS = ["all", "draft", "submitted", "approved"] as const;
  const isAdmin = user?.role === "admin";

  const approvableEntries = (entries ?? []).filter((e: any) => e.status === "submitted");
  const allApprovableSelected = approvableEntries.length > 0 && approvableEntries.every((e: any) => selectedIds.has(e.id));

  const toggleSelectAll = () => {
    if (allApprovableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvableEntries.map((e: any) => e.id)));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Log & Review</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>Timesheets</h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {isAdmin && selectedIds.size > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
              disabled={bulkApprove.isPending}
            >
              {bulkApprove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Approve {selectedIds.size} selected
            </Button>
          )}
          <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Log time</Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Total Hours</p>
          <p className="text-2xl font-semibold text-foreground leading-none tabular-nums" style={{ fontFamily: "var(--font-serif)" }}>{totalHours.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">All entries</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Approved</p>
          <p className="text-2xl font-semibold text-foreground leading-none tabular-nums" style={{ fontFamily: "var(--font-serif)" }}>{approvedHours.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">Hours confirmed</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Pending</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Drafts</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{draftCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Not submitted</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setSelectedIds(new Set()); }}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors capitalize ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
            style={{ letterSpacing: "0.06em" }}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        {isAdmin && pendingCount > 0 && statusFilter !== "submitted" && (
          <button
            onClick={() => setStatusFilter("submitted")}
            className="px-3.5 py-1.5 rounded-full text-xs border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            style={{ letterSpacing: "0.06em" }}
          >
            {pendingCount} awaiting approval
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : entries && entries.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {isAdmin && (
                  <th className="w-10 px-4 py-3">
                    {approvableEntries.length > 0 && (
                      <Checkbox
                        checked={allApprovableSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all submittable"
                      />
                    )}
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                {isAdmin && <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Crew</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Description</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Hours</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry: any) => {
                const isApprovable = isAdmin && entry.status === "submitted";
                const isSelected = selectedIds.has(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={`hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      if (!isApprovable) return;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(entry.id)) next.delete(entry.id);
                        else next.add(entry.id);
                        return next;
                      });
                    }}
                    style={isApprovable ? { cursor: "pointer" } : undefined}
                  >
                    {isAdmin && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {isApprovable && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(entry.id);
                                else next.delete(entry.id);
                                return next;
                              });
                            }}
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-foreground" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{formatDate(entry.date)}</td>
                    {isAdmin && <td className="px-4 py-3 text-foreground">{entry.profile?.name ?? "—"}</td>}
                    <td className="px-4 py-3 text-foreground">{entry.project?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{entry.description ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>{entry.hours}h</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={STATUS_VARIANT[entry.status] ?? "secondary"} className="text-xs">{entry.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No time entries found</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Project <span className="text-destructive">*</span></Label>
              <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Hours <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  placeholder="8.0"
                  value={form.hours}
                  onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="What did you work on?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => logTime.mutate()} disabled={logTime.isPending || !form.project_id || !form.hours}>
                {logTime.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
