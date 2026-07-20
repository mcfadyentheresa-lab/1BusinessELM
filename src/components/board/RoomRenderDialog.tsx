import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Sparkles, RefreshCw, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const MAX_POLL_ATTEMPTS = 30;

type RenderMode = "restyle" | "imagine";

interface RenderJob {
  id: string;
  status: "pending" | "processing" | "complete" | "failed";
  mode: RenderMode;
  prompt: string;
  result_url?: string;
  source_url?: string;
  created_at: string;
}

interface RoomRenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  projectId?: number;
  roomName?: string | null;
  roomZoneElementId?: number | null;
  initialSourcePhotoUrl?: string | null;
  onSourcePhotoUpdated?: (url: string) => void;
  onAccept?: (url: string) => void;
}

export function RoomRenderDialog({ open, onOpenChange, boardId, projectId, roomName, roomZoneElementId, initialSourcePhotoUrl, onSourcePhotoUpdated, onAccept }: RoomRenderDialogProps) {
  const [mode, setMode] = useState<RenderMode>("restyle");
  const [prompt, setPrompt] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [activeJob, setActiveJob] = useState<RenderJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/rooms/render?boardId=${boardId}`);
      if (res.ok) {
        const json = await res.json();
        setJobs(json.jobs ?? []);
      } else {
        toast({ title: "Couldn't load render history", variant: "destructive" });
      }
    } catch (err) {
      console.error("[RoomRender] Failed to load history", err);
      toast({ title: "Couldn't load render history", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open, boardId]);

  const pollJob = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        console.error("[RoomRender] Polling timed out after", attempts, "attempts for job", jobId);
        toast({ title: "Render timed out", description: "Check back in a moment.", variant: "destructive" });
        return;
      }
      try {
        const res = await fetch(`/api/rooms/render/${jobId}`);
        if (res.ok) {
          const job: RenderJob = await res.json();
          setActiveJob(job);
          if (job.status === "complete" || job.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            loadHistory();
          }
        }
      } catch (err) {
        console.error("[RoomRender] Poll error for job", jobId, err);
      }
    }, 2000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleFileChange = (file: File) => {
    setSourceFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSourcePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("boardId", String(boardId));
      form.append("mode", mode);
      form.append("prompt", prompt.trim());
      if (sourceFile) form.append("source", sourceFile);
      const res = await fetch("/api/rooms/render", { method: "POST", body: form });
      if (!res.ok) throw new Error("Submit failed");
      const job: RenderJob = await res.json();
      setActiveJob(job);
      pollJob(job.id);
    } catch (err) {
      console.error("[RoomRender] Failed to submit render", err);
      toast({ title: "Render failed to start", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const historyJobs = jobs.filter((j) => j.status === "complete");
  const shownHistory = historyJobs[historyIdx];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Room Render
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Left: controls */}
          <div className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as RenderMode)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="restyle">Restyle</TabsTrigger>
                <TabsTrigger value="imagine">Imagine</TabsTrigger>
              </TabsList>
              <TabsContent value="restyle" className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">Upload a photo and describe the new style.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
                {sourcePreview ? (
                  <div className="relative">
                    <img src={sourcePreview} className="w-full h-32 object-cover rounded-lg" alt="source" />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute bottom-2 right-2 h-7 text-xs"
                      onClick={() => fileRef.current?.click()}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/40 transition-colors text-xs"
                  >
                    <Upload className="h-5 w-5" />
                    Upload source photo
                  </button>
                )}
              </TabsContent>
              <TabsContent value="imagine" className="mt-3">
                <p className="text-xs text-muted-foreground">Describe your room vision from scratch.</p>
              </TabsContent>
            </Tabs>

            <Textarea
              placeholder={mode === "restyle"
                ? "e.g. Scandinavian living room with white oak floors…"
                : "e.g. Open-plan kitchen, warm brass fixtures, sage green cabinets…"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="text-sm resize-none"
            />

            <Button
              className="w-full gap-2"
              onClick={submit}
              disabled={!prompt.trim() || submitting || (mode === "restyle" && !sourceFile)}
            >
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Rendering…</> : <><Sparkles className="h-4 w-4" />Render</>}
            </Button>
          </div>

          {/* Right: result */}
          <div className="space-y-3">
            <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center relative">
              {activeJob?.status === "pending" || activeJob?.status === "processing" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeJob.status === "pending" ? "Queued…" : "Rendering…"}
                  </p>
                </div>
              ) : activeJob?.status === "complete" && activeJob.result_url ? (
                <img src={activeJob.result_url} className="w-full h-full object-cover" alt="render result" />
              ) : activeJob?.status === "failed" ? (
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-destructive">Render failed</p>
                  <p className="text-xs text-muted-foreground mt-1">Please try again.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center px-4">Result will appear here</p>
              )}

              {activeJob?.status === "complete" && activeJob.result_url && (
                <Button
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => onAccept?.(activeJob.result_url!)}
                >
                  Use on board
                </Button>
              )}
            </div>

            {/* History strip */}
            {historyJobs.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  History
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryIdx((i) => Math.max(0, i - 1))}
                    disabled={historyIdx === 0}
                    className="h-6 w-6 rounded border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex gap-1.5 flex-1 overflow-hidden">
                    {historyJobs.slice(Math.max(0, historyIdx - 1), historyIdx + 4).map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => { setActiveJob(j); setHistoryIdx(historyJobs.indexOf(j)); }}
                        className={`flex-1 aspect-square rounded overflow-hidden border transition-all ${
                          j.id === (activeJob?.id) ? "border-primary" : "border-border opacity-60 hover:opacity-90"
                        }`}
                      >
                        {j.result_url && <img src={j.result_url} className="w-full h-full object-cover" alt="" />}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryIdx((i) => Math.min(historyJobs.length - 1, i + 1))}
                    disabled={historyIdx >= historyJobs.length - 1}
                    className="h-6 w-6 rounded border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
