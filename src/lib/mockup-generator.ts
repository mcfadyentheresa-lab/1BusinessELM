import { supabase } from "./supabase";
import type { CanvasElement } from "../shared/database.types";

export type MockupSeed = {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, any>;
};

export type MockupSourcingResult =
  | { kind: "real"; seeds: MockupSeed[] }
  | { kind: "generic"; seeds: MockupSeed[]; variant: number };

const GRID = 20;

type RealPhoto = { url: string; caption: string | null };
type RealPaint = { name: string; hex: string; brand: string };

async function fetchRealPhotos(projectId: number, roomName: string): Promise<RealPhoto[]> {
  const { data } = await supabase
    .from("photos")
    .select("url, caption, tags, planning_board_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (!data) return [];
  const roomLower = roomName.toLowerCase();
  return data
    .filter((p: any) => {
      const tags = (p.tags as string[] | null) ?? [];
      const tagMatch = tags.some((t) => t.toLowerCase() === roomLower);
      return tagMatch;
    })
    .slice(0, 4)
    .map((p: any) => ({ url: p.url, caption: p.caption }));
}

async function fetchRealPaints(): Promise<RealPaint[]> {
  const { data } = await supabase
    .from("paint_colors")
    .select("name, hex, brand")
    .limit(12);
  if (!data) return [];
  return data as RealPaint[];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length && out.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function buildRealSeeds(photos: RealPhoto[], paints: RealPaint[]): MockupSeed[] {
  const seeds: MockupSeed[] = [];
  let z = 0;
  const headingX = 0;
  const headingY = 0;
  seeds.push({
    type: "text",
    x: headingX,
    y: headingY,
    width: 360,
    height: 44,
    content: { variant: "heading", title: "Starter Layout", tracking: "normal", align: "left", size: "md" },
  });
  z++;
  let colY = 80;
  const photoCount = Math.min(photos.length, 4);
  for (let i = 0; i < photoCount; i++) {
    const p = photos[i];
    seeds.push({
      type: "image",
      x: 0,
      y: colY,
      width: 360,
      height: 260,
      content: { url: p.url, caption: p.caption ?? "" },
    });
    colY += 280;
    z++;
  }
  const remainingSlots = Math.max(0, 4 - photoCount);
  if (remainingSlots > 0 && paints.length > 0) {
    const chosen = pickRandom(paints, Math.min(remainingSlots, paints.length));
    for (const paint of chosen) {
      seeds.push({
        type: "surface",
        x: 400,
        y: colY - 280 * photoCount + (seeds.length - 1) * 260,
        width: 240,
        height: 240,
        content: { kind: "paint", color: paint.hex, name: paint.name, hex: paint.hex, status: "idea" },
      });
      z++;
    }
  }
  return seeds;
}

const GENERIC_VARIANTS: MockupSeed[][] = [
  [
    { type: "text", x: 0, y: 0, width: 360, height: 44, content: { variant: "heading", title: "Color Story", tracking: "normal", align: "left", size: "md" } },
    { type: "surface", x: 0, y: 80, width: 240, height: 240, content: { kind: "paint", color: "#C9D6C2", name: "Sample Paint Color", hex: "#C9D6C2", status: "idea" } },
    { type: "surface", x: 280, y: 80, width: 240, height: 240, content: { kind: "paint", color: "#E8DDD0", name: "Sample Paint Color", hex: "#E8DDD0", status: "idea" } },
    { type: "surface", x: 560, y: 80, width: 240, height: 240, content: { kind: "paint", color: "#3E4A3F", name: "Sample Paint Color", hex: "#3E4A3F", status: "idea" } },
    { type: "text", x: 0, y: 360, width: 240, height: 140, content: { variant: "note", title: "", text: "Notes about the palette..." } },
  ],
  [
    { type: "text", x: 0, y: 0, width: 360, height: 44, content: { variant: "heading", title: "Design Notes", tracking: "normal", align: "left", size: "md" } },
    { type: "surface", x: 0, y: 80, width: 240, height: 240, content: { kind: "paint", color: "#D4C9B0", name: "Sample Paint Color", hex: "#D4C9B0", status: "idea" } },
    { type: "surface", x: 280, y: 80, width: 240, height: 240, content: { kind: "paint", color: "#6B7F7A", name: "Sample Paint Color", hex: "#6B7F7A", status: "idea" } },
    { type: "todo", x: 0, y: 360, width: 240, height: 200, content: { title: "To-do", items: [{ text: "Confirm dimensions", checked: false }, { text: "Pick finish", checked: false }, { text: "Order samples", checked: false }] } },
    { type: "text", x: 280, y: 360, width: 240, height: 140, content: { variant: "note", title: "", text: "Ideas and references..." } },
  ],
  [
    { type: "text", x: 0, y: 0, width: 360, height: 44, content: { variant: "heading", title: "Material Board", tracking: "normal", align: "left", size: "md" } },
    { type: "surface", x: 0, y: 80, width: 240, height: 290, content: { kind: "material", name: "Sample Material", supplier: "", code: "", imageUrl: "", notes: "", status: "idea" } },
    { type: "surface", x: 280, y: 80, width: 240, height: 290, content: { kind: "material", name: "Sample Material", supplier: "", code: "", imageUrl: "", notes: "", status: "idea" } },
    { type: "surface", x: 560, y: 80, width: 240, height: 240, content: { kind: "paint", color: "#B8A89A", name: "Sample Paint Color", hex: "#B8A89A", status: "idea" } },
    { type: "text", x: 0, y: 410, width: 240, height: 140, content: { variant: "note", title: "", text: "Material notes..." } },
  ],
];

export async function sourceMockupSeeds(
  projectId: number,
  roomName: string,
  variantIndex?: number
): Promise<MockupSourcingResult> {
  const photos = await fetchRealPhotos(projectId, roomName);
  if (photos.length >= 2) {
    return { kind: "real", seeds: buildRealSeeds(photos, []) };
  }
  const paints = await fetchRealPaints();
  if (photos.length > 0 || paints.length > 0) {
    return { kind: "real", seeds: buildRealSeeds(photos, paints) };
  }
  const idx = variantIndex != null ? variantIndex : Math.floor(Math.random() * GENERIC_VARIANTS.length);
  const variant = GENERIC_VARIANTS[idx % GENERIC_VARIANTS.length];
  return { kind: "generic", seeds: variant, variant: idx % GENERIC_VARIANTS.length };
}

export async function createMockupElements(
  boardId: number,
  projectId: number,
  roomName: string,
  startZ: number,
  variantIndex?: number
): Promise<CanvasElement[]> {
  const result = await sourceMockupSeeds(projectId, roomName, variantIndex);
  const created: CanvasElement[] = [];
  let z = startZ;
  for (const seed of result.seeds) {
    const x = Math.round(seed.x / GRID) * GRID;
    const y = Math.round(seed.y / GRID) * GRID;
    const { data, error } = await supabase
      .from("canvas_elements")
      .insert({
        board_id: boardId,
        type: seed.type,
        x,
        y,
        width: seed.width,
        height: seed.height,
        z_index: z,
        content: seed.content as any,
        is_mockup: true,
      })
      .select()
      .single();
    if (!error && data) {
      created.push(data as CanvasElement);
      z++;
    }
  }
  return created;
}

export async function deleteMockupElements(boardId: number): Promise<number> {
  const { data, error } = await supabase
    .from("canvas_elements")
    .delete()
    .eq("board_id", boardId)
    .eq("is_mockup", true)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export const MOCKUP_VARIANT_COUNT = GENERIC_VARIANTS.length;
