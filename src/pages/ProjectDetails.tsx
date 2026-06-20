import { useState, useRef } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateMilestone, useDeleteMilestone, useCreateSubMilestone, useUpdateSubMilestone } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  LayoutGrid, Clock, CheckSquare, Image, FileText, MessageSquare,
  ChevronRight, Settings, DollarSign, Calendar, AlertTriangle,
  MapPin, Plus, Check, Loader2, ArrowUpRight, FileImage, Package,
  Wrench, Camera, ClipboardList, ExternalLink, Send, User, Pencil, Columns,
  Trash2, X, Heart, Link as LinkIcon,
} from "lucide-react";
import PlanningBoard from "@/components/board/PlanningBoard";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-amber-100 text-amber-800" },
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  on_hold: { label: "On Hold", color: "bg-orange-100 text-orange-800" },
  complete: { label: "Complete", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const projectId = parseInt(id);

  const params = new URLSearchParams(searchStr);
  const defaultTab = params.get("tab") ?? "overview";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [chatMsg, setChatMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timeline state
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [addSubOpen, setAddSubOpen] = useState<number | null>(null);
  const [newSubTitle, setNewSubTitle] = useState("");

  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const createSubMilestone = useCreateSubMilestone();
  const updateSubMilestone = useUpdateSubMilestone();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, client:profiles!projects_client_id_fkey(name, email, avatar_url)")
        .eq("id", projectId)
        .maybeSingle();
      return data;
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("milestones")
        .select("*, sub_milestones(*)")
        .eq("project_id", projectId)
        .order("order");
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assigned_to_fkey(name, avatar_url)")
        .eq("project_id", projectId)
        .order("order");
      return data ?? [];
    },
    enabled: activeTab === "overview" || activeTab === "tasks",
  });

  const { data: photos } = useQuery({
    queryKey: ["photos", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("photos")
        .select("*")
        .eq("project_id", projectId)
        .order("taken_at", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "files",
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "files",
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, sender:profiles!messages_sender_id_fkey(name, avatar_url)")
        .eq("project_id", projectId)
        .order("created_at");
      return data ?? [];
    },
    enabled: activeTab === "chat",
  });

  const { data: decisions } = useQuery({
    queryKey: ["decisions", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("decisions")
        .select("*")
        .eq("project_id", projectId)
        .order("decided_at", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "decisions",
  });

  const { data: changeOrders } = useQuery({
    queryKey: ["change-orders", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("change_orders")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "change-orders",
  });

  const { data: siteVisits } = useQuery({
    queryKey: ["site-visits", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_visits")
        .select("*, user:profiles!site_visits_user_id_fkey(name)")
        .eq("project_id", projectId)
        .order("visit_date", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "site-visits",
  });

  const { data: selections } = useQuery({
    queryKey: ["selections", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("selections")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "selections",
  });

  const { data: wishlistItems, isLoading: wishlistLoading } = useQuery({
    queryKey: ["wishlist", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_wishlist_items")
        .select("*, user:profiles!project_wishlist_items_user_id_fkey(name, avatar_url)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: activeTab === "wishlist",
  });

  // Wishlist form state
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishForm, setWishForm] = useState({ name: "", note: "", image_url: "", source_url: "", category: "other" });
  const [wishSaving, setWishSaving] = useState(false);

  const saveWishlistItem = async () => {
    if (!wishForm.name.trim() || !user) return;
    setWishSaving(true);
    const { error } = await supabase.from("project_wishlist_items").insert({
      project_id: projectId,
      user_id: user.id,
      name: wishForm.name.trim(),
      note: wishForm.note.trim() || null,
      image_url: wishForm.image_url.trim() || null,
      source_url: wishForm.source_url.trim() || null,
      category: wishForm.category,
    });
    if (error) {
      toast({ title: "Couldn't save item", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["wishlist", projectId] });
      setWishlistOpen(false);
      setWishForm({ name: "", note: "", image_url: "", source_url: "", category: "other" });
    }
    setWishSaving(false);
  };

  const deleteWishlistItem = async (id: number) => {
    await supabase.from("project_wishlist_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["wishlist", projectId] });
  };

  const toggleTask = async (taskId: number, done: boolean) => {
    await supabase.from("tasks").update({ status: done ? "done" : "todo" }).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", projectId] });
  };

  const sendMessage = async () => {
    if (!chatMsg.trim() || !user) return;
    setSendingMsg(true);
    try {
      await supabase.from("messages").insert({
        project_id: projectId,
        sender_id: user.id,
        content: chatMsg.trim(),
      });
      setChatMsg("");
      qc.invalidateQueries({ queryKey: ["messages", projectId] });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    }
    setSendingMsg(false);
  };

  if (projectLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const status = STATUS_MAP[project.status] ?? { label: project.status, color: "bg-muted text-muted-foreground" };
  const budgetPct = project.total_budget && project.budget_used
    ? Math.round((project.budget_used / project.total_budget) * 100)
    : 0;
  const completedTasks = (tasks ?? []).filter((t: any) => t.status === "done").length;
  const totalTasks = (tasks ?? []).length;

  const isAdmin = user?.role === "admin";
  const isCrew = user?.role === "crew";

  const TABS = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "timeline", label: "Timeline", icon: Clock },
    { id: "board", label: "Board", icon: Columns },
    { id: "selections", label: "Selections", icon: Package },
    { id: "wishlist", label: "Wishlist", icon: Heart },
    { id: "decisions", label: "Decisions", icon: CheckSquare },
    { id: "files", label: "Files", icon: Image },
    { id: "change-orders", label: "Changes", icon: AlertTriangle },
    { id: "site-visits", label: "Site Visits", icon: Camera },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="relative h-60 md:h-72 w-full overflow-hidden shrink-0">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.name}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${(project.hero_focal_x ?? 50)}% ${(project.hero_focal_y ?? 50)}%`,
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-200 via-stone-100 to-amber-50 flex items-center justify-center">
            <LayoutGrid className="h-16 w-16 text-stone-300" />
          </div>
        )}
        {/* Deep gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Left gradient for stats contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" style={{ maxWidth: "60%" }} />

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6 flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm", status.color)}>
                {status.label}
              </span>
              {project.code && (
                <span className="text-white/50 text-xs font-mono">{project.code}</span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
              {project.name}
            </h1>
            {(project.address || project.city) && (
              <p className="text-white/60 text-sm mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[project.address, project.city].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {/* Right: stat pills + actions */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1 backdrop-blur-sm"
                  onClick={() => navigate(`/project/${projectId}/estimate`)}
                >
                  <DollarSign className="h-3.5 w-3.5" /> Estimate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1 backdrop-blur-sm"
                  onClick={() => navigate(`/project/${projectId}/settings`)}
                >
                  <Settings className="h-3.5 w-3.5" /> Settings
                </Button>
              </div>
            )}
            {/* Stat pills */}
            <div className="flex gap-2 flex-wrap justify-end">
              {project.phase && (
                <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-center">
                  <p className="text-white/50 text-[9px] uppercase tracking-widest leading-none mb-0.5">Phase</p>
                  <p className="text-white text-xs font-medium leading-none">{project.phase}</p>
                </div>
              )}
              {project.start_date && (
                <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-center hidden sm:block">
                  <p className="text-white/50 text-[9px] uppercase tracking-widest leading-none mb-0.5">Start</p>
                  <p className="text-white text-xs font-medium leading-none">{new Date(project.start_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              )}
              {project.total_budget && project.total_budget > 0 && (isAdmin || project.budget_visible_to_client) && (
                <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-center hidden sm:block">
                  <p className="text-white/50 text-[9px] uppercase tracking-widest leading-none mb-0.5">Budget</p>
                  <p className="text-white text-xs font-medium leading-none">{budgetPct}% used</p>
                </div>
              )}
              {totalTasks > 0 && (
                <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-center">
                  <p className="text-white/50 text-[9px] uppercase tracking-widest leading-none mb-0.5">Tasks</p>
                  <p className="text-white text-xs font-medium leading-none">{completedTasks}/{totalTasks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b border-border bg-background sticky top-0 z-20 overflow-x-auto shadow-sm">
          <TabsList className="h-auto bg-transparent rounded-none px-4 gap-0 inline-flex w-max min-w-full">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground gap-1.5 px-3 py-3 text-sm shrink-0"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="p-6 max-w-6xl mx-auto w-full flex-1 space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-2 space-y-4">
              {/* Current focus */}
              {project.current_focus_text && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Current Focus</p>
                    <p className="text-foreground">{project.current_focus_text}</p>
                  </CardContent>
                </Card>
              )}

              {/* Budget */}
              {(isAdmin || (project.budget_visible_to_client && user?.role === "client")) && project.total_budget && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" /> Budget
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(project.budget_used ?? 0)}
                      </span>
                      <span className="text-muted-foreground text-sm">of {formatCurrency(project.total_budget)}</span>
                    </div>
                    <Progress value={budgetPct} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{budgetPct}% utilized</p>
                  </CardContent>
                </Card>
              )}

              {/* Tasks */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" /> Tasks
                      {totalTasks > 0 && (
                        <span className="text-xs text-muted-foreground font-normal">({completedTasks}/{totalTasks})</span>
                      )}
                    </CardTitle>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {(tasks ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(tasks ?? []).slice(0, 10).map((task: any) => (
                        <div key={task.id} className="flex items-start gap-2.5 py-1.5 group">
                          <Checkbox
                            checked={task.status === "done"}
                            onCheckedChange={(v) => toggleTask(task.id, !!v)}
                            className="mt-0.5"
                            disabled={!isAdmin && !isCrew}
                          />
                          <span className={cn("text-sm flex-1", task.status === "done" && "line-through text-muted-foreground")}>
                            {task.title}
                          </span>
                          {task.assignee && (
                            <span className="text-xs text-muted-foreground shrink-0">{task.assignee.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Meta grid — 2-col info tiles */}
              {(project.phase || project.start_date || project.end_date || (project as any).client?.name) && (
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {project.phase && (
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Phase</p>
                          <p className="text-sm font-medium text-foreground leading-snug">{project.phase.replace(/_/g, " ")}</p>
                        </div>
                      )}
                      {(project as any).client?.name && (
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Client</p>
                          <p className="text-sm font-medium text-foreground leading-snug">{(project as any).client.name}</p>
                        </div>
                      )}
                      {project.start_date && (
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Start</p>
                          <p className="text-sm font-medium text-foreground leading-snug">{formatDate(project.start_date)}</p>
                        </div>
                      )}
                      {project.end_date && (
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Target</p>
                          <p className="text-sm font-medium text-foreground leading-snug">{formatDate(project.end_date)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Task progress mini-card */}
              {totalTasks > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Task Progress</p>
                      <p className="text-xs font-medium tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                        {completedTasks}/{totalTasks}
                      </p>
                    </div>
                    <Progress value={totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {Math.round((completedTasks / totalTasks) * 100)}% complete
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Quick links */}
              {isAdmin && (
                <Card>
                  <CardContent className="p-3 space-y-1">
                    <button
                      onClick={() => navigate(`/project/${projectId}/estimate`)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      Cost Estimate
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </button>
                    <button
                      onClick={() => navigate(`/project/${projectId}/settings`)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      Project Settings
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="p-6 max-w-4xl mx-auto w-full mt-0">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Milestones
            </h2>
            {isAdmin && (
              <Button size="sm" className="gap-1.5 h-8" onClick={() => { setAddMilestoneOpen(true); setNewMilestoneTitle(""); setNewMilestoneDate(""); }}>
                <Plus className="h-3.5 w-3.5" /> Add Milestone
              </Button>
            )}
          </div>

          {/* Add milestone inline form */}
          {addMilestoneOpen && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">New Milestone</p>
              <input
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Milestone title"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setAddMilestoneOpen(false); }}
              />
              <input
                type="date"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={newMilestoneDate}
                onChange={(e) => setNewMilestoneDate(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!newMilestoneTitle.trim()}
                  onClick={async () => {
                    if (!newMilestoneTitle.trim()) return;
                    const nextOrder = (milestones ?? []).length;
                    const { error } = await supabase.from("milestones").insert({
                      project_id: projectId,
                      title: newMilestoneTitle.trim(),
                      date: newMilestoneDate || null,
                      order: nextOrder,
                    });
                    if (!error) {
                      qc.invalidateQueries({ queryKey: ["milestones", projectId] });
                      setAddMilestoneOpen(false);
                    }
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddMilestoneOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {(milestones ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No milestones yet</p>
              {isAdmin && !addMilestoneOpen && (
                <Button className="mt-4 gap-2" size="sm" onClick={() => setAddMilestoneOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add milestone
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Horizontal step strip */}
              <div className="rounded-xl border border-border bg-card p-5 overflow-x-auto">
                <div className="flex items-start min-w-max gap-0">
                  {(milestones ?? []).map((m: any, i: number) => (
                    <div key={m.id} className="flex items-start flex-1 min-w-[120px]">
                      <div className="flex flex-col items-center flex-1">
                        <div className="flex items-center w-full">
                          <div className={cn("flex-1 h-px", i === 0 ? "invisible" : m.completed ? "bg-primary" : "bg-border")} />
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => isAdmin && updateMilestone.mutate({ id: m.id, projectId, completed: !m.completed })}
                            className={cn(
                              "h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition-colors",
                              m.completed
                                ? "bg-primary border-primary text-primary-foreground"
                                : isAdmin ? "bg-card border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/10 cursor-pointer" : "bg-card border-border text-muted-foreground"
                            )}
                            title={isAdmin ? (m.completed ? "Mark incomplete" : "Mark complete") : undefined}
                          >
                            {m.completed ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-semibold">{i + 1}</span>}
                          </button>
                          <div className={cn("flex-1 h-px", i === (milestones ?? []).length - 1 ? "invisible" : m.completed ? "bg-primary" : "bg-border")} />
                        </div>
                        <div className="mt-2.5 text-center px-1">
                          <p className={cn("text-xs font-semibold leading-tight", m.completed ? "text-foreground" : "text-muted-foreground")}>{m.title}</p>
                          {m.date && <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(m.date)}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail cards */}
              <div className="space-y-3">
                {(milestones ?? []).map((m: any, i: number) => (
                  <div key={m.id} className={cn(
                    "rounded-xl border bg-card transition-colors",
                    m.completed ? "border-primary/20 bg-primary/[0.02]" : "border-border"
                  )}>
                    {/* Milestone header */}
                    <div className="flex items-start gap-3 p-4">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => isAdmin && updateMilestone.mutate({ id: m.id, projectId, completed: !m.completed })}
                        className={cn(
                          "mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 text-[9px] font-bold transition-colors",
                          m.completed
                            ? "bg-primary border-primary text-primary-foreground"
                            : isAdmin ? "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 cursor-pointer" : "border-muted-foreground/30 text-muted-foreground"
                        )}
                        title={isAdmin ? (m.completed ? "Mark incomplete" : "Mark complete") : undefined}
                      >
                        {m.completed ? <Check className="h-3 w-3" /> : i + 1}
                      </button>

                      <div className="flex-1 min-w-0">
                        <h3 className={cn("font-semibold text-foreground", m.completed && "line-through text-muted-foreground")}>{m.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.date ? formatDate(m.date) : <span className="italic opacity-50">No date set</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.color_hex && (
                          <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: m.color_hex }} />
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => deleteMilestone.mutate({ id: m.id, projectId })}
                            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete milestone"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-milestones */}
                    {((m.sub_milestones ?? []).length > 0 || isAdmin) && (
                      <div className="border-t border-border mx-4 pt-3 pb-4 space-y-1.5 ml-[52px]">
                        {(m.sub_milestones ?? []).map((sm: any) => (
                          <div key={sm.id} className="flex items-center gap-2 group">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => isAdmin && updateSubMilestone.mutate({ id: sm.id, projectId, completed: !sm.completed })}
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                sm.completed
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : isAdmin ? "border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/10 cursor-pointer" : "border-muted-foreground/40"
                              )}
                            >
                              {sm.completed && <Check className="h-2.5 w-2.5" />}
                            </button>
                            <span className={cn("text-sm flex-1", sm.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                              {sm.title}
                            </span>
                          </div>
                        ))}

                        {/* Add sub-milestone */}
                        {isAdmin && addSubOpen === m.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-4 w-4 rounded border border-dashed border-muted-foreground/30 shrink-0" />
                            <input
                              autoFocus
                              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                              placeholder="Sub-milestone title…"
                              value={newSubTitle}
                              onChange={(e) => setNewSubTitle(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter" && newSubTitle.trim()) {
                                  await createSubMilestone.mutateAsync({ milestoneId: m.id, projectId, title: newSubTitle.trim() });
                                  setNewSubTitle("");
                                  setAddSubOpen(null);
                                } else if (e.key === "Escape") {
                                  setAddSubOpen(null);
                                  setNewSubTitle("");
                                }
                              }}
                            />
                            <button type="button" onClick={() => { setAddSubOpen(null); setNewSubTitle(""); }} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : isAdmin && (
                          <button
                            type="button"
                            onClick={() => { setAddSubOpen(m.id); setNewSubTitle(""); }}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                          >
                            <Plus className="h-3 w-3" /> Add step
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Board Tab */}
        <TabsContent value="board" className="mt-0" style={{ height: "calc(100vh - 60px - 44px)" }}>
          <PlanningBoard projectId={projectId} />
        </TabsContent>

        {/* Selections Tab */}
        <TabsContent value="selections" className="p-6 max-w-5xl mx-auto w-full mt-0">
          {(selections ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No selections added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(selections ?? []).map((sel: any) => (
                <Card key={sel.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  {sel.image_url && (
                    <img src={sel.image_url} alt={sel.name} className="w-full h-40 object-cover" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{sel.name}</h3>
                        {sel.category && <p className="text-xs text-muted-foreground capitalize mt-0.5">{sel.category}</p>}
                      </div>
                      <Badge variant={sel.approved ? "success" : "secondary"} className="text-[10px] shrink-0">
                        {sel.approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    {sel.supplier_name && <p className="text-xs text-muted-foreground mt-2">{sel.supplier_name}</p>}
                    {sel.unit_price && (
                      <p className="text-sm font-semibold mt-2 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(parseFloat(sel.unit_price))}
                      </p>
                    )}
                    {sel.product_url && (
                      <a
                        href={sel.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                      >
                        View product <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Wishlist Tab */}
        <TabsContent value="wishlist" className="p-6 max-w-5xl mx-auto w-full mt-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-muted-foreground" /> Wishlist
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAdmin
                  ? "Items your client has saved for inspiration"
                  : "Save things you love — colours, materials, furniture, or anything that catches your eye"}
              </p>
            </div>
            {!isAdmin && (
              <Button size="sm" className="gap-1.5 h-8" onClick={() => setWishlistOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            )}
          </div>

          {/* Add item dialog */}
          <Dialog open={wishlistOpen} onOpenChange={setWishlistOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add to wishlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Item name <span className="text-destructive">*</span></label>
                  <Input
                    placeholder="e.g. Hague Blue on kitchen cabinets"
                    value={wishForm.name}
                    onChange={(e) => setWishForm((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {["colour", "material", "furniture", "fixture", "other"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setWishForm((f) => ({ ...f, category: cat }))}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs border capitalize transition-colors",
                          wishForm.category === cat
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Note</label>
                  <Textarea
                    placeholder="What do you love about this? Where would you use it?"
                    value={wishForm.note}
                    onChange={(e) => setWishForm((f) => ({ ...f, note: e.target.value }))}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Image URL</label>
                  <Input
                    placeholder="https://…"
                    value={wishForm.image_url}
                    onChange={(e) => setWishForm((f) => ({ ...f, image_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Source link</label>
                  <Input
                    placeholder="Product page, Pinterest, etc."
                    value={wishForm.source_url}
                    onChange={(e) => setWishForm((f) => ({ ...f, source_url: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 gap-2" onClick={saveWishlistItem} disabled={wishSaving || !wishForm.name.trim()}>
                    {wishSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save to wishlist
                  </Button>
                  <Button variant="outline" onClick={() => setWishlistOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Content */}
          {wishlistLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="rounded-xl border border-border h-48 animate-pulse bg-muted/30" />)}
            </div>
          ) : (wishlistItems ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Heart className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-medium">
                {isAdmin ? "No wishlist items yet" : "Your wishlist is empty"}
              </p>
              <p className="text-muted-foreground text-xs mt-1 max-w-xs mx-auto">
                {isAdmin
                  ? "Your client hasn't saved any items yet."
                  : "Add paint colours, materials, furniture — anything that inspires you for this project."}
              </p>
              {!isAdmin && (
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => setWishlistOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add your first item
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(wishlistItems ?? []).map((item: any) => (
                <div key={item.id} className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
                  {item.image_url && (
                    <div className="relative overflow-hidden h-40 bg-muted">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground leading-snug">{item.name}</h3>
                        {item.category && (
                          <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full capitalize">
                            {item.category}
                          </span>
                        )}
                      </div>
                      {(user?.id === item.user_id || isAdmin) && (
                        <button
                          onClick={() => deleteWishlistItem(item.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {item.note && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{item.note}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> View source
                        </a>
                      )}
                      {isAdmin && item.user?.name && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          by {item.user.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* Add more card — client only */}
              {!isAdmin && (
                <button
                  onClick={() => setWishlistOpen(true)}
                  className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-card h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
                >
                  <div className="h-8 w-8 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">Add item</span>
                </button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" className="p-6 max-w-4xl mx-auto w-full mt-0">
          {(decisions ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <CheckSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No decisions logged yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(decisions ?? []).map((d: any) => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{d.title}</h3>
                      {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
                      {d.outcome && (
                        <div className="mt-2 rounded-lg bg-muted/60 p-2.5">
                          <p className="text-xs font-medium text-foreground">Outcome</p>
                          <p className="text-sm text-foreground mt-0.5">{d.outcome}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-[10px]">{d.category ?? "General"}</Badge>
                      {d.decided_at && <p className="text-xs text-muted-foreground mt-1">{formatDate(d.decided_at)}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="p-6 max-w-5xl mx-auto w-full mt-0 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileImage className="h-4 w-4 text-muted-foreground" /> Photos
            </h2>
            {(photos ?? []).length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {(photos ?? []).map((photo: any) => (
                  <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={photo.url} alt={photo.caption ?? ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {photo.is_hero && (
                      <div className="absolute top-1 right-1">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">Hero</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Documents
            </h2>
            {(documents ?? []).length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No documents yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(documents ?? []).map((doc: any) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      {doc.uploaded_at && <p className="text-xs text-muted-foreground">{formatDate(doc.uploaded_at)}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Change Orders Tab */}
        <TabsContent value="change-orders" className="p-6 max-w-4xl mx-auto w-full mt-0">
          {(changeOrders ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No change orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(changeOrders ?? []).map((co: any) => (
                <div key={co.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{co.title}</h3>
                        <Badge
                          variant={co.status === "approved" ? "success" : co.status === "rejected" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {co.status}
                        </Badge>
                      </div>
                      {co.description && <p className="text-sm text-muted-foreground">{co.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {co.cost_delta != null && (
                        <p className={cn("text-sm font-bold tabular-nums", co.cost_delta >= 0 ? "text-amber-600" : "text-green-600")}
                          style={{ fontFamily: "var(--font-mono)" }}>
                          {co.cost_delta >= 0 ? "+" : ""}{formatCurrency(Math.abs(co.cost_delta))}
                        </p>
                      )}
                      {co.created_at && <p className="text-xs text-muted-foreground mt-1">{formatDate(co.created_at)}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Site Visits Tab */}
        <TabsContent value="site-visits" className="p-6 max-w-4xl mx-auto w-full mt-0">
          {(siteVisits ?? []).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Camera className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No site visits recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(siteVisits ?? []).map((sv: any) => (
                <div key={sv.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground">{formatDate(sv.visit_date)}</p>
                        {sv.user?.name && (
                          <span className="text-xs text-muted-foreground">by {sv.user.name}</span>
                        )}
                      </div>
                      {sv.summary && <p className="text-sm text-muted-foreground">{sv.summary}</p>}
                      {sv.weather && <p className="text-xs text-muted-foreground mt-1">Weather: {sv.weather}</p>}
                    </div>
                    {sv.crew_count != null && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{sv.crew_count} crew</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex flex-col h-full max-h-[calc(100vh-16rem)] mt-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {(messages ?? []).length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No messages yet — start the conversation</p>
              </div>
            ) : (
              (messages ?? []).map((msg: any) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-muted text-muted-foreground"
                    )}>
                      {msg.sender?.name?.[0] ?? "?"}
                    </div>
                    <div className={cn("max-w-[70%]", isOwn && "items-end flex flex-col")}>
                      <p className="text-xs text-muted-foreground mb-1">{msg.sender?.name ?? "Unknown"}</p>
                      <div className={cn(
                        "rounded-xl px-3 py-2 text-sm",
                        isOwn ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-border p-4 bg-background">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message…"
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={sendingMsg || !chatMsg.trim()} size="icon">
                {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
