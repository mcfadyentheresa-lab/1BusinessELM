import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Clock, Calendar, Users, ArrowRight, FolderOpen, CheckCircle2, AlertCircle, Hammer } from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function EventDateLabel({ dateStr }: { dateStr: string }) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return <span className="text-primary font-medium">Today</span>;
    if (isTomorrow(d)) return <span className="text-amber-600 font-medium">Tomorrow</span>;
    return <span>{format(d, "EEE, MMM d")}</span>;
  } catch {
    return <span>{dateStr}</span>;
  }
}

const EVENT_COLOR: Record<string, string> = {
  event: "bg-primary/10 text-primary border-primary/20",
  milestone: "bg-amber-50 text-amber-700 border-amber-200",
  site_visit: "bg-green-50 text-green-700 border-green-200",
  deadline: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  submitted: "bg-amber-400",
  approved: "bg-green-500",
};

export default function CrewDashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, status, phase, address, city, thumbnail_url, hero_focal_x, hero_focal_y")
        .in("status", ["active", "planning", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["crew-upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, date, type, project:projects(id, name)")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: recentEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ["crew-recent-entries", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("id, date, hours, status, description, project:projects(name)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalHoursThisWeek = (() => {
    if (!recentEntries) return 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr = weekStart.toISOString().slice(0, 10);
    return recentEntries
      .filter((e: any) => e.date >= weekStr)
      .reduce((sum: number, e: any) => sum + (e.hours ?? 0), 0);
  })();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">{getGreeting()}</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
            {firstName}
          </h1>
        </div>
        <Link href="/timesheets">
          <Button className="gap-2 mt-1">
            <Clock className="h-4 w-4" /> Log Hours
          </Button>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">This week</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>
            {entriesLoading ? "—" : `${totalHoursThisWeek}h`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Hours logged</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Active projects</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>
            {projectsLoading ? "—" : projects?.length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Assigned sites</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Upcoming</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>
            {eventsLoading ? "—" : upcomingEvents?.length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Events scheduled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Projects — spans 3 cols */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
              Active sites
            </h2>
            <Link href="/">
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                All projects <ArrowRight className="h-3 w-3" />
              </button>
            </Link>
          </div>
          {projectsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="space-y-2">
              {projects.map((p: any) => (
                <Link key={p.id} href={`/project/${p.id}`}>
                  <div className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer">
                    <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                      {p.thumbnail_url ? (
                        <img
                          src={p.thumbnail_url}
                          alt={p.name}
                          className="h-full w-full object-cover"
                          style={{ objectPosition: `${((p.hero_focal_x ?? 0.5) * 100).toFixed(1)}% ${((p.hero_focal_y ?? 0.5) * 100).toFixed(1)}%` }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <FolderOpen className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      {(p.address || p.city) && (
                        <p className="text-xs text-muted-foreground truncate">{[p.address, p.city].filter(Boolean).join(", ")}</p>
                      )}
                      {p.phase && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{p.phase}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${
                      p.status === "active" || p.status === "in_progress"
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {p.status === "in_progress" ? "Active" : p.status === "active" ? "Active" : "Planning"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Hammer className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active projects</p>
            </div>
          )}
        </div>

        {/* Right column — spans 2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming events */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                Schedule
              </h2>
              <Link href="/master-calendar">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  Calendar <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            {eventsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-1.5">
                {upcomingEvents.map((ev: any) => (
                  <div
                    key={ev.id}
                    className={`rounded-lg border px-3 py-2.5 ${EVENT_COLOR[ev.type] ?? "bg-muted/50 text-foreground border-border"}`}
                  >
                    <p className="text-xs font-medium leading-tight">{ev.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] opacity-70">{ev.project?.name ?? ""}</p>
                      <p className="text-[10px] font-medium">
                        <EventDateLabel dateStr={ev.date} />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <Calendar className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No upcoming events</p>
              </div>
            )}
          </div>

          {/* Recent time entries */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                Recent hours
              </h2>
              <Link href="/timesheets">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  All <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            {entriesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : recentEntries && recentEntries.length > 0 ? (
              <div className="space-y-1.5">
                {recentEntries.map((entry: any) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[entry.status] ?? "bg-muted"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{entry.project?.name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                    <span className="text-xs font-semibold text-foreground shrink-0">{entry.hours}h</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <Clock className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No hours logged yet</p>
                <Link href="/timesheets">
                  <Button size="sm" variant="outline" className="mt-3 text-xs h-7">Log hours</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
              Quick links
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/timesheets", icon: Clock, label: "Log Hours" },
                { href: "/master-calendar", icon: Calendar, label: "Calendar" },
                { href: "/crew-and-trade", icon: Users, label: "Crew & Trade" },
                { href: "/colors", icon: CheckCircle2, label: "Colour Portfolio" },
              ].map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href}>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer group">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="text-xs text-foreground group-hover:text-primary transition-colors">{label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
