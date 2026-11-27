import * as THREE from 'three';

const cache = new Map<string, THREE.MeshLambertMaterial>();
/** Shared flat-coloured materials, one per colour. */
export function mat(color: string | number, opts: { emissive?: string; flat?: boolean } = {}): THREE.MeshLambertMaterial {
  const key = `${color}|${opts.emissive ?? ''}|${opts.flat ?? true}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: opts.flat ?? true });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = 1;
    }
    cache.set(key, m);
  }
  return m;
}

export const C = {
  stone: '#a39f95',
  stoneDark: '#7f7b74',
  wood: '#6b4a2f',
  roof: '#7a3b2a',
  thatch: '#b59a5a',
  plaster: '#d8ccb0',
  skin: ['#f1c9a5', '#d9a77f', '#b07d56', '#8a5a3c'],
  hair: ['#2b1d14', '#5a3a22', '#a0702e', '#d9c27a', '#7a2f1a', '#cfcac2'],
  metal: '#b8bcc4',
  darkMetal: '#5a5e66',
  leather: '#7a5534',
  cloth: '#5e4b8b',
};

export function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
