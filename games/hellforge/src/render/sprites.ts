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
  // Act 3: snow over the old camp, the pass, blue mine ice, the founders' bronze and soot, and the dead forge.
  snowtown: { floor: ['#b4bcc6', '#aab3be', '#bcc4cd', '#a2abb7'], speck: ['#d8dee6', '#8a94a2', '#5a5448', '#e8eef4'], wallTop: '#c8d0da', wallL: '#6a707c', wallR: '#4c525e' },
  snow: { floor: ['#c2cad4', '#b8c1cc', '#cad2db', '#b0bac6'], speck: ['#e6ecf2', '#98a4b4', '#f4f8fc'], wallTop: '#d0d8e2', wallL: '#74808e', wallR: '#566270' },
  icemine: { floor: ['#2c3e4c', '#283947', '#304452', '#243442'], speck: ['#40586a', '#1a2732', '#6a98b4'], wallTop: '#4a6a80', wallL: '#324a5c', wallR: '#223544', cracks: '#a8e0ff' },
  foundry: { floor: ['#3a3430', '#35302c', '#3f3934', '#302b28'], speck: ['#4c443c', '#221e1c', '#7a5a30'], wallTop: '#6a5638', wallL: '#4a3c28', wallR: '#34291c', grid: '#231f1c' },
  furnace: { floor: ['#2a2a30', '#26262c', '#2e2e35', '#222228'], speck: ['#3a3a44', '#16161a', '#4a5a70'], wallTop: '#3e3e4a', wallL: '#2c2c36', wallR: '#1e1e26', grid: '#18181c', cracks: '#5a8ab8' },
  heart: { floor: ['#2c2024', '#281c20', '#302328', '#24191c'], speck: ['#3c2a30', '#160e10', '#5a6a88'], wallTop: '#3a2a30', wallL: '#2a1c22', wallR: '#1c1216', cracks: '#7ab0e8' },
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
  if (theme === 'snow' || theme === 'snowtown') {
    // Wind-packed drifts, and a few glints where the crust catches the light.
    ctx.strokeStyle = 'rgba(70,90,120,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = rng.range(6, TILE_H - 6);
      ctx.beginPath();
      ctx.moveTo(rng.range(4, 20), y);
      ctx.quadraticCurveTo(TILE_W / 2, y + rng.range(2, 5), TILE_W - rng.range(4, 20), y + rng.range(-2, 2));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 5; i++) ctx.fillRect(rng.range(6, TILE_W - 6), rng.range(4, TILE_H - 4), 1, 1);
    if (theme === 'snowtown' && v % 2) {
      // Trodden paths: the camp still walks here.
      ctx.fillStyle = 'rgba(70,62,50,0.22)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(rng.range(14, TILE_W - 14), rng.range(8, TILE_H - 8), rng.range(3, 6), rng.range(1.5, 3), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (theme === 'icemine') {
    // A skin of ice over the stone.
    const g = ctx.createLinearGradient(0, 0, TILE_W, TILE_H);
    g.addColorStop(0, 'rgba(170,220,255,0.16)');
    g.addColorStop(0.5, 'rgba(170,220,255,0)');
    g.addColorStop(1, 'rgba(170,220,255,0.1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE_W, TILE_H);
  }
  if (theme === 'furnace' || theme === 'heart' || theme === 'foundry') {
    // Hoarfrost creeping in from the tile edges.
    ctx.fillStyle = theme === 'foundry' ? 'rgba(200,220,240,0.1)' : 'rgba(190,220,250,0.17)';
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0.72, 1);
      ctx.beginPath();
      ctx.ellipse(TILE_W / 2 + Math.cos(a) * (TILE_W / 2) * d * 0.9, TILE_H / 2 + Math.sin(a) * (TILE_H / 2) * d * 0.9, rng.range(2, 6), rng.range(1, 3), 0, 0, Math.PI * 2);
      ctx.fill();
    }
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
  } else if (theme === 'chapel' || theme === 'crypt' || theme === 'hell' || theme === 'cistern' || theme === 'ruins' || theme === 'vault' || theme === 'foundry' || theme === 'furnace' || theme === 'heart') {
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
  if (theme === 'foundry') {
    // A bronze band along the top of every course, gone green at the rivets.
    ctx.strokeStyle = '#b08a48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, T / 2 + 5);
    ctx.lineTo(W / 2, T + 5);
    ctx.lineTo(W, T / 2 + 5);
    ctx.stroke();
    ctx.fillStyle = '#5a8a6a';
    for (let i = 0; i < 4; i++) ctx.fillRect(6 + i * 9, T / 2 + 4 + (i < 2 ? i * 4.5 : 0) + (i >= 2 ? 9 + (i - 2) * 4.5 : 0), 1.6, 1.6);
  }
  if (theme === 'icemine' || theme === 'furnace' || theme === 'heart' || theme === 'foundry') {
    // Icicles hanging from the top edge, and frost on the stone below it.
    ctx.fillStyle = theme === 'foundry' ? 'rgba(200,225,245,0.45)' : 'rgba(190,225,250,0.7)';
    const n = theme === 'foundry' ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const x = rng.range(3, W - 3);
      const yTop = (x < W / 2 ? T / 2 + (x / (W / 2)) * (T / 2) : T - ((x - W / 2) / (W / 2)) * (T / 2)) + 0.5;
      const len = rng.range(5, 15);
      ctx.beginPath();
      ctx.moveTo(x - 1.6, yTop);
      ctx.lineTo(x, yTop + len);
      ctx.lineTo(x + 1.6, yTop);
      ctx.fill();
    }
  }
  if ((theme === 'heart' || theme === 'furnace') && v % 3 === 0) {
    // The forge's old fire-cracks, glowing cold now.
    ctx.strokeStyle = '#7ab0e8';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(W * 0.3, T / 2 + 12);
    ctx.lineTo(W * 0.22, T / 2 + 24);
    ctx.lineTo(W * 0.28, T / 2 + 36);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
  if (theme === 'snow' || theme === 'snowtown') {
    drawSnowObstacle(ctx, theme, v, rng, bx, by);
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

/** Rimefall Pass and the ruined camp: pines bowed under snow, iced boulders, and what is left of the palisade. */
function drawSnowObstacle(ctx: CanvasRenderingContext2D, theme: 'snow' | 'snowtown', v: number, rng: Rng, bx: number, by: number) {
  ctx.fillStyle = 'rgba(40,56,80,0.28)';
  ctx.beginPath();
  ctx.ellipse(bx, by, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  if (theme === 'snowtown' && v % 2 === 0) {
    // Burnt palisade stakes: the camp fed its wall to the fire, one stake at a time.
    for (let i = 0; i < 4; i++) {
      const x = bx - 18 + i * 12 + rng.range(-2, 2);
      const h = rng.range(8, 30);
      const g = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
      g.addColorStop(0, '#3a2c22');
      g.addColorStop(1, '#14100c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 4, by + 2);
      ctx.lineTo(x - 4, by - h);
      ctx.lineTo(x - 1 + rng.range(-1, 1), by - h - rng.range(3, 8));
      ctx.lineTo(x + 2, by - h + 1);
      ctx.lineTo(x + 4, by - h - rng.range(0, 4));
      ctx.lineTo(x + 4, by + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e4eaf2';
      ctx.beginPath();
      ctx.ellipse(x, by + 2, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (v % 3 === 0) {
    // A boulder with a cap of snow and a beard of ice.
    const g = ctx.createLinearGradient(bx - 22, by - 40, bx + 22, by);
    g.addColorStop(0, '#8a94a2');
    g.addColorStop(1, '#3c4450');
    ctx.fillStyle = g;
    const top = 30 + rng.range(0, 12);
    ctx.beginPath();
    ctx.moveTo(bx - 25, by + 2);
    ctx.lineTo(bx - 20, by - top * 0.7);
    ctx.lineTo(bx - 5, by - top);
    ctx.lineTo(bx + 14, by - top * 0.8);
    ctx.lineTo(bx + 25, by - 5);
    ctx.lineTo(bx + 13, by + 5);
    ctx.lineTo(bx - 14, by + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eef3f8';
    ctx.beginPath();
    ctx.moveTo(bx - 21, by - top * 0.62);
    ctx.lineTo(bx - 5, by - top - 2);
    ctx.lineTo(bx + 15, by - top * 0.8 - 1);
    ctx.quadraticCurveTo(bx + 10, by - top * 0.6, bx + 2, by - top * 0.7);
    ctx.quadraticCurveTo(bx - 8, by - top * 0.5, bx - 21, by - top * 0.62);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,250,0.8)';
    for (let i = 0; i < 4; i++) {
      const x = bx - 12 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x - 1.5, by - top * 0.5);
      ctx.lineTo(x, by - top * 0.5 + rng.range(6, 14));
      ctx.lineTo(x + 1.5, by - top * 0.5);
      ctx.fill();
    }
    return;
  }
  // A pine, each tier weighed down with snow.
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(bx - 3, by - 26, 6, 26);
  for (let i = 0; i < 4; i++) {
    const y = by - 22 - i * 18;
    const w = 29 - i * 6 + rng.range(-3, 3);
    ctx.fillStyle = i % 2 ? '#1e3028' : '#243a30';
    ctx.beginPath();
    ctx.moveTo(bx - w, y + 3);
    ctx.lineTo(bx, y - 28);
    ctx.lineTo(bx + w, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8eef5';
    ctx.beginPath();
    ctx.moveTo(bx, y - 29);
    ctx.lineTo(bx + w * 0.72, y - 3);
    ctx.quadraticCurveTo(bx + w * 0.3, y - 9, bx + 2, y - 4);
    ctx.quadraticCurveTo(bx - w * 0.3, y - 10, bx - w * 0.66, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(140,170,210,0.35)';
    ctx.beginPath();
    ctx.moveTo(bx, y - 29);
    ctx.lineTo(bx - w * 0.66, y - 4);
    ctx.quadraticCurveTo(bx - w * 0.3, y - 10, bx - 1, y - 8);
    ctx.closePath();
    ctx.fill();
  }
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

export { shade } from './figures';
