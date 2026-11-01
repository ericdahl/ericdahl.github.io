export interface Vec {
  x: number;
  y: number;
}

export interface Grid {
  w: number;
  h: number;
  blocked(tx: number, ty: number): boolean;
}

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, p: number) {
    const a = this.items;
    const pr = this.prio;
    a.push(item);
    pr.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      [pr[parent], pr[i]] = [pr[i], pr[parent]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items;
    const pr = this.prio;
    const top = a[0];
    const lastI = a.pop()!;
    const lastP = pr.pop()!;
    if (a.length) {
      a[0] = lastI;
      pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && pr[l] < pr[m]) m = l;
        if (r < a.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}

function octile(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

/**
 * Finds the passable tile nearest to (gx, gy), breaking ties toward (fromX, fromY).
 * Returns null if nothing passable is within maxR.
 */
export function nearestFreeTile(grid: Grid, gx: number, gy: number, fromX: number, fromY: number, maxR = 12): Vec | null {
  if (!grid.blocked(gx, gy)) return { x: gx, y: gy };
  for (let r = 1; r <= maxR; r++) {
    let best: Vec | null = null;
    let bestD = Infinity;
    for (let y = gy - r; y <= gy + r; y++) {
      for (let x = gx - r; x <= gx + r; x++) {
        if (Math.max(Math.abs(x - gx), Math.abs(y - gy)) !== r) continue;
        if (grid.blocked(x, y)) continue;
        const d = (x - gx) ** 2 + (y - gy) ** 2 + 0.01 * ((x - fromX) ** 2 + (y - fromY) ** 2);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * A* over the tile grid with 8-way movement (no corner cutting).
 * Returns tile coordinates from start (exclusive) to goal (inclusive). If the goal is
 * unreachable, returns a path to the explored tile closest to it.
 */
export function findPath(grid: Grid, sx: number, sy: number, gx: number, gy: number, maxNodes = 6000): Vec[] {
  const { w, h } = grid;
  if (sx === gx && sy === gy) return [];
  const goal = nearestFreeTile(grid, gx, gy, sx, sy);
  if (!goal) return [];
  gx = goal.x;
  gy = goal.y;
  const start = sy * w + sx;
  const target = gy * w + gx;
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const open = new MinHeap();
  g.set(start, 0);
  open.push(start, octile(sx, sy, gx, gy));
  let best = start;
  let bestH = octile(sx, sy, gx, gy);
  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (cur === target) {
      best = cur;
      break;
    }
    if (++expanded > maxNodes) break;
    const cx = cur % w;
    const cy = (cur / w) | 0;
    const cg = g.get(cur)!;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid.blocked(nx, ny)) continue;
      if (dx && dy && (grid.blocked(cx + dx, cy) || grid.blocked(cx, cy + dy))) continue;
      const n = ny * w + nx;
      if (closed.has(n)) continue;
      const ng = cg + cost;
      if (ng < (g.get(n) ?? Infinity)) {
        g.set(n, ng);
        came.set(n, cur);
        const hh = octile(nx, ny, gx, gy);
        if (hh < bestH) {
          bestH = hh;
          best = n;
        }
        open.push(n, ng + hh * 1.001);
      }
    }
  }
  const out: Vec[] = [];
  let c = best;
  while (c !== start) {
    out.push({ x: c % w, y: (c / w) | 0 });
    const p = came.get(c);
    if (p === undefined) break;
    c = p;
  }
  out.reverse();
  return out;
}

/** True if a disc of the given radius can travel in a straight line between two points. */
export function lineClear(grid: Grid, ax: number, ay: number, bx: number, by: number, radius = 0.35): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  const steps = Math.ceil(len / 0.25);
  const px = (-dy / len) * radius;
  const py = (dx / len) * radius;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (grid.blocked(Math.floor(x), Math.floor(y))) return false;
    if (grid.blocked(Math.floor(x + px), Math.floor(y + py))) return false;
    if (grid.blocked(Math.floor(x - px), Math.floor(y - py))) return false;
  }
  return true;
}

/** Converts a tile path into world waypoints and removes redundant ones via line-of-sight. */
export function smoothPath(grid: Grid, fromX: number, fromY: number, tiles: Vec[], radius = 0.35): Vec[] {
  const pts = tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  if (pts.length <= 1) return pts;
  const out: Vec[] = [];
  let ax = fromX;
  let ay = fromY;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(grid, ax, ay, pts[j].x, pts[j].y, radius)) j--;
    out.push(pts[j]);
    ax = pts[j].x;
    ay = pts[j].y;
    i = j + 1;
  }
  return out;
}
