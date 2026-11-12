import { Rng } from './rng';

export const VOID = 0;
export const FLOOR = 1;
export const WALL = 2;

export type ThemeId = 'town' | 'fields' | 'cave' | 'forest' | 'chapel' | 'crypt' | 'hell' | 'oasis' | 'desert' | 'glass' | 'mesa' | 'cistern' | 'ruins' | 'vault'
  | 'snowtown' | 'snow' | 'icemine' | 'foundry' | 'furnace' | 'heart';
export type ExitKind = 'path' | 'down' | 'up';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Exit extends Point {
  to: string;
  label: string;
  kind: ExitKind;
}

export type PropKind =
  | 'torch' | 'bones' | 'pillar' | 'tent' | 'campfire' | 'grave' | 'brazier' | 'banner' | 'lava'
  | 'scrub' | 'shards' | 'urn' | 'quicksand' | 'well'
  | 'icicle' | 'anvil' | 'bell' | 'drift' | 'rubble' | 'ruin' | 'hearth';
export interface Prop extends Point {
  kind: PropKind;
}

export type ObjectKind = 'chest' | 'barrel' | 'shrine' | 'brazier';

/** Themes where the cold is loose and braziers stand unlit, waiting for the ember. */
export const COLD_THEMES: ReadonlySet<ThemeId> = new Set<ThemeId>(['snow', 'icemine', 'foundry', 'furnace', 'heart']);
export interface MapObject extends Point {
  kind: ObjectKind;
}

export interface Level {
  w: number;
  h: number;
  tiles: Uint8Array;
  theme: ThemeId;
  start: Point;
  exits: Exit[];
  waypoint: Point | null;
  spawns: Point[];
  props: Prop[];
  objects: MapObject[];
  rooms: Rect[];
  /** Named spots for handcrafted maps (town NPCs, boss lair). */
  spots: Record<string, Point>;
  /** Tile indexes of quicksand, which slows anything walking through it. */
  slow: Set<number>;
}

export interface LinkSpec {
  to: string;
  label: string;
  kind: ExitKind;
}

export interface LevelSpec {
  gen: 'open' | 'rooms' | 'town';
  w: number;
  h: number;
  theme: ThemeId;
  /** First link is the entrance (back), the rest lead onward. */
  links: LinkSpec[];
  waypoint?: boolean;
  bossLair?: boolean;
  density?: number;
}

export function idx(l: { w: number }, x: number, y: number): number {
  return y * l.w + x;
}

export function tileAt(l: Level, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= l.w || ty >= l.h) return WALL;
  return l.tiles[ty * l.w + tx];
}

export function isWalkable(l: Level, x: number, y: number): boolean {
  return tileAt(l, x, y) === FLOOR;
}

function newLevel(w: number, h: number, theme: ThemeId, fill: number): Level {
  return {
    w,
    h,
    tiles: new Uint8Array(w * h).fill(fill),
    theme,
    start: { x: 0, y: 0 },
    exits: [],
    waypoint: null,
    spawns: [],
    props: [],
    objects: [],
    rooms: [],
    spots: {},
    slow: new Set(),
  };
}

function setRect(l: Level, r: Rect, v: number) {
  for (let y = Math.max(0, r.y); y < Math.min(l.h, r.y + r.h); y++)
    for (let x = Math.max(0, r.x); x < Math.min(l.w, r.x + r.w); x++) l.tiles[y * l.w + x] = v;
}

/** BFS distances from a tile over floor; -1 where unreachable. */
export function floodDistances(l: Level, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(l.w * l.h).fill(-1);
  const start = idx(l, sx, sy);
  if (l.tiles[start] !== FLOOR) return dist;
  const q = new Int32Array(l.w * l.h);
  let head = 0;
  let tail = 0;
  q[tail++] = start;
  dist[start] = 0;
  while (head < tail) {
    const c = q[head++];
    const cx = c % l.w;
    const cy = (c - cx) / l.w;
    const d = dist[c] + 1;
    if (cx > 0 && l.tiles[c - 1] === FLOOR && dist[c - 1] < 0) (dist[c - 1] = d), (q[tail++] = c - 1);
    if (cx < l.w - 1 && l.tiles[c + 1] === FLOOR && dist[c + 1] < 0) (dist[c + 1] = d), (q[tail++] = c + 1);
    if (cy > 0 && l.tiles[c - l.w] === FLOOR && dist[c - l.w] < 0) (dist[c - l.w] = d), (q[tail++] = c - l.w);
    if (cy < l.h - 1 && l.tiles[c + l.w] === FLOOR && dist[c + l.w] < 0) (dist[c + l.w] = d), (q[tail++] = c + l.w);
  }
  return dist;
}

function wallNeighbors(l: Level, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h || l.tiles[ny * l.w + nx] !== FLOOR) n++;
    }
  return n;
}

function carveDisc(l: Level, cx: number, cy: number, r: number) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 2 || y < 2 || x >= l.w - 2 || y >= l.h - 2) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) l.tiles[y * l.w + x] = FLOOR;
    }
}

/** Wandering, biased walk between two points so the level is always traversable. */
function carvePath(l: Level, rng: Rng, a: Point, b: Point, r: number) {
  let x = a.x;
  let y = a.y;
  for (let i = 0; i < 4000; i++) {
    carveDisc(l, x, y, r);
    const dx = b.x - x;
    const dy = b.y - y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    if (rng.chance(0.65)) {
      if (Math.abs(dx) > Math.abs(dy)) x += Math.sign(dx);
      else y += Math.sign(dy);
    } else {
      x += rng.int(-1, 1);
      y += rng.int(-1, 1);
    }
    x = Math.max(3, Math.min(l.w - 4, x));
    y = Math.max(3, Math.min(l.h - 4, y));
  }
}

/** Walls off floor that cannot be reached from `from`. */
function pruneUnreachable(l: Level, from: Point): Int32Array {
  const dist = floodDistances(l, from.x, from.y);
  for (let i = 0; i < l.tiles.length; i++) if (l.tiles[i] === FLOOR && dist[i] < 0) l.tiles[i] = WALL;
  return dist;
}

function edgePoint(l: Level, rng: Rng, side: 'w' | 'e' | 'n' | 's'): Point {
  const m = 4;
  switch (side) {
    case 'w':
      return { x: m, y: rng.int(m + 4, l.h - m - 5) };
    case 'e':
      return { x: l.w - m - 1, y: rng.int(m + 4, l.h - m - 5) };
    case 'n':
      return { x: rng.int(m + 4, l.w - m - 5), y: m };
    default:
      return { x: rng.int(m + 4, l.w - m - 5), y: l.h - m - 1 };
  }
}

function genOpen(spec: LevelSpec, rng: Rng): Level {
  const l = newLevel(spec.w, spec.h, spec.theme, FLOOR);
  const density = spec.density ?? 0.4;
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      const border = x < 2 || y < 2 || x >= l.w - 2 || y >= l.h - 2;
      if (border || rng.chance(density)) l.tiles[y * l.w + x] = WALL;
    }
  for (let it = 0; it < 4; it++) {
    const next = l.tiles.slice();
    for (let y = 1; y < l.h - 1; y++)
      for (let x = 1; x < l.w - 1; x++) {
        const n = wallNeighbors(l, x, y);
        next[y * l.w + x] = n >= 5 ? WALL : n <= 2 ? FLOOR : l.tiles[y * l.w + x];
      }
    l.tiles = next;
  }
  const sides: ('w' | 'e' | 'n' | 's')[] = ['w', 'e', 'n', 's'];
  const entrySide = rng.pick(sides);
  const opposite = { w: 'e', e: 'w', n: 's', s: 'n' } as const;
  const exitSides = [opposite[entrySide], ...rng.shuffle(sides.filter((s) => s !== entrySide && s !== opposite[entrySide]))];
  const entry = edgePoint(l, rng, entrySide);
  const exitPts = spec.links.slice(1).map((_, i) => edgePoint(l, rng, exitSides[i % exitSides.length]));
  const center = { x: Math.floor(l.w / 2) + rng.int(-4, 4), y: Math.floor(l.h / 2) + rng.int(-4, 4) };
  carvePath(l, rng, entry, center, 1.6);
  for (const p of exitPts) carvePath(l, rng, center, p, 1.6);
  carveDisc(l, entry.x, entry.y, 3);
  for (const p of exitPts) carveDisc(l, p.x, p.y, 2.5);
  carveDisc(l, center.x, center.y, 3);
  connectRegions(l, rng, center);
  const dist = pruneUnreachable(l, entry);
  finishLevel(l, spec, rng, entry, exitPts, dist);
  return l;
}

/** Links every reasonably sized pocket of floor back to `hub` so cellular caves are not wasted. */
function connectRegions(l: Level, rng: Rng, hub: Point) {
  const seen = new Uint8Array(l.w * l.h);
  for (let i = 0; i < l.tiles.length; i++) {
    if (l.tiles[i] !== FLOOR || seen[i]) continue;
    const x = i % l.w;
    const y = (i - x) / l.w;
    const dist = floodDistances(l, x, y);
    let size = 0;
    for (let k = 0; k < dist.length; k++) if (dist[k] >= 0) (seen[k] = 1), size++;
    if (dist[idx(l, hub.x, hub.y)] >= 0 || size < 12) continue;
    carvePath(l, rng, { x, y }, hub, 1.2);
  }
}

function rectsOverlap(a: Rect, b: Rect, pad: number) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

function center(r: Rect): Point {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
}

function carveCorridor(l: Level, a: Point, b: Point, horizFirst: boolean) {
  const wide = (x: number, y: number) => setRect(l, { x, y, w: 2, h: 2 }, FLOOR);
  let x = a.x;
  let y = a.y;
  const stepX = () => {
    while (x !== b.x) {
      wide(x, y);
      x += Math.sign(b.x - x);
    }
  };
  const stepY = () => {
    while (y !== b.y) {
      wide(x, y);
      y += Math.sign(b.y - y);
    }
  };
  if (horizFirst) stepX(), stepY();
  else stepY(), stepX();
  wide(x, y);
}

function genRooms(spec: LevelSpec, rng: Rng): Level {
  const l = newLevel(spec.w, spec.h, spec.theme, WALL);
  const rooms: Rect[] = [];
  const target = Math.floor((spec.w * spec.h) / 170);
  for (let tries = 0; tries < 600 && rooms.length < target; tries++) {
    const big = spec.bossLair && rooms.length === 1;
    const w = big ? rng.int(13, 16) : rng.int(5, 11);
    const h = big ? rng.int(13, 16) : rng.int(5, 11);
    const r = { x: rng.int(3, l.w - w - 4), y: rng.int(3, l.h - h - 4), w, h };
    if (rooms.some((o) => rectsOverlap(o, r, 3))) continue;
    rooms.push(r);
  }
  for (const r of rooms) setRect(l, r, FLOOR);
  // Incremental spanning tree: each room links to its nearest already-linked room, plus a few loops.
  for (let i = 1; i < rooms.length; i++) {
    const c = center(rooms[i]);
    let best = 0;
    let bd = Infinity;
    for (let j = 0; j < i; j++) {
      const o = center(rooms[j]);
      const d = Math.abs(o.x - c.x) + Math.abs(o.y - c.y);
      if (d < bd) (bd = d), (best = j);
    }
    carveCorridor(l, c, center(rooms[best]), rng.chance(0.5));
    if (i > 2 && rng.chance(0.2)) carveCorridor(l, c, center(rooms[rng.int(0, i - 1)]), rng.chance(0.5));
  }
  l.rooms = rooms;
  const entry = center(rooms[0]);
  const dist = floodDistances(l, entry.x, entry.y);
  // Exits go in the rooms furthest from the entrance (the boss lair is room 1 if requested).
  const order = rooms
    .map((r, i) => ({ i, d: dist[idx(l, center(r).x, center(r).y)] }))
    .filter((o) => o.i !== 0)
    .sort((a, b) => b.d - a.d);
  const exitPts: Point[] = [];
  for (let k = 0; k < spec.links.length - 1; k++) {
    const room = rooms[order[k % order.length].i];
    exitPts.push({ x: room.x + 1 + k, y: room.y + 1 });
  }
  if (spec.bossLair) {
    const lair = order[0] ? rooms[order[0].i] : rooms[rooms.length - 1];
    l.spots.boss = center(lair);
    const corners: Point[] = [
      { x: lair.x + 1, y: lair.y + 1 },
      { x: lair.x + lair.w - 2, y: lair.y + 1 },
      { x: lair.x + 1, y: lair.y + lair.h - 2 },
      { x: lair.x + lair.w - 2, y: lair.y + lair.h - 2 },
    ];
    // In the cold the lair's braziers are real ones: out until the hero lights them, and the only shelter in the fight.
    if (COLD_THEMES.has(spec.theme)) for (const c of corners) l.objects.push({ ...c, kind: 'brazier' });
    else for (const c of corners) l.props.push({ ...c, kind: 'brazier' });
  }
  for (const r of rooms) {
    if (r.w >= 9 && r.h >= 9 && rng.chance(0.6)) {
      for (const [px, py] of [
        [r.x + 2, r.y + 2],
        [r.x + r.w - 3, r.y + 2],
        [r.x + 2, r.y + r.h - 3],
        [r.x + r.w - 3, r.y + r.h - 3],
      ]) {
        l.tiles[idx(l, px, py)] = WALL;
        l.props.push({ x: px, y: py, kind: 'pillar' });
      }
    }
  }
  finishLevel(l, spec, rng, entry, exitPts, floodDistances(l, entry.x, entry.y));
  return l;
}

function finishLevel(l: Level, spec: LevelSpec, rng: Rng, entry: Point, exitPts: Point[], dist: Int32Array) {
  l.start = { ...entry };
  if (spec.links[0]) l.exits.push({ ...entry, ...spec.links[0] });
  spec.links.slice(1).forEach((link, i) => l.exits.push({ ...exitPts[i], ...link }));
  const floors: Point[] = [];
  for (let y = 2; y < l.h - 2; y++)
    for (let x = 2; x < l.w - 2; x++) if (l.tiles[idx(l, x, y)] === FLOOR) floors.push({ x, y });
  const nearExit = (p: Point, r: number) => l.exits.some((e) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < r);
  if (spec.waypoint) {
    const cands = floors.filter((p) => {
      const d = dist[idx(l, p.x, p.y)];
      return d > 4 && d < 10 && wallNeighbors(l, p.x, p.y) === 0;
    });
    l.waypoint = cands.length ? rng.pick(cands) : { x: entry.x + 1, y: entry.y };
  }
  // Spawn spots for monster packs: spread out, away from the entrance.
  const shuffled = rng.shuffle(floors.filter((p) => dist[idx(l, p.x, p.y)] > 14 && wallNeighbors(l, p.x, p.y) <= 1));
  for (const p of shuffled) {
    if (l.spawns.every((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 9)) l.spawns.push(p);
  }
  // Decorations and interactables.
  const decorKinds: PropKind[] =
    l.theme === 'fields' || l.theme === 'forest' ? ['bones', 'grave']
    : l.theme === 'hell' ? ['bones', 'lava']
    : l.theme === 'desert' || l.theme === 'mesa' ? ['bones', 'scrub', 'scrub']
    : l.theme === 'glass' ? ['shards', 'shards', 'bones']
    : l.theme === 'ruins' ? ['bones', 'urn', 'torch']
    : l.theme === 'vault' ? ['urn', 'shards', 'torch']
    : l.theme === 'snow' ? ['drift', 'drift', 'icicle', 'bones', 'rubble']
    : l.theme === 'icemine' ? ['icicle', 'icicle', 'rubble', 'bones']
    : l.theme === 'foundry' ? ['anvil', 'bell', 'rubble', 'bones']
    : l.theme === 'furnace' ? ['anvil', 'rubble', 'icicle', 'bones']
    : l.theme === 'heart' ? ['icicle', 'rubble', 'bell', 'bones']
    : ['bones', 'torch'];
  for (const p of rng.shuffle(floors.slice()).slice(0, Math.floor(floors.length / 45))) {
    if (nearExit(p, 3)) continue;
    l.props.push({ x: p.x, y: p.y, kind: rng.pick(decorKinds) });
  }
  if (l.theme === 'desert' || l.theme === 'glass') addQuicksand(l, rng, floors, nearExit);
  if (COLD_THEMES.has(l.theme)) addBraziers(l, rng, floors, dist, nearExit);
  const objCount = Math.floor(floors.length / 140);
  let shrines = 0;
  for (const p of rng.shuffle(floors.filter((f) => wallNeighbors(l, f.x, f.y) >= 2 && dist[idx(l, f.x, f.y)] > 6)).slice(0, objCount)) {
    if (nearExit(p, 4) || (l.waypoint && Math.abs(l.waypoint.x - p.x) + Math.abs(l.waypoint.y - p.y) < 3)) continue;
    if (l.objects.some((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < 3)) continue;
    const kind: ObjectKind = shrines < 2 && rng.chance(0.15) ? 'shrine' : rng.chance(0.35) ? 'chest' : 'barrel';
    if (kind === 'shrine') shrines++;
    l.objects.push({ ...p, kind });
  }
}

/**
 * Stands unlit braziers through a cold level: one a few steps from the way in, then a fire in sight of a fire.
 * The pass keeps a fixed number of them, since lighting them all is a quest.
 */
function addBraziers(l: Level, rng: Rng, floors: Point[], dist: Int32Array, nearExit: (p: Point, r: number) => boolean) {
  const taken = new Set(l.props.map((p) => idx(l, p.x, p.y)));
  const open = floors.filter((p) => wallNeighbors(l, p.x, p.y) === 0 && !taken.has(idx(l, p.x, p.y)) && !nearExit(p, 3) && dist[idx(l, p.x, p.y)] >= 0
    && !(l.waypoint && Math.abs(l.waypoint.x - p.x) + Math.abs(l.waypoint.y - p.y) < 2));
  const placed: Point[] = l.objects.filter((o) => o.kind === 'brazier');
  const far = (p: Point, gap: number) => placed.every((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) >= gap);
  const first = open.filter((p) => dist[idx(l, p.x, p.y)] >= 4 && dist[idx(l, p.x, p.y)] <= 8);
  const max = l.theme === 'snow' ? 12 : 99;
  let n = 0;
  const put = (p: Point) => {
    placed.push(p);
    l.objects.push({ ...p, kind: 'brazier' });
    n++;
  };
  if (first.length) put(rng.pick(first));
  for (const p of rng.shuffle(open.slice())) {
    if (n >= max) break;
    if (far(p, l.theme === 'snow' ? 17 : 13) && !l.objects.some((o) => o.kind !== 'brazier' && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < 2)) put(p);
  }
}

/** Scatters patches of quicksand, kept clear of exits and the waypoint so arrivals are never bogged down. */
function addQuicksand(l: Level, rng: Rng, floors: Point[], nearExit: (p: Point, r: number) => boolean) {
  const taken = new Set(l.props.map((p) => idx(l, p.x, p.y)));
  for (const c of rng.shuffle(floors.slice()).slice(0, Math.floor(floors.length / 220))) {
    if (nearExit(c, 6) || (l.waypoint && Math.abs(l.waypoint.x - c.x) + Math.abs(l.waypoint.y - c.y) < 5)) continue;
    const r = rng.range(1.2, 2.3);
    for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++)
      for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++) {
        const i = idx(l, x, y);
        if ((x - c.x) ** 2 + (y - c.y) ** 2 > r * r || l.tiles[i] !== FLOOR || taken.has(i)) continue;
        taken.add(i);
        l.slow.add(i);
        l.props.push({ x, y, kind: 'quicksand' });
      }
  }
}

function genTown(spec: LevelSpec): Level {
  const l = newLevel(spec.w, spec.h, spec.theme, WALL);
  setRect(l, { x: 3, y: 3, w: l.w - 6, h: l.h - 6 }, FLOOR);
  const cx = Math.floor(l.w / 2);
  const cy = Math.floor(l.h / 2);
  // Gate on the east wall leads out to the wilds.
  setRect(l, { x: l.w - 3, y: cy - 1, w: 3, h: 3 }, FLOOR);
  const block = (x: number, y: number, kind: PropKind) => {
    l.tiles[idx(l, x, y)] = WALL;
    l.props.push({ x, y, kind });
  };
  const snow = spec.theme === 'snowtown';
  block(cx, cy, spec.theme === 'oasis' ? 'well' : snow ? 'hearth' : 'campfire');
  // Under the snow only one tent still stands; the rest are burnt frames.
  block(cx - 7, cy - 6, 'tent');
  block(cx + 6, cy - 7, snow ? 'ruin' : 'tent');
  block(cx - 8, cy + 5, snow ? 'ruin' : 'tent');
  block(cx + 5, cy + 7, snow ? 'ruin' : 'tent');
  if (snow) {
    for (const [x, y] of [[cx - 11, cy - 1], [cx + 9, cy - 3], [cx - 4, cy + 8], [cx + 11, cy + 6], [cx - 12, cy + 9], [cx + 1, cy - 9], [cx - 3, cy - 7], [cx + 12, cy - 9]]) l.props.push({ x, y, kind: 'drift' });
    for (const [x, y] of [[cx - 10, cy + 2], [cx + 8, cy + 3], [cx + 3, cy + 10]]) l.props.push({ x, y, kind: 'rubble' });
  }
  for (let i = 0; i < 6; i++) if (!snow || i % 2 === 0) l.props.push({ x: 4 + i * 6, y: 4, kind: 'banner' });
  l.props.push({ x: l.w - 4, y: cy - 2, kind: 'brazier' }, { x: l.w - 4, y: cy + 2, kind: 'brazier' });
  l.spots = {
    healer: { x: cx - 6, y: cy - 4 },
    smith: { x: cx + 6, y: cy - 5 },
    sage: { x: cx - 3, y: cy + 3 },
    fence: { x: cx + 5, y: cy + 5 },
    stash: { x: cx + 2, y: cy - 2 },
    caravan: { x: cx + 10, y: cy + 2 },
  };
  l.waypoint = { x: cx - 2, y: cy - 2 };
  l.start = { x: cx + 2, y: cy + 3 };
  const gate = { x: l.w - 2, y: cy };
  spec.links.forEach((link) => l.exits.push({ ...gate, ...link }));
  return l;
}

export function generateLevel(spec: LevelSpec, rng: Rng): Level {
  if (spec.gen === 'town') return genTown(spec);
  return spec.gen === 'open' ? genOpen(spec, rng) : genRooms(spec, rng);
}

/** A walkable tile near `p`, searching outward in rings. */
export function nearestFloor(l: Level, p: Point, avoid?: (x: number, y: number) => boolean): Point {
  for (let r = 0; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = Math.floor(p.x) + dx;
        const y = Math.floor(p.y) + dy;
        if (isWalkable(l, x, y) && !(avoid && avoid(x, y))) return { x, y };
      }
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}
