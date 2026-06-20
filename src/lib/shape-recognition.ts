interface Point {
  x: number;
  y: number;
}

interface StrokePath {
  points: Point[];
}

type ShapeType = "rectangle" | "circle" | "line" | "arrow" | "triangle" | null;

export function recognizeShape(path: StrokePath, _totalPaths?: number): ShapeType {
  const pts = path.points;
  if (!pts || pts.length < 4) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 10 || h < 10) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const closeDist = Math.hypot(last.x - first.x, last.y - first.y);
  const closed = closeDist < Math.max(w, h) * 0.2;

  if (closed) {
    const aspect = w / h;
    if (aspect > 0.7 && aspect < 1.4) return "circle";
    return "rectangle";
  }

  return "line";
}

export function recognizeAllShapes(paths: StrokePath[]): Array<{ path: StrokePath; shape: ShapeType }> {
  return paths.map((p) => ({ path: p, shape: recognizeShape(p, paths.length) }));
}

export function looksLikeHandwriting(paths: StrokePath[]): boolean {
  if (paths.length < 3) return false;
  const avgLength = paths.reduce((acc, p) => acc + p.points.length, 0) / paths.length;
  return avgLength < 30;
}
