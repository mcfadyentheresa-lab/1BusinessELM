import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, ChevronLeft, ChevronRight, Link2, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PresentationModeProps {
  projectId: number;
  boardId?: number;
  onClose: () => void;
}

interface CanvasElement {
  id: number;
  type: string;
  content: Record<string, any> | null;
}

interface PaintColor {
  id: number;
  name: string;
  hex: string;
  brand?: string | null;
  collection?: string | null;
}

export function PresentationMode({ projectId, boardId, onClose }: PresentationModeProps) {
  const [slide, setSlide] = useState(0);
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("name, description, thumbnail_url, hero_focal_x, hero_focal_y, phase, city, address, current_focus_text")
        .eq("id", projectId)
        .maybeSingle();
      return data;
    },
  });

  const { data: board } = useQuery({
    queryKey: ["board", boardId ?? projectId],
    queryFn: async () => {
      if (boardId) {
        const { data } = await supabase
          .from("planning_boards")
          .select("*")
          .eq("id", boardId)
          .maybeSingle();
        return data;
      }
      const { data } = await supabase
        .from("planning_boards")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at")
        .maybeSingle();
      return data;
    },
  });

  const { data: canvasElements } = useQuery({
    queryKey: ["presentation-canvas-elements", board?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("canvas_elements")
        .select("id, type, content")
        .eq("board_id", board!.id)
        .order("created_at");
      return (data ?? []) as unknown as CanvasElement[];
    },
    enabled: !!board?.id,
  });

  const { data: selections } = useQuery({
    queryKey: ["selections-presentation", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("selections")
        .select("*")
        .eq("project_id", projectId)
        .order("category");
      return data ?? [];
    },
  });

  const paintColors: PaintColor[] = (() => {
    const seen = new Set<string>();
    const colors: PaintColor[] = [];
    for (const el of canvasElements ?? []) {
      if (el.type !== "surface" || !el.content) continue;
      const c = el.content;
      if (c.kind !== "paint" || !c.name || !c.hex) continue;
      const key = `${c.name}|${c.hex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      colors.push({
        id: el.id,
        name: c.name,
        hex: c.hex,
        brand: c.brand ?? null,
        collection: c.collection ?? null,
      });
    }
    return colors.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Build slides
  const slides: Array<{ type: string; data?: any }> = [];

  // Slide 0: Hero
  slides.push({ type: "hero" });

  // Slide 1: Inspiration images from canvas elements
  const imageItems = (canvasElements ?? []).filter(
    (el) => el.type === "image" && el.content?.url
  );
  if (imageItems.length > 0) {
    slides.push({ type: "inspiration", data: imageItems });
  }

  // Slide 2: Color palette
  if ((paintColors ?? []).length > 0) {
    slides.push({ type: "palette", data: paintColors });
  }

  // Slide 3: Selections (grouped by category)
  if ((selections ?? []).length > 0) {
    const grouped = (selections ?? []).reduce((acc: Record<string, any[]>, sel: any) => {
      const cat = sel.category ?? "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(sel);
      return acc;
    }, {});
    Object.entries(grouped).forEach(([cat, items]) => {
      slides.push({ type: "selections", data: { category: cat, items } });
    });
  }

  // Slide 4: Notes from canvas text elements
  const noteItems = (canvasElements ?? []).filter(
    (el) => el.type === "text" && el.content?.body
  );
  if (noteItems.length > 0) {
    slides.push({ type: "notes", data: noteItems });
  }

  // Final slide
  slides.push({ type: "footer" });

  const totalSlides = slides.length;
  const currentSlide = slides[Math.min(slide, totalSlides - 1)];

  const goNext = () => setSlide((s) => Math.min(s + 1, totalSlides - 1));
  const goPrev = () => setSlide((s) => Math.max(s - 1, 0));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [totalSlides]);

  const generateShareLink = async () => {
    setGeneratingLink(true);
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase.from("board_presentation_tokens").insert({
        board_id: board!.id,
        token,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      const link = `${window.location.origin}/p/${token}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Client link copied to clipboard", description: "This link shows a polished project summary, not this slideshow." });
      setTimeout(() => setCopied(false), 3000);
    } catch (e: any) {
      toast({ title: "Failed to generate link", description: e.message, variant: "destructive" });
    }
    setGeneratingLink(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{ fontFamily: "var(--font-serif)" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <span className="text-white/80 text-sm font-sans">{project?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs font-sans tabular-nums">
            {slide + 1} / {totalSlides}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 font-sans"
                onClick={generateShareLink}
                disabled={generatingLink || !board?.id}
              >
                {generatingLink ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Copy client link
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generates a polished project summary page — not this slideshow view.</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Hero slide */}
        {currentSlide?.type === "hero" && (
          <div className="w-full h-full relative">
            {project?.thumbnail_url ? (
              <img
                src={project.thumbnail_url}
                alt={project.name}
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${project.hero_focal_x ?? 50}% ${project.hero_focal_y ?? 50}%`,
                  animation: "kenBurns 20s ease-in-out infinite alternate",
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-stone-800 via-stone-700 to-amber-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
              <p className="text-white/50 text-xs uppercase tracking-widest mb-4 font-sans">
                {[project?.city, project?.address].filter(Boolean).join(" · ") || "Aster & Spruce Living"}
              </p>
              <h1
                className="text-5xl md:text-7xl font-bold text-white leading-tight max-w-4xl"
                style={{ letterSpacing: "-0.04em" }}
              >
                {project?.name}
              </h1>
              {project?.description && (
                <p className="text-white/60 text-lg mt-6 max-w-2xl leading-relaxed font-sans">
                  {project.description}
                </p>
              )}
              {project?.current_focus_text && (
                <div className="mt-8 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                  <p className="text-white text-sm font-sans">{project.current_focus_text}</p>
                </div>
              )}
              {project?.phase && (
                <p className="text-white/30 text-xs mt-6 uppercase tracking-widest font-sans">
                  Phase: {project.phase.replace(/_/g, " ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Inspiration slide */}
        {currentSlide?.type === "inspiration" && (
          <div className="w-full h-full flex flex-col">
            <div className="absolute top-16 left-6 z-10">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-sans">Inspiration</h2>
            </div>
            <div
              className="w-full h-full grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min((currentSlide.data as CanvasElement[]).length, 3)}, 1fr)`,
              }}
            >
              {(currentSlide.data as CanvasElement[]).slice(0, 6).map((item: CanvasElement, i: number) => (
                <div key={item.id} className={cn("overflow-hidden relative", i === 0 && (currentSlide.data as CanvasElement[]).length > 1 ? "row-span-2" : "")}>
                  <img
                    src={item.content!.url}
                    alt={item.content?.caption ?? ""}
                    className="w-full h-full object-cover"
                  />
                  {item.content?.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-white text-xs font-sans truncate">{item.content.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Palette slide */}
        {currentSlide?.type === "palette" && (
          <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center px-8">
            <h2 className="text-white/30 text-xs uppercase tracking-widest font-sans mb-12">Colour Palette</h2>
            <div className="flex gap-4 md:gap-8 items-end justify-center flex-wrap">
              {(currentSlide.data as any[]).map((color: any) => (
                <div key={color.id} className="flex flex-col items-center gap-3">
                  <div
                    className="rounded-2xl shadow-2xl"
                    style={{
                      backgroundColor: color.hex ?? "#ccc",
                      width: "clamp(80px, 10vw, 140px)",
                      height: "clamp(120px, 15vw, 200px)",
                    }}
                  />
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">{color.name}</p>
                    {color.collection && (
                      <p className="text-white/40 text-xs font-sans mt-0.5">{color.collection}</p>
                    )}
                    {color.hex && (
                      <p className="text-white/30 text-xs font-mono mt-0.5">{color.hex.toUpperCase()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selections slide */}
        {currentSlide?.type === "selections" && (
          <div className="w-full h-full bg-stone-50 flex flex-col">
            <div className="px-8 py-12 pb-6">
              <p className="text-stone-400 text-xs uppercase tracking-widest font-sans">Design Selections</p>
              <h2 className="text-4xl font-bold text-stone-900 mt-2" style={{ letterSpacing: "-0.03em" }}>
                {currentSlide.data.category}
              </h2>
            </div>
            <div className="flex-1 overflow-hidden px-8 pb-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 h-full">
                {(currentSlide.data.items as any[]).slice(0, 8).map((sel: any) => (
                  <div key={sel.id} className="rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
                    {sel.image_url ? (
                      <img src={sel.image_url} alt={sel.name} className="w-full flex-1 object-cover min-h-0" />
                    ) : (
                      <div className="flex-1 bg-stone-100 flex items-center justify-center min-h-0">
                        <span className="text-stone-300 text-3xl">◻</span>
                      </div>
                    )}
                    <div className="p-3 shrink-0">
                      <p className="font-semibold text-stone-900 text-sm leading-tight">{sel.name}</p>
                      {sel.supplier_name && (
                        <p className="text-stone-400 text-xs font-sans mt-0.5">{sel.supplier_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes slide */}
        {currentSlide?.type === "notes" && (
          <div className="w-full h-full bg-amber-50 flex flex-col items-center justify-center px-8 md:px-16">
            <h2 className="text-stone-400 text-xs uppercase tracking-widest font-sans mb-12">Design Notes</h2>
            <div className="max-w-4xl w-full space-y-6">
              {(currentSlide.data as CanvasElement[]).slice(0, 4).map((item: CanvasElement) => (
                <div key={item.id} className="border-l-2 border-stone-300 pl-6">
                  {item.content?.title && (
                    <h3 className="text-stone-600 text-sm uppercase tracking-wider font-sans mb-2">{item.content.title}</h3>
                  )}
                  <p className="text-stone-800 text-xl md:text-2xl leading-relaxed" style={{ letterSpacing: "-0.01em" }}>
                    {item.content?.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer slide */}
        {currentSlide?.type === "footer" && (
          <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center text-center px-8">
            <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mb-8">
              <span className="text-white text-xl font-bold">A&S</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
              Aster &amp; Spruce Living
            </h2>
            <p className="text-white/40 mt-4 font-sans text-sm tracking-wider uppercase">
              Elevated Living Management
            </p>
            {project?.name && (
              <p className="text-white/30 mt-8 font-sans text-sm">
                {project.name} · Confidential
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-t from-black/60 to-transparent">
        <button
          onClick={goPrev}
          disabled={slide === 0}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>

        {/* Slide dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={cn(
                "rounded-full transition-all",
                i === slide ? "bg-white w-4 h-1.5" : "bg-white/30 w-1.5 h-1.5"
              )}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={slide === totalSlides - 1}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      </div>

      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1); }
          to { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
