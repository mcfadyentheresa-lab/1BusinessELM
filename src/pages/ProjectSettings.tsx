import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Camera, X, ImageIcon } from "lucide-react";
import { useUpdateProjectCover, useRemoveProjectCover } from "@/hooks/use-projects";

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const projectId = parseInt(id);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      return data;
    },
  });

  const updateCover = useUpdateProjectCover();
  const removeCover = useRemoveProjectCover();

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    code: "",
    phase: "",
    status: "planning",
    total_budget: "",
    budget_visible_to_client: false,
    description: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        address: project.address ?? "",
        city: project.city ?? "",
        code: project.code ?? "",
        phase: project.phase ?? "",
        status: project.status,
        total_budget: String(project.total_budget ?? ""),
        budget_visible_to_client: project.budget_visible_to_client ?? false,
        description: project.description ?? "",
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
      });
    }
  }, [project]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({
        name: form.name,
        address: form.address || null,
        city: form.city || null,
        code: form.code || null,
        phase: form.phase || null,
        status: form.status,
        total_budget: form.total_budget ? parseInt(form.total_budget) : 0,
        budget_visible_to_client: form.budget_visible_to_client,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast({ title: "Project settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-6" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
        Project Settings
      </h1>

      {/* Cover Image */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Cover Image</CardTitle>
          <CardDescription>Displayed on the project card and client dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              updateCover.mutate(
                { projectId, file },
                {
                  onSuccess: () => toast({ title: "Cover image updated" }),
                  onError: (err: any) =>
                    toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
                }
              );
              e.target.value = "";
            }}
          />
          {project?.thumbnail_url ? (
            <div className="relative group rounded-lg overflow-hidden border border-border" style={{ aspectRatio: "16/7" }}>
              <img
                src={project.thumbnail_url}
                alt="Cover"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${((project.hero_focal_x ?? 0.5) * 100).toFixed(1)}% ${((project.hero_focal_y ?? 0.5) * 100).toFixed(1)}%`,
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 shadow"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={updateCover.isPending}
                >
                  {updateCover.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5 shadow"
                  onClick={() =>
                    removeCover.mutate(
                      { projectId },
                      {
                        onSuccess: () => toast({ title: "Cover image removed" }),
                        onError: (err: any) =>
                          toast({ title: "Error", description: err.message, variant: "destructive" }),
                      }
                    )
                  }
                  disabled={removeCover.isPending}
                >
                  {removeCover.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={updateCover.isPending}
              className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/40 transition-colors flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground"
            >
              {updateCover.isPending ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <ImageIcon className="h-7 w-7" />
              )}
              <span className="text-sm">{updateCover.isPending ? "Uploading..." : "Click to upload a cover image"}</span>
              <span className="text-xs">JPEG, PNG, or WebP</span>
            </button>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Project name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="HWR-204" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Current phase</Label>
            <Input value={form.phase} onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))} placeholder="Cabinetry installation" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Target completion</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Port Carling" />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Budget</CardTitle>
          <CardDescription>Set the total contract value and client visibility.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Total budget (CAD)</Label>
            <Input type="number" value={form.total_budget} onChange={(e) => setForm((f) => ({ ...f, total_budget: e.target.value }))} placeholder="0" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">Show budget to client</p>
              <p className="text-xs text-muted-foreground">Client can see total budget and usage percentage</p>
            </div>
            <Switch checked={form.budget_visible_to_client} onCheckedChange={(v) => setForm((f) => ({ ...f, budget_visible_to_client: v }))} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save settings
      </Button>
    </div>
  );
}
