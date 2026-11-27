/** Procedural low-poly models for every creature and person, with simple keyframe-free animation. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, C, shade } from './palette';
import type { Entity } from '../game/types';
import { REALM_DEFS } from '../game/geo';
import { CLASSES } from '../game/data';

const gcache = new Map<string, THREE.BufferGeometry>();
function box(w: number, h: number, d: number, oy = 0, ox = 0, oz = 0) {
  const k = `b${w},${h},${d},${oy},${ox},${oz}`;
  let g = gcache.get(k);
  if (!g) gcache.set(k, (g = new THREE.BoxGeometry(w, h, d).translate(ox, oy, oz)));
  return g;
}
function cyl(rt: number, rb: number, h: number, seg = 6, oy = 0) {
  const k = `c${rt},${rb},${h},${seg},${oy}`;
  let g = gcache.get(k);
  if (!g) gcache.set(k, (g = new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, oy, 0)));
  return g;
}
function ico(r: number, detail = 0) {
  const k = `i${r},${detail}`;
  let g = gcache.get(k);
  if (!g) gcache.set(k, (g = new THREE.IcosahedronGeometry(r, detail)));
  return g;
}
function cone(r: number, h: number, seg = 6, oy = 0) {
  const k = `k${r},${h},${seg},${oy}`;
  let g = gcache.get(k);
  if (!g) gcache.set(k, (g = new THREE.ConeGeometry(r, h, seg).translate(0, oy, 0)));
  return g;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

export interface Rig {
  root: THREE.Group; // positioned and rotated in the world
  body: THREE.Group; // tilts for death
  legs: THREE.Object3D[];
  arms: THREE.Object3D[]; // [right, left]
  glow?: THREE.Mesh;
  height: number;
  kind: 'humanoid' | 'quadruped' | 'spider' | 'sprite' | 'treant' | 'none';
  phase: number;
  swingT: number; // time since swing started (s), large = idle
  castT: number;
  casting: string | null;
  dieT: number;
  bow?: boolean;
  orbit?: THREE.Object3D;
  cape?: THREE.Object3D;
}

function hashId(id: number, salt: number) {
  let h = Math.imul(id ^ 0x9e3779b9, 2654435761) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

interface Look {
  body: string;
  trim: string;
  cape?: string;
  weapon: 'sword' | 'bow' | 'staff' | 'mace' | 'none';
  shield: boolean;
  helm: 'none' | 'helm' | 'hood' | 'hat' | 'crown';
  skin: string;
  hair: string;
  bones?: boolean;
  bare?: boolean;
}

function lookOf(e: Entity): Look {
  const skin = C.skin[Math.floor(hashId(e.id, 1) * C.skin.length)];
  const hair = C.hair[Math.floor(hashId(e.id, 2) * C.hair.length)];
  if (e.mob) {
    const l = e.mob.look!;
    return {
      body: l.body, trim: l.trim, weapon: (l.weapon as Look['weapon']) ?? 'none', shield: false, helm: l.helm ? 'helm' : 'none',
      skin: l.bones ? '#d9d2bc' : e.mob.id === 'troll' ? e.mob.color : skin, hair, bones: l.bones, bare: e.mob.id === 'troll',
    };
  }
  const realm = e.realm === -1 ? null : REALM_DEFS[e.realm];
  const trim = e.look?.trim ?? realm?.color ?? '#9fb2c8';
  const cls = e.cls ?? 'warden';
  const armor = CLASSES[cls].armor;
  let body = armor === 'plate' ? '#9aa0a8' : armor === 'chain' ? '#80868d' : armor === 'leather' ? C.leather : realm ? shade(realm.dark, 1.2) : '#3d4a5a';
  if (e.look?.body) body = e.look.body;
  let helm: Look['helm'] = cls === 'runecaller' ? 'hat' : cls === 'ranger' ? 'hood' : e.kind === 'guard' || e.kind === 'soldier' ? (cls === 'warden' ? 'helm' : 'none') : 'none';
  if (e.kind === 'lord') helm = 'crown';
  if (e.kind === 'npc') helm = 'none';
  if (e.look?.helm) helm = 'helm';
  const weapon: Look['weapon'] = e.kind === 'npc' ? 'none' : CLASSES[cls].weapon as Look['weapon'];
  return { body, trim, cape: realm && (cls === 'warden' || cls === 'cleric' || e.kind === 'lord') ? realm.color : undefined, weapon, shield: CLASSES[cls].block > 0 && e.kind !== 'npc', helm, skin, hair };
}

function humanoid(e: Entity): Rig {
  const L = lookOf(e);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bodyM = mat(L.body), trimM = mat(L.trim), skinM = mat(L.skin), hairM = mat(L.hair), dark = mat(shade(L.body, 0.6));
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.95, side * 0.13);
    hip.add(mesh(box(0.22, 0.95, 0.22, -0.47), L.bare ? skinM : L.bones ? skinM : dark));
    hip.add(mesh(box(0.3, 0.14, 0.24, -0.9, 0.05), mat('#3a2a1e')));
    body.add(hip);
    legs.push(hip);
  }
  const torso = mesh(box(0.34, 0.66, 0.54, 1.3), L.bare ? skinM : bodyM);
  body.add(torso);
  if (!L.bare && !L.bones) {
    body.add(mesh(box(0.05, 0.62, 0.36, 1.18, 0.18), trimM)); // tabard
    body.add(mesh(box(0.36, 0.1, 0.56, 0.98), mat('#3b2b1d'))); // belt
  }
  if (L.bones) for (let i = 0; i < 3; i++) body.add(mesh(box(0.36, 0.05, 0.5, 1.15 + i * 0.13), mat('#d9d2bc')));
  // head
  const head = new THREE.Group();
  head.position.set(0, 1.63, 0);
  head.add(mesh(box(0.3, 0.32, 0.28, 0.17), skinM));
  if (!L.bones) {
    head.add(mesh(box(0.03, 0.05, 0.05, 0.2, 0.15, -0.07), mat('#1c140e')));
    head.add(mesh(box(0.03, 0.05, 0.05, 0.2, 0.15, 0.07), mat('#1c140e')));
    head.add(mesh(box(0.05, 0.08, 0.05, 0.13, 0.16), mat(shade(L.skin, 0.8))));
  }
  else {
    head.add(mesh(box(0.04, 0.06, 0.06, 0.22, 0.15, -0.07), mat('#1a1a1a')));
    head.add(mesh(box(0.04, 0.06, 0.06, 0.22, 0.15, 0.07), mat('#1a1a1a')));
  }
  if (L.helm === 'helm') {
    head.add(mesh(box(0.36, 0.26, 0.34, 0.28), mat(C.metal)));
    head.add(mesh(box(0.05, 0.05, 0.3, 0.2, 0.17), mat('#222')));
  } else if (L.helm === 'hood') {
    head.add(mesh(box(0.36, 0.38, 0.34, 0.22, -0.03), mat(shade(L.trim, 0.55))));
  } else if (L.helm === 'hat') {
    head.add(mesh(cyl(0.32, 0.32, 0.04, 8, 0.36), mat(shade(L.trim, 0.5))));
    const tip = mesh(cone(0.18, 0.55, 8, 0.65), mat(shade(L.trim, 0.5)));
    tip.rotation.z = 0.15;
    head.add(tip);
  } else if (L.helm === 'crown') {
    head.add(mesh(box(0.36, 0.26, 0.34, 0.28), mat(C.metal)));
    head.add(mesh(cyl(0.21, 0.21, 0.1, 8, 0.45), mat('#d4af37')));
  } else if (!L.bones && !L.bare) {
    head.add(mesh(box(0.33, 0.12, 0.31, 0.35, -0.02), hairM));
    head.add(mesh(box(0.08, 0.26, 0.31, 0.22, -0.14), hairM));
  }
  body.add(head);
  // arms
  const arms: THREE.Object3D[] = [];
  for (const side of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(0, 1.58, side * 0.36);
    sh.add(mesh(box(0.17, 0.66, 0.17, -0.31), L.bare || L.bones ? skinM : bodyM));
    sh.add(mesh(box(0.15, 0.13, 0.15, -0.68), L.bare ? skinM : mat(shade(L.body, 0.7))));
    if (!L.bare) sh.add(mesh(box(0.24, 0.16, 0.24, -0.02), side === 1 ? trimM : bodyM));
    body.add(sh);
    arms.push(sh);
  }
  const [right, left] = arms;
  const hand = new THREE.Group();
  hand.position.set(0, -0.7, 0);
  right.add(hand);
  if (L.weapon === 'sword') {
    const w = new THREE.Group();
    w.add(mesh(box(0.05, 0.92, 0.1, 0.62), mat('#d5dae0')));
    w.add(mesh(box(0.08, 0.06, 0.34, 0.15), mat('#8a6a2a')));
    w.add(mesh(box(0.06, 0.2, 0.06, 0.02), mat('#3a2a1e')));
    w.rotation.z = -1.2;
    hand.add(w);
  } else if (L.weapon === 'mace') {
    const w = new THREE.Group();
    w.add(mesh(box(0.06, 0.7, 0.06, 0.32), mat('#4a3626')));
    w.add(mesh(ico(0.13), mat(C.darkMetal), 0, 0.72, 0));
    w.rotation.z = -1.2;
    hand.add(w);
  } else if (L.weapon === 'staff') {
    const w = new THREE.Group();
    w.add(mesh(cyl(0.035, 0.045, 1.8, 5, 0.2), mat('#5a3d22')));
    const gem = mesh(ico(0.1), mat(L.trim, { emissive: shade(L.trim, 0.8) }), 0, 1.15, 0);
    w.add(gem);
    hand.add(w);
  } else if (L.weapon === 'bow') {
    const w = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 4, 10, Math.PI * 0.9), mat('#6b4a2f'));
    arc.rotation.z = Math.PI / 2 + Math.PI * 0.05;
    arc.castShadow = true;
    w.add(arc);
    w.rotation.y = Math.PI / 2;
    w.position.set(0.1, 0, 0);
    const lh = new THREE.Group();
    lh.position.set(0, -0.7, 0);
    lh.add(w);
    left.add(lh);
  }
  if (L.shield) {
    const s = new THREE.Group();
    s.add(mesh(box(0.08, 0.62, 0.5), mat(L.trim)));
    s.add(mesh(box(0.1, 0.2, 0.2), mat('#d4af37')));
    s.position.set(0.12, -0.42, -0.06);
    left.add(s);
  }
  let cape: THREE.Object3D | undefined;
  if (L.cape) {
    const cp = new THREE.Group();
    cp.position.set(-0.18, 1.58, 0);
    cp.add(mesh(box(0.04, 1.15, 0.6, -0.56), mat(shade(L.cape, 0.8))));
    body.add(cp);
    cape = cp;
  }
  const s = e.scale;
  root.scale.setScalar(s);
  return { root, body, legs, arms, height: 2.05 * s, kind: 'humanoid', phase: hashId(e.id, 3) * 6, swingT: 9, castT: 0, casting: null, dieT: -1, bow: L.weapon === 'bow', cape };
}

function quadruped(e: Entity): Rig {
  const d = e.mob!;
  const v = d.variant ?? 'wolf';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m1 = mat(d.color), m2 = mat(d.color2), dark = mat(shade(d.color, 0.6));
  const bear = v === 'bear', boar = v === 'boar', rat = v === 'rat';
  const len = bear ? 1.5 : boar ? 1.2 : rat ? 0.9 : 1.3;
  const hgt = bear ? 0.75 : boar ? 0.6 : rat ? 0.35 : 0.5;
  const legH = bear ? 0.6 : boar ? 0.42 : rat ? 0.22 : 0.62;
  const by = legH + hgt / 2;
  body.add(mesh(box(len, hgt, hgt * (bear ? 1.15 : 0.95), by), m1));
  if (!rat) body.add(mesh(box(len * 0.5, hgt * 0.4, hgt * 0.85, by - hgt * 0.35, len * 0.1), m2));
  const head = new THREE.Group();
  head.position.set(len / 2 + 0.1, by + hgt * 0.25, 0);
  head.add(mesh(box(0.42, hgt * 0.8, hgt * 0.75), m1));
  head.add(mesh(box(0.3, hgt * 0.4, hgt * 0.4, -hgt * 0.15, 0.3), boar ? m2 : dark));
  if (!boar && !bear) for (const sz of [-1, 1]) head.add(mesh(cone(0.07, 0.2, 4, hgt * 0.5), m1, -0.05, 0, sz * hgt * 0.22));
  if (bear) for (const sz of [-1, 1]) head.add(mesh(ico(0.09), m1, -0.05, hgt * 0.42, sz * hgt * 0.3));
  if (boar) for (const sz of [-1, 1]) head.add(mesh(cone(0.04, 0.22, 4), mat('#f0ead6'), 0.35, -0.02, sz * 0.12));
  for (const sz of [-1, 1]) head.add(mesh(box(0.05, 0.05, 0.05, hgt * 0.15, 0.2, sz * hgt * 0.22), mat('#ffcc33', { emissive: '#663300' })));
  body.add(head);
  const legs: THREE.Object3D[] = [];
  for (const sx of [1, -1]) for (const sz of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set((sx * len) / 2.6, legH, (sz * hgt) / 3);
    hip.add(mesh(box(0.13 * (bear ? 1.6 : 1), legH, 0.13 * (bear ? 1.6 : 1), -legH / 2), sx > 0 ? m1 : dark));
    body.add(hip);
    legs.push(hip);
  }
  if (!bear && !boar) {
    const tail = mesh(box(rat ? 0.7 : 0.5, 0.1, 0.1, 0, -0.25), rat ? mat('#c9a0a0') : m1);
    tail.position.set(-len / 2, by + 0.1, 0);
    tail.rotation.z = rat ? 0.1 : -0.5;
    body.add(tail);
  }
  root.scale.setScalar(e.scale);
  return { root, body, legs, arms: [head], height: (by + hgt) * e.scale + 0.3, kind: 'quadruped', phase: hashId(e.id, 3) * 6, swingT: 9, castT: 0, casting: null, dieT: -1 };
}

function spider(e: Entity): Rig {
  const d = e.mob!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m1 = mat(d.color), m2 = mat(d.color2);
  body.add(mesh(ico(0.55, 1), m1, -0.5, 0.75, 0));
  body.add(mesh(ico(0.18), m2, -0.5, 1.15, 0));
  body.add(mesh(ico(0.32), m1, 0.15, 0.6, 0));
  for (const sz of [-1, 1]) body.add(mesh(ico(0.06), mat('#ff3333', { emissive: '#aa0000' }), 0.42, 0.68, sz * 0.1));
  const legs: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.2 - i * 0.18, 0.62, sz * 0.2);
    const upper = mesh(box(0.06, 0.06, 0.7, 0, 0, sz * 0.35), m1);
    upper.rotation.x = sz * -0.55;
    hip.add(upper);
    const lower = mesh(box(0.05, 0.7, 0.05, -0.35), m1, 0, 0.32, sz * 0.62);
    hip.add(lower);
    hip.rotation.y = (i - 1.5) * 0.35 * sz;
    body.add(hip);
    legs.push(hip);
  }
  root.scale.setScalar(e.scale);
  return { root, body, legs, arms: [], height: 1.4 * e.scale, kind: 'spider', phase: hashId(e.id, 3) * 6, swingT: 9, castT: 0, casting: null, dieT: -1 };
}

function sprite(e: Entity): Rig {
  const d = e.mob!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const core = new THREE.Mesh(ico(0.35, 1), new THREE.MeshBasicMaterial({ color: d.color }));
  body.add(core);
  const halo = new THREE.Mesh(ico(0.6, 1), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.25, depthWrite: false }));
  body.add(halo);
  const orbit = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(ico(0.08), new THREE.MeshBasicMaterial({ color: d.color2 }));
    const a = (i / 3) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.75, Math.sin(a * 2) * 0.2, Math.sin(a) * 0.75);
    orbit.add(m);
  }
  body.add(orbit);
  root.scale.setScalar(e.scale);
  return { root, body, legs: [], arms: [], height: 1.0 * e.scale, kind: 'sprite', phase: hashId(e.id, 3) * 6, swingT: 9, castT: 0, casting: null, dieT: -1, orbit };
}

function treant(e: Entity): Rig {
  const d = e.mob!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bark = mat(d.color), leaf = mat(d.color2), leaf2 = mat(shade(d.color2, 1.25));
  const legs: THREE.Object3D[] = [];
  for (const sz of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.9, sz * 0.25);
    hip.add(mesh(cyl(0.14, 0.22, 0.95, 5, -0.45), bark));
    body.add(hip);
    legs.push(hip);
  }
  body.add(mesh(cyl(0.32, 0.4, 1.4, 6, 1.55), bark));
  body.add(mesh(ico(0.75), leaf, 0, 2.55, 0));
  body.add(mesh(ico(0.5), leaf2, 0.2, 2.9, 0.35));
  body.add(mesh(ico(0.45), leaf, -0.2, 2.75, -0.4));
  for (const sz of [-1, 1]) body.add(mesh(box(0.06, 0.06, 0.06, 2.0, 0.33, sz * 0.12), mat('#e6ff66', { emissive: '#668800' })));
  const arms: THREE.Object3D[] = [];
  for (const sz of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(0, 2.0, sz * 0.42);
    sh.add(mesh(cyl(0.07, 0.12, 1.0, 5, -0.5), bark));
    sh.add(mesh(ico(0.22), leaf, 0, -1.0, 0));
    body.add(sh);
    arms.push(sh);
  }
  root.scale.setScalar(e.scale);
  return { root, body, legs, arms, height: 3.3 * e.scale, kind: 'treant', phase: hashId(e.id, 3) * 6, swingT: 9, castT: 0, casting: null, dieT: -1 };
}

export function buildRig(e: Entity): Rig {
  const r = buildRigRaw(e);
  bake(r.root);
  return r;
}

function buildRigRaw(e: Entity): Rig {
  if (e.kind === 'door') {
    const root = new THREE.Group();
    return { root, body: new THREE.Group(), legs: [], arms: [], height: 7.5, kind: 'none', phase: 0, swingT: 9, castT: 0, casting: null, dieT: -1 };
  }
  if (e.mob) {
    switch (e.mob.shape) {
      case 'quadruped': return quadruped(e);
      case 'spider': return spider(e);
      case 'sprite': return sprite(e);
      case 'treant': return treant(e);
    }
  }
  return humanoid(e);
}

const SCHOOL_COLOR: Record<string, string> = { fire: '#ff8a2a', cold: '#8fd6ff', energy: '#c99bff', holy: '#ffe58a', ranged: '#e8d9b0', melee: '#ffffff', arrow: '#e8d9b0' };
export function schoolColor(s: string) {
  return SCHOOL_COLOR[s] ?? '#ffffff';
}

/** Advances a rig's animation. `moved` is metres moved this frame. */
export function animate(r: Rig, e: Entity, dt: number, moved: number, now: number) {
  if (r.kind === 'none') return;
  if (e.dead) {
    if (r.dieT < 0) r.dieT = 0;
    r.dieT += dt;
    const t = Math.min(1, r.dieT / 0.6);
    if (r.kind === 'sprite') {
      r.body.scale.setScalar(Math.max(0.01, 1 - t));
      return;
    }
    r.body.rotation.x = (-Math.PI / 2) * t * (r.kind === 'humanoid' || r.kind === 'treant' ? 1 : 0.95);
    r.body.position.y = -0.1 * t;
    if (r.glow) r.glow.visible = false;
    return;
  }
  if (r.dieT >= 0) {
    r.dieT = -1;
    r.body.rotation.x = 0;
    r.body.position.y = 0;
    r.body.scale.setScalar(1);
  }
  r.phase += moved * (r.kind === 'quadruped' ? 2.6 : r.kind === 'spider' ? 4 : 2.1) / Math.max(0.5, e.scale);
  const walking = moved > 0.001;
  const sw = walking ? Math.sin(r.phase) : 0;
  r.swingT += dt;
  if (r.kind === 'sprite') {
    r.body.position.y = Math.sin(now * 2 + r.phase) * 0.15;
    if (r.orbit) r.orbit.rotation.y += dt * 2.4;
    return;
  }
  if (r.kind === 'quadruped') {
    r.legs.forEach((l, i) => (l.rotation.z = sw * 0.6 * (i % 2 === 0 ? 1 : -1) * (i < 2 ? 1 : -1)));
    const head = r.arms[0];
    if (head) {
      const bite = r.swingT < 0.35 ? Math.sin((r.swingT / 0.35) * Math.PI) : 0;
      head.rotation.z = -bite * 0.5;
      head.position.x = (head.userData.x0 ??= head.position.x) + bite * 0.15;
    }
    r.body.position.y = walking ? Math.abs(Math.sin(r.phase)) * 0.05 : 0;
    return;
  }
  if (r.kind === 'spider') {
    r.legs.forEach((l, i) => (l.rotation.z = Math.sin(r.phase + i * 1.3) * (walking ? 0.35 : 0.05)));
    r.body.position.y = r.swingT < 0.3 ? Math.sin((r.swingT / 0.3) * Math.PI) * 0.15 : 0;
    return;
  }
  // humanoid and treant
  r.legs[0].rotation.z = sw * 0.65;
  r.legs[1].rotation.z = -sw * 0.65;
  r.body.position.y = walking ? Math.abs(Math.cos(r.phase)) * 0.06 : 0;
  const [right, left] = r.arms;
  let ra = -sw * 0.55, la = sw * 0.55;
  let rx = 0, lx = 0;
  if (r.casting) {
    r.castT += dt;
    if (r.bow) {
      la = 1.5;
      ra = 1.45;
      rx = -0.3;
      lx = 0.1;
    } else {
      const wob = Math.sin(r.castT * 9) * 0.12;
      ra = 1.1 + wob;
      la = 1.1 - wob;
      rx = 0.35;
      lx = -0.35;
    }
  } else if (r.swingT < 0.45) {
    const t = r.swingT / 0.45;
    if (r.bow) {
      la = 1.5;
      ra = 1.4 * (1 - t);
    } else {
      // wind up, then strike down
      ra = t < 0.35 ? 0.6 + (t / 0.35) * 2.1 : 2.7 - ((t - 0.35) / 0.65) * 2.4;
      rx = t < 0.35 ? 0 : -0.3;
    }
  }
  if (right) { right.rotation.z = ra; right.rotation.x = rx; }
  if (left) { left.rotation.z = la; left.rotation.x = lx; }
  if (r.cape) r.cape.rotation.z = -0.1 - (walking ? 0.25 + Math.sin(r.phase * 2) * 0.05 : 0);
  if (r.glow) {
    r.glow.visible = !!r.casting && !r.bow;
    if (r.glow.visible) r.glow.scale.setScalar(0.8 + Math.sin(now * 12) * 0.2);
  }
}

export function attachGlow(r: Rig, color: string) {
  if (r.kind !== 'humanoid') return;
  if (!r.glow) {
    r.glow = new THREE.Mesh(ico(0.14, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    r.glow.position.set(0.55, 1.55, 0);
    r.body.add(r.glow);
  }
  (r.glow.material as THREE.MeshBasicMaterial).color.set(color);
}

const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/**
 * Merges the plain-coloured meshes under each group into one vertex-coloured mesh,
 * so a person costs a handful of draw calls instead of thirty.
 */
export function bake(root: THREE.Object3D) {
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => { if (!(o as THREE.Mesh).isMesh) groups.push(o); });
  for (const g of groups) {
    const meshes = g.children.filter((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return false;
      const mm = m.material as THREE.MeshLambertMaterial;
      return mm.type === 'MeshLambertMaterial' && !(mm.emissive && mm.emissive.getHex() !== 0) && m.children.length === 0;
    }) as THREE.Mesh[];
    if (meshes.length < 2) continue;
    const parts: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      m.updateMatrix();
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      geo.deleteAttribute('uv');
      const c = (m.material as THREE.MeshLambertMaterial).color;
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      parts.push(geo);
      g.remove(m);
    }
    const merged = mergeGeometries(parts, false);
    if (!merged) continue;
    const out = new THREE.Mesh(merged, vcMat);
    out.castShadow = true;
    g.add(out);
  }
}
