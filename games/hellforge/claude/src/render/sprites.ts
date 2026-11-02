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
  } else if (theme === 'chapel' || theme === 'crypt' || theme === 'hell') {
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
  if (theme === 'hell' && v % 3 === 0) {
    ctx.strokeStyle = '#ff5a10';
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
