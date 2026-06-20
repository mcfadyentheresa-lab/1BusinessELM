import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Download, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function Payroll() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const periodStart = format(startOfMonth(subMonths(new Date(), periodOffset)), "yyyy-MM-dd");
  const periodEnd = format(endOfMonth(subMonths(new Date(), periodOffset)), "yyyy-MM-dd");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["payroll-entries", periodStart, periodEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("*, profile:profiles!user_id(name, id), project:projects(name), crew_rate:crew_rates!inner(pay_rate, billable_rate)")
        .gte("date", periodStart)
        .lte("date", periodEnd)
        .eq("status", "approved");
      return data ?? [];
    },
  });

  const byUser = (entries ?? []).reduce<Record<string, { name: string; hours: number; pay: number; billable: number }>>((acc, e: any) => {
    const uid = e.user_id;
    if (!acc[uid]) acc[uid] = { name: e.profile?.name ?? "Unknown", hours: 0, pay: 0, billable: 0 };
    const hrs = parseFloat(e.hours || "0");
    const payRate = parseFloat(e.crew_rate?.pay_rate || "0");
    const billRate = parseFloat(e.crew_rate?.billable_rate || "0");
    acc[uid].hours += hrs;
    acc[uid].pay += hrs * payRate;
    acc[uid].billable += hrs * billRate;
    return acc;
  }, {});

  const totals = Object.values(byUser);
  const totalPay = totals.reduce((s, u) => s + u.pay, 0);
  const totalBillable = totals.reduce((s, u) => s + u.billable, 0);

  const handleExportCSV = () => {
    const rows = [
      ["Crew Member", "Hours", "Pay Amount (CAD)", "Billable Value (CAD)"],
      ...totals.map((u) => [u.name, u.hours.toFixed(1), u.pay.toFixed(2), u.billable.toFixed(2)]),
      ["Total", totals.reduce((s, u) => s + u.hours, 0).toFixed(1), totalPay.toFixed(2), totalBillable.toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${periodStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(periodStart + "T00:00:00"), "MMMM yyyy")}
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          <Select value={String(periodOffset)} onValueChange={(v) => setPeriodOffset(parseInt(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }).map((_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {format(startOfMonth(subMonths(new Date(), i)), "MMMM yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={totals.length === 0}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {/* Summary KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Total Payroll</p>
          <p className="text-3xl font-semibold text-foreground leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(totalPay)}</p>
          <p className="text-xs text-muted-foreground mt-2">Labour cost this period</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Billable Value</p>
          <p className="text-3xl font-semibold text-foreground leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(totalBillable)}</p>
          <p className="text-xs text-muted-foreground mt-2">Client-facing labour value</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Crew Members</p>
          <p className="text-3xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{totals.length}</p>
          <p className="text-xs text-muted-foreground mt-2">With approved hours</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : totals.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Crew member</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Hours</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Pay amount</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Billable value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {totals.map((u, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{u.hours.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(u.pay)}</td>
                  <td className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(u.billable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t border-border">
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                  {totals.reduce((s, u) => s + u.hours, 0).toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-primary" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(totalPay)}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(totalBillable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No approved time entries for this period</p>
        </div>
      )}
    </div>
  );
}
