import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Link, Image, Loader2, Palette } from "lucide-react";

interface ExtractedColor {
  hex: string;
  name?: string;
  percentage?: number;
}

export interface PaletteAddPayload {
  room?: string | null;
  rows: Array<{
    hex: string;
    name?: string;
    match?: {
      hex: string;
      name?: string;
      brand?: string;
      code?: string;
      lrv?: number;
    } | null;
  }>;
}

interface PaletteExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId?: number;
  // Legacy simple API
  rooms?: string[];
  onAccept?: (colors: ExtractedColor[], room: string | null) => void;
  // Extended API used by PlanningBoard
  boardImages?: Array<{ id: number; url: string; caption?: string | null }>;
  roomSuggestions?: string[];
  uploadImage?: (file: File) => Promise<string>;
  onAdd?: (payload: PaletteAddPayload) => void | Promise<void>;
  presetImageUrl?: string | null;
}

export function PaletteExtractionDialog({
  open,
  onOpenChange,
  boardId,
  rooms,
  onAccept,
  boardImages,
  roomSuggestions,
  uploadImage,
  onAdd,
  presetImageUrl,
}: PaletteExtractionDialogProps) {
  const [tab, setTab] = useState<"url" | "upload" | "board">("url");
  const [url, setUrl] = useState("");
  const [colorCount, setColorCount] = useState(6);
  const [extracting, setExtracting] = useState(false);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [room, setRoom] = useState<string>("");
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allRooms = roomSuggestions ?? rooms ?? [];

  useEffect(() => {
    if (open && presetImageUrl) {
      setUrl(presetImageUrl);
      extract(presetImageUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetImageUrl]);

  const extract = async (source: string | File) => {
    setExtracting(true);
    setColors([]);
    setSelected(new Set());
    try {
      const form = new FormData();
      form.append("count", String(colorCount));
      form.append("boardId", String(boardId));
      if (typeof source === "string") {
        form.append("url", source);
      } else {
        form.append("file", source);
      }
      const res = await fetch("/api/board/extract-palette", { method: "POST", body: form });
      if (!res.ok) throw new Error("Extraction failed");
      const json = await res.json();
      const result: ExtractedColor[] = json.colors ?? [];
      setColors(result);
      setSelected(new Set(result.map((c) => c.hex)));
    } catch {
      setColors([]);
    } finally {
      setExtracting(false);
    }
  };

  const toggle = (hex: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  };

  const handleAccept = async () => {
    const picked = colors.filter((c) => selected.has(c.hex));
    if (onAdd) {
      await onAdd({ room: room.trim() || null, rows: picked.map((c) => ({ hex: c.hex, name: c.name })) });
    } else if (onAccept) {
      onAccept(picked, room.trim() || null);
    }
    setColors([]);
    setSelected(new Set());
    setUrl("");
    setPreviewFile(null);
    onOpenChange(false);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreviewFile(e.target?.result as string);
    reader.readAsDataURL(file);
    extract(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Extract Palette
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="url" className="gap-1.5"><Link className="h-3.5 w-3.5" />URL</TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
            <TabsTrigger value="board" className="gap-1.5"><Image className="h-3.5 w-3.5" />Board</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && url.trim() && extract(url.trim())}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => extract(url.trim())}
                disabled={!url.trim() || extracting}
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extract"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3 mt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {previewFile ? (
              <div className="relative">
                <img src={previewFile} className="w-full h-40 object-cover rounded-lg" alt="preview" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2"
                  onClick={() => fileRef.current?.click()}
                >
                  Change
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm">Click to upload image</span>
              </button>
            )}
            {extracting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting colors…
              </div>
            )}
          </TabsContent>

          <TabsContent value="board" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">Extract colors from images already on this board.</p>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => extract("board:" + boardId)}
              disabled={extracting}
            >
              {extracting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scanning board…</> : "Scan Board Images"}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Colors to extract: {colorCount}</Label>
          </div>
          <Slider
            min={3}
            max={12}
            step={1}
            value={[colorCount]}
            onValueChange={([v]) => setColorCount(v)}
          />
        </div>

        {colors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Extracted colors</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(new Set(colors.map((c) => c.hex)))}
              >
                Select all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {colors.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => toggle(color.hex)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                    selected.has(color.hex)
                      ? "border-primary bg-primary/5"
                      : "border-border opacity-50"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase truncate">{color.hex}</div>
                    {color.percentage != null && (
                      <div className="text-[10px] text-muted-foreground">{Math.round(color.percentage)}%</div>
                    )}
                  </div>
                  {selected.has(color.hex) && (
                    <Checkbox checked className="ml-auto shrink-0 h-3.5 w-3.5 pointer-events-none" />
                  )}
                </button>
              ))}
            </div>

            {allRooms.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tag to room (optional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={room === "" ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => setRoom("")}
                  >
                    No room
                  </Badge>
                  {allRooms.map((r) => (
                    <Badge
                      key={r}
                      variant={room === r ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => setRoom(r)}
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={selected.size === 0}
              onClick={handleAccept}
            >
              Add {selected.size} color{selected.size !== 1 ? "s" : ""} to board
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
