import type { ThemeId } from '../game/map';
import { Rng } from '../game/rng';
import { TILE_H, TILE_W } from './camera';

export const WALL_H = 46;

interface Palette {
  floor: string[];
  speck: string[];
  wallTop: string;
  wallL: string;
  wallR: string;
  grid?: string;
  cracks?: string;
}

export const THEMES: Record<ThemeId, Palette> = {
  town: { floor: ['#4a4430', '#4f472f', '#463f2c', '#55502f'], speck: ['#5d5636', '#3b3524', '#5f6a35'], wallTop: '#6b4a2a', wallL: '#4f3520', wallR: '#3c2818' },
  fields: { floor: ['#3e3826', '#433b27', '#3a3424', '#47402a'], speck: ['#52492d', '#2e2a1c', '#4f4a2a', '#5a3a22'], wallTop: '#55504a', wallL: '#3e3a35', wallR: '#2d2a27' },
  cave: { floor: ['#3a332c', '#352f29', '#3e3730', '#332d27'], speck: ['#4a4138', '#26211d', '#463d33'], wallTop: '#5a5046', wallL: '#433b33', wallR: '#2f2924' },
  forest: { floor: ['#27311f', '#2b3421', '#242d1d', '#2f3823'], speck: ['#36432a', '#1b2215', '#3d4a2c', '#3a3122'], wallTop: '#3a4a2e', wallL: '#2a3622', wallR: '#1d2618' },
  chapel: { floor: ['#3d3b40', '#39373c', '#423f45', '#363439'], speck: ['#4a474e', '#2b292e'], wallTop: '#5c5862', wallL: '#46434b', wallR: '#333037', grid: '#2a282d' },
  crypt: { floor: ['#33302c', '#2f2c29', '#37342f', '#2c2926'], speck: ['#3f3b35', '#24211e'], wallTop: '#524b42', wallL: '#3d3731', wallR: '#2c2824', grid: '#221f1c' },
  hell: { floor: ['#3b1e15', '#361b13', '#401f16', '#331811'], speck: ['#4c2618', '#24100a', '#5a2a14'], wallTop: '#4d2216', wallL: '#3a1910', wallR: '#29110a', cracks: '#ff6a1a' },
  oasis: { floor: ['#a8946a', '#a08b60', '#b09c72', '#98855a'], speck: ['#c4b184', '#83724a', '#6b7f42'], wallTop: '#8a6f48', wallL: '#6a5436', wallR: '#524028' },
  desert: { floor: ['#b89a6c', '#ae9062', '#c0a274', '#a68a5c'], speck: ['#d0b484', '#8c7048', '#a08458'], wallTop: '#8a6c48', wallL: '#6a5236', wallR: '#524028' },
  glass: { floor: ['#2f4a4c', '#294244', '#355256', '#263c3e'], speck: ['#4a7a7c', '#1a2c2e', '#70b0b0'], wallTop: '#4a7878', wallL: '#2c4c4e', wallR: '#1e3638', cracks: '#a8ecec' },
  mesa: { floor: ['#96603f', '#8c5839', '#a06846', '#845030'], speck: ['#b47a50', '#5e3a24', '#a4683e'], wallTop: '#8a5234', wallL: '#663a24', wallR: '#4c2a1a' },
  cistern: { floor: ['#2e3a3c', '#2a3537', '#324042', '#263032'], speck: ['#3f5052', '#1c2628', '#3a5a50'], wallTop: '#4c5a58', wallL: '#38443f', wallR: '#2a3330', grid: '#1e2826' },
  ruins: { floor: ['#6e5e42', '#66573d', '#766548', '#5e5038'], speck: ['#8a7858', '#463a28'], wallTop: '#a08a64', wallL: '#786648', wallR: '#584a34', grid: '#4a3e2c' },
  vault: { floor: ['#3a2c14', '#342710', '#402f16', '#2f230e'], speck: ['#5a4420', '#1e160a', '#8a6a20'], wallTop: '#6a5220', wallL: '#4a3816', wallR: '#33270f', grid: '#261c0c', cracks: '#ffc840' },
};

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

const floorCache = new Map<string, HTMLCanvasElement>();
const RES = 2;

/** Pre-rendered floor diamond for a theme variant (drawn at 2x for crispness). */
export function floorTile(theme: ThemeId, v: number): HTMLCanvasElement {
  const key = `${theme}:${v}`;
  const hit = floorCache.get(key);
  if (hit) return hit;
  const pal = THEMES[theme];
  const c = canvas(TILE_W * RES, TILE_H * RES);
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  const rng = new Rng(v * 7919 + theme.length * 31);
  diamond(ctx, 0, 0, TILE_W, TILE_H);
  ctx.fillStyle = pal.floor[v % pal.floor.length];
  ctx.fill();
  ctx.save();
  diamond(ctx, 0, 0, TILE_W, TILE_H);
  ctx.clip();
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rng.pick(pal.speck);
    ctx.globalAlpha = rng.range(0.25, 0.7);
    const s = rng.range(1, 3.2);
    ctx.fillRect(rng.range(0, TILE_W), rng.range(0, TILE_H), s, s * 0.6);
  }
  ctx.globalAlpha = 1;
  if (pal.grid) {
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1.2;
    diamond(ctx, 1, 0.5, TILE_W - 2, TILE_H - 1);
    ctx.stroke();
    if (v % 2) {
      ctx.beginPath();
      ctx.moveTo(TILE_W / 4, TILE_H / 4);
      ctx.lineTo((TILE_W * 3) / 4, (TILE_H * 3) / 4);
      ctx.stroke();
    }
  }
  if (theme === 'town' || theme === 'forest' || theme === 'fields') {
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = theme === 'fields' ? '#5b5130' : theme === 'forest' ? '#3e5130' : '#66703c';
      ctx.globalAlpha = 0.5;
      const x = rng.range(4, TILE_W - 4);
      const y = rng.range(4, TILE_H - 4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 5));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (theme === 'desert' || theme === 'mesa' || theme === 'oasis') {
    // Wind ripples in the sand.
    ctx.strokeStyle = 'rgba(70,45,20,0.13)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = rng.range(6, TILE_H - 6);
      ctx.beginPath();
      ctx.moveTo(rng.range(4, 18), y);
      ctx.quadraticCurveTo(TILE_W / 2, y - rng.range(2, 5), TILE_W - rng.range(4, 18), y + rng.range(-2, 2));
      ctx.stroke();
    }
  }
  if (pal.cracks && v % 2 === 0) {
    ctx.strokeStyle = pal.cracks;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = rng.range(10, 30);
    let y = rng.range(8, 20);
    ctx.moveTo(x, y);
    for (let i = 0; i < 4; i++) {
      x += rng.range(3, 9);
      y += rng.range(-4, 4);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  floorCache.set(key, c);
  return c;
}

const wallCache = new Map<string, HTMLCanvasElement>();

/** A raised isometric block. Canvas spans TILE_W x (TILE_H + WALL_H). */
export function wallBlock(theme: ThemeId, v: number): HTMLCanvasElement {
  const key = `${theme}:${v}`;
  const hit = wallCache.get(key);
  if (hit) return hit;
  const pal = THEMES[theme];
  const H = WALL_H;
  const c = canvas(TILE_W * RES, (TILE_H + H) * RES);
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  const rng = new Rng(v * 131 + 17);
  const W = TILE_W;
  const T = TILE_H;
  // Left face
  ctx.beginPath();
  ctx.moveTo(0, T / 2);
  ctx.lineTo(W / 2, T);
  ctx.lineTo(W / 2, T + H);
  ctx.lineTo(0, T / 2 + H);
  ctx.closePath();
  ctx.fillStyle = pal.wallL;
  ctx.fill();
  // Right face
  ctx.beginPath();
  ctx.moveTo(W / 2, T);
  ctx.lineTo(W, T / 2);
  ctx.lineTo(W, T / 2 + H);
  ctx.lineTo(W / 2, T + H);
  ctx.closePath();
  ctx.fillStyle = pal.wallR;
  ctx.fill();
  // Masonry / texture lines on faces.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  if (theme === 'town') {
    for (let i = 1; i < 8; i++) {
      const x = (i / 8) * W;
      const yTop = x < W / 2 ? T / 2 + (x / (W / 2)) * (T / 2) : T - ((x - W / 2) / (W / 2)) * (T / 2);
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yTop + H);
      ctx.stroke();
    }
  } else if (theme === 'chapel' || theme === 'crypt' || theme === 'hell' || theme === 'cistern' || theme === 'ruins' || theme === 'vault') {
    for (let r = 1; r < 5; r++) {
      const dy = (r / 5) * H;
      ctx.beginPath();
      ctx.moveTo(0, T / 2 + dy);
      ctx.lineTo(W / 2, T + dy);
      ctx.lineTo(W, T / 2 + dy);
      ctx.stroke();
      for (let k = 0; k < 2; k++) {
        const fx = ((k + (r % 2) * 0.5) / 2) * (W / 2) + 6;
        ctx.beginPath();
        ctx.moveTo(fx, T / 2 + (fx / (W / 2)) * (T / 2) + dy - H / 5);
        ctx.lineTo(fx, T / 2 + (fx / (W / 2)) * (T / 2) + dy);
        ctx.stroke();
      }
    }
  } else {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
      const x = rng.range(0, W);
      const y = rng.range(T / 2, T + H);
      ctx.fillRect(x, y, rng.range(2, 5), rng.range(1, 3));
    }
  }
  // Top
  diamond(ctx, 0, 0, W, T);
  ctx.fillStyle = pal.wallTop;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
  if (theme === 'town') {
    // Pointed stake tips along the top.
    ctx.fillStyle = '#7a5631';
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 10;
      const y = T / 2 + (x < W / 2 ? 0 : 0) - 2;
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 6);
      ctx.lineTo(x, y - 4);
      ctx.lineTo(x + 3, y + 6);
      ctx.fill();
    }
  }
  if ((theme === 'hell' || theme === 'vault') && v % 3 === 0) {
    ctx.strokeStyle = theme === 'vault' ? '#ffc840' : '#ff5a10';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(W * 0.7, T / 2 + 8);
    ctx.lineTo(W * 0.78, T / 2 + 20);
    ctx.lineTo(W * 0.72, T / 2 + 32);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  wallCache.set(key, c);
  return c;
}

const treeCache = new Map<string, HTMLCanvasElement>();
export const TREE_W = 96;
export const TREE_H = 128;

/** Trees and boulders used as walls outdoors. Anchor is bottom-center at (48, 112). */
export function treeSprite(theme: ThemeId, v: number): HTMLCanvasElement {
  const key = `${theme}:${v}`;
  const hit = treeCache.get(key);
  if (hit) return hit;
  const c = canvas(TREE_W * RES, TREE_H * RES);
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  const rng = new Rng(v * 977 + 3);
  const bx = 48;
  const by = 112;
  if (theme === 'oasis' || theme === 'desert' || theme === 'glass' || theme === 'mesa') {
    drawDesertObstacle(ctx, theme, v, rng, bx, by);
    treeCache.set(key, c);
    return c;
  }
  const rock = (theme === 'fields' && v % 3 === 0) || theme === 'cave';
  if (rock) {
    ctx.fillStyle = '#2a2723';
    ctx.beginPath();
    ctx.ellipse(bx, by, 26, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(bx - 20, by - 40, bx + 20, by);
    g.addColorStop(0, '#77706a');
    g.addColorStop(1, '#3d3934');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - 24, by);
    ctx.lineTo(bx - 20 + rng.range(-3, 3), by - 22 - rng.range(0, 10));
    ctx.lineTo(bx - 4, by - 34 - rng.range(0, 12));
    ctx.lineTo(bx + 14, by - 26 - rng.range(0, 8));
    ctx.lineTo(bx + 24, by - 6);
    ctx.lineTo(bx + 12, by + 5);
    ctx.lineTo(bx - 14, by + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
  } else if (theme === 'fields') {
    // Dead, gnarled tree.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b2c20';
    ctx.lineCap = 'round';
    const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (depth > 0) {
        branch(x2, y2, ang - rng.range(0.3, 0.7), len * 0.7, w * 0.65, depth - 1);
        branch(x2, y2, ang + rng.range(0.3, 0.7), len * 0.7, w * 0.65, depth - 1);
      }
    };
    branch(bx, by, -Math.PI / 2 + rng.range(-0.15, 0.15), 38, 7, 4);
  } else {
    // Dark pines / leafy trees.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 26, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e2116';
    ctx.fillRect(bx - 3, by - 26, 6, 26);
    const base = theme === 'town' ? ['#2f4a22', '#3a5a2a', '#25401b'] : ['#1c2d17', '#24391c', '#16240f'];
    for (let i = 0; i < 4; i++) {
      const y = by - 24 - i * 18;
      const w = 30 - i * 6 + rng.range(-3, 3);
      ctx.fillStyle = base[i % base.length];
      ctx.beginPath();
      ctx.moveTo(bx - w, y);
      ctx.lineTo(bx, y - 30);
      ctx.lineTo(bx + w, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(bx, y - 30);
      ctx.lineTo(bx + w, y);
      ctx.lineTo(bx + w * 0.4, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  treeCache.set(key, c);
  return c;
}

function drawDesertObstacle(ctx: CanvasRenderingContext2D, theme: 'oasis' | 'desert' | 'glass' | 'mesa', v: number, rng: Rng, bx: number, by: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(bx, by, 25, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  if (theme === 'oasis') {
    // Date palm: a leaning trunk and a crown of drooping fronds.
    const lean = rng.range(-9, 9);
    const topX = bx + lean;
    const topY = by - 74;
    ctx.strokeStyle = '#6a4e2e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - lean * 0.5, by - 40, topX, topY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,26,12,0.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const k = i / 8;
      const x = bx + (topX - bx) * k * k;
      ctx.beginPath();
      ctx.moveTo(x - 3, by - 74 * k);
      ctx.lineTo(x + 3, by - 74 * k - 1);
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const len = rng.range(30, 42);
      const ex = topX + Math.cos(a) * len;
      const ey = topY + Math.sin(a) * len * 0.42 + 12;
      ctx.strokeStyle = i % 2 ? '#3f6a2a' : '#54803a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY - 12, ex, ey);
      ctx.stroke();
    }
    return;
  }
  if (theme === 'glass') {
    // Jagged spires of fused black-green glass.
    const n = 3 + (v % 3);
    for (let i = 0; i < n; i++) {
      const x = bx + rng.range(-20, 20);
      const h = rng.range(34, 86);
      const w = rng.range(7, 14);
      const tip = x + rng.range(-8, 8);
      const g = ctx.createLinearGradient(x - w, by - h, x + w, by);
      g.addColorStop(0, '#a8ecec');
      g.addColorStop(0.4, '#3b7476');
      g.addColorStop(1, '#14282a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w, by + rng.range(-2, 4));
      ctx.lineTo(tip, by - h);
      ctx.lineTo(x + w, by + rng.range(-2, 4));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,250,250,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tip, by - h);
      ctx.lineTo(x - w * 0.2, by);
      ctx.stroke();
    }
    return;
  }
  if (theme === 'desert' && v % 3 === 1) {
    // Saguaro.
    ctx.strokeStyle = '#4c6a38';
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - 66);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx, by - 30);
    ctx.lineTo(bx - 16, by - 34);
    ctx.lineTo(bx - 16, by - 54);
    ctx.moveTo(bx, by - 40);
    ctx.lineTo(bx + 15, by - 44);
    ctx.lineTo(bx + 15, by - 60);
    ctx.stroke();
    return;
  }
  // Wind-carved rock: squat boulders in the desert, tall red spires on the mesa.
  const tall = theme === 'mesa' ? rng.range(58, 92) : rng.range(26, 44);
  const hi = theme === 'mesa' ? '#b87850' : '#c4a472';
  const lo = theme === 'mesa' ? '#5c3420' : '#6e5636';
  const g = ctx.createLinearGradient(bx - 22, by - tall, bx + 22, by);
  g.addColorStop(0, hi);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx - 25, by + 3);
  ctx.lineTo(bx - 19 + rng.range(-3, 3), by - tall * 0.65);
  ctx.lineTo(bx - 8, by - tall);
  ctx.lineTo(bx + 11, by - tall * 0.92);
  ctx.lineTo(bx + 21, by - tall * 0.45);
  ctx.lineTo(bx + 25, by + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,10,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 5; i++) {
    const y = by - (tall * i) / 5;
    ctx.beginPath();
    ctx.moveTo(bx - 21, y + rng.range(-2, 2));
    ctx.lineTo(bx + 20, y + rng.range(-3, 3));
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ figures

export interface HumanoidLook {
  body: string;
  trim?: string;
  skin: string;
  legs: string;
  head: 'hair' | 'helm' | 'hood' | 'cap' | 'mitre' | 'none';
  headColor: string;
  weapon?: 'sword' | 'axe' | 'mace' | 'bow' | 'staff' | 'wand' | 'dagger' | 'club' | null;
  weaponColor?: string;
  shield?: string | null;
  robe?: boolean;
  cape?: string;
}

export interface Pose {
  /** Screen-space facing: +1 right, -1 left. */
  dir: number;
  /** Facing toward the camera (south) or away. */
  back: boolean;
  walk: number;
  moving: boolean;
  attack: number;
  cast: number;
}

/** Draws a standing figure with feet at (0,0), height ~48 at scale 1. */
export function drawHumanoid(ctx: CanvasRenderingContext2D, look: HumanoidLook, pose: Pose) {
  ctx.save();
  if (pose.dir < 0) ctx.scale(-1, 1);
  const sw = pose.moving ? Math.sin(pose.walk * 3.2) : 0;
  // Cape behind
  if (look.cape) {
    ctx.fillStyle = look.cape;
    ctx.beginPath();
    ctx.moveTo(-7, -36);
    ctx.lineTo(7, -36);
    ctx.lineTo(9 - sw * 2, -6);
    ctx.lineTo(-10 - sw * 2, -6);
    ctx.closePath();
    ctx.fill();
  }
  // Legs
  ctx.strokeStyle = look.legs;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  if (look.robe) {
    ctx.fillStyle = look.body;
    ctx.beginPath();
    ctx.moveTo(-8, -26);
    ctx.lineTo(8, -26);
    ctx.lineTo(11 + sw, 0);
    ctx.lineTo(-11 + sw, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-3, -20);
    ctx.lineTo(-3 + sw * 5, -1);
    ctx.moveTo(3, -20);
    ctx.lineTo(3 - sw * 5, -1);
    ctx.stroke();
  }
  // Torso
  ctx.fillStyle = look.body;
  roundRect(ctx, -8, -38, 16, 20, 5);
  ctx.fill();
  if (look.trim) {
    ctx.fillStyle = look.trim;
    ctx.fillRect(-8, -22, 16, 3);
  }
  // Back arm (shield side)
  const atk = pose.attack;
  if (look.shield) {
    ctx.fillStyle = look.shield;
    ctx.beginPath();
    ctx.ellipse(-8, -27, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.strokeStyle = look.skin;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(-9 - sw * 2, -22);
    ctx.stroke();
  }
  // Head
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(0, -44, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.headColor;
  if (look.head === 'hair') {
    ctx.beginPath();
    ctx.arc(pose.back ? 0 : -1, -46, 6.3, Math.PI * 0.95, Math.PI * 2.15);
    ctx.fill();
  } else if (look.head === 'helm') {
    ctx.beginPath();
    ctx.arc(0, -45, 6.8, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-6.8, -45, 13.6, 3);
  } else if (look.head === 'hood' || look.head === 'mitre') {
    ctx.beginPath();
    ctx.moveTo(-8, -38);
    ctx.lineTo(0, look.head === 'mitre' ? -62 : -54);
    ctx.lineTo(8, -38);
    ctx.closePath();
    ctx.fill();
    if (!pose.back) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(1.5, -43, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look.head === 'cap') {
    ctx.beginPath();
    ctx.arc(0, -46, 6.5, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  // Weapon arm
  const swing = atk > 0 ? Math.sin(atk * Math.PI) : 0;
  const armAng = pose.cast > 0 ? -1.2 : -0.4 - swing * 1.8 + (atk > 0.5 ? 2.2 * (atk - 0.5) : 0);
  const hx = 6 + Math.cos(armAng + 1.2) * 10;
  const hy = -34 + Math.sin(armAng + 1.2) * 10;
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(6, -34);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  drawWeapon(ctx, look, hx, hy, armAng, atk);
  if (pose.cast > 0) {
    ctx.fillStyle = `rgba(255,220,150,${0.6 * Math.sin(pose.cast * Math.PI)})`;
    ctx.beginPath();
    ctx.arc(hx, hy - 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWeapon(ctx: CanvasRenderingContext2D, look: HumanoidLook, hx: number, hy: number, armAng: number, atk: number) {
  const w = look.weapon;
  if (!w) return;
  const col = look.weaponColor ?? '#c8c8d0';
  ctx.save();
  ctx.translate(hx, hy);
  if (w === 'bow') {
    ctx.rotate(atk > 0 ? -0.1 : 0.3);
    ctx.strokeStyle = '#7a5532';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-4, 0, 14, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,230,230,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4 + Math.cos(-1.2) * 14, Math.sin(-1.2) * 14);
    ctx.lineTo(-4 - atk * 6, 0);
    ctx.lineTo(-4 + Math.cos(1.2) * 14, Math.sin(1.2) * 14);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.rotate(armAng - 0.6);
  if (w === 'staff') {
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -26);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -27, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (w === 'wand') {
    ctx.strokeStyle = '#d8cfb8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -12);
    ctx.stroke();
  } else {
    const len = w === 'dagger' ? 10 : w === 'sword' ? 20 : 16;
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(0, -4);
    ctx.stroke();
    if (w === 'sword' || w === 'dagger') {
      ctx.strokeStyle = '#8a7a50';
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, -4);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(0, -4 - len);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(0, -4 - len);
      ctx.stroke();
      ctx.fillStyle = col;
      if (w === 'axe') {
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.quadraticCurveTo(9, -len - 2, 8, -len + 8);
        ctx.lineTo(0, -len + 4);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, -len - 3, w === 'club' ? 3 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, color = '#ffd040', r = 1.4) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - gap / 2, y, r, 0, Math.PI * 2);
  ctx.arc(x + gap / 2, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Monster figures, feet at (0,0). `t` is a free-running time for idle motion. */
export function drawMonsterShape(ctx: CanvasRenderingContext2D, shape: string, color: string, pose: Pose, t: number) {
  ctx.save();
  if (pose.dir < 0) ctx.scale(-1, 1);
  const sw = pose.moving ? Math.sin(pose.walk * 3.5) : 0;
  const atk = pose.attack > 0 ? Math.sin(pose.attack * Math.PI) : 0;
  ctx.lineCap = 'round';
  switch (shape) {
    case 'imp':
    case 'hexer': {
      ctx.strokeStyle = shade(color, -0.3);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-3, -12);
      ctx.lineTo(-3 + sw * 4, 0);
      ctx.moveTo(3, -12);
      ctx.lineTo(3 - sw * 4, 0);
      ctx.stroke();
      ctx.strokeStyle = shade(color, -0.2);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, -12);
      ctx.quadraticCurveTo(-14, -10, -13, -20);
      ctx.stroke();
      ctx.fillStyle = shape === 'hexer' ? '#6b3b1a' : color;
      ctx.beginPath();
      ctx.ellipse(0, -18, 7, 9, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(4, -27, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8d8b0';
      ctx.beginPath();
      ctx.moveTo(1, -30);
      ctx.lineTo(-1, -37);
      ctx.lineTo(3, -31);
      ctx.moveTo(6, -31);
      ctx.lineTo(9, -37);
      ctx.lineTo(8, -30);
      ctx.fill();
      eyes(ctx, 5.5, -27, 3.5);
      ctx.strokeStyle = shape === 'hexer' ? '#6a4a2a' : '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(7, -18);
      ctx.lineTo(10 + atk * 6, shape === 'hexer' ? -40 : -24 - atk * 6);
      ctx.stroke();
      if (shape === 'hexer') {
        ctx.fillStyle = '#e8e0c8';
        ctx.beginPath();
        ctx.arc(10, -41, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,140,40,${0.5 + 0.3 * Math.sin(t * 6)})`;
        ctx.beginPath();
        ctx.arc(10, -41, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'ghoul':
    case 'glutton': {
      const big = shape === 'glutton';
      ctx.strokeStyle = shade(color, -0.35);
      ctx.lineWidth = big ? 7 : 4.5;
      ctx.beginPath();
      ctx.moveTo(-4, -14);
      ctx.lineTo(-5 + sw * 4, 0);
      ctx.moveTo(4, -14);
      ctx.lineTo(5 - sw * 4, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      if (big) ctx.ellipse(0, -24, 17, 16, 0, 0, Math.PI * 2);
      else ctx.ellipse(1, -24, 8, 12, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, 0.1);
      ctx.beginPath();
      ctx.arc(big ? 4 : 7, big ? -42 : -35, big ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, big ? 5 : 8.5, big ? -42 : -35, 3.5, '#d0ff60', 1.2);
      ctx.strokeStyle = shade(color, -0.1);
      ctx.lineWidth = big ? 6 : 3.5;
      ctx.beginPath();
      ctx.moveTo(5, -30);
      ctx.lineTo(12 + atk * 8, -14 - atk * 10);
      ctx.stroke();
      if (big) {
        ctx.fillStyle = 'rgba(80,40,20,0.5)';
        ctx.beginPath();
        ctx.ellipse(2, -18, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'skeleton':
    case 'archer':
    case 'warden': {
      const big = shape === 'warden';
      const k = big ? 1.5 : 1;
      ctx.scale(k, k);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-3, -18);
      ctx.lineTo(-3 + sw * 5, 0);
      ctx.moveTo(3, -18);
      ctx.lineTo(3 - sw * 5, 0);
      ctx.moveTo(0, -18);
      ctx.lineTo(0, -36);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-5 + i * 0.4, -33 + i * 4);
        ctx.lineTo(5 - i * 0.4, -33 + i * 4);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -42, 5.5, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, 1, -42, 4, big ? '#60c0ff' : '#ff4020', 1.3);
      if (shape === 'archer') {
        ctx.strokeStyle = '#6b5030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(6, -30, 11, -1.2, 1.2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#9a9aa2';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(5, -30);
        ctx.lineTo(10 + atk * 6, -44 + atk * 18);
        ctx.stroke();
        if (big) {
          ctx.fillStyle = '#5a5048';
          ctx.beginPath();
          ctx.ellipse(-7, -28, 5, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'bat': {
      const flap = Math.sin(t * 18);
      ctx.translate(0, -26 + Math.sin(t * 4) * 3);
      ctx.fillStyle = shade(color, -0.2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-16, -6 - flap * 8);
      ctx.lineTo(-10, 2);
      ctx.lineTo(-5, 1);
      ctx.moveTo(0, 0);
      ctx.lineTo(16, -6 - flap * 8);
      ctx.lineTo(10, 2);
      ctx.lineTo(5, 1);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, 0, -2, 3, '#ff3030', 1);
      break;
    }
    case 'hound': {
      ctx.strokeStyle = shade(color, -0.3);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(-8 + sw * 4, 0);
      ctx.moveTo(-4, -10);
      ctx.lineTo(-4 - sw * 4, 0);
      ctx.moveTo(6, -10);
      ctx.lineTo(6 - sw * 4, 0);
      ctx.moveTo(9, -10);
      ctx.lineTo(9 + sw * 4, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -14, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(14 + atk * 4, -19 + atk * 3, 6, 4.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -16);
      ctx.lineTo(-19, -22);
      ctx.stroke();
      eyes(ctx, 16, -20, 2, '#ff7020', 1.1);
      ctx.fillStyle = `rgba(255,110,30,${0.25 + 0.15 * Math.sin(t * 5)})`;
      ctx.beginPath();
      ctx.ellipse(0, -17, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'brute': {
      ctx.strokeStyle = shade(color, -0.35);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-5, -16);
      ctx.lineTo(-6 + sw * 4, 0);
      ctx.moveTo(5, -16);
      ctx.lineTo(6 - sw * 4, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -28, 13, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.1);
      ctx.beginPath();
      ctx.arc(3, -45, 6, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, 4, -45, 4, '#ffcc30', 1.3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(10, -36);
      ctx.lineTo(15 + atk * 4, -20 - atk * 18);
      ctx.stroke();
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(15 + atk * 4, -20 - atk * 18);
      ctx.lineTo(20 + atk * 14, -38 - atk * 8);
      ctx.stroke();
      break;
    }
    case 'wraith': {
      const bob = Math.sin(t * 3) * 3;
      ctx.translate(0, bob - 6);
      ctx.globalAlpha *= 0.75;
      const g = ctx.createLinearGradient(0, -48, 0, 4);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(120,150,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-9, -36);
      ctx.quadraticCurveTo(0, -56, 9, -36);
      ctx.lineTo(12 + Math.sin(t * 5) * 3, 4);
      ctx.lineTo(0, -4);
      ctx.lineTo(-12 + Math.cos(t * 5) * 3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.ellipse(1, -40, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, 1.5, -41, 3.5, '#bfe8ff', 1.2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, -32);
      ctx.lineTo(14 + atk * 8, -26 - atk * 6);
      ctx.stroke();
      break;
    }
    case 'cultist':
    case 'bishop': {
      const big = shape === 'bishop';
      const look: HumanoidLook = {
        body: color, skin: big ? '#9fb7a8' : '#c9a98a', legs: '#222', head: big ? 'mitre' : 'hood',
        headColor: big ? '#d8d0b0' : shade(color, -0.15), robe: true, weapon: 'staff', weaponColor: big ? '#9fe8ff' : '#c080ff',
        trim: big ? '#c8b060' : undefined,
      };
      drawHumanoid(ctx, look, { ...pose, dir: 1 });
      break;
    }
    case 'scarab': {
      const bob = Math.abs(sw) * 1.5;
      ctx.strokeStyle = shade(color, -0.45);
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5, -7);
        ctx.lineTo(i * 8 + sw * 3, 0);
        ctx.moveTo(i * 5, -7);
        ctx.lineTo(i * 8 - sw * 3, -1);
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(-9, -18, 9, -4);
      g.addColorStop(0, '#d4fbfb');
      g.addColorStop(0.45, color);
      g.addColorStop(1, shade(color, -0.55));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -10 - bob, 10, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -17 - bob);
      ctx.lineTo(0, -3 - bob);
      ctx.stroke();
      ctx.fillStyle = shade(color, -0.5);
      ctx.beginPath();
      ctx.arc(9, -11 - bob, 3.6, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, 10.5, -12 - bob, 2.5, '#ffe860', 0.8);
      break;
    }
    case 'scorpion': {
      ctx.strokeStyle = shade(color, -0.4);
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 4; i++) {
        const x = -8 + i * 5;
        const s = i % 2 ? sw : -sw;
        ctx.beginPath();
        ctx.moveTo(x, -7);
        ctx.lineTo(x - 5, -11);
        ctx.lineTo(x - 7 + s * 3, 0);
        ctx.moveTo(x, -7);
        ctx.lineTo(x + 5, -11);
        ctx.lineTo(x + 7 - s * 3, 0);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(1, -9, 13, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail arcing over the back, striking forward on attack.
      ctx.strokeStyle = shade(color, 0.08);
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(-11, -9);
      ctx.quadraticCurveTo(-26, -20, -17 + atk * 16, -36 + atk * 8);
      ctx.quadraticCurveTo(-11 + atk * 18, -40 + atk * 8, -5 + atk * 22, -32 + atk * 10);
      ctx.stroke();
      ctx.fillStyle = '#d8e070';
      ctx.beginPath();
      ctx.arc(-5 + atk * 22, -31 + atk * 10, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.1);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(11, -9);
      ctx.lineTo(19 + atk * 5, -12);
      ctx.moveTo(19 + atk * 5, -12);
      ctx.lineTo(25 + atk * 5, -8 + atk * 3);
      ctx.moveTo(19 + atk * 5, -12);
      ctx.lineTo(25 + atk * 5, -16 - atk * 3);
      ctx.stroke();
      eyes(ctx, 12, -12, 3, '#ff6030', 0.9);
      break;
    }
    case 'burrower': {
      const up = 1 + atk * 0.25;
      ctx.fillStyle = shade(color, -0.25);
      ctx.beginPath();
      ctx.ellipse(0, -2, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(-13 + sw * 2, -28 * up, 0 + sw * 2, -42 * up);
      ctx.quadraticCurveTo(13 + sw * 2, -28 * up, 12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.4);
      ctx.lineWidth = 1.4;
      for (let i = 1; i < 6; i++) {
        const y = -7 * i * up;
        ctx.beginPath();
        ctx.moveTo(-12 + i * 1.5, y);
        ctx.quadraticCurveTo(0, y + 3, 12 - i * 1.5, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#2a0a08';
      ctx.beginPath();
      ctx.ellipse(1 + sw * 2, -37 * up, 8, 6 + atk * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#efe4c8';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const px = 1 + sw * 2 + Math.cos(a) * 7.5;
        const py = -37 * up + Math.sin(a) * 5.5;
        ctx.beginPath();
        ctx.moveTo(px - 1.5, py);
        ctx.lineTo(1 + sw * 2 + Math.cos(a) * 3.5, -37 * up + Math.sin(a) * 2.5);
        ctx.lineTo(px + 1.5, py);
        ctx.fill();
      }
      break;
    }
    case 'kite': {
      const flap = Math.sin(t * 9);
      ctx.translate(0, -28 + Math.sin(t * 3) * 3);
      ctx.fillStyle = shade(color, -0.25);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(side * 11, -8 - flap * 9);
        ctx.lineTo(side * 25, -4 - flap * 13);
        ctx.lineTo(side * 18, 1 - flap * 7);
        ctx.lineTo(side * 21, 6 - flap * 8);
        ctx.lineTo(side * 11, 4 - flap * 4);
        ctx.lineTo(side * 5, 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c48870';
      ctx.beginPath();
      ctx.arc(4, -10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8c080';
      ctx.beginPath();
      ctx.moveTo(7, -11);
      ctx.lineTo(13 + atk * 3, -8);
      ctx.lineTo(7, -8);
      ctx.fill();
      eyes(ctx, 5, -11, 2.5, '#ff3020', 0.9);
      break;
    }
    case 'mummy': {
      const big = color === '#d8c068';
      ctx.strokeStyle = shade(color, -0.2);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-3, -18);
      ctx.lineTo(-4 + sw * 3, 0);
      ctx.moveTo(3, -18);
      ctx.lineTo(4 - sw * 3, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      roundRect(ctx, -8, -38, 16, 22, 5);
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.4);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 6; i++) {
        const y = -36 + i * 4;
        ctx.beginPath();
        ctx.moveTo(-8, y + (i % 2) * 2);
        ctx.lineTo(8, y + ((i + 1) % 2) * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = shade(color, -0.1);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(7, -34);
      ctx.lineTo(16 + atk * 6, -32 + atk * 7);
      ctx.moveTo(-7, -34);
      ctx.lineTo(-13 + sw * 2, -22);
      ctx.stroke();
      ctx.strokeStyle = shade(color, -0.25);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-12 + sw * 2, -24);
      ctx.lineTo(-15 + Math.sin(t * 4) * 3, -11);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(1, -44, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, -46);
      ctx.lineTo(7, -44);
      ctx.moveTo(-5, -42);
      ctx.lineTo(7, -41);
      ctx.stroke();
      eyes(ctx, 2.5, -45, 3.8, big ? '#ffc840' : '#70e0ff', 1.2);
      if (big) {
        ctx.fillStyle = '#c89a28';
        ctx.beginPath();
        ctx.moveTo(-7, -49);
        ctx.lineTo(-5, -60);
        ctx.lineTo(-1, -53);
        ctx.lineTo(2, -64);
        ctx.lineTo(5, -53);
        ctx.lineTo(9, -60);
        ctx.lineTo(9, -49);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'raider':
    case 'acolyte':
    case 'mirage':
    case 'corvin': {
      const looks: Record<string, HumanoidLook> = {
        raider: { body: color, trim: '#3a2a18', skin: '#a87850', legs: '#4a3a24', head: 'hood', headColor: '#c8b488', weapon: 'bow', weaponColor: '#5a4020' },
        acolyte: { body: color, trim: '#fff0a8', skin: '#b08860', legs: '#222', head: 'mitre', headColor: '#f0c858', robe: true, weapon: 'staff', weaponColor: '#ffe080' },
        mirage: { body: color, trim: '#ff8040', skin: '#d8b078', legs: '#222', head: 'hood', headColor: '#e8c070', robe: true, weapon: 'wand', weaponColor: '#ffe0a0' },
        corvin: { body: '#4a5068', trim: '#c8b060', skin: '#d8b898', legs: '#222', head: 'hair', headColor: '#e8e8e8', robe: true, weapon: 'staff', weaponColor: '#a0d8ff' },
      };
      drawHumanoid(ctx, looks[shape], { ...pose, dir: 1 });
      break;
    }
    case 'colossus': {
      ctx.strokeStyle = shade(color, -0.35);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-6, -16);
      ctx.lineTo(-7 + sw * 3, 0);
      ctx.moveTo(6, -16);
      ctx.lineTo(7 - sw * 3, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-15, -38);
      ctx.lineTo(-11, -14);
      ctx.lineTo(12, -13);
      ctx.lineTo(16, -40);
      ctx.lineTo(4, -47);
      ctx.lineTo(-7, -46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(color, -0.18);
      ctx.beginPath();
      ctx.moveTo(1, -42);
      ctx.lineTo(13, -38);
      ctx.lineTo(10, -16);
      ctx.lineTo(1, -18);
      ctx.closePath();
      ctx.fill();
      // Salt crystals growing out of the shoulders.
      ctx.fillStyle = '#f6f4ec';
      for (const [x, h] of [[-13, 15], [-8, 22], [13, 18], [8, 13]] as const) {
        ctx.beginPath();
        ctx.moveTo(x - 4, -41);
        ctx.lineTo(x, -41 - h);
        ctx.lineTo(x + 4, -41);
        ctx.fill();
      }
      eyes(ctx, 3, -40, 6, '#60d8ff', 1.5);
      ctx.strokeStyle = shade(color, -0.1);
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(14, -36);
      ctx.lineTo(21 + atk * 2, -14 - atk * 26);
      ctx.moveTo(-14, -36);
      ctx.lineTo(-20, -14 - atk * 26);
      ctx.stroke();
      break;
    }
    case 'noon': {
      // Corvane's true form: a robed figure hanging under a burning halo.
      const lift = 8 + Math.sin(t * 2) * 2;
      ctx.translate(0, -lift);
      const glow = ctx.createRadialGradient(0, -44, 2, 0, -44, 38);
      glow.addColorStop(0, 'rgba(255,240,180,0.85)');
      glow.addColorStop(0.45, 'rgba(255,170,50,0.32)');
      glow.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-40, -84, 80, 80);
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 13, -44 + Math.sin(a) * 13);
        ctx.lineTo(Math.cos(a) * (i % 2 ? 19 : 25), -44 + Math.sin(a) * (i % 2 ? 19 : 25));
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-8, -36);
      ctx.lineTo(8, -36);
      ctx.lineTo(13, 2);
      ctx.lineTo(5, -3);
      ctx.lineTo(0, 4);
      ctx.lineTo(-5, -3);
      ctx.lineTo(-13, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1208';
      ctx.beginPath();
      ctx.arc(0, -44, 8, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, 0, -44, 5, '#fff6c0', 1.6);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(7, -33);
      ctx.lineTo(18 + atk * 8, -26 - atk * 18);
      ctx.moveTo(-7, -33);
      ctx.lineTo(-18 - atk * 8, -26 - atk * 18);
      ctx.stroke();
      break;
    }
    case 'mother': {
      const breathe = Math.sin(t * 2) * 1.5;
      ctx.fillStyle = shade(color, -0.4);
      ctx.beginPath();
      ctx.moveTo(-6, -34);
      ctx.lineTo(-30, -50 - Math.sin(t * 2.5) * 4);
      ctx.lineTo(-24, -26);
      ctx.lineTo(-14, -30);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, -34);
      ctx.lineTo(28, -52 - Math.sin(t * 2.5) * 4);
      ctx.lineTo(24, -28);
      ctx.lineTo(14, -30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.3);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-5, -14);
      ctx.lineTo(-7 + sw * 4, 0);
      ctx.moveTo(5, -14);
      ctx.lineTo(7 - sw * 4, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -26 - breathe, 11, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(0, -24, 0, 0, -24, 8);
      g.addColorStop(0, '#fff2a0');
      g.addColorStop(0.5, '#ff8a20');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -24, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, 0.05);
      ctx.beginPath();
      ctx.arc(2, -46 - breathe, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath();
      ctx.moveTo(-2, -50);
      ctx.quadraticCurveTo(-10, -58, -6, -64);
      ctx.lineTo(-1, -52);
      ctx.moveTo(6, -50);
      ctx.quadraticCurveTo(14, -58, 10, -64);
      ctx.lineTo(5, -52);
      ctx.fill();
      eyes(ctx, 3, -46 - breathe, 4, '#ffee60', 1.4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(9, -34);
      ctx.lineTo(18 + atk * 6, -20 - atk * 14);
      ctx.moveTo(-9, -34);
      ctx.lineTo(-16, -20);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (k >= 0) {
    r += (255 - r) * k;
    g += (255 - g) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    g *= 1 + k;
    b *= 1 + k;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
