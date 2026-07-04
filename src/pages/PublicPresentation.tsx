import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTenantBrand } from "@/hooks/use-tenant-brand";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MapPin, Calendar, Package, CheckSquare } from "lucide-react";

export default function PublicPresentation() {
  const { token } = useParams<{ token: string }>();
  const brand = useTenantBrand();

  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ["presentation-token", token],
    queryFn: async () => {
      const { data } = await supabase
        .from("board_presentation_tokens")
        .select("*, board:planning_boards(id, title, project_id)")
        .eq("token", token)
        .maybeSingle();
      return data as (typeof data & { board?: { id: number; title: string; project_id: number } | null }) | null;
    },
  });

  const projectId = tokenData?.board?.project_id;

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["public-project", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  const { data: selections } = useQuery({
    queryKey: ["public-selections", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("selections")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const { data: milestones } = useQuery({
    queryKey: ["public-milestones", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("milestones")
        .select("*")
        .eq("project_id", projectId!)
        .order("order");
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const { data: photos } = useQuery({
    queryKey: ["public-photos", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("photos")
        .select("*")
        .eq("project_id", projectId!)
        .order("taken_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: !!projectId,
  });

  if (tokenLoading || projectLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-full max-w-4xl p-8 space-y-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!tokenData || !project) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-stone-800" style={{ fontFamily: "var(--font-serif)" }}>
            Presentation not found
          </p>
          <p className="text-stone-500 mt-2">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  const completedMilestones = (milestones ?? []).filter((m: any) => m.completed).length;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-stone-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {brand.brandName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-semibold text-stone-700 tracking-wide">{brand.brandName}</span>
        </div>
        <Badge variant="secondary" className="text-xs">Project Preview</Badge>
      </header>

      {/* Hero */}
      <div className="relative h-[60vh] overflow-hidden">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.name}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${project.hero_focal_x ?? 50}% ${project.hero_focal_y ?? 50}%`,
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-200 via-amber-50 to-stone-100" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 max-w-5xl mx-auto">
          <p className="text-white/60 text-sm uppercase tracking-widest mb-2 font-medium">
            {[project.city, project.address].filter(Boolean).join(" · ") || "Project Showcase"}
          </p>
          <h1
            className="text-4xl md:text-6xl font-bold text-white leading-tight"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}
          >
            {project.name}
          </h1>
          {project.description && (
            <p className="text-white/70 text-lg mt-4 max-w-2xl leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats band */}
      <div className="bg-stone-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {project.phase && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider">Phase</p>
              <p className="text-white font-semibold mt-1 capitalize">{project.phase.replace(/_/g, " ")}</p>
            </div>
          )}
          {project.start_date && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider">Start Date</p>
              <p className="text-white font-semibold mt-1">{formatDate(project.start_date)}</p>
            </div>
          )}
          {project.end_date && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider">Target Completion</p>
              <p className="text-white font-semibold mt-1">{formatDate(project.end_date)}</p>
            </div>
          )}
          {(milestones ?? []).length > 0 && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider">Progress</p>
              <p className="text-white font-semibold mt-1">{completedMilestones} / {(milestones ?? []).length} milestones</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">
        {/* Photo Gallery */}
        {(photos ?? []).length > 0 && (
          <section>
            <h2
              className="text-2xl font-bold text-stone-900 mb-8"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.02em" }}
            >
              Progress Photos
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(photos ?? []).map((photo: any, i: number) => (
                <div
                  key={photo.id}
                  className={`overflow-hidden rounded-xl bg-stone-100 ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? ""}
                    className="w-full h-full object-cover aspect-square hover:scale-105 transition-transform duration-500"
                    style={{ aspectRatio: i === 0 ? "2/1" : "1/1" }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Selections */}
        {(selections ?? []).length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <Package className="h-5 w-5 text-stone-400" />
              <h2
                className="text-2xl font-bold text-stone-900"
                style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.02em" }}
              >
                Design Selections
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(selections ?? []).map((sel: any) => (
                <div key={sel.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100">
                  {sel.image_url ? (
                    <img src={sel.image_url} alt={sel.name} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-stone-50 flex items-center justify-center">
                      <Package className="h-8 w-8 text-stone-300" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-900">{sel.name}</h3>
                    {sel.category && (
                      <p className="text-xs text-stone-400 uppercase tracking-wider mt-0.5">{sel.category}</p>
                    )}
                    {sel.supplier_name && (
                      <p className="text-sm text-stone-500 mt-1">{sel.supplier_name}</p>
                    )}
                    {sel.notes && (
                      <p className="text-sm text-stone-500 mt-2 leading-relaxed">{sel.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Timeline */}
        {(milestones ?? []).length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <CheckSquare className="h-5 w-5 text-stone-400" />
              <h2
                className="text-2xl font-bold text-stone-900"
                style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.02em" }}
              >
                Project Milestones
              </h2>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-200" />
              <div className="space-y-4">
                {(milestones ?? []).map((m: any) => (
                  <div key={m.id} className="relative pl-10">
                    <div className={`absolute left-2.5 top-2 h-3 w-3 rounded-full border-2 border-white ${m.completed ? "bg-stone-900" : "bg-stone-200"}`} />
                    <div className="bg-white rounded-xl border border-stone-100 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-semibold ${m.completed ? "text-stone-900" : "text-stone-400"}`}>
                          {m.title}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.date && (
                            <span className="text-xs text-stone-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(m.date)}
                            </span>
                          )}
                          {m.completed && (
                            <Badge className="text-[10px] bg-stone-900 text-white border-0">Done</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-100 bg-white py-10 text-center">
        <p className="text-stone-400 text-sm">
          Prepared by <span className="font-semibold text-stone-700">{brand.brandName}</span> · Confidential Project Preview
        </p>
      </footer>
    </div>
  );
}
