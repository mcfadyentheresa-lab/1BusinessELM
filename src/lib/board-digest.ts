import type { CanvasElement } from "@/shared/database.types";

export interface DigestRoomItem {
  id: number;
  kind: string;
  name?: string;
  finish?: string;
  color?: string;
  price?: number;
  status?: string;
}

export interface DigestRoom {
  name: string;
  items: DigestRoomItem[];
}

export interface DigestPaletteEntry {
  id: number;
  name?: string;
  hex?: string;
  lrv?: number;
  brand?: string;
  sheen?: string;
  room?: string;
}

export interface DigestMaterialEntry {
  id: number;
  name?: string;
  kind?: string;
  lrv?: number;
  supplier?: string;
  room?: string;
}

export interface BoardDigest {
  boardId: number;
  rooms: DigestRoom[];
  palette: DigestPaletteEntry[];
  materials: DigestMaterialEntry[];
  inspirationCount: number;
  signature: string;
}

const UNROOMED = "Unassigned";

export function buildBoardDigest(boardId: number, elements: CanvasElement[]): BoardDigest {
  const roomMap = new Map<string, DigestRoomItem[]>();
  const palette: DigestPaletteEntry[] = [];
  const materials: DigestMaterialEntry[] = [];
  let inspirationCount = 0;

  for (const el of elements) {
    if (el.type === "room_zone") {
      const c: Record<string, unknown> = (el.content as Record<string, unknown>) || {};
      const name = ((c.title || c.name || c.label || "Room") as string).toString().trim() || "Room";
      if (!roomMap.has(name)) roomMap.set(name, []);
    }
  }

  for (const el of elements) {
    const c: Record<string, unknown> = (el.content as Record<string, unknown>) || {};
    const room = ((c.room || "") as string).toString().trim() || UNROOMED;

    if (el.type === "hardware") {
      if (!roomMap.has(room)) roomMap.set(room, []);
      roomMap.get(room)!.push({
        id: el.id,
        kind: c.category ? `hardware/${c.category}` : "hardware",
        name: (c.name as string) || undefined,
        finish: (c.finish as string) || undefined,
        price: typeof c.price === "number" ? c.price : undefined,
        status: (c.status as string) || undefined,
      });
      continue;
    }

    if (el.type === "product") {
      if (!roomMap.has(room)) roomMap.set(room, []);
      roomMap.get(room)!.push({
        id: el.id,
        kind: c.category ? `product/${c.category}` : "product",
        name: (c.name as string) || undefined,
        finish: (c.finish as string) || undefined,
        status: (c.status as string) || undefined,
      });
      continue;
    }

    if (el.type === "surface") {
      const kind = c.kind === "material" ? "material" : "paint";
      if (kind === "paint") {
        palette.push({
          id: el.id,
          name: (c.name as string) || undefined,
          hex: (c.hex as string) || undefined,
          lrv: typeof c.lrv === "number" ? c.lrv : undefined,
          brand: (c.brand as string) || undefined,
          sheen: (c.sheen as string) || undefined,
          room: (c.room as string) || undefined,
        });
      } else {
        materials.push({
          id: el.id,
          name: (c.name as string) || undefined,
          kind: (c.category as string) || undefined,
          lrv: typeof c.lrv === "number" ? c.lrv : undefined,
          supplier: (c.supplier as string) || undefined,
          room: (c.room as string) || undefined,
        });
      }
      if (!roomMap.has(room)) roomMap.set(room, []);
      roomMap.get(room)!.push({
        id: el.id,
        kind: kind === "paint" ? "paint" : "material",
        name: (c.name as string) || undefined,
        finish: (c.sheen as string) || undefined,
        color: (c.hex as string) || undefined,
        status: (c.status as string) || undefined,
      });
      continue;
    }

    if (el.type === "color_swatch") {
      palette.push({
        id: el.id,
        name: (c.name as string) || undefined,
        hex: (c.hex as string) || undefined,
        lrv: typeof c.lrv === "number" ? c.lrv : undefined,
        brand: (c.brand as string) || undefined,
        sheen: (c.sheen as string) || undefined,
        room: (c.room as string) || undefined,
      });
      continue;
    }

    if (el.type === "image") {
      inspirationCount += 1;
    }
  }

  const rooms: DigestRoom[] = Array.from(roomMap.entries())
    .map(([name, items]) => ({
      name,
      items: items.slice().sort((a, b) => a.id - b.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sortedPalette = palette.slice().sort((a, b) => a.id - b.id);
  const sortedMaterials = materials.slice().sort((a, b) => a.id - b.id);

  const signature = computeSignature(rooms, sortedPalette, sortedMaterials, inspirationCount);

  return {
    boardId,
    rooms,
    palette: sortedPalette,
    materials: sortedMaterials,
    inspirationCount,
    signature,
  };
}

function computeSignature(
  rooms: DigestRoom[],
  palette: DigestPaletteEntry[],
  materials: DigestMaterialEntry[],
  inspirationCount: number,
): string {
  const parts: string[] = [];
  for (const r of rooms) {
    parts.push(`R:${r.name}`);
    for (const it of r.items) {
      parts.push(`${it.id}|${it.kind}|${it.name || ""}|${it.finish || ""}|${it.color || ""}|${it.status || ""}|${it.price ?? ""}`);
    }
  }
  parts.push("|P|");
  for (const p of palette) {
    parts.push(`${p.id}|${p.name || ""}|${p.hex || ""}|${p.lrv ?? ""}|${p.brand || ""}|${p.sheen || ""}|${p.room || ""}`);
  }
  parts.push("|M|");
  for (const m of materials) {
    parts.push(`${m.id}|${m.name || ""}|${m.kind || ""}|${m.lrv ?? ""}|${m.supplier || ""}|${m.room || ""}`);
  }
  parts.push(`|I:${inspirationCount}`);
  return hashString(parts.join("§"));
}

function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function isMeaningfulChange(prev: BoardDigest | null, next: BoardDigest): boolean {
  if (!prev) return true;
  if (prev.signature === next.signature) return false;

  const prevElementCount = countItems(prev);
  const nextElementCount = countItems(next);
  if (prevElementCount !== nextElementCount) return true;

  if (prev.palette.length !== next.palette.length) return true;
  if (prev.materials.length !== next.materials.length) return true;

  const prevSel = collectStatuses(prev);
  const nextSel = collectStatuses(next);
  if (prevSel !== nextSel) return true;

  if (prev.rooms.length !== next.rooms.length) return true;

  return true;
}

function countItems(d: BoardDigest): number {
  return d.rooms.reduce((acc, r) => acc + r.items.length, 0);
}

function collectStatuses(d: BoardDigest): string {
  const parts: string[] = [];
  for (const r of d.rooms) {
    for (const it of r.items) {
      if (it.status === "selected" || it.status === "ordered") {
        parts.push(`${it.id}:${it.status}`);
      }
    }
  }
  return parts.sort().join(",");
}
