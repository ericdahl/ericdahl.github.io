/**
 * The world's geography: three home realms around a shared frontier.
 * Pure functions of (x, z), no DOM. x runs east, z runs south (three.js convention).
 */
import { fbm, smoothstep, lerp, clamp } from './noise';

export type RealmId = 0 | 1 | 2;
export const REALMS: RealmId[] = [0, 1, 2];

export interface RealmDef {
  id: RealmId;
  name: string;
  adjective: string;
  angle: number; // radians, direction of the home realm from the centre
  color: string;
  dark: string;
  town: string;
  gate: string;
  zones: [string, string, string];
  blurb: string;
}

const deg = (d: number) => (d * Math.PI) / 180;

export const REALM_DEFS: RealmDef[] = [
  {
    id: 0, name: 'Valmora', adjective: 'Valmoran', angle: deg(150), color: '#4a7fe0', dark: '#1d3a78',
    town: 'Caer Lumen', gate: 'Lumen Gate', zones: ['Lumen Fields', 'Greywater Downs', 'Barrow Moor'],
    blurb: 'Knights and chapter-houses of the old river kingdom. Rolling meadows, stone towers and a stubborn sense of honour.',
  },
  {
    id: 1, name: 'Eldwyn', adjective: 'Eldwynn', angle: deg(30), color: '#46b558', dark: '#1c5a26',
    town: 'Tir Aenwy', gate: 'Aenwy Gate', zones: ['Aenwy Glade', 'Mosswood', 'Thornwild'],
    blurb: 'Clans of the deep green wood, half in this world and half in the mists. Old trees, older bargains.',
  },
  {
    id: 2, name: 'Hroth', adjective: 'Hrothi', angle: deg(270), color: '#d9443a', dark: '#6e1a14',
    town: 'Skelvik', gate: 'Skelvik Gate', zones: ['Skelvik Shore', 'Rimeholt', 'Jotun Wastes'],
    blurb: 'Fjord-holds of the frozen north, where the sagas are sung loud and the winters bite back.',
  },
];

export const WORLD_R = 1200;
export const FRONTIER_R = 500;
export const TOWN_R = 930;
export const GATE_R = 575;
export const WATER_Y = 0;

export interface Site {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: 'town' | 'gate' | 'keep';
  realm: RealmId | -1; // starting owner
  facing: number; // radians: direction the front (gate) faces
  flat: number; // flattened radius
}

function polar(angle: number, r: number) {
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

const KEEP_NAMES: [string, string][] = [
  ['Dun Harrow', 'Brightwatch'],
  ['Caer Moss', 'Thornhold'],
  ['Jarnfell', 'Wolfmark'],
];

export const KEEP_HALF = 22; // keeps are 44 m squares

export const SITES: Site[] = (() => {
  const out: Site[] = [];
  for (const r of REALM_DEFS) {
    const t = polar(r.angle, TOWN_R);
    out.push({ id: `town${r.id}`, name: r.town, ...t, kind: 'town', realm: r.id, facing: r.angle + Math.PI, flat: 70 });
    const g = polar(r.angle, GATE_R);
    out.push({ id: `gate${r.id}`, name: r.gate, ...g, kind: 'gate', realm: r.id, facing: r.angle + Math.PI, flat: 34 });
    KEEP_NAMES[r.id].forEach((name, i) => {
      const a = r.angle + deg(i === 0 ? -27 : 27);
      const p = polar(a, 330);
      out.push({ id: `keep${r.id}${i}`, name, ...p, kind: 'keep', realm: r.id, facing: Math.atan2(-p.z, -p.x), flat: 48 });
    });
  }
  out.push({ id: 'keepC', name: 'Highcrown', x: 0, z: 0, kind: 'keep', realm: -1, facing: deg(90), flat: 50 });
  return out;
})();

export const KEEPS = SITES.filter((s) => s.kind === 'keep');
export const siteById = (id: string) => SITES.find((s) => s.id === id)!;

/** Roads, as polylines, for drawing and for a little flattening. */
export const ROADS: { x: number; z: number }[][] = (() => {
  const roads: { x: number; z: number }[][] = [];
  for (const r of REALM_DEFS) {
    const t = siteById(`town${r.id}`), g = siteById(`gate${r.id}`);
    const mid = polar(r.angle + 0.06, (TOWN_R + GATE_R) / 2);
    roads.push([t, mid, g]);
    for (const i of [0, 1]) {
      const k = siteById(`keep${r.id}${i}`);
      roads.push([g, k]);
      roads.push([k, { x: 0, z: 0 }]);
    }
  }
  return roads;
})();

function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Which home sector an angle falls in. */
export function sectorOf(x: number, z: number): RealmId {
  const a = Math.atan2(z, x);
  let best: RealmId = 0, bd = 99;
  for (const r of REALM_DEFS) {
    const d = Math.abs(angDiff(a, r.angle));
    if (d < bd) { bd = d; best = r.id; }
  }
  return best;
}

const BOUNDARIES = [deg(90), deg(210), deg(330)];

function segDist(px: number, pz: number, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

export function roadDist(x: number, z: number): number {
  let d = 1e9;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i], b = road[i + 1];
      // quick reject
      if (x < Math.min(a.x, b.x) - 30 || x > Math.max(a.x, b.x) + 30 || z < Math.min(a.z, b.z) - 30 || z > Math.max(a.z, b.z) + 30) continue;
      d = Math.min(d, segDist(x, z, a, b));
    }
  }
  return d;
}

export class Geo {
  readonly seed: number;
  private siteH = new Map<string, number>();
  constructor(seed: number) {
    this.seed = seed;
    for (const s of SITES) this.siteH.set(s.id, Math.max(3.5, this.raw(s.x, s.z)));
  }

  /** Mountain ridge strength between home realms and at the world edge, 0..1. */
  ridge(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    let d = 1e9;
    for (const b of BOUNDARIES) d = Math.min(d, Math.abs(angDiff(a, b)) * r);
    const wob = (fbm(x / 90, z / 90, this.seed + 55) - 0.5) * 50;
    const between = smoothstep(80, 18, d + wob) * smoothstep(FRONTIER_R - 40, FRONTIER_R + 60, r);
    const edge = smoothstep(WORLD_R - 120, WORLD_R - 10, r + wob * 0.6);
    return Math.max(between, edge);
  }

  raw(x: number, z: number): number {
    const s = this.seed;
    const r = Math.hypot(x, z);
    const n = fbm(x / 320 + 13.1, z / 320 - 7.7, s);
    const detail = fbm(x / 55, z / 55, s + 7) - 0.5;
    const sector = sectorOf(x, z);
    const home = smoothstep(FRONTIER_R - 30, FRONTIER_R + 50, r);
    let hillAmp = 38;
    if (sector === 2) hillAmp = lerp(38, 54, home);
    if (sector === 1) hillAmp = lerp(38, 30, home);
    let h = 5 + (n - 0.47) * hillAmp + detail * 6;
    const rg = this.ridge(x, z);
    const peaks = fbm(x / 40, z / 40, s + 33);
    h = lerp(h, 70 + peaks * 70, rg);
    return h;
  }

  height(x: number, z: number): number {
    let h = this.raw(x, z);
    for (const s of SITES) {
      const dx = x - s.x, dz = z - s.z;
      if (Math.abs(dx) > s.flat + 40 || Math.abs(dz) > s.flat + 40) continue;
      const d = Math.hypot(dx, dz);
      const t = 1 - smoothstep(s.flat * 0.75, s.flat + 30, d);
      if (t > 0) h = lerp(h, this.siteH.get(s.id)!, t);
    }
    // Roads sit a little above water and smooth the ground they cross.
    const rd = roadDist(x, z);
    if (rd < 14) {
      const t = 1 - smoothstep(3, 14, rd);
      h = lerp(h, Math.max(h, 1.2), t);
    }
    return h;
  }

  /** Height you stand at: the ground, or the water's surface when wading. */
  standY(x: number, z: number): number {
    return Math.max(this.height(x, z), WATER_Y - 0.9);
  }

  zoneAt(x: number, z: number): Zone {
    const r = Math.hypot(x, z);
    if (r < FRONTIER_R) return { kind: 'frontier', realm: -1, name: 'The Frontier', level: 18 };
    const realm = sectorOf(x, z);
    const def = REALM_DEFS[realm];
    const t = siteById(`town${realm}`);
    const d = Math.hypot(x - t.x, z - t.z);
    if (r < GATE_R + 40 && Math.abs(r - GATE_R) < 60 && d > 300) {
      return { kind: 'home', realm, name: `${def.gate} Approach`, level: 18 };
    }
    const level = homeLevel(d);
    const name = level <= 6 ? def.zones[0] : level <= 13 ? def.zones[1] : def.zones[2];
    return { kind: 'home', realm, name: d < 70 ? def.town : name, level };
  }
}

export interface Zone {
  kind: 'frontier' | 'home';
  realm: RealmId | -1;
  name: string;
  level: number;
}

/** Monster level by distance from a realm's town. */
export function homeLevel(distFromTown: number): number {
  return clamp(Math.round(1 + (distFromTown - 60) / 27), 1, 19);
}
