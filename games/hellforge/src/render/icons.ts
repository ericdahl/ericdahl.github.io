import { baseOf, type BaseItem, type Item } from '../game/items';
import { SKILL_BY_ID } from '../game/skills';

const CELL = 28;
const cache = new Map<string, string>();
const canvasCache = new Map<string, HTMLCanvasElement>();

const GEM_COLORS: Record<string, string> = {
  ruby: '#e0283a', sapphire: '#2f6bff', topaz: '#ffc928', emerald: '#2fcf5a', amethyst: '#b04ae8', diamond: '#e8f4ff', skull: '#d8d0b8',
};

function metal(b: BaseItem): string {
  if (b.qlvl >= 15) return '#c9ccd6';
  if (b.qlvl >= 8) return '#a8a8b0';
  return '#8e8a80';
}

function paint(ctx: CanvasRenderingContext2D, b: BaseItem, w: number, h: number) {
  const W = w * CELL;
  const H = h * CELL;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const m = metal(b);
  switch (b.kind) {
    case 'weapon': {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 4 * (w > 1 ? 0.6 : 0));
      const L = H * 0.9;
      if (b.cat === 'bow') {
        ctx.strokeStyle = '#8a5f35';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(-W * 0.55, 0, L * 0.62, -0.9, 0.9);
        ctx.stroke();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-W * 0.55 + Math.cos(-0.9) * L * 0.62, Math.sin(-0.9) * L * 0.62);
        ctx.lineTo(-W * 0.55 + Math.cos(0.9) * L * 0.62, Math.sin(0.9) * L * 0.62);
        ctx.stroke();
      } else if (b.cat === 'staff' || b.cat === 'wand') {
        ctx.strokeStyle = b.cat === 'wand' ? '#d9ceb2' : '#7a5530';
        ctx.lineWidth = b.cat === 'wand' ? 4 : 5;
        ctx.beginPath();
        ctx.moveTo(0, L / 2);
        ctx.lineTo(0, -L / 2 + 6);
        ctx.stroke();
        ctx.fillStyle = b.cat === 'wand' ? '#e8e0c8' : '#6fb8ff';
        ctx.beginPath();
        ctx.arc(0, -L / 2 + 5, b.cat === 'wand' ? 4 : 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#5a4028';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, L / 2);
        ctx.lineTo(0, L / 2 - L * 0.28);
        ctx.stroke();
        if (b.cat === 'sword' || b.cat === 'dagger') {
          ctx.strokeStyle = '#b09048';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-8, L / 2 - L * 0.28);
          ctx.lineTo(8, L / 2 - L * 0.28);
          ctx.stroke();
          ctx.fillStyle = m;
          ctx.beginPath();
          ctx.moveTo(-4, L / 2 - L * 0.3);
          ctx.lineTo(-3.5, -L / 2 + 6);
          ctx.lineTo(0, -L / 2);
          ctx.lineTo(3.5, -L / 2 + 6);
          ctx.lineTo(4, L / 2 - L * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, L / 2 - L * 0.32);
          ctx.lineTo(0, -L / 2 + 4);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#6a4a2a';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, L / 2);
          ctx.lineTo(0, -L / 2 + 4);
          ctx.stroke();
          ctx.fillStyle = m;
          if (b.cat === 'axe') {
            ctx.beginPath();
            ctx.moveTo(0, -L / 2 + 4);
            ctx.quadraticCurveTo(W * 0.55, -L / 2, W * 0.45, -L / 2 + L * 0.35);
            ctx.lineTo(0, -L / 2 + L * 0.25);
            ctx.fill();
            if (b.twoHanded) {
              ctx.beginPath();
              ctx.moveTo(0, -L / 2 + 4);
              ctx.quadraticCurveTo(-W * 0.55, -L / 2, -W * 0.45, -L / 2 + L * 0.35);
              ctx.lineTo(0, -L / 2 + L * 0.25);
              ctx.fill();
            }
          } else {
            if (b.twoHanded) {
              // Hammers: a square head across the haft.
              ctx.fillStyle = b.id === 'obsidian_maul' ? '#3a3440' : m;
              ctx.fillRect(-W * 0.36, -L / 2 + 1, W * 0.72, L * 0.2);
              ctx.fillStyle = 'rgba(255,255,255,0.25)';
              ctx.fillRect(-W * 0.36, -L / 2 + 1, W * 0.72, 3);
              ctx.fillStyle = 'rgba(0,0,0,0.35)';
              ctx.fillRect(-3, -L / 2 + 1, 6, L * 0.2);
              ctx.restore();
              break;
            }
            ctx.beginPath();
            ctx.arc(0, -L / 2 + 8, b.id === 'club' ? 6 : 8, 0, Math.PI * 2);
            ctx.fill();
            if (b.id === 'morning_star') {
              ctx.strokeStyle = m;
              ctx.lineWidth = 2;
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 8, -L / 2 + 8 + Math.sin(a) * 8);
                ctx.lineTo(Math.cos(a) * 12, -L / 2 + 8 + Math.sin(a) * 12);
                ctx.stroke();
              }
            }
          }
        }
      }
      ctx.restore();
      break;
    }
    case 'armor': {
      const col = b.qlvl >= 11 ? m : b.qlvl >= 3 ? '#7a5634' : '#b5a27a';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(W * 0.2, H * 0.12);
      ctx.lineTo(W * 0.38, H * 0.06);
      ctx.lineTo(W * 0.5, H * 0.14);
      ctx.lineTo(W * 0.62, H * 0.06);
      ctx.lineTo(W * 0.8, H * 0.12);
      ctx.lineTo(W * 0.95, H * 0.42);
      ctx.lineTo(W * 0.8, H * 0.46);
      ctx.lineTo(W * 0.78, H * 0.92);
      ctx.lineTo(W * 0.22, H * 0.92);
      ctx.lineTo(W * 0.2, H * 0.46);
      ctx.lineTo(W * 0.05, H * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.24, H * (0.2 + i * 0.14));
        ctx.lineTo(W * 0.76, H * (0.2 + i * 0.14));
        ctx.stroke();
      }
      break;
    }
    case 'helm': {
      ctx.fillStyle = b.id === 'cap' ? '#8a6a44' : b.id === 'circlet' ? '#d8b850' : m;
      if (b.id === 'circlet') {
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#d8b850';
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.55, W * 0.36, H * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#5fb8ff';
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.36, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.62, W * 0.36, Math.PI, 0);
      ctx.lineTo(W * 0.86, H * 0.78);
      ctx.lineTo(W * 0.14, H * 0.78);
      ctx.closePath();
      ctx.fill();
      if (b.qlvl >= 11) {
        ctx.fillStyle = '#111';
        ctx.fillRect(W * 0.3, H * 0.56, W * 0.4, 4);
      }
      break;
    }
    case 'shield': {
      ctx.fillStyle = b.qlvl >= 11 ? m : '#7a5634';
      ctx.beginPath();
      if (b.id === 'buckler' || b.id === 'small_shield') ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.4, 0, Math.PI * 2);
      else {
        ctx.moveTo(W * 0.12, H * 0.1);
        ctx.lineTo(W * 0.88, H * 0.1);
        ctx.lineTo(W * 0.85, H * 0.6);
        ctx.lineTo(W * 0.5, H * 0.94);
        ctx.lineTo(W * 0.15, H * 0.6);
        ctx.closePath();
      }
      ctx.fill();
      ctx.strokeStyle = '#c8a858';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#c8a858';
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.45, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'gloves': {
      ctx.fillStyle = b.qlvl >= 12 ? m : '#7a5634';
      roundRectPath(ctx, W * 0.25, H * 0.35, W * 0.5, H * 0.55, 6);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        roundRectPath(ctx, W * 0.26 + i * W * 0.12, H * 0.12, W * 0.1, H * 0.3, 3);
        ctx.fill();
      }
      roundRectPath(ctx, W * 0.1, H * 0.42, W * 0.18, H * 0.12, 3);
      ctx.fill();
      break;
    }
    case 'boots': {
      ctx.fillStyle = b.qlvl >= 12 ? m : '#6a4a2c';
      ctx.beginPath();
      ctx.moveTo(W * 0.3, H * 0.1);
      ctx.lineTo(W * 0.62, H * 0.1);
      ctx.lineTo(W * 0.62, H * 0.62);
      ctx.lineTo(W * 0.92, H * 0.74);
      ctx.lineTo(W * 0.92, H * 0.9);
      ctx.lineTo(W * 0.3, H * 0.9);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'belt': {
      ctx.fillStyle = b.qlvl >= 12 ? m : '#7a5634';
      ctx.fillRect(2, H * 0.3, W - 4, H * 0.4);
      ctx.strokeStyle = '#d8b850';
      ctx.lineWidth = 3;
      ctx.strokeRect(W / 2 - 7, H * 0.24, 14, H * 0.52);
      break;
    }
    case 'ring': {
      ctx.strokeStyle = '#d8b850';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.58, W * 0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#6fd0ff';
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.28, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'amulet': {
      ctx.strokeStyle = '#d8b850';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.2, H * 0.1);
      ctx.lineTo(W / 2, H * 0.55);
      ctx.lineTo(W * 0.8, H * 0.1);
      ctx.stroke();
      ctx.fillStyle = '#e06030';
      ctx.beginPath();
      ctx.moveTo(W / 2, H * 0.45);
      ctx.lineTo(W * 0.68, H * 0.68);
      ctx.lineTo(W / 2, H * 0.92);
      ctx.lineTo(W * 0.32, H * 0.68);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'potion': {
      const t = b.potion!.type;
      const col = t === 'hp' ? '#d0202a' : t === 'mp' ? '#2a4ad8' : '#9a30c8';
      const tier = Number(b.id.replace(/\D/g, '')) || 3;
      const r = W * (0.18 + tier * 0.025);
      ctx.fillStyle = 'rgba(220,230,240,0.35)';
      ctx.fillRect(W / 2 - 3, H * 0.12, 6, H * 0.25);
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(W / 2 - 3.5, H * 0.08, 7, 4);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.62, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(W / 2 - r * 0.35, H * 0.62 - r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'gem': {
      const g = b.gem!;
      const col = GEM_COLORS[g.type];
      const r = W * (0.16 + g.grade * 0.045);
      ctx.fillStyle = col;
      if (g.type === 'skull') {
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.46, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(W / 2 - r * 0.6, H * 0.46, r * 1.2, r * 1.1);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(W / 2 - r * 0.4, H * 0.48, r * 0.25, 0, Math.PI * 2);
        ctx.arc(W / 2 + r * 0.4, H * 0.48, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      ctx.beginPath();
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2 - r);
      ctx.lineTo(W / 2 + r * 0.5, H / 2 - r * 0.2);
      ctx.lineTo(W / 2 - r * 0.2, H / 2);
      ctx.fill();
      break;
    }
    case 'scroll': {
      ctx.fillStyle = '#d8c89a';
      ctx.fillRect(W * 0.2, H * 0.22, W * 0.6, H * 0.56);
      ctx.fillStyle = '#8a7650';
      ctx.fillRect(W * 0.14, H * 0.18, W * 0.72, 4);
      ctx.fillRect(W * 0.14, H * 0.76, W * 0.72, 4);
      ctx.fillStyle = '#3a6ad8';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function baseIconCanvas(baseId: string): HTMLCanvasElement {
  const hit = canvasCache.get(baseId);
  if (hit) return hit;
  const b = baseOf(baseId);
  const c = document.createElement('canvas');
  c.width = b.w * CELL * 2;
  c.height = b.h * CELL * 2;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  paint(ctx, b, b.w, b.h);
  canvasCache.set(baseId, c);
  return c;
}

export function baseIconUrl(baseId: string): string {
  const hit = cache.get(baseId);
  if (hit) return hit;
  const url = baseIconCanvas(baseId).toDataURL();
  cache.set(baseId, url);
  return url;
}

export function itemIconUrl(item: Item): string {
  return baseIconUrl(item.base);
}

const skillCache = new Map<string, string>();
export function skillIconUrl(id: string): string {
  const hit = skillCache.get(id);
  if (hit) return hit;
  const s = SKILL_BY_ID[id];
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(48, 40, 6, 48, 48, 60);
  g.addColorStop(0, s.color);
  g.addColorStop(1, '#120c08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = '#6a5a3a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 90, 90);
  ctx.fillStyle = '#fff';
  ctx.font = '48px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 6;
  ctx.fillText(s.glyph, 48, 52);
  const url = c.toDataURL();
  skillCache.set(id, url);
  return url;
}
