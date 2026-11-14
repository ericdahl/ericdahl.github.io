import { CLASSES } from '../game/character';
import { makeItem, type ClassId, type Item } from '../game/items';
import { drawHumanoid, drawTinted, type HumanoidLook, type Pose } from '../render/figures';
import { heroLook, type Gear } from '../render/looks';

/**
 * The New Hero scene: every class standing round a fire, drawn large with the same figures the game uses.
 * They breathe and shift while they wait. The one picked steps into the light and shows what they do.
 */

/** What each class wears to be looked at: enough gear to say who they are. */
const OUTFITS: Record<ClassId, Partial<Record<keyof Gear, string>>> = {
  reaver: { weapon: 'war_axe', offhand: 'small_shield', body: 'studded_leather' },
  arcanist: { weapon: 'gnarled_staff' },
  huntress: { weapon: 'long_bow', body: 'leather_armor' },
  necromancer: { weapon: 'bone_wand' },
  forgewright: { weapon: 'war_hammer' },
  hiveborn: { weapon: 'short_sword', offhand: 'hand_axe' },
};
/** Who shows off with a spell rather than a swing. */
const CASTS: Partial<Record<ClassId, string>> = { arcanist: '#ff9a40', necromancer: '#a8ff70' };

export const HERO_ORDER = Object.keys(CLASSES) as ClassId[];

let looks: Record<string, HumanoidLook> | null = null;
function showLooks() {
  if (looks) return looks;
  looks = {};
  for (const id of HERO_ORDER) {
    const gear: Gear = {};
    for (const [slot, base] of Object.entries(OUTFITS[id])) gear[slot as keyof Gear] = makeItem(base) as Item;
    looks[id] = heroLook(id, gear);
  }
  return looks;
}

const TAU = Math.PI * 2;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface HeroScene {
  el: HTMLCanvasElement;
  select(id: ClassId): void;
}

/** Builds the scene. `onPick` is called when a hero is tapped. It animates for as long as its canvas is on the page. */
export function heroScene(initial: ClassId, onPick: (id: ClassId) => void): HeroScene {
  const cv = document.createElement('canvas');
  cv.className = 'hero-scene';
  cv.setAttribute('role', 'img');
  const ctx = cv.getContext('2d')!;
  const L = showLooks();
  const n = HERO_ORDER.length;
  let selected = initial;
  let hover: ClassId | null = null;
  /** 0..1 for each hero: how far they have stepped forward into the light. */
  const lift: Record<string, number> = Object.fromEntries(HERO_ORDER.map((id) => [id, id === initial ? 1 : 0]));
  let pickedAt = 0;
  let W = 0;
  let H = 0;
  let scale = 1;
  const embers = Array.from({ length: 26 }, (_, i) => ({ seed: i * 7.31, life: (i * 0.37) % 1 }));
  const label = () => cv.setAttribute('aria-label', `The six classes around a campfire. ${CLASSES[selected].name} is chosen.`);
  label();

  /** Where hero `i` stands: an arc round the fire, the middle ones furthest back. */
  const spot = (i: number) => {
    const k = (i + 0.5) / n;
    const x = W * (0.07 + 0.86 * k);
    const depth = Math.sin(k * Math.PI);
    return { x, y: H * 0.84 - depth * H * 0.1, left: k < 0.5 };
  };
  const fire = () => ({ x: W / 2, y: H * 0.9 });

  function size() {
    const w = Math.round(cv.clientWidth);
    if (!w) return false;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    // As big as the width allows, but never taller than about half the screen, so the choice below stays in view.
    scale = Math.max(1.5, Math.min(3.7, w / n / 30, (window.innerHeight * 0.56 - 12) / 96));
    const h = Math.round(scale * 96 + 12);
    if (w !== W || h !== H || cv.width !== Math.round(w * dpr)) {
      W = w;
      H = h;
      cv.style.height = `${h}px`;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function drawFire(t: number, flick: number) {
    const f = fire();
    const s = scale * 1.5;
    // The pool of light on the ground.
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, W * 0.55);
    g.addColorStop(0, `rgba(255,150,60,${0.34 * flick})`);
    g.addColorStop(0.35, `rgba(200,80,30,${0.14 * flick})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, 0.34);
    ctx.translate(-f.x, -f.y);
    ctx.fillStyle = g;
    ctx.fillRect(0, f.y - W, W, W * 2);
    ctx.restore();
    // Logs.
    ctx.lineCap = 'round';
    for (const [a, len] of [[0.25, 11], [-0.3, 12], [2.9, 10]] as const) {
      ctx.strokeStyle = '#1c120c';
      ctx.lineWidth = 4.6 * s * 0.5;
      ctx.beginPath();
      ctx.moveTo(f.x - Math.cos(a) * len * s * 0.5, f.y + 2 * s * 0.5 - Math.sin(a) * 3 * s * 0.5);
      ctx.lineTo(f.x + Math.cos(a) * len * s * 0.5, f.y + 2 * s * 0.5 + Math.sin(a) * 3 * s * 0.5);
      ctx.stroke();
      ctx.strokeStyle = '#4a2c18';
      ctx.lineWidth = 2.6 * s * 0.5;
      ctx.stroke();
    }
    // Flames: tongues that lean and stretch on their own clocks.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const ph = t * (2.6 + i * 0.37) + i * 1.9;
      const lean = Math.sin(ph) * 2.2 * s;
      const h = (15 + 7 * Math.sin(ph * 1.3 + i)) * s * (0.75 + 0.25 * flick);
      const bx = f.x + (i - 3) * 2.3 * s;
      const wid = (4.2 - Math.abs(i - 3) * 0.7) * s;
      const fg = ctx.createLinearGradient(bx, f.y, bx + lean, f.y - h);
      fg.addColorStop(0, 'rgba(255,240,190,0.85)');
      fg.addColorStop(0.35, 'rgba(255,160,50,0.6)');
      fg.addColorStop(1, 'rgba(220,50,10,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(bx - wid, f.y);
      ctx.quadraticCurveTo(bx - wid * 0.7 + lean * 0.4, f.y - h * 0.55, bx + lean, f.y - h);
      ctx.quadraticCurveTo(bx + wid * 0.7 + lean * 0.4, f.y - h * 0.55, bx + wid, f.y);
      ctx.closePath();
      ctx.fill();
    }
    // Embers going up.
    for (const e of embers) {
      const k = (e.life + t * (0.12 + (e.seed % 1) * 0.1)) % 1;
      const ex = f.x + Math.sin(e.seed + k * 5) * (5 + k * 16) * s;
      const ey = f.y - 8 * s - k * H * 0.75;
      ctx.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - k))},70,${0.85 * (1 - k)})`;
      ctx.fillRect(ex, ey, 1.4 + (1 - k), 1.4 + (1 - k));
    }
    ctx.restore();
  }

  function draw(now: number) {
    if (!size()) return;
    const t = now / 1000;
    const still = reducedMotion();
    const flick = still ? 0.9 : 0.82 + 0.1 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7);
    ctx.clearRect(0, 0, W, H);
    // Night, and the ground it stands on.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#07050a');
    sky.addColorStop(0.62, '#0e0907');
    sky.addColorStop(1, '#1a100a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const f = fire();
    // Furthest back first, so the ones in front overlap them; the fire sits in front of the middle of the arc.
    const order = HERO_ORDER.map((id, i) => ({ id, i, ...spot(i) })).sort((a, b) => a.y + lift[a.id] * 8 - (b.y + lift[b.id] * 8));
    let fireDrawn = false;
    for (const h of order) {
      const up = lift[h.id];
      const y = h.y + up * H * 0.07;
      if (!fireDrawn && y > f.y - 2) {
        drawFire(t, flick);
        fireDrawn = true;
      }
      const s = scale * (1 + up * 0.14);
      // A little toward the fire when picked.
      const x = h.x + (f.x - h.x) * 0.06 * up;
      const dir = h.left ? 1 : -1;
      const since = t - pickedAt;
      const cast = CASTS[h.id];
      // The one picked shows off: a swing or a spell on arriving, then again every few seconds.
      const beat = still ? -1 : h.id === selected ? (since < 0.25 ? -1 : (since - 0.25) % 3.4) : -1;
      const act = beat >= 0 && beat < 0.95 ? beat / 0.95 : 0;
      const pose: Pose = { dir, back: false, walk: 0, moving: false, attack: cast ? 0 : act, cast: cast ? act : 0 };
      const look = L[h.id];
      const time = still ? 0 : t + h.i * 1.7;
      // Shadow thrown away from the fire.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(x + (x - f.x) * 0.05, y + 1.5 * s, 9.5 * s, 3 * s, 0, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      drawHumanoid(ctx, look, pose, time);
      // Firelight on the side that faces it; the ones not picked stand back in the dark.
      const near = 1 - Math.min(1, Math.abs(x - f.x) / (W * 0.5));
      drawTinted(ctx, (c) => drawHumanoid(c, look, pose, time), '#ff7a28', (0.1 + 0.16 * near) * flick, 'lighter', 80);
      const dim = 0.5 * (1 - up) * (hover === h.id ? 0.45 : 1);
      if (dim > 0.01) drawTinted(ctx, (c) => drawHumanoid(c, look, pose, time), '#06040a', dim, 'source-over', 80);
      ctx.restore();
    }
    if (!fireDrawn) drawFire(t, flick);
    // Vignette.
    const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  let last = 0;
  function frame(now: number) {
    if (!cv.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const id of HERO_ORDER) {
      const to = id === selected ? 1 : 0;
      lift[id] += (to - lift[id]) * Math.min(1, dt * 7);
    }
    draw(now);
    if (reducedMotion() && HERO_ORDER.every((id) => Math.abs(lift[id] - (id === selected ? 1 : 0)) < 0.01)) return void (running = false);
    requestAnimationFrame(frame);
  }
  let running = false;
  const start = () => {
    if (running && !reducedMotion()) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  // Start once the canvas is on the page and has a width.
  requestAnimationFrame(function wait() {
    if (cv.isConnected) start();
    else requestAnimationFrame(wait);
  });

  const at = (e: PointerEvent | MouseEvent): ClassId => {
    const r = cv.getBoundingClientRect();
    const k = (e.clientX - r.left) / r.width;
    return HERO_ORDER[Math.max(0, Math.min(n - 1, Math.floor(((k - 0.07) / 0.86) * n)))];
  };
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') hover = at(e);
  });
  cv.addEventListener('pointerleave', () => (hover = null));
  cv.addEventListener('click', (e) => onPick(at(e)));

  return {
    el: cv,
    select(id) {
      if (id === selected) return;
      selected = id;
      pickedAt = performance.now() / 1000;
      label();
      start();
    },
  };
}

/** A small still portrait of a saved hero, wearing what they wear. */
export function heroPortrait(classId: ClassId, gear: Gear, px = 44): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  cv.width = cv.height = Math.round(px * dpr);
  cv.style.width = cv.style.height = `${px}px`;
  cv.className = 'cc-figure';
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  // Head and shoulders: the figure is about 50 tall with its feet at the origin.
  const s = px / 30;
  ctx.translate(px / 2 - 1.5 * s, px + 21 * s);
  ctx.scale(s, s);
  drawHumanoid(ctx, heroLook(classId, gear), { dir: 1, back: false, walk: 0, moving: false, attack: 0, cast: 0 }, 0);
  return cv;
}
