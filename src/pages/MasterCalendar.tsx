import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar, Plus, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from "date-fns";

const EVENT_COLORS: Record<string, string> = {
  event: "bg-primary/20 text-primary",
  milestone: "bg-amber-100 text-amber-800",
  site_visit: "bg-green-100 text-green-800",
  deadline: "bg-red-100 text-red-800",
};

interface EventForm {
  project_id: string;
  title: string;
  date: string;
  type: string;
  notes: string;
}

export default function MasterCalendar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"month" | "list">("month");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventForm>({
    project_id: "",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    type: "event",
    notes: "",
  });

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar-events", monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("*, project:projects(name)")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date");
      return data ?? [];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data ?? [];
    },
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.date) throw new Error("Title and date are required");
      const { error } = await supabase.from("calendar_events").insert({
        project_id: form.project_id ? parseInt(form.project_id) : null,
        title: form.title,
        date: form.date,
        type: form.type,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Event added" });
      setOpen(false);
      setForm({ project_id: "", title: "", date: new Date().toISOString().slice(0, 10), type: "event", notes: "" });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: any) => toast({ title: "Failed to add event", description: e.message, variant: "destructive" }),
  });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();

  const eventsForDay = (day: Date) =>
    (events ?? []).filter((e: any) => isSameDay(new Date(e.date + "T00:00:00"), day));

  const isAdmin = user?.role === "admin" || user?.role === "crew";

  const eventCounts = (events ?? []).reduce<Record<string, number>>((acc, e: any) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  const EVENT_LABELS: Record<string, string> = {
    event: "Event",
    milestone: "Milestone",
    site_visit: "Site Visit",
    deadline: "Deadline",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Operations</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>Master Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">All projects, all events</p>
        </div>
        <div className="flex gap-2 mt-1">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button variant={view === "month" ? "default" : "ghost"} size="sm" className="rounded-none px-4" onClick={() => setView("month")}>Month</Button>
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="rounded-none px-4" onClick={() => setView("list")}>List</Button>
          </div>
          {isAdmin && (
            <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add event</Button>
          )}
        </div>
      </div>

      {/* Month navigation + event legend */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold text-foreground min-w-[160px] text-center" style={{ fontFamily: "var(--font-serif)" }}>
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Event type legend */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap justify-end">
          {Object.entries(EVENT_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${
                type === "event" ? "bg-primary/60" :
                type === "milestone" ? "bg-amber-500" :
                type === "site_visit" ? "bg-green-500" :
                "bg-red-500"
              }`} />
              <span className="text-xs text-muted-foreground">{label}</span>
              {eventCounts[type] > 0 && (
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">({eventCounts[type]})</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : view === "month" ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] p-2 border-r border-b border-border bg-muted/20" />
            ))}
            {days.map((day) => {
              const dayEvents = eventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] p-2 border-r border-b border-border",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev: any) => (
                      <div
                        key={ev.id}
                        className={cn("rounded px-1.5 py-0.5 text-[10px] truncate", EVENT_COLORS[ev.type] ?? EVENT_COLORS.event)}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(events ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No events this month</p>
            </div>
          ) : (
            (events ?? []).map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-4 rounded-lg border border-border p-4 bg-card hover:shadow-sm transition-shadow">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", EVENT_COLORS[ev.type] ?? EVENT_COLORS.event)}>
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{ev.title}</p>
                  <p className="text-sm text-muted-foreground">{ev.project?.name ?? "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-foreground font-mono">{formatDate(ev.date)}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">{ev.type}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Event title…"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project (optional)…" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional details…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => addEvent.mutate()} disabled={addEvent.isPending || !form.title || !form.date}>
                {addEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
