import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Palette } from "lucide-react";
import type { PaintColor } from "@/shared/database.types";

const COLOR_FAMILIES = ["All", "White", "Off-White", "Gray", "Green", "Blue", "Red", "Yellow", "Brown", "Black", "Neutral"];

export default function ColorPortfolio() {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("All");
  const [selectedColor, setSelectedColor] = useState<PaintColor | null>(null);

  const { data: colors, isLoading } = useQuery({
    queryKey: ["paint-colors"],
    queryFn: async () => {
      const { data } = await supabase.from("paint_colors").select("*").order("brand").order("name");
      return data ?? [];
    },
  });

  const filtered = (colors ?? []).filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    const matchFamily = family === "All" || c.color_family.toLowerCase().includes(family.toLowerCase());
    return matchSearch && matchFamily;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Operations</p>
          <h1 className="text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
            Colour Portfolio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{colors?.length ?? 0} colors in library</p>
        </div>
      </div>

      {/* Search + filter chips */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {COLOR_FAMILIES.map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                family === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
              style={{ letterSpacing: "0.06em" }}
            >
              {f}
            </button>
          ))}
        </div>
        {(search || family !== "All") && (
          <p className="text-xs text-muted-foreground">{filtered.length} color{filtered.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {Array.from({ length: 24 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Palette className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No colors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {filtered.map((color) => (
            <button
              key={color.id}
              onClick={() => setSelectedColor(color)}
              className="group text-left rounded-xl overflow-hidden border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200"
            >
              <div
                className="w-full h-28 transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ backgroundColor: color.hex }}
              />
              <div className="p-2.5 bg-card">
                <p className="text-xs font-medium text-foreground truncate leading-tight">{color.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                  {color.code}
                </p>
                <p className="text-[10px] text-muted-foreground/70 truncate">{color.brand}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Color detail panel */}
      {selectedColor && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedColor(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full h-40" style={{ backgroundColor: selectedColor.hex }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-serif)" }}>{selectedColor.name}</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">{selectedColor.brand}</p>
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground border border-border" style={{ fontFamily: "var(--font-mono)" }}>{selectedColor.hex.toUpperCase()}</span>
              </div>
              {/* Meta tiles */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Code</p>
                  <p className="text-sm font-medium text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{selectedColor.code}</p>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Family</p>
                  <p className="text-sm font-medium text-foreground">{selectedColor.color_family}</p>
                </div>
                {selectedColor.lrv != null && (
                  <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">LRV</p>
                    <p className="text-sm font-medium text-foreground">{selectedColor.lrv}</p>
                  </div>
                )}
                {selectedColor.collection && (
                  <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Collection</p>
                    <p className="text-sm font-medium text-foreground truncate">{selectedColor.collection}</p>
                  </div>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSelectedColor(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
