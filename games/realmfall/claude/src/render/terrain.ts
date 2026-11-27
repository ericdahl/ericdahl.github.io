import * as THREE from 'three';
import { Geo, REALM_DEFS, WORLD_R, FRONTIER_R, sectorOf, roadDist, SITES, WATER_Y } from '../game/geo';
import { fbm, smoothstep, lerp } from '../game/noise';

const tmp = new THREE.Color();
const A = new THREE.Color(), B = new THREE.Color();

/** Ground colour at a point: realm biome, height, slope, roads and plazas. */
export function groundColor(geo: Geo, x: number, z: number, h: number, slope: number, out: THREE.Color) {
  const r = Math.hypot(x, z);
  const sector = sectorOf(x, z);
  const home = smoothstep(FRONTIER_R - 40, FRONTIER_R + 60, r);
  const n = fbm(x / 35, z / 35, geo.seed + 91);
  const n2 = fbm(x / 140, z / 140, geo.seed + 92);
  // frontier: dry, trampled grass
  A.set('#7f8a4a').lerp(tmp.set('#6b7a3e'), n);
  if (home > 0) {
    if (sector === 0) B.set('#6f9a45').lerp(tmp.set('#8fae55'), n); // Valmora: bright meadow
    else if (sector === 1) B.set('#3f6e33').lerp(tmp.set('#557f3a'), n); // Eldwyn: deep forest floor
    else B.set('#7c8770').lerp(tmp.set('#a3ab98'), n); // Hroth: tundra
    A.lerp(B, home);
  }
  out.copy(A);
  if (n2 > 0.62) out.lerp(tmp.set(sector === 2 && home > 0.5 ? '#c8cfd6' : '#9a9a55'), (n2 - 0.62) * 1.5);
  // beaches and mud by water
  if (h < 1.6) out.lerp(tmp.set(sector === 2 ? '#8c8b86' : '#b9a878'), smoothstep(1.6, 0.4, h));
  if (h < -0.2) out.lerp(tmp.set('#5d5a48'), 0.6);
  // rock on steep ground and mountains
  const rock = smoothstep(0.55, 1.0, slope) + smoothstep(28, 60, h) * 0.9;
  if (rock > 0) out.lerp(tmp.set(n > 0.5 ? '#807a72' : '#6e6a64'), Math.min(1, rock));
  // snow: high everywhere, lower in Hroth
  const snowLine = sector === 2 && home > 0.4 ? 22 : 62;
  const snow = smoothstep(snowLine, snowLine + 14, h + n * 8);
  if (snow > 0) out.lerp(tmp.set('#eef2f5'), snow * (1 - smoothstep(0.9, 1.3, slope) * 0.6));
  if (sector === 2 && home > 0.7 && h < snowLine) out.lerp(tmp.set('#dfe6ea'), smoothstep(0.55, 0.8, n) * 0.7);
  // roads
  const rd = roadDist(x, z);
  if (rd < 5.5) out.lerp(tmp.set('#9b8463'), (1 - smoothstep(2.2, 5.5, rd)) * 0.9);
  // plazas in towns, keeps and gates
  for (const s of SITES) {
    const d = Math.hypot(x - s.x, z - s.z);
    const pr = s.kind === 'town' ? 22 : s.kind === 'gate' ? 16 : 0;
    if (pr && d < pr + 4) out.lerp(tmp.set('#a09a8a'), (1 - smoothstep(pr - 3, pr + 4, d)) * 0.85);
    if (s.kind === 'keep' && d < 34) out.lerp(tmp.set('#8f8163'), (1 - smoothstep(20, 34, d)) * 0.6);
  }
  return out;
}

export function buildTerrain(geo: Geo, segs = 400): THREE.Mesh {
  const size = WORLD_R * 2;
  const geom = new THREE.PlaneGeometry(size, size, segs, segs);
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const heights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    let h = geo.height(x, z);
    if (r > WORLD_R - 20) h = Math.max(h, lerp(h, 140, smoothstep(WORLD_R - 20, WORLD_R * 1.05, r)));
    heights[i] = h;
    pos.setY(i, h);
  }
  geom.computeVertexNormals();
  const nor = geom.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const slope = Math.sqrt(1 - Math.min(1, nor.getY(i) ** 2)) / Math.max(0.05, nor.getY(i));
    groundColor(geo, x, z, heights[i], slope, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geom, m);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  mesh.userData.map = mapImage(segs + 1, colors, nor, heights);
  return mesh;
}

/** A top-down painted map of the world, from the terrain's own colours with hill shading. */
function mapImage(n: number, colors: Float32Array, nor: THREE.BufferAttribute, heights: Float32Array): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const shadeF = 0.75 + 0.45 * (nor.getX(i) * -0.6 + nor.getY(i) * 0.6 + nor.getZ(i) * -0.5);
    const water = heights[i] < 0;
    const r = water ? 0.23 : colors[i * 3] * shadeF, gg = water ? 0.45 : colors[i * 3 + 1] * shadeF, b = water ? 0.6 : colors[i * 3 + 2] * shadeF;
    // colours are linear; the canvas wants sRGB
    img.data[i * 4] = Math.min(255, Math.pow(r, 1 / 2.2) * 255);
    img.data[i * 4 + 1] = Math.min(255, Math.pow(gg, 1 / 2.2) * 255);
    img.data[i * 4 + 2] = Math.min(255, Math.pow(b, 1 / 2.2) * 255);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function buildWater(): THREE.Mesh {
  const g = new THREE.CircleGeometry(WORLD_R * 1.1, 64);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshPhongMaterial({ color: '#3a7a99', transparent: true, opacity: 0.78, shininess: 90, specular: '#cfe8ff' });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = WATER_Y;
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}

export { REALM_DEFS };
