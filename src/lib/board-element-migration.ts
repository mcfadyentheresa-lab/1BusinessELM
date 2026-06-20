import type { CanvasElement } from "@/shared/database.types";

export function isTextHeading(el: CanvasElement): boolean {
  const c = (el.content as Record<string, unknown>) ?? {};
  return el.type === "text" && (c.variant === "heading" || c.isHeading === true);
}

export function isPaintSurface(el: CanvasElement): boolean {
  if (el.type !== "surface") return false;
  const c = (el.content as Record<string, unknown>) ?? {};
  return c.kind !== "material";
}
