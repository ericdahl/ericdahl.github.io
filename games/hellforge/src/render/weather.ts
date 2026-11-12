import { isWalkable } from '../game/map';
import type { World } from '../game/world';
import type { Camera } from './camera';

/**
 * Per-area atmosphere: drifting ash and embers, fog banks, falling leaves, cave drips and dust,
 * plus screen-edge vignettes when chilled, poisoned or close to death. Particles live in world
 * space around the player so they move with the ground, and fade outside the light radius.
 */

type Kind = 'ash' | 'ember' | 'fog' | 'leaf' | 'drip' | 'dust' | 'splash' | 'sand' | 'glint' | 'snow' | 'frost';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  /** Height above the ground in screen pixels (at zoom 1). */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  life: number;
  size: number;
  rot: number;
}

/** Particles per second for each kind, by area theme. */
const RATES: Record<string, Partial<Record<Kind, number>>> = {
  town: { ember: 2.5, ash: 1.5 },
  fields: { ash: 14, ember: 3, fog: 0.25 },
  forest: { leaf: 5, fog: 1.2, dust: 2 },
  cave: { drip: 1.4, dust: 4 },
  chapel: { drip: 1, fog: 0.5, dust: 3 },
  crypt: { dust: 6, fog: 0.3 },
  hell: { ember: 16, ash: 8 },
  oasis: { ash: 2, sand: 2, dust: 2 },
  desert: { sand: 11, ash: 4 },
  glass: { glint: 9, sand: 5, ash: 3 },
  mesa: { sand: 8, dust: 4 },
  cistern: { drip: 2, fog: 0.6, dust: 2 },
  ruins: { dust: 8, sand: 1.5 },
  vault: { ember: 9, glint: 5, dust: 3 },
  snowtown: { snow: 16, ember: 2, fog: 0.3 },
  snow: { snow: 24, fog: 0.9, glint: 2 },
  icemine: { drip: 1.2, frost: 5, fog: 0.5, glint: 3 },
  foundry: { dust: 5, frost: 3, snow: 2 },
  furnace: { frost: 7, snow: 4, fog: 0.5 },
  heart: { snow: 12, frost: 6, ember: 1.5 },
};

const MAX = 220;

let ember: HTMLCanvasElement | null = null;
/** A pre-rendered glowing spark, scaled and faded per particle (cheaper than a gradient each). */
function emberSprite(): HTMLCanvasElement {
  if (ember) return ember;
  ember = document.createElement('canvas');
  ember.width = ember.height = 32;
  const c = ember.getContext('2d')!;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,220,140,1)');
  g.addColorStop(0.35, 'rgba(255,110,30,0.6)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  return ember;
}

export class Weather {
  private ps: Particle[] = [];
  private acc: Partial<Record<Kind, number>> = {};
  private theme = '';
  private time = 0;

  update(w: World, dt: number) {
    this.time += dt;
    const theme = w.area.level.theme;
    if (theme !== this.theme) {
      this.theme = theme;
      this.ps = [];
      this.acc = {};
      // Start with the air already full rather than everything spawning at once.
      for (let i = 0; i < 40; i++) this.spawnAll(w, 0.25, true);
    }
    this.spawnAll(w, dt, false);
    const p = w.player;
    const l = w.area.level;
    for (const q of this.ps) {
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.rot += dt * (q.kind === 'leaf' ? 3 : 0.5);
      if (q.kind === 'leaf') q.vx += Math.sin(this.time * 2 + q.rot) * dt * 0.6;
      if (q.kind === 'drip' && q.z <= 0) {
        q.t = q.life;
        if (isWalkable(l, q.x, q.y)) this.ps.push({ kind: 'splash', x: q.x, y: q.y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 0.45, size: 1, rot: 0 });
      }
      if (q.kind === 'snow') q.vx += Math.sin(this.time * 1.7 + q.rot) * dt * 0.5;
      if (q.kind === 'snow' && q.z <= 0) q.t = q.life;
      if ((q.kind === 'ash' || q.kind === 'leaf') && q.z <= 0) {
        q.z = 0;
        q.vx = q.vy = q.vz = 0;
      }
      // Recycle anything that drifted far from the player.
      if (Math.abs(q.x - p.x) > 14 || Math.abs(q.y - p.y) > 14) q.t = q.life;
    }
    this.ps = this.ps.filter((q) => q.t < q.life);
  }

  private spawnAll(w: World, dt: number, warm: boolean) {
    const rates = RATES[this.theme];
    if (!rates) return;
    for (const [kind, rate] of Object.entries(rates) as [Kind, number][]) {
      const stormy = kind === 'sand' ? 1 + w.storm * 9 : kind === 'snow' ? 1 + w.storm * 5 : 1;
      this.acc[kind] = (this.acc[kind] ?? 0) + rate * stormy * dt;
      while (this.acc[kind]! >= 1) {
        this.acc[kind]! -= 1;
        if (this.ps.length < MAX) this.spawn(w, kind, warm);
      }
    }
  }

  private spawn(w: World, kind: Kind, warm: boolean) {
    const p = w.player;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    let x = p.x + r(-11, 11);
    let y = p.y + r(-11, 11);
    // Ground-level effects only over floor, not the void around the map.
    if (kind === 'fog' || kind === 'dust' || kind === 'drip') {
      const span = kind === 'drip' ? 7 : 11;
      for (let i = 0; i < 6 && !isWalkable(w.area.level, x, y); i++) (x = p.x + r(-span, span)), (y = p.y + r(-span, span));
      if (!isWalkable(w.area.level, x, y)) return;
    }
    const q: Particle = { kind, x, y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 6, size: 1, rot: r(0, 6.3) };
    switch (kind) {
      case 'ash':
        Object.assign(q, { z: r(80, 220), vx: r(0.3, 0.9), vy: r(-0.2, 0.3), vz: -r(14, 26), life: r(9, 14), size: r(1, 2.2) });
        break;
      case 'ember':
        Object.assign(q, { z: r(0, 30), vx: r(-0.3, 0.6), vy: r(-0.4, 0.2), vz: r(18, 40), life: r(3, 6), size: r(1, 2.2) });
        break;
      case 'fog':
        Object.assign(q, { z: r(4, 20), vx: r(0.15, 0.35), vy: r(-0.1, 0.1), life: r(14, 22), size: r(2.5, 4.5) });
        break;
      case 'leaf':
        Object.assign(q, { z: r(90, 200), vx: r(0.2, 0.7), vy: r(0, 0.4), vz: -r(18, 30), life: r(10, 14), size: r(3.5, 5) });
        break;
      case 'drip':
        Object.assign(q, { z: r(140, 200), vz: -320, life: 2, size: 1 });
        break;
      case 'sand': {
        const gust = 1 + w.storm * 2.5;
        Object.assign(q, { z: r(3, 60), vx: r(1.6, 3) * gust, vy: r(-0.7, 0) * gust, vz: r(-3, 3), life: r(2, 3.6), size: r(1, 2) });
        break;
      }
      case 'glint':
        Object.assign(q, { z: r(0, 16), life: r(0.5, 1.2), size: r(1.5, 3.5) });
        break;
      case 'snow': {
        // Flakes fall slantwise; a whiteout drives them nearly flat.
        const gust = 1 + w.storm * 4;
        Object.assign(q, { z: r(60, 230), vx: r(0.3, 1) * gust, vy: r(-0.3, 0.2) * gust, vz: -r(26, 48), life: r(5, 8), size: r(1.2, 2.8) });
        break;
      }
      case 'frost':
        // Motes of ice hanging in still air.
        Object.assign(q, { z: r(6, 80), vx: r(-0.06, 0.06), vy: r(-0.06, 0.06), vz: r(-3, 1), life: r(4, 8), size: r(0.8, 1.7) });
        break;
      case 'dust':
        Object.assign(q, { z: r(10, 70), vx: r(-0.08, 0.08), vy: r(-0.08, 0.08), vz: r(-2, 2), life: r(6, 10), size: r(0.8, 1.6) });
        break;
    }
    if (warm) q.t = r(0, q.life * 0.8);
    this.ps.push(q);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, w: World) {
    const z = cam.zoom;
    const p = w.player;
    const light = w.area.def.light;
    ctx.save();
    for (const q of this.ps) {
      const s = cam.toScreen(q.x, q.y);
      const sy = s.y - q.z * z;
      // Fade in and out over the particle's life, and with distance from the player's light.
      const k = q.t / q.life;
      const life = Math.min(1, k * 6, (1 - k) * 4);
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      const lit = q.kind === 'ember' ? 1 : Math.max(0, Math.min(1, 1.3 - dist / light));
      const a = life * lit;
      if (a <= 0.01) continue;
      switch (q.kind) {
        case 'ash':
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(190,180,170,${0.55 * a})`;
          ctx.fillRect(s.x, sy, q.size * z, q.size * z);
          break;
        case 'snow':
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(240,246,255,${0.85 * a})`;
          ctx.beginPath();
          ctx.arc(s.x, sy, q.size * 0.6 * z, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'frost':
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(190,225,255,${0.5 * a * (0.5 + 0.5 * Math.sin(this.time * 3 + q.rot * 4))})`;
          ctx.fillRect(s.x, sy, q.size * z, q.size * z);
          break;
        case 'sand':
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = `rgba(226,196,146,${0.55 * a})`;
          ctx.lineWidth = q.size * 0.7 * z;
          ctx.beginPath();
          ctx.moveTo(s.x, sy);
          ctx.lineTo(s.x - q.vx * 3.2 * z, sy - q.vy * 1.6 * z);
          ctx.stroke();
          break;
        case 'glint': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(220,255,255,${0.9 * Math.sin(k * Math.PI) * lit})`;
          ctx.lineWidth = 1 * z;
          const g = q.size * Math.sin(k * Math.PI) * 2.4 * z;
          ctx.beginPath();
          ctx.moveTo(s.x - g, sy);
          ctx.lineTo(s.x + g, sy);
          ctx.moveTo(s.x, sy - g);
          ctx.lineTo(s.x, sy + g);
          ctx.stroke();
          break;
        }
        case 'dust':
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(220,200,160,${0.35 * a * (0.6 + 0.4 * Math.sin(this.time * 2 + q.rot))})`;
          ctx.fillRect(s.x, sy, q.size * z, q.size * z);
          break;
        case 'ember': {
          ctx.globalCompositeOperation = 'lighter';
          const flick = 0.7 + 0.3 * Math.sin(this.time * 14 + q.rot * 5);
          const r = 4 * q.size * z;
          ctx.globalAlpha = Math.min(1, a * flick);
          ctx.drawImage(emberSprite(), s.x - r, sy - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 'fog': {
          ctx.globalCompositeOperation = 'source-over';
          const rw = q.size * 34 * z;
          const g = ctx.createRadialGradient(s.x, sy, 0, s.x, sy, rw);
          g.addColorStop(0, `rgba(150,160,170,${0.2 * a})`);
          g.addColorStop(1, 'rgba(150,160,170,0)');
          ctx.fillStyle = g;
          ctx.save();
          ctx.translate(s.x, sy);
          ctx.scale(1, 0.4);
          ctx.translate(-s.x, -sy);
          ctx.fillRect(s.x - rw, sy - rw, rw * 2, rw * 2);
          ctx.restore();
          break;
        }
        case 'leaf':
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(${q.rot % 2 > 1 ? '120,70,30' : '150,110,40'},${0.85 * a})`;
          ctx.save();
          ctx.translate(s.x, sy);
          ctx.rotate(q.rot);
          ctx.scale(1, Math.abs(Math.sin(q.rot * 1.3)) * 0.8 + 0.2);
          ctx.beginPath();
          ctx.ellipse(0, 0, q.size * z, q.size * 0.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        case 'drip':
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(160,190,220,${0.6 * a})`;
          ctx.lineWidth = 1.2 * z;
          ctx.beginPath();
          ctx.moveTo(s.x, sy - 7 * z);
          ctx.lineTo(s.x, sy);
          ctx.stroke();
          break;
        case 'splash':
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(160,190,220,${0.5 * (1 - k) * lit})`;
          ctx.lineWidth = 1 * z;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, (2 + k * 9) * z, (1 + k * 4) * z, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
    }
    ctx.restore();
  }

  /** Screen-edge tints: frost when chilled, green when poisoned, a red pulse near death. */
  drawVignettes(ctx: CanvasRenderingContext2D, cam: Camera, w: World) {
    const p = w.player;
    const lifeK = p.life / Math.max(1, w.stats.maxLife);
    const layers: { rgb: string; a: number }[] = [];
    // Frostbite whitens the edges of the screen as it builds; a chill from a blow does the same for a moment.
    const cold = Math.max(p.chill > 0 ? Math.min(1, p.chill) : 0, p.dead ? 0 : w.frost);
    if (cold > 0) layers.push({ rgb: '150,210,255', a: cold * 0.5 });
    if (p.poison.t > 0) layers.push({ rgb: '70,170,40', a: Math.min(1, p.poison.t / 2) * 0.4 });
    if (!p.dead && lifeK < 0.35) {
      // Pulse in time with the heartbeat in the score.
      const bpm = 62 + (1 - lifeK / 0.35) * 58;
      const ph = (this.time * bpm) / 60;
      const beat = Math.max(0, Math.sin(ph * Math.PI * 2)) ** 6;
      layers.push({ rgb: '150,0,0', a: (0.25 + 0.3 * beat) * (1 - lifeK / 0.35) + 0.12 });
    }
    if (!layers.length) return;
    const W = cam.w;
    const H = cam.h;
    const r = Math.hypot(W, H) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (const L of layers) {
      const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.55, W / 2, H / 2, r);
      g.addColorStop(0, `rgba(${L.rgb},0)`);
      g.addColorStop(1, `rgba(${L.rgb},${L.a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Frost crystals creeping in from the corners.
    if (cold > 0) {
      ctx.strokeStyle = `rgba(220,240,255,${cold * 0.35})`;
      ctx.lineWidth = 1.2;
      for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]] as const) {
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * (Math.PI / 2);
          const len = 40 + ((i * 37) % 30);
          const ex = cx + Math.cos(a0) * len * sx;
          const ey = cy + Math.sin(a0) * len * sy;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ex, ey);
          ctx.moveTo(cx + (ex - cx) * 0.6, cy + (ey - cy) * 0.6);
          ctx.lineTo(cx + (ex - cx) * 0.6 + 10 * sx, cy + (ey - cy) * 0.6 - 6 * sy);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
