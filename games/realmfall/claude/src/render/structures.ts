import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { REALM_DEFS, SITES, KEEP_HALF, type Site } from '../game/geo';
import type { World } from '../game/world';
import { mat, C } from './palette';

function gable(w: number, d: number, h: number) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.lineTo(w / 2, 0);
  sh.lineTo(0, h);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

const merge = (gs: THREE.BufferGeometry[]) => {
  const ng = gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return n;
  });
  return mergeGeometries(ng, false)!;
};

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0) {
  g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

export interface KeepView {
  roofs: THREE.Mesh[];
  banners: THREE.Mesh[];
  door: THREE.Mesh;
  rubble: THREE.Mesh;
  flagMat: THREE.MeshLambertMaterial;
  roofMat: THREE.MeshLambertMaterial;
}

const NEUTRAL = '#8a96a8';
export function ownerColor(owner: number) {
  return owner === -1 ? NEUTRAL : REALM_DEFS[owner].color;
}

/** Builds keeps, houses, gate portals and town furniture. Returns handles for things that change. */
export function buildStructures(w: World) {
  const group = new THREE.Group();
  group.name = 'structures';
  const stone: THREE.BufferGeometry[] = [];
  const darkStone: THREE.BufferGeometry[] = [];
  const wood: THREE.BufferGeometry[] = [];
  const plaster: THREE.BufferGeometry[] = [];
  const roofsRed: THREE.BufferGeometry[] = [];
  const thatch: THREE.BufferGeometry[] = [];
  const darkWood: THREE.BufferGeometry[] = [];
  const keepViews: KeepView[] = [];
  const lamps: THREE.BufferGeometry[] = [];
  const geo = w.geo;
  const H = KEEP_HALF;

  for (const k of w.keeps) {
    const s = k.site;
    const y0 = geo.height(s.x, s.z) - 0.5;
    const P = (u: number, v: number) => w.keepToWorld(s, u, v);
    const wallH = 9;
    const wall = (u0: number, v0: number, u1: number, v1: number) => {
      const a = P(u0, v0), b = P(u1, v1);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const rot = -Math.atan2(b.z - a.z, b.x - a.x);
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      stone.push(place(new THREE.BoxGeometry(len, wallH, 2.2), mx, y0 + wallH / 2, mz, rot));
      // walkway lip and merlons
      for (let t = 1; t < len - 0.5; t += 2.2) {
        const px = a.x + ((b.x - a.x) * t) / len, pz = a.z + ((b.z - a.z) * t) / len;
        darkStone.push(place(new THREE.BoxGeometry(1.1, 1.3, 2.4), px, y0 + wallH + 0.6, pz, rot));
      }
    };
    wall(H, -H, H, -3.6);
    wall(H, 3.6, H, H);
    wall(H, H, -H, H);
    wall(-H, H, -H, -H);
    wall(-H, -H, H, -H);
    // gatehouse over the opening
    const gh = P(H, 0);
    stone.push(place(new THREE.BoxGeometry(4, 4, 11), gh.x, y0 + wallH + 1.5, gh.z, -s.facing));
    for (const sv of [-1, 1]) {
      const gp = P(H, sv * 4.6);
      stone.push(place(new THREE.BoxGeometry(4.4, wallH + 3, 3), gp.x, y0 + (wallH + 3) / 2, gp.z, -s.facing));
    }
    const roofMat = new THREE.MeshLambertMaterial({ color: ownerColor(k.owner), flatShading: true });
    const flagMat = new THREE.MeshLambertMaterial({ color: ownerColor(k.owner), side: THREE.DoubleSide, flatShading: true });
    const roofs: THREE.Mesh[] = [];
    const banners: THREE.Mesh[] = [];
    for (const [cu, cv] of [[H, -H], [H, H], [-H, H], [-H, -H]]) {
      const c = P(cu, cv);
      stone.push(place(new THREE.CylinderGeometry(3.4, 3.8, 13, 10), c.x, y0 + 6.5, c.z));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 5, 10), roofMat);
      roof.position.set(c.x, y0 + 15.5, c.z);
      roof.castShadow = true;
      roofs.push(roof);
      group.add(roof);
    }
    // donjon
    const dj = P(-17, 0);
    stone.push(place(new THREE.BoxGeometry(8, 16, 14), dj.x, y0 + 8, dj.z, -s.facing));
    for (let i = -2; i <= 2; i++) {
      const m1 = P(-13, i * 2.8);
      darkStone.push(place(new THREE.BoxGeometry(1.1, 1.4, 1.1), m1.x, y0 + 16.6, m1.z, -s.facing));
    }
    const djRoof = new THREE.Mesh(new THREE.ConeGeometry(6, 6, 4).rotateY(Math.PI / 4).scale(1, 1, 1.6), roofMat);
    djRoof.rotation.y = -s.facing;
    djRoof.position.set(dj.x, y0 + 19, dj.z);
    roofs.push(djRoof);
    group.add(djRoof);
    // banners on the gatehouse and donjon
    for (const [u, v, hh] of [[H + 1.3, -2.8, wallH + 0.5], [H + 1.3, 2.8, wallH + 0.5], [-12.9, 0, 13]] as [number, number, number][]) {
      const bp = P(u, v);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5), flagMat);
      ban.position.set(bp.x, y0 + hh - 1.5, bp.z);
      ban.rotation.y = -s.facing + Math.PI / 2;
      banners.push(ban);
      group.add(ban);
    }
    // flag on a pole above the donjon
    const fp = P(-17, 0);
    wood.push(place(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), fp.x, y0 + 24, fp.z));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2), flagMat);
    flag.position.set(fp.x + Math.cos(s.facing + Math.PI / 2) * 1.7, y0 + 26.3, fp.z + Math.sin(s.facing + Math.PI / 2) * 1.7);
    flag.rotation.y = -s.facing;
    flag.userData.wave = true;
    banners.push(flag);
    group.add(flag);
    // the door and its rubble
    const dp = P(H, 0);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 7.4), mat('#4a3320'));
    door.position.set(dp.x, y0 + 3.5, dp.z);
    door.rotation.y = -s.facing;
    door.castShadow = true;
    group.add(door);
    const rubble = new THREE.Mesh(merge([
      new THREE.BoxGeometry(2.4, 0.5, 1.2).rotateZ(0.3).translate(0.6, 0.3, -1.8),
      new THREE.BoxGeometry(1.8, 0.4, 1.5).rotateY(0.6).translate(-0.5, 0.2, 1.2),
      new THREE.BoxGeometry(1.0, 0.5, 2.5).rotateY(-0.4).translate(1.2, 0.25, 2.4),
    ]), mat('#3d2a1a'));
    rubble.position.copy(door.position);
    rubble.position.y = y0 + 0.2;
    rubble.rotation.y = -s.facing;
    rubble.visible = false;
    group.add(rubble);
    keepViews.push({ roofs, banners, door, rubble, flagMat, roofMat });
  }

  // Houses, styled per realm.
  for (const h of w.houses) {
    const y0 = geo.height(h.x, h.z) - 0.3;
    if (h.realm === 0) {
      plaster.push(place(new THREE.BoxGeometry(h.w, 4.2, h.d), h.x, y0 + 2.1, h.z, -h.rot));
      wood.push(place(new THREE.BoxGeometry(h.w + 0.2, 0.4, h.d + 0.2), h.x, y0 + 4.3, h.z, -h.rot));
      roofsRed.push(place(gable(h.w + 1.2, h.d + 0.8, 3.2), h.x, y0 + 4.4, h.z, -h.rot));
      plaster.push(place(gable(h.w, 0.1, 3.0), h.x, y0 + 4.4, h.z, -h.rot));
      wood.push(place(new THREE.BoxGeometry(1.2, 2.2, 0.2), h.x, y0 + 1.1, h.z + 0, -h.rot));
      darkWood.push(place(new THREE.BoxGeometry(0.8, 1.6, 0.8), h.x + Math.cos(h.rot) * (h.w / 2 - 1), y0 + 6.2, h.z + Math.sin(h.rot) * (h.w / 2 - 1)));
    } else if (h.realm === 1) {
      const rad = Math.min(h.w, h.d) * 0.55;
      plaster.push(place(new THREE.CylinderGeometry(rad, rad, 3.6, 10), h.x, y0 + 1.8, h.z));
      thatch.push(place(new THREE.ConeGeometry(rad + 1.2, 4.2, 10), h.x, y0 + 5.6, h.z));
    } else {
      darkWood.push(place(new THREE.BoxGeometry(h.w, 3.4, h.d + 3), h.x, y0 + 1.7, h.z, -h.rot));
      thatch.push(place(gable(h.w + 1.6, h.d + 3.8, 4.2), h.x, y0 + 3.3, h.z, -h.rot));
      for (const sv of [-1, 1]) {
        const ex = h.x + Math.cos(h.rot + Math.PI / 2) * sv * ((h.d + 3.8) / 2), ez = h.z + Math.sin(h.rot + Math.PI / 2) * sv * ((h.d + 3.8) / 2);
        darkWood.push(place(new THREE.BoxGeometry(0.3, 1.8, 0.3).rotateZ(0.5).translate(0.4, 0, 0), ex, y0 + 7.6, ez, -h.rot));
        darkWood.push(place(new THREE.BoxGeometry(0.3, 1.8, 0.3).rotateZ(-0.5).translate(-0.4, 0, 0), ex, y0 + 7.6, ez, -h.rot));
      }
    }
  }

  // Towns and gates.
  const portalMats: THREE.MeshBasicMaterial[] = [];
  const portals: THREE.Mesh[] = [];
  for (const s of SITES) {
    const y0 = geo.height(s.x, s.z);
    if (s.kind === 'town') {
      stone.push(place(new THREE.BoxGeometry(1.4, 5, 0.8), s.x, y0 + 2.4, s.z, 0.3));
      darkStone.push(place(new THREE.CylinderGeometry(2.6, 2.8, 0.8, 12), s.x + 5, y0 + 0.4, s.z + 4));
      // stalls
      for (let i = 0; i < 3; i++) {
        const a = s.facing + Math.PI + (i - 1) * 0.6;
        const x = s.x + Math.cos(a) * 11, z = s.z + Math.sin(a) * 11;
        wood.push(place(new THREE.BoxGeometry(3, 1, 1.6), x, y0 + 0.5, z, -a));
        for (const sx of [-1.4, 1.4]) wood.push(place(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 4).translate(sx, 1.3, 0), x, y0, z, -a));
        const canopy = new THREE.BoxGeometry(3.4, 0.15, 2.2).translate(0, 2.6, 0);
        (i % 2 ? roofsRed : plaster).push(place(canopy, x, y0, z, -a));
      }
      // lamp posts along the road out
      for (let i = 1; i <= 4; i++) {
        const x = s.x + Math.cos(s.facing) * (18 + i * 10) + Math.cos(s.facing + Math.PI / 2) * 5;
        const z = s.z + Math.sin(s.facing) * (18 + i * 10) + Math.sin(s.facing + Math.PI / 2) * 5;
        darkWood.push(place(new THREE.CylinderGeometry(0.1, 0.13, 2.6, 5), x, geo.height(x, z) + 1.3, z));
        lamps.push(place(new THREE.BoxGeometry(0.4, 0.5, 0.4), x, geo.height(x, z) + 2.8, z));
      }
    }
    if (s.kind === 'gate') {
      const realm = REALM_DEFS[s.realm as number];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a - s.facing), Math.cos(a - s.facing))) < 0.4) continue;
        if (Math.abs(Math.atan2(Math.sin(a - s.facing - Math.PI), Math.cos(a - s.facing - Math.PI))) < 0.4) continue;
        const x = s.x + Math.cos(a) * 14, z = s.z + Math.sin(a) * 14;
        stone.push(place(new THREE.BoxGeometry(1.6, 5.5, 1.1), x, y0 + 2.4, z, -a));
      }
      // the portal arch
      const ax = s.x - Math.cos(s.facing) * 1.5, az = s.z - Math.sin(s.facing) * 1.5;
      for (const sv of [-1, 1]) {
        const px = ax + Math.cos(s.facing + Math.PI / 2) * 3 * sv, pz = az + Math.sin(s.facing + Math.PI / 2) * 3 * sv;
        stone.push(place(new THREE.BoxGeometry(1.2, 7, 1.2), px, y0 + 3.5, pz, -s.facing));
      }
      stone.push(place(new THREE.BoxGeometry(1.4, 1.2, 7.4), ax, y0 + 7.4, az, -s.facing));
      const pm = new THREE.MeshBasicMaterial({ color: realm.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      const portal = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), pm);
      portal.position.set(ax, y0 + 3.6, az);
      portal.rotation.y = -s.facing + Math.PI / 2;
      portal.scale.set(1, 1.3, 1);
      group.add(portal);
      portals.push(portal);
      portalMats.push(pm);
    }
  }

  const add = (gs: THREE.BufferGeometry[], m: THREE.Material) => {
    if (!gs.length) return;
    const mesh = new THREE.Mesh(merge(gs), m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(stone, mat(C.stone));
  add(darkStone, mat(C.stoneDark));
  add(wood, mat(C.wood));
  add(plaster, mat(C.plaster));
  add(roofsRed, mat('#8a3b2b'));
  add(thatch, mat('#a8894f'));
  add(darkWood, mat('#4a3626'));
  if (lamps.length) group.add(new THREE.Mesh(merge(lamps), new THREE.MeshBasicMaterial({ color: '#ffd27a' })));

  return { group, keepViews, portals };
}

export function siteLabelPos(w: World, s: Site) {
  return { x: s.x, y: w.geo.height(s.x, s.z) + 30, z: s.z };
}
