import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Geo, SITES, WORLD_R, FRONTIER_R, sectorOf, roadDist } from '../game/geo';
import { fbm } from '../game/noise';
import { Rng } from '../game/rng';

function colored(g: THREE.BufferGeometry, hex: string, jitter = 0, rng?: Rng): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i += 3) {
    const f = 1 + (rng ? rng.range(-jitter, jitter) : 0);
    for (let k = 0; k < 3; k++) {
      col[(i + k) * 3] = c.r * f;
      col[(i + k) * 3 + 1] = c.g * f;
      col[(i + k) * 3 + 2] = c.b * f;
    }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  return ng;
}

function build(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  return g;
}

export function treeGeometries() {
  const r = new Rng(7);
  const trunk = (h: number, rad: number, col = '#5b3d26') => colored(new THREE.CylinderGeometry(rad * 0.7, rad, h, 6).translate(0, h / 2, 0), col, 0.08, r);
  const pine = build([
    trunk(2.4, 0.32),
    colored(new THREE.ConeGeometry(2.6, 3.6, 7).translate(0, 3.4, 0), '#2f5a33', 0.12, r),
    colored(new THREE.ConeGeometry(2.0, 3.0, 7).translate(0, 5.3, 0), '#356438', 0.12, r),
    colored(new THREE.ConeGeometry(1.3, 2.6, 7).translate(0, 7.0, 0), '#3b6e3d', 0.12, r),
  ]);
  const snowPine = build([
    trunk(2.4, 0.32),
    colored(new THREE.ConeGeometry(2.6, 3.6, 7).translate(0, 3.4, 0), '#2c4f3a', 0.1, r),
    colored(new THREE.ConeGeometry(2.0, 3.0, 7).translate(0, 5.3, 0), '#dfe9ee', 0.05, r),
    colored(new THREE.ConeGeometry(1.3, 2.6, 7).translate(0, 7.0, 0), '#f2f6f8', 0.05, r),
  ]);
  const oak = build([
    trunk(3.2, 0.45, '#4f3522'),
    colored(new THREE.IcosahedronGeometry(2.8, 0).translate(0, 5.0, 0), '#3f7a35', 0.15, r),
    colored(new THREE.IcosahedronGeometry(2.0, 0).translate(1.6, 4.2, 0.6), '#4a8a3b', 0.15, r),
    colored(new THREE.IcosahedronGeometry(1.9, 0).translate(-1.4, 4.5, -0.8), '#356b2f', 0.15, r),
  ]);
  const bigOak = build([
    trunk(4.5, 0.8, '#45301f'),
    colored(new THREE.IcosahedronGeometry(4.2, 0).translate(0, 7.2, 0), '#2f6a2c', 0.15, r),
    colored(new THREE.IcosahedronGeometry(3.0, 0).translate(2.6, 6.0, 1), '#3a7a32', 0.15, r),
    colored(new THREE.IcosahedronGeometry(3.0, 0).translate(-2.4, 6.4, -1.2), '#285e27', 0.15, r),
    colored(new THREE.IcosahedronGeometry(2.4, 0).translate(0.5, 9.4, -0.6), '#3c7f35', 0.15, r),
  ]);
  const birch = build([
    trunk(4.6, 0.22, '#e8e4da'),
    colored(new THREE.IcosahedronGeometry(1.6, 0).scale(1, 1.6, 1).translate(0, 5.4, 0), '#8fb14a', 0.15, r),
    colored(new THREE.IcosahedronGeometry(1.1, 0).scale(1, 1.4, 1).translate(0.6, 4.2, 0.3), '#a3c25a', 0.15, r),
  ]);
  const rock = build([colored(new THREE.DodecahedronGeometry(1.2, 0).scale(1.3, 0.75, 1), '#85817a', 0.12, r)]);
  const bush = build([colored(new THREE.IcosahedronGeometry(0.9, 0).scale(1.2, 0.8, 1.2).translate(0, 0.5, 0), '#4c7c39', 0.18, r)]);
  return { pine, snowPine, oak, bigOak, birch, rock, bush };
}

type Kind = keyof ReturnType<typeof treeGeometries>;

const CHUNKS = 8;
const CHUNK = (WORLD_R * 2) / CHUNKS;

/** Scatters trees, rocks and bushes over the world, as instanced meshes in chunks so the camera can cull them. */
export function buildProps(geo: Geo): THREE.Group {
  const geoms = treeGeometries();
  const rng = new Rng(geo.seed * 17 + 3);
  const buckets = new Map<string, THREE.Matrix4[]>();
  const colors = new Map<string, THREE.Color[]>();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const put = (kind: Kind, x: number, z: number, scale: number, sink = 0.2) => {
    const ci = Math.min(CHUNKS - 1, Math.max(0, Math.floor((x + WORLD_R) / CHUNK)));
    const cj = Math.min(CHUNKS - 1, Math.max(0, Math.floor((z + WORLD_R) / CHUNK)));
    const key = `${kind}:${ci}:${cj}`;
    let b = buckets.get(key);
    if (!b) { buckets.set(key, (b = [])); colors.set(key, []); }
    q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
    s.set(scale * rng.range(0.9, 1.1), scale * rng.range(0.85, 1.2), scale * rng.range(0.9, 1.1));
    p.set(x, geo.height(x, z) - sink, z);
    b.push(m.compose(p, q, s).clone());
    colors.get(key)!.push(new THREE.Color().setHSL(0, 0, rng.range(0.85, 1.12)));
  };
  const clear = (x: number, z: number) => {
    for (const st of SITES) {
      const d = Math.hypot(x - st.x, z - st.z);
      if (d < st.flat + (st.kind === 'town' ? 10 : 6)) return false;
    }
    return roadDist(x, z) > 7;
  };
  const step = 7.5;
  for (let x = -WORLD_R; x < WORLD_R; x += step) {
    for (let z = -WORLD_R; z < WORLD_R; z += step) {
      const px = x + rng.range(0, step), pz = z + rng.range(0, step);
      const r = Math.hypot(px, pz);
      if (r > WORLD_R + 20) continue;
      const h = geo.height(px, pz);
      if (h < 0.9) continue;
      const sector = sectorOf(px, pz);
      const home = r > FRONTIER_R + 20;
      const dens = fbm(px / 160, pz / 160, geo.seed + 300);
      const ridge = geo.ridge(px, pz);
      let p0 = 0;
      let kind: Kind = 'oak';
      if (ridge > 0.3) {
        if (h > 85) continue;
        p0 = 0.18;
        kind = sector === 2 || h > 50 ? 'snowPine' : 'pine';
      } else if (!home) {
        p0 = dens > 0.58 ? 0.35 : 0.04;
        kind = rng.chance(0.5) ? 'oak' : rng.chance(0.5) ? 'pine' : 'birch';
      } else if (sector === 0) {
        p0 = dens > 0.6 ? 0.42 : dens > 0.5 ? 0.08 : 0.02;
        kind = rng.chance(0.55) ? 'oak' : 'birch';
      } else if (sector === 1) {
        p0 = dens > 0.45 ? 0.5 : 0.12;
        kind = rng.chance(0.18) ? 'bigOak' : rng.chance(0.7) ? 'oak' : 'pine';
      } else {
        p0 = dens > 0.5 ? 0.42 : 0.07;
        kind = h > 20 || rng.chance(0.5) ? 'snowPine' : 'pine';
      }
      if (rng.chance(p0) && clear(px, pz)) {
        put(kind, px, pz, rng.range(0.85, 1.35));
      } else if (rng.chance(home ? 0.05 : 0.04) && clear(px, pz)) {
        put(rng.chance(0.55) ? 'rock' : 'bush', px, pz, rng.range(0.6, 1.6), 0.3);
      }
    }
  }
  const group = new THREE.Group();
  group.name = 'props';
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (const [key, mats] of buckets) {
    const kind = key.split(':')[0] as Kind;
    const mesh = new THREE.InstancedMesh(geoms[kind], material, mats.length);
    const cols = colors.get(key)!;
    mats.forEach((mm, i) => {
      mesh.setMatrixAt(i, mm);
      mesh.setColorAt(i, cols[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = kind !== 'bush';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
