import { BUILDINGS, RESOURCES, type ResourceKind } from './defs';
import { Rng } from './rng';

export const GROUND = 0;
export const ROCK = 1;

export interface Placement {
  kind: ResourceKind;
  tx: number;
  ty: number;
}

export interface MapData {
  w: number;
  h: number;
  seed: number;
  terrain: Uint8Array;
  /** Per-tile noise 0..255 used only for visuals. */
  deco: Uint8Array;
  /** Core tile positions for player 1 and player 2. */
  starts: { tx: number; ty: number }[];
  /** Additional core spots with resources around them. */
  expansions: { tx: number; ty: number }[];
  resources: Placement[];
}

/** Resource layout relative to a core's top-left tile. */
const BASE_LAYOUT: { kind: ResourceKind; dx: number; dy: number }[] = [
  { kind: 'crystal', dx: -5, dy: -2 },
  { kind: 'crystal', dx: -6, dy: -1 },
  { kind: 'crystal', dx: -5, dy: 0 },
  { kind: 'crystal', dx: -6, dy: 1 },
  { kind: 'crystal', dx: -5, dy: 2 },
  { kind: 'crystal', dx: -6, dy: 3 },
  { kind: 'crystal', dx: -2, dy: -4 },
  { kind: 'crystal', dx: 0, dy: -4 },
  { kind: 'vent', dx: 5, dy: -4 },
];

export function generateMap(seed: number, size = 80): MapData {
  for (let attempt = 0; attempt < 50; attempt++) {
    const m = tryGenerate(seed + attempt * 7919, size);
    if (m) return m;
  }
  throw new Error('failed to generate a connected map');
}

function tryGenerate(seed: number, size: number): MapData | null {
  const rng = new Rng(seed);
  const w = size;
  const h = size;
  const terrain = new Uint8Array(w * h);
  const deco = new Uint8Array(w * h);
  const core = BUILDINGS.core;

  const mirror = (tx: number, ty: number, fw: number, fh: number) => ({ tx: w - tx - fw, ty: h - ty - fh });

  const p1 = { tx: 10, ty: 10 };
  const nat1 = { tx: 10, ty: Math.round(h * 0.45) };
  const mid1 = { tx: Math.round(w * 0.45), ty: 14 };
  const starts = [p1, mirror(p1.tx, p1.ty, core.w, core.h)];
  const expansions = [nat1, mirror(nat1.tx, nat1.ty, core.w, core.h), mid1, mirror(mid1.tx, mid1.ty, core.w, core.h)];

  const resources: Placement[] = [];
  // Mirrored bases are the point reflection of the player-1-side layout.
  const addBase = (b: { tx: number; ty: number }, mirrored: boolean) => {
    for (const r of BASE_LAYOUT) {
      const d = RESOURCES[r.kind];
      const tx = b.tx + r.dx;
      const ty = b.ty + r.dy;
      resources.push({ kind: r.kind, ...(mirrored ? mirror(tx, ty, d.w, d.h) : { tx, ty }) });
    }
  };
  addBase(p1, false);
  addBase(p1, true);
  addBase(nat1, false);
  addBase(nat1, true);
  addBase(mid1, false);
  addBase(mid1, true);

  const clearZones: { x: number; y: number; r: number }[] = [];
  for (const s of starts) clearZones.push({ x: s.tx + 2, y: s.ty + 1.5, r: 11 });
  for (const e of expansions) clearZones.push({ x: e.tx + 2, y: e.ty + 1.5, r: 8.5 });

  const setSym = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    terrain[y * w + x] = v;
    terrain[(h - 1 - y) * w + (w - 1 - x)] = v;
  };

  const blobs = 26;
  for (let i = 0; i < blobs; i++) {
    const cx = rng.range(2, w - 2);
    const cy = rng.range(2, h / 2 + 4);
    const r = rng.range(1.4, 4.2);
    const stretch = rng.range(0.6, 1.6);
    for (let y = Math.floor(cy - r * 2); y <= cy + r * 2; y++) {
      for (let x = Math.floor(cx - r * 2); x <= cx + r * 2; x++) {
        const dx = (x + 0.5 - cx) / (r * stretch);
        const dy = (y + 0.5 - cy) / (r / stretch);
        if (dx * dx + dy * dy <= 1 + rng.range(-0.25, 0.25)) setSym(x, y, ROCK);
      }
    }
  }
  for (let x = 0; x < w; x++) {
    setSym(x, 0, ROCK);
  }
  for (let y = 0; y < h; y++) {
    setSym(0, y, ROCK);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (const z of clearZones) {
        const dx = x + 0.5 - z.x;
        const dy = y + 0.5 - z.y;
        if (dx * dx + dy * dy < z.r * z.r) {
          terrain[y * w + x] = GROUND;
          break;
        }
      }
    }
  }

  // Remove pockets that can't be reached from player 1's base.
  const reach = new Uint8Array(w * h);
  const stack = [starts[0].ty * w + starts[0].tx];
  reach[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    const ns = [i - 1, i + 1, i - w, i + w];
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) continue;
    for (const n of ns) {
      if (!reach[n] && terrain[n] === GROUND) {
        reach[n] = 1;
        stack.push(n);
      }
    }
  }
  for (const s of [...starts, ...expansions]) {
    if (!reach[s.ty * w + s.tx]) return null;
  }
  for (let i = 0; i < w * h; i++) if (!reach[i]) terrain[i] = ROCK;

  for (let i = 0; i < w * h; i++) deco[i] = Math.floor(rng.next() * 256);

  return { w, h, seed, terrain, deco, starts, expansions, resources };
}
