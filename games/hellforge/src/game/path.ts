import { FLOOR, type Level, type Point } from './map';

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

function walk(l: Level, x: number, y: number) {
  return x >= 0 && y >= 0 && x < l.w && y < l.h && l.tiles[y * l.w + x] === FLOOR;
}

/** Diagonal steps may not cut wall corners. */
function canStep(l: Level, x: number, y: number, dx: number, dy: number) {
  if (!walk(l, x + dx, y + dy)) return false;
  if (dx && dy) return walk(l, x + dx, y) && walk(l, x, y + dy);
  return true;
}

class Heap {
  private items: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.items.length;
  }
  push(v: number, p: number) {
    const a = this.items;
    const b = this.pri;
    a.push(v);
    b.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (b[par] <= b[i]) break;
      [a[par], a[i]] = [a[i], a[par]];
      [b[par], b[i]] = [b[i], b[par]];
      i = par;
    }
  }
  pop(): number {
    const a = this.items;
    const b = this.pri;
    const top = a[0];
    const lv = a.pop()!;
    const lp = b.pop()!;
    if (a.length) {
      a[0] = lv;
      b[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && b[l] < b[m]) m = l;
        if (r < a.length && b[r] < b[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [b[m], b[i]] = [b[i], b[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* over tiles with 8-way movement. Returns tile centers from (exclusive) start to goal,
 * or the path to the closest reachable tile when the goal is blocked/unreachable.
 */
export function findPath(l: Level, from: Point, to: Point, maxNodes = 6000): Point[] {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  let gx = Math.floor(to.x);
  let gy = Math.floor(to.y);
  if (sx === gx && sy === gy) return [];
  const n = l.w * l.h;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const start = sy * l.w + sx;
  const goal = gy * l.w + gx;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const heap = new Heap();
  g[start] = 0;
  heap.push(start, h(sx, sy));
  let best = start;
  let bestH = h(sx, sy);
  let expanded = 0;
  while (heap.size && expanded < maxNodes) {
    const c = heap.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    expanded++;
    if (c === goal) {
      best = c;
      break;
    }
    const cx = c % l.w;
    const cy = (c - cx) / l.w;
    const ch = h(cx, cy);
    if (ch < bestH) (bestH = ch), (best = c);
    for (const [dx, dy, cost] of DIRS) {
      if (!canStep(l, cx, cy, dx, dy)) continue;
      const ni = (cy + dy) * l.w + cx + dx;
      if (closed[ni]) continue;
      const ng = g[c] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = c;
        heap.push(ni, ng + h(cx + dx, cy + dy));
      }
    }
  }
  const out: Point[] = [];
  for (let c = best; c !== start && c >= 0; c = came[c]) {
    const x = c % l.w;
    out.push({ x: x + 0.5, y: (c - x) / l.w + 0.5 });
  }
  out.reverse();
  return out;
}

/** Exact grid traversal: true only if every tile the segment touches is floor, so projectiles never clip corners. */
export function lineOfSight(l: Level, a: Point, b: Point): boolean {
  let x = Math.floor(a.x);
  let y = Math.floor(a.y);
  const ex = Math.floor(b.x);
  const ey = Math.floor(b.y);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const tdx = dx ? Math.abs(1 / dx) : Infinity;
  const tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tmx = dx ? (sx > 0 ? x + 1 - a.x : a.x - x) * tdx : Infinity;
  let tmy = dy ? (sy > 0 ? y + 1 - a.y : a.y - y) * tdy : Infinity;
  for (let i = 0; i < 400 && (x !== ex || y !== ey); i++) {
    if (Math.abs(tmx - tmy) < 1e-9) {
      // Passing exactly through a corner: both side tiles must be open.
      if (!walk(l, x + sx, y) || !walk(l, x, y + sy)) return false;
      x += sx;
      y += sy;
      tmx += tdx;
      tmy += tdy;
    } else if (tmx < tmy) {
      x += sx;
      tmx += tdx;
    } else {
      y += sy;
      tmy += tdy;
    }
    if (!walk(l, x, y)) return false;
  }
  return true;
}

/**
 * Dijkstra map rooted at a target (usually the player). Monsters roll downhill toward it,
 * which is much cheaper than running A* for each one.
 */
export class FlowField {
  dist: Float32Array;
  rootX = -1;
  rootY = -1;
  constructor(private l: Level, private radius = 28) {
    this.dist = new Float32Array(l.w * l.h).fill(Infinity);
  }

  update(x: number, y: number) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx === this.rootX && ty === this.rootY) return;
    this.rootX = tx;
    this.rootY = ty;
    const l = this.l;
    const d = this.dist;
    d.fill(Infinity);
    if (!walk(l, tx, ty)) return;
    const heap = new Heap();
    const s = ty * l.w + tx;
    d[s] = 0;
    heap.push(s, 0);
    while (heap.size) {
      const c = heap.pop();
      const cx = c % l.w;
      const cy = (c - cx) / l.w;
      const cd = d[c];
      if (cd > this.radius) continue;
      for (const [dx, dy, cost] of DIRS) {
        if (!canStep(l, cx, cy, dx, dy)) continue;
        const ni = (cy + dy) * l.w + cx + dx;
        const nd = cd + cost;
        if (nd < d[ni]) {
          d[ni] = nd;
          heap.push(ni, nd);
        }
      }
    }
  }

  at(x: number, y: number): number {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.l.w || ty >= this.l.h) return Infinity;
    return this.dist[ty * this.l.w + tx];
  }

  /** Center of the neighbouring tile that is closest to the root, or null. */
  next(x: number, y: number): Point | null {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    let best = this.at(x, y);
    let out: Point | null = null;
    for (const [dx, dy] of DIRS) {
      if (!canStep(this.l, tx, ty, dx, dy)) continue;
      const v = this.dist[(ty + dy) * this.l.w + tx + dx];
      if (v < best) {
        best = v;
        out = { x: tx + dx + 0.5, y: ty + dy + 0.5 };
      }
    }
    return out;
  }
}
