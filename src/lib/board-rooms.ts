import type { CanvasElement } from "@/shared/database.types";

export type RoomStatus = "idea" | "shortlist" | "selected" | "ordered";
export const ROOM_STATUSES: RoomStatus[] = ["idea", "shortlist", "selected", "ordered"];
export const STATUS_CYCLE: RoomStatus[] = ["idea", "shortlist", "selected", "ordered"];

export const STATUS_EDGE_COLOR: Record<RoomStatus, string> = {
  idea: "#a8a29e",
  shortlist: "#7a9bb5",
  selected: "#2f4a3a",
  ordered: "#2f4a3a",
};

export function nextStatus(s: RoomStatus | undefined): RoomStatus {
  const cur = (s as RoomStatus) || "idea";
  const idx = STATUS_CYCLE.indexOf(cur);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export function isRoomable(el: CanvasElement): boolean {
  return el.type === "hardware" || el.type === "surface" || el.type === "product" || el.type === "furniture_redesign";
}

export function isCategorizable(el: CanvasElement): boolean {
  return (
    el.type === "hardware" ||
    el.type === "surface" ||
    el.type === "product" ||
    el.type === "furniture_redesign" ||
    el.type === "image" ||
    el.type === "link"
  );
}

export function explicitCategory(el: CanvasElement): string | undefined {
  if (!isCategorizable(el)) return undefined;
  const c = (el.content as Record<string, unknown>) || {};
  const raw = typeof c.category === "string" ? c.category.trim() : "";
  return raw || undefined;
}

export function deriveCategories(elements: CanvasElement[]): string[] {
  const counts = new Map<string, number>();
  for (const el of elements) {
    const cat = explicitCategory(el);
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export function countByCategory(
  elements: CanvasElement[],
  activeRoom: string | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const el of elements) {
    const cat = explicitCategory(el);
    if (!cat) continue;
    if (activeRoom != null) {
      const room = resolveRoomFor(el, elements);
      if (room !== activeRoom) continue;
    }
    out[cat] = (out[cat] || 0) + 1;
  }
  return out;
}

export function countByRoom(
  elements: CanvasElement[],
  activeCategory: string | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const el of elements) {
    if (activeCategory != null && activeCategory !== "__all__") {
      if (explicitCategory(el) !== activeCategory) continue;
    }
    const room = resolveRoomFor(el, elements);
    if (!room) continue;
    out[room] = (out[room] || 0) + 1;
  }
  return out;
}

export function explicitRoom(el: CanvasElement): string | undefined {
  if (!isRoomable(el)) return undefined;
  const c = (el.content as Record<string, unknown>) || {};
  const room = typeof c.room === "string" ? c.room.trim() : "";
  return room || undefined;
}

export function roomZoneName(el: CanvasElement): string | undefined {
  if (el.type !== "room_zone") return undefined;
  const t = (el.content as Record<string, unknown>)?.title;
  if (typeof t !== "string") return undefined;
  const trimmed = t.trim();
  return trimmed || undefined;
}

export function resolveRoomFor(el: CanvasElement, allElements: CanvasElement[]): string | undefined {
  const direct = explicitRoom(el);
  if (direct) return direct;
  if (el.type === "room_zone") return roomZoneName(el);
  for (const z of allElements) {
    if (z.type !== "room_zone") continue;
    const name = roomZoneName(z);
    if (!name) continue;
    const w = z.width || 500;
    const h = z.height || 400;
    if (el.x >= z.x && el.y >= z.y && el.x < z.x + w && el.y < z.y + h) return name;
  }
  return undefined;
}

export function deriveRooms(elements: CanvasElement[]): string[] {
  const seen = new Set<string>();
  for (const el of elements) {
    const name = roomZoneName(el) ?? explicitRoom(el);
    if (name) seen.add(name);
  }
  return Array.from(seen);
}

export function orderRooms(rooms: string[], savedOrder: string[] | undefined): string[] {
  if (!savedOrder || savedOrder.length === 0) return rooms;
  const set = new Set(rooms);
  const ordered: string[] = [];
  for (const n of savedOrder) {
    if (set.has(n)) {
      ordered.push(n);
      set.delete(n);
    }
  }
  for (const n of rooms) {
    if (set.has(n)) ordered.push(n);
  }
  return ordered;
}

export function readCadPrice(el: CanvasElement): { amount: number | null; currency: string } {
  const c = (el.content as Record<string, unknown>) || {};
  const currency = (typeof c.currency === "string" && c.currency.trim()) || "CAD";
  const raw = c.price;
  if (raw == null || raw === "") return { amount: null, currency };
  if (typeof raw === "number") return { amount: Number.isFinite(raw) ? raw : null, currency };
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return { amount: null, currency };
  const n = Number(cleaned);
  return { amount: Number.isFinite(n) ? n : null, currency };
}

export interface RoomBudget {
  selected: number;
  ordered: number;
  total: number;
  hasMixedCurrency: boolean;
}

export function computeRoomBudget(
  elements: CanvasElement[],
  roomName: string | null,
): RoomBudget {
  let selected = 0;
  let ordered = 0;
  let mixed = false;
  for (const el of elements) {
    if (!isRoomable(el)) continue;
    const status = ((el.content as Record<string, unknown>)?.status as RoomStatus | undefined) || "idea";
    if (status !== "selected" && status !== "ordered") continue;
    const elRoom = resolveRoomFor(el, elements);
    if (roomName != null && elRoom !== roomName) continue;
    const { amount, currency } = readCadPrice(el);
    if (amount == null) continue;
    if (currency.toUpperCase() !== "CAD") {
      mixed = true;
      continue;
    }
    if (status === "selected") selected += amount;
    else ordered += amount;
  }
  return { selected, ordered, total: selected + ordered, hasMixedCurrency: mixed };
}

const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function formatCad(n: number): string {
  return cadFormatter.format(n);
}

export function countByStatus(
  elements: CanvasElement[],
  roomName: string | null,
): Record<RoomStatus, number> {
  const out: Record<RoomStatus, number> = { idea: 0, shortlist: 0, selected: 0, ordered: 0 };
  for (const el of elements) {
    if (!isRoomable(el)) continue;
    if (roomName != null) {
      const elRoom = resolveRoomFor(el, elements);
      if (elRoom !== roomName) continue;
    }
    const s = ((el.content as Record<string, unknown>)?.status as RoomStatus | undefined) || "idea";
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}
