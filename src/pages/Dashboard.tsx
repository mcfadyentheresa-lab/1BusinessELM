import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useViewAs } from "@/contexts/view-as";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { FolderOpen, Plus, ArrowRight, Clock, DollarSign, CheckCircle2, Loader2, Camera } from "lucide-react";
import { useUpdateProjectCover } from "@/hooks/use-projects";
import type { Project } from "@/shared/database.types";
import { syncToFrontDoor } from "@/services/elmSyncService";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  active: "Active",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  planning: "secondary",
  in_progress: "default",
  active: "default",
  completed: "success",
  on_hold: "warning",
};

interface NewProjectForm {
  name: string;
  code: string;
  address: string;
  city: string;
  status: string;
  phase: string;
  description: string;
}

function ProjectCard({ project }: { project: Project }) {
  const budget = project.total_budget ?? 0;
  const used = project.budget_used ?? 0;
  const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateCover = useUpdateProjectCover();

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          updateCover.mutate(
            { projectId: project.id, file },
            {
              onSuccess: () => toast({ title: "Cover image updated" }),
              onError: (err: any) =>
                toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
            }
          );
          e.target.value = "";
        }}
      />

      {/* Image */}
      <div className="relative h-48 bg-muted overflow-hidden">
        <Link href={`/project/${project.id}`}>
          <div className="block w-full h-full cursor-pointer">
            {project.thumbnail_url ? (
              <img
                src={project.thumbnail_url}
                alt={project.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                style={{
                  objectPosition: `${((project.hero_focal_x ?? 0.5) * 100).toFixed(1)}% ${((project.hero_focal_y ?? 0.5) * 100).toFixed(1)}%`,
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-muted to-muted/60">
                <FolderOpen className="h-10 w-10 text-muted-foreground/20" />
              </div>
            )}
          </div>
        </Link>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        {/* Status badge */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
            project.status === "active" || project.status === "in_progress"
              ? "bg-green-500/90 text-white"
              : project.status === "completed"
              ? "bg-primary/90 text-primary-foreground"
              : project.status === "on_hold"
              ? "bg-amber-500/90 text-white"
              : "bg-black/40 text-white"
          }`}>
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>
        {project.code && (
          <div
            className="absolute top-3 right-3 rounded px-2 py-0.5 bg-black/40 backdrop-blur-sm text-white text-[10px] pointer-events-none"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {project.code}
          </div>
        )}
        {/* Phase pill bottom */}
        {project.phase && (
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium bg-background/90 backdrop-blur-sm text-foreground border border-border/50 uppercase tracking-wide">
              {project.phase}
            </span>
          </div>
        )}
        {/* Upload cover button — visible on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={updateCover.isPending}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
          title="Upload cover image"
        >
          {updateCover.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
          {updateCover.isPending ? "Uploading…" : "Cover"}
        </button>
      </div>

      <Link href={`/project/${project.id}`}>
        <div className="p-4 cursor-pointer">
          <h3 className="font-semibold text-foreground text-base leading-tight mb-1 group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-serif)" }}>
            {project.name}
          </h3>
          {(project.address || project.city) && (
            <p className="text-xs text-muted-foreground mb-3 truncate">
              {[project.address, project.city].filter(Boolean).join(", ")}
            </p>
          )}
          {budget > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground uppercase" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>Budget</span>
                <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1" />
            </div>
          )}
          {project.current_focus_text && (
            <p className="mt-3 text-xs text-muted-foreground border-l-2 border-primary/30 pl-2.5 leading-relaxed line-clamp-2">
              {project.current_focus_text}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<NewProjectForm>({
    name: "",
    code: "",
    address: "",
    city: "",
    status: "planning",
    phase: "",
    description: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Project name is required");
      const { error: insertError } = await supabase
        .from("projects")
        .insert({
          name: form.name.trim(),
          code: form.code.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          status: form.status,
          phase: form.phase.trim() || null,
          description: form.description.trim() || null,
        });
      if (insertError) throw insertError;
      const { data, error: selectError } = await supabase
        .from("projects")
        .select("id")
        .eq("name", form.name.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (selectError) throw selectError;
      return data;
    },
    onSuccess: (project) => {
      toast({ title: "Project created" });
      qc.invalidateQueries({ queryKey: ["projects"] });
      syncToFrontDoor({
        projects: [{ id: String(project.id), title: form.name.trim(), status: form.status, deadline: null, priority: null }],
        pendingReviewCount: 0,
      });
      onClose();
      navigate(`/project/${project.id}`);
    },
    onError: (e: any) => toast({ title: "Failed to create project", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Project Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Riverside Kitchen Reno"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project Code</Label>
              <Input
                placeholder="e.g. RKR-001"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                placeholder="Street address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Current Phase</Label>
            <Input
              placeholder="e.g. Demo & Framing"
              value={form.phase}
              onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief project description…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_FILTERS = [
  { key: "all", label: "All Projects" },
  { key: "active", label: "Active" },
  { key: "planning", label: "Planning" },
  { key: "on_hold", label: "On Hold" },
  { key: "completed", label: "Completed" },
] as const;

function AdminDashboard() {
  const { user } = useAuth();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!projects?.length) return;
    syncToFrontDoor({
      projects: projects.map((p) => ({
        id: String(p.id),
        title: p.name,
        status: p.status,
        deadline: p.end_date ?? null,
        priority: null,
      })),
      pendingReviewCount: 0,
    });
  }, [projects]);

  const active = projects?.filter((p) => p.status === "active" || p.status === "in_progress") ?? [];
  const planning = projects?.filter((p) => p.status === "planning") ?? [];
  const onHold = projects?.filter((p) => p.status === "on_hold") ?? [];
  const done = projects?.filter((p) => p.status === "completed") ?? [];
  const firstName = user?.name?.split(" ")[0] ?? "";

  const filtered = !projects ? [] : statusFilter === "all"
    ? projects
    : projects.filter((p) => p.status === statusFilter || (statusFilter === "active" && p.status === "in_progress"));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">{getGreeting()}</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
            {firstName}
          </h1>
        </div>
        <Button className="gap-2 mt-1" onClick={() => setNewProjectOpen(true)}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Active</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{active.length}</p>
          <p className="text-xs text-muted-foreground mt-1">In progress</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Planning</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{planning.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Upcoming</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">On Hold</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{onHold.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Paused</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Completed</p>
          <p className="text-2xl font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-serif)" }}>{done.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Finished</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors ${
              statusFilter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
            style={{ letterSpacing: "0.06em" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : projects && projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-medium text-foreground mb-1">No projects yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first project to get started.</p>
          <Button className="gap-2" onClick={() => setNewProjectOpen(true)}><Plus className="h-4 w-4" /> New Project</Button>
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No projects match this filter</p>
          <button onClick={() => setStatusFilter("all")} className="text-xs text-primary mt-2 hover:underline">Clear filter</button>
        </div>
      )}

      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
}

function ClientDashboard() {
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["client-projects", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("client_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-80 rounded-xl" /></div>;
  }

  if (!projects?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="font-medium text-foreground mb-1">No projects assigned yet</p>
        <p className="text-sm text-muted-foreground">Your project manager will share your project once it's set up.</p>
      </div>
    );
  }

  const project = projects[0];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-1">Your project</p>
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
          {project.name}
        </h1>
        {project.address && <p className="text-muted-foreground text-sm mt-1">{project.address}{project.city ? `, ${project.city}` : ""}</p>}
      </div>

      {project.thumbnail_url && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ aspectRatio: "16/7" }}>
          <img
            src={project.thumbnail_url}
            alt={project.name}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${((project.hero_focal_x ?? 0.5) * 100).toFixed(1)}% ${((project.hero_focal_y ?? 0.5) * 100).toFixed(1)}%`,
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-muted-foreground font-normal">Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"} className="text-sm px-3 py-1">
              {STATUS_LABELS[project.status] ?? project.status}
            </Badge>
          </CardContent>
        </Card>
        {project.phase && (
          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-muted-foreground font-normal">Current phase</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <p className="font-medium text-foreground">{project.phase}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {project.current_focus_text && (
        <Card className="border-primary/20 bg-primary/5 mb-6">
          <CardContent className="p-4">
            <p className="text-xs text-primary/70 uppercase mb-1" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.15em" }}>This week</p>
            <p className="text-foreground leading-relaxed">{project.current_focus_text}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href={`/project/${project.id}`}>
          <Button className="gap-2">
            View full project <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { previewRole } = useViewAs();
  if (!user) return null;
  const effectiveRole = user.role === "admin" && previewRole ? previewRole : user.role;
  if (effectiveRole === "client") return <ClientDashboard />;
  return <AdminDashboard />;
}
