// Procedural character art: the shared shading kit, humanoids (the hero, townsfolk and
// human-shaped monsters) and their weapons. Monster bodies live in creatures.ts.
// Everything is drawn in figure space: feet at (0,0), facing +x, about 50 units tall.

export interface HumanoidLook {
  body: string;
  trim?: string;
  skin: string;
  legs: string;
  boots?: string;
  gloves?: string;
  head: 'hair' | 'helm' | 'fullhelm' | 'greathelm' | 'skullcap' | 'wrapped' | 'circlet' | 'hood' | 'cap' | 'mitre' | 'hat' | 'turban' | 'none';
  headColor: string;
  hair?: 'short' | 'long' | 'wild' | 'tail' | 'bald';
  /** Hair showing under a circlet, hat or open hood. */
  hairUnder?: string;
  beard?: string;
  longBeard?: boolean;
  weapon?: 'sword' | 'axe' | 'mace' | 'bow' | 'staff' | 'wand' | 'dagger' | 'club' | null;
  weaponId?: string;
  weaponColor?: string;
  weaponGlow?: string;
  /** 1-3: bigger, more ornate weapons at higher item levels. */
  weaponTier?: number;
  shield?: string | null;
  shieldShape?: 'round' | 'heater' | 'kite' | 'tower';
  robe?: boolean;
  cape?: string;
  armor?: 'cloth' | 'leather' | 'studded' | 'mail' | 'scale' | 'plate';
  pauldrons?: string;
  tabard?: string;
  apron?: string;
  quiver?: boolean;
  /** Eyes glowing out of the shadow of a hood. */
  eyeGlow?: string;
  /** Hood pulled back far enough to show the face. */
  openHood?: boolean;
  accent?: string;
  bones?: boolean;
  bareArms?: boolean;
  /** Shoulder width multiplier. */
  build?: number;
  /** Pale, drowned skin with dripping water. */
  drowned?: boolean;
  /** Flowing veils (the Mirage Dancer). */
  veils?: string;
  /** Face covered below the eyes. */
  veil?: string;
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

// ------------------------------------------------------------------ shading kit

/** Outline colour: a warm near-black so silhouettes read on any floor. */
export const INK = 'rgba(14,9,6,0.82)';

/** Corpses are drawn with this set: no glowing eyes, no auras. */
export const art = { dead: false };

const parsed = new Map<string, [number, number, number]>();
export function rgbOf(c: string): [number, number, number] {
  const hit = parsed.get(c);
  if (hit) return hit;
  let out: [number, number, number] = [128, 128, 128];
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16);
    if (!Number.isNaN(n)) out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const m = c.match(/[\d.]+/g);
    if (m && m.length >= 3) out = [+m[0], +m[1], +m[2]];
  }
  if (parsed.size > 2000) parsed.clear();
  parsed.set(c, out);
  return out;
}

/** Lighten (k > 0) towards white or darken (k < 0) towards black. Accepts #hex and rgb(). */
export function shade(c: string, k: number): string {
  let [r, g, b] = rgbOf(c);
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

export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return `rgb(${(x[0] + (y[0] - x[0]) * t) | 0},${(x[1] + (y[1] - x[1]) * t) | 0},${(x[2] + (y[2] - x[2]) * t) | 0})`;
}

export function alpha(c: string, a: number): string {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${a})`;
}

/** Linear light-to-shadow ramp across a part. */
export function lin(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string, hi = 0.25, lo = -0.42): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(c, hi));
  g.addColorStop(0.45, c);
  g.addColorStop(1, shade(c, lo));
  return g;
}

/** Radial ramp lit from the upper left, for round masses (heads, bellies, shells). */
export function rad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, hi = 0.32, lo = -0.5): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.05);
  g.addColorStop(0, shade(c, hi));
  g.addColorStop(0.5, c);
  g.addColorStop(1, shade(c, lo));
  return g;
}

export function ink(ctx: CanvasRenderingContext2D, w = 1) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Fill the current path and outline it. */
export function fillInk(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, w = 1) {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, w);
}

/** A tapered or plain limb along a polyline, with an outline underneath. */
export function limb(ctx: CanvasRenderingContext2D, pts: number[], w: number, color: string | CanvasGradient, outline = 1.4) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (outline > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + outline;
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Soft additive glow. Skipped on corpses. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.6) {
  if (art.dead || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(0.4, alpha(color, a * 0.35));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** A pair of eyes; glowing ones get a halo, corpses get dull sockets. */
export function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, color = '#ffd040', r = 1.4, halo = true) {
  ctx.fillStyle = art.dead ? 'rgba(20,12,8,0.9)' : color;
  ctx.beginPath();
  ctx.arc(x - gap / 2, y, r, 0, Math.PI * 2);
  ctx.arc(x + gap / 2, y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  if (halo) glow(ctx, x, y, gap + r * 4, color, 0.45);
}

/** Narrow, slanted demon eyes. */
export function slitEyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, color: string, len = 2.4) {
  ctx.fillStyle = art.dead ? 'rgba(20,12,8,0.9)' : color;
  for (const [cx, k] of [[x - gap / 2, 0.85], [x + gap / 2, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx - len * 0.5 * k, y - len * 0.25);
    ctx.quadraticCurveTo(cx, y - len * 0.45, cx + len * 0.55 * k, y + len * 0.2);
    ctx.quadraticCurveTo(cx, y + len * 0.2, cx - len * 0.5 * k, y - len * 0.25);
    ctx.fill();
  }
  glow(ctx, x, y, gap + len * 2.5, color, 0.5);
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
}

export function poly(ctx: CanvasRenderingContext2D, pts: number[], close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
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

// ------------------------------------------------------------------ baking

/** A figure rendered once to its own canvas, to be stamped instead of redrawn. */
export interface Baked {
  canvas: HTMLCanvasElement;
  /** Half the canvas size: where the figure's origin sits in it. */
  half: number;
}

/**
 * Renders `draw` once into a canvas of its own, at the caller's current scale and rotation. Use it for figures that
 * have stopped changing (corpses): stamping the result with drawBaked costs one image instead of dozens of paths.
 * `reach` is how far the figure extends from its origin, in its own units.
 */
export function bake(ctx: CanvasRenderingContext2D, draw: (c: CanvasRenderingContext2D) => void, reach = 80): Baked {
  const m = ctx.getTransform();
  const s = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  const size = Math.max(2, Math.min(1024, Math.ceil(reach * 2 * s)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  c.setTransform(m.a, m.b, m.c, m.d, size / 2, size / 2);
  draw(c);
  return { canvas, half: size / 2 };
}

/** Stamps a baked figure at the caller's current origin. The caller's alpha applies; its scale was baked in. */
export function drawBaked(ctx: CanvasRenderingContext2D, b: Baked) {
  const m = ctx.getTransform();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(b.canvas, m.e - b.half, m.f - b.half);
  ctx.restore();
}

// ------------------------------------------------------------------ tinting

let scratch: HTMLCanvasElement | null = null;

/**
 * Draws a figure flattened to one colour (hit flashes, chill, poison, charring), using the
 * caller's current transform. The figure is rendered to a scratch buffer, filled with `tint`
 * where it is opaque, then composited onto `ctx` with `op` at `a`.
 */
export function drawTinted(ctx: CanvasRenderingContext2D, draw: (c: CanvasRenderingContext2D) => void, tint: string, a: number, op: GlobalCompositeOperation = 'lighter', reach = 130) {
  const m = ctx.getTransform();
  const s = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  const size = Math.min(2048, Math.ceil(reach * 2 * s));
  if (size < 2) return;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < size || scratch.height < size) {
    scratch.width = Math.max(scratch.width, size);
    scratch.height = Math.max(scratch.height, size);
  }
  const sc = scratch.getContext('2d')!;
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalCompositeOperation = 'source-over';
  sc.globalAlpha = 1;
  sc.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size * 0.7;
  sc.setTransform(m.a, m.b, m.c, m.d, cx, cy);
  draw(sc);
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalCompositeOperation = 'source-atop';
  sc.globalAlpha = 1;
  sc.fillStyle = tint;
  sc.fillRect(0, 0, size, size);
  sc.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha *= a;
  ctx.drawImage(scratch, 0, 0, size, size, m.e - cx, m.f - cy, size, size);
  ctx.restore();
}

// ------------------------------------------------------------------ humanoids

type Key = [at: number, arm: number, tool: number];
const SWING: Key[] = [[0, 1.25, -1.2], [0.3, -2.05, -2.7], [0.58, 0.3, 0.5], [0.75, 0.55, 0.2], [1, 1.25, -1.2]];
const STAFF_REST: Key = [0, 1.15, -1.5];
const ease = (k: number) => k * k * (3 - 2 * k);

/**
 * Arm angle (shoulder to hand) and weapon angle (hand to tip), in screen radians, for a
 * point in an attack (0-1) or cast. At rest the weapon is held upright at the side; an
 * attack winds up over the shoulder, strikes forward and down, then recovers.
 */
export function swingPose(attack: number, cast: number, weapon: HumanoidLook['weapon'] | null): { arm: number; tool: number } {
  if (cast > 0) {
    const k = Math.sin(Math.min(1, cast) * Math.PI);
    return { arm: 1.2 - k * 1.8, tool: -1.4 + k * 0.1 };
  }
  if (weapon === 'bow') {
    const k = attack > 0 ? Math.min(1, Math.sin(attack * Math.PI) * 2.5) : 0;
    return { arm: 1.3 - k * 1.25, tool: 0 };
  }
  const rest: Key = weapon === 'staff' ? STAFF_REST : weapon === 'wand' ? [0, 1.2, -0.9] : SWING[0];
  if (attack <= 0 || attack >= 1) return { arm: rest[1], tool: rest[2] };
  const keys = [rest, ...SWING.slice(1, -1), [1, rest[1], rest[2]] as Key];
  let i = 0;
  while (i < keys.length - 2 && attack > keys[i + 1][0]) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const k = ease((attack - a[0]) / (b[0] - a[0]));
  return { arm: a[1] + (b[1] - a[1]) * k, tool: a[2] + (b[2] - a[2]) * k };
}


const METAL = '#a8acb4';
const GOLD = '#d8b050';
const WOOD = '#6a4a2a';
const LEATHER = '#4a3420';

/** Draws a standing figure with feet at (0,0), height ~50 at scale 1. */
export function drawHumanoid(ctx: CanvasRenderingContext2D, L: HumanoidLook, pose: Pose, t = 0) {
  ctx.save();
  if (pose.dir < 0) ctx.scale(-1, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const back = pose.back;
  const ph = pose.walk * 3.2;
  const sw = pose.moving ? Math.sin(ph) : 0;
  const bob = pose.moving ? Math.abs(Math.cos(ph)) * 1.1 : Math.sin(t * 1.8) * 0.3;
  const B = L.build ?? 1;
  const atk = pose.attack;

  // Arm geometry first: the weapon hand drives the swing.
  const sp = swingPose(atk, pose.cast, L.weapon ?? null);
  const armAng = sp.arm;
  const shX = 6 * B;
  const shY = -34.5 - bob;
  const hx = shX + Math.cos(armAng) * 10.5;
  const hy = shY + Math.sin(armAng) * 10.5;

  if (!back) {
    if (L.cape) drawCape(ctx, L, sw, bob, t, false);
    if (L.quiver) drawQuiver(ctx, bob, false);
    if (L.veils) drawVeils(ctx, L.veils, t, bob, false);
  }
  if (L.hair === 'long' && L.head === 'hair' && !back) drawLongHairBack(ctx, L.headColor, bob);
  if (!L.shield) drawFarArm(ctx, L, sw, bob);
  drawLegs(ctx, L, sw, ph, pose.moving);
  ctx.save();
  ctx.translate(0, -bob);
  drawTorso(ctx, L, back, sw);
  if (L.pauldrons) drawPauldron(ctx, L.pauldrons, -6.6 * B, -36.3, 0.92);
  if (L.bones) drawBoneSpikes(ctx, L.accent ?? '#e8e0c8', -6.5 * B);
  drawHead(ctx, L, back, t);
  if (back) {
    if (L.quiver) drawQuiver(ctx, 0, true);
    if (L.cape) drawCape(ctx, L, sw, 0, t, true);
    if (L.veils) drawVeils(ctx, L.veils, t, 0, true);
  }
  if (L.shield) drawShield(ctx, L, sw, back);
  ctx.restore();
  drawWeaponArm(ctx, L, shX, shY, hx, hy, sp.tool, atk, t);
  if (L.pauldrons) drawPauldron(ctx, L.pauldrons, shX + 0.6, -36.3 - bob, 1);
  if (L.bones) drawBoneSpikes(ctx, L.accent ?? '#e8e0c8', shX + 0.4, -bob);
  if (pose.cast > 0 && !art.dead) {
    const k = Math.sin(pose.cast * Math.PI);
    const c = L.weaponGlow ?? L.eyeGlow ?? '#ffdc96';
    glow(ctx, hx, hy - 2, 14, c, 0.9 * k);
    ctx.fillStyle = alpha('#fff8e0', 0.85 * k);
    circle(ctx, hx, hy - 2, 2.2 * k + 0.5);
    ctx.fill();
  }
  ctx.restore();
}

function drawLongHairBack(ctx: CanvasRenderingContext2D, c: string, bob: number) {
  ctx.beginPath();
  ctx.moveTo(-4.5, -47 - bob);
  ctx.quadraticCurveTo(-8, -40 - bob, -7, -33 - bob);
  ctx.lineTo(-1, -35 - bob);
  ctx.lineTo(0, -44 - bob);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -8, -46, 0, -33, c, 0.15, -0.4), 0.8);
}

function drawCape(ctx: CanvasRenderingContext2D, L: HumanoidLook, sw: number, bob: number, t: number, front: boolean) {
  const c = L.cape!;
  const B = L.build ?? 1;
  const flow = Math.sin(t * 2.2) * 0.8;
  const trail = -Math.abs(sw) * 2.2 - flow;
  const hem = -3;
  ctx.beginPath();
  ctx.moveTo(-7 * B, -37.5 - bob);
  ctx.lineTo(7 * B, -37.5 - bob);
  ctx.quadraticCurveTo(10, -18, 9 + trail * 0.4, hem);
  ctx.lineTo(4 + trail * 0.6, hem + 1.2 + sw * 0.6);
  ctx.lineTo(-1 + trail, hem - 0.4);
  ctx.lineTo(-6 + trail * 1.2, hem + 1 - sw * 0.6);
  ctx.lineTo(-11 + trail * 1.4, hem - 0.5);
  ctx.quadraticCurveTo(-11, -20, -7 * B, -37.5 - bob);
  ctx.closePath();
  if (front) {
    fillInk(ctx, lin(ctx, -10, -36, 10, -2, c, 0.2, -0.5), 1);
    // Folds and a clasp at the collar.
    ctx.strokeStyle = alpha('#000000', 0.28);
    ctx.lineWidth = 1.1;
    for (const x of [-4, 0.5, 4.5]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.6, -33 - bob);
      ctx.quadraticCurveTo(x, -18, x * 1.15 + trail * 0.7, hem);
      ctx.stroke();
    }
    ctx.strokeStyle = alpha('#ffffff', 0.08);
    ctx.beginPath();
    ctx.moveTo(-6, -34 - bob);
    ctx.quadraticCurveTo(-8.5, -18, -9 + trail, hem);
    ctx.stroke();
    if (L.trim) {
      ctx.strokeStyle = L.trim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7 * B, -37.5 - bob);
      ctx.lineTo(7 * B, -37.5 - bob);
      ctx.stroke();
    }
  } else {
    // Seen from the front, only the dark lining shows either side of the body.
    fillInk(ctx, lin(ctx, -10, -36, 10, -2, shade(c, -0.25), 0.05, -0.5), 1);
  }
}

function drawVeils(ctx: CanvasRenderingContext2D, c: string, t: number, bob: number, front: boolean) {
  ctx.save();
  ctx.globalAlpha *= front ? 0.75 : 0.55;
  for (let i = 0; i < 2; i++) {
    const w = Math.sin(t * 3 + i * 1.7);
    ctx.beginPath();
    ctx.moveTo(-5, -36 - bob);
    ctx.bezierCurveTo(-16 - i * 4, -32 + w * 3, -12 - i * 6, -16 - w * 3, -18 - i * 5 + w * 2, -6 + i * 3);
    ctx.lineTo(-13 - i * 3 + w * 2, -9 + i * 3);
    ctx.bezierCurveTo(-9 - i * 3, -18, -8, -28, -2, -34 - bob);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, -18, -34, -4, -6, i ? shade(c, 0.2) : c, 0.3, -0.3);
    ctx.fill();
  }
  ctx.restore();
}

function drawQuiver(ctx: CanvasRenderingContext2D, bob: number, front: boolean) {
  ctx.save();
  ctx.translate(-4.5, -30 - bob);
  ctx.rotate(-0.35);
  // Fletchings above the rim.
  for (let i = 0; i < 4; i++) {
    const x = -1.8 + i * 1.3;
    ctx.strokeStyle = '#8a6a40';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, -7);
    ctx.lineTo(x, -11.5);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? '#c84030' : '#e8e0d0';
    poly(ctx, [x - 0.9, -14.5, x + 0.9, -14.5, x + 0.7, -11, x - 0.7, -11]);
    ctx.fill();
  }
  roundRect(ctx, -3, -8, 6, 16, 2);
  fillInk(ctx, lin(ctx, -3, -8, 3, 8, front ? '#6a4628' : '#5a3a20', 0.25, -0.45), 0.9);
  ctx.fillStyle = '#b89050';
  ctx.fillRect(-3, -7.5, 6, 1.2);
  ctx.fillRect(-3, 4.5, 6, 1);
  ctx.restore();
}

function drawFarArm(ctx: CanvasRenderingContext2D, L: HumanoidLook, sw: number, bob: number) {
  const B = L.build ?? 1;
  const sx = -5.8 * B;
  const sy = -34.5 - bob;
  const ex = sx - 1.6 - sw * 1.2;
  const ey = sy + 6;
  const hx2 = sx - 2.2 - sw * 2.4;
  const hy2 = sy + 11.5;
  const sleeve = L.bareArms ? L.skin : shade(L.body, -0.2);
  limb(ctx, [sx, sy, ex, ey], 3.8 * B, sleeve);
  limb(ctx, [ex, ey, hx2, hy2], 3.2 * B, L.gloves ? shade(L.gloves, -0.15) : L.bareArms || !L.robe ? shade(L.skin, -0.2) : shade(L.body, -0.25));
  circle(ctx, hx2, hy2 + 0.6, 1.7 * B);
  fillInk(ctx, shade(L.gloves ?? L.skin, -0.2), 0.7);
}

function drawLegs(ctx: CanvasRenderingContext2D, L: HumanoidLook, sw: number, ph: number, moving: boolean) {
  const lift = (s: number) => (moving ? Math.max(0, s) : 0);
  const legCol = L.armor === 'plate' ? L.body : L.legs;
  const boots = L.boots ?? shade(L.legs, -0.35);
  const leg = (hx: number, s: number, far: boolean) => {
    const kx = hx + s * 3.2 + 0.6;
    const ky = -10.5 - lift(s) * 1.6;
    const fx = hx + s * 5.6;
    const fy = -1 - lift(s) * 1.6;
    const c = far ? shade(legCol, -0.28) : legCol;
    if (!L.robe) {
      limb(ctx, [hx, -20, kx, ky], 4.6, lin(ctx, hx - 2, -20, hx + 3, -10, c, 0.15, -0.35));
      limb(ctx, [kx, ky, fx, fy - 3.5], 3.9, c);
      if (L.armor === 'plate') {
        circle(ctx, kx + 0.4, ky, 1.9);
        fillInk(ctx, rad(ctx, kx, ky, 2, METAL), 0.6);
      }
    }
    const b = far ? shade(boots, -0.25) : boots;
    limb(ctx, [fx - 0.4, fy - 4.2, fx, fy - 0.6], 4.4, b);
    ellipse(ctx, fx + 1.6, fy - 0.4, 3.2, 1.5);
    fillInk(ctx, b, 0.8);
    ctx.fillStyle = alpha('#ffffff', 0.12);
    ctx.fillRect(fx - 1.6, fy - 4.4, 3, 1);
  };
  void ph;
  leg(-2.4, -sw, true);
  leg(2.4, sw, false);
}

function torsoPath(ctx: CanvasRenderingContext2D, B: number) {
  ctx.beginPath();
  ctx.moveTo(-6.2, -19.5);
  ctx.lineTo(-7, -27);
  ctx.quadraticCurveTo(-8.8 * B, -34.5, -7.2 * B, -38.2);
  ctx.quadraticCurveTo(0, -40, 7.2 * B, -38.2);
  ctx.quadraticCurveTo(8.8 * B, -34.5, 7, -27);
  ctx.lineTo(6.2, -19.5);
  ctx.closePath();
}

function drawTorso(ctx: CanvasRenderingContext2D, L: HumanoidLook, back: boolean, sw: number) {
  const B = L.build ?? 1;
  if (L.robe) {
    // Skirt of the robe, flaring to the ground; the feet show under the hem.
    const fl = sw * 1.4;
    ctx.beginPath();
    ctx.moveTo(-6.8, -26);
    ctx.lineTo(6.8, -26);
    ctx.quadraticCurveTo(9, -12, 10.5 + fl, -0.8);
    ctx.quadraticCurveTo(5, 1, 0 + fl * 0.5, 0);
    ctx.quadraticCurveTo(-5, 1, -10.5 + fl, -0.8);
    ctx.quadraticCurveTo(-9, -12, -6.8, -26);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -10, -24, 10, 0, L.body, 0.18, -0.45), 1);
    ctx.strokeStyle = alpha('#000000', 0.3);
    ctx.lineWidth = 1;
    for (const x of [-4.5, -0.5, 3.5]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.7, -21);
      ctx.quadraticCurveTo(x * 1.1, -10, x * 1.45 + fl, -1);
      ctx.stroke();
    }
    if (L.trim) {
      ctx.strokeStyle = L.trim;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-10.2 + fl, -1.6);
      ctx.quadraticCurveTo(-5, 0.2, 0 + fl * 0.5, -0.8);
      ctx.quadraticCurveTo(5, 0.2, 10.2 + fl, -1.6);
      ctx.stroke();
      if (!back) {
        // A embroidered panel down the front.
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(1.5, -20);
        ctx.lineTo(2.4 + fl * 0.4, -1.5);
        ctx.stroke();
      }
    }
  }
  torsoPath(ctx, B);
  fillInk(ctx, lin(ctx, -8, -39, 8, -20, L.body, 0.22, -0.42), 1);
  ctx.save();
  torsoPath(ctx, B);
  ctx.clip();
  const a = L.armor ?? (L.robe ? 'cloth' : 'cloth');
  if (a === 'mail') {
    ctx.strokeStyle = alpha('#ffffff', 0.22);
    ctx.lineWidth = 0.6;
    for (let y = -38; y < -19; y += 1.8) {
      for (let x = -9 + ((y | 0) % 2 ? 0.9 : 0); x < 9; x += 1.8) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI);
        ctx.stroke();
      }
    }
  } else if (a === 'scale') {
    ctx.strokeStyle = alpha('#000000', 0.35);
    ctx.lineWidth = 0.7;
    for (let r = 0, y = -37; y < -19; y += 2.4, r++) {
      for (let x = -9 + (r % 2) * 1.4; x < 9; x += 2.8) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI);
        ctx.stroke();
      }
    }
    ctx.fillStyle = alpha('#ffffff', 0.08);
    ctx.fillRect(-8, -38, 6, 18);
  } else if (a === 'plate') {
    // Breastplate: a raised ridge, a polished highlight and the fauld bands below.
    if (!back) {
      ctx.fillStyle = alpha('#ffffff', 0.28);
      ellipse(ctx, -2, -32, 3, 4.5, 0.3);
      ctx.fill();
      ctx.strokeStyle = alpha('#000000', 0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(1, -38);
      ctx.quadraticCurveTo(2, -30, 1, -24);
      ctx.stroke();
    }
    ctx.strokeStyle = alpha('#000000', 0.4);
    ctx.lineWidth = 0.8;
    for (const y of [-25.5, -23]) {
      ctx.beginPath();
      ctx.moveTo(-8, y);
      ctx.quadraticCurveTo(0, y + 1.2, 8, y);
      ctx.stroke();
    }
  } else if (a === 'leather' || a === 'studded') {
    ctx.strokeStyle = alpha('#000000', 0.3);
    ctx.lineWidth = 0.7;
    ctx.setLineDash([1.2, 1]);
    ctx.beginPath();
    ctx.moveTo(-6, -36);
    ctx.lineTo(-5, -21);
    ctx.moveTo(6.5, -36);
    ctx.lineTo(5.5, -21);
    ctx.stroke();
    ctx.setLineDash([]);
    if (a === 'studded') {
      ctx.fillStyle = '#d8d0b8';
      for (let y = -35; y < -22; y += 3.5) for (let x = -5; x <= 6; x += 3.6) ctx.fillRect(x - 0.45 + ((y / 3.5) % 2 ? 1.8 : 0), y, 0.9, 0.9);
    }
  } else if (!back && !L.robe) {
    // Cloth: a laced collar.
    ctx.strokeStyle = alpha('#000000', 0.35);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -38.5);
    ctx.lineTo(2, -33);
    ctx.lineTo(4, -38.5);
    ctx.stroke();
  }
  if (L.robe && !back) {
    // Robe front: a collar opening and trim down the chest.
    ctx.fillStyle = shade(L.body, -0.35);
    poly(ctx, [-1.5, -39, 2, -32, 5.5, -39]);
    ctx.fill();
    if (L.trim) {
      ctx.strokeStyle = L.trim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-1.5, -39);
      ctx.lineTo(2, -32);
      ctx.lineTo(5.5, -39);
      ctx.moveTo(2, -32);
      ctx.lineTo(1.5, -21);
      ctx.stroke();
    }
  }
  if (L.tabard && !back) {
    ctx.fillStyle = lin(ctx, -2, -37, 4, -14, L.tabard, 0.2, -0.4);
    poly(ctx, [-2.4, -37.5, 5, -37.5, 4.6, -14, -2, -14]);
    ctx.fill();
    if (L.trim) {
      ctx.strokeStyle = L.trim;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  if (L.apron && !back) {
    ctx.fillStyle = lin(ctx, -4, -34, 6, -10, L.apron, 0.15, -0.45);
    poly(ctx, [-4.5, -34, 6, -34, 6.8, -19, -5.5, -19]);
    ctx.fill();
  }
  // Rim light down the lit edge.
  ctx.strokeStyle = alpha('#ffffff', 0.12);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-7.3 * B, -36);
  ctx.quadraticCurveTo(-7.8, -30, -6.4, -21);
  ctx.stroke();
  ctx.restore();
  if (L.apron && !back) {
    // The apron hangs below the belt.
    ctx.beginPath();
    ctx.moveTo(-5.5, -20);
    ctx.lineTo(6.8, -20);
    ctx.lineTo(7.6, -8 + sw);
    ctx.lineTo(-5.8, -8 + sw * 0.5);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -5, -20, 7, -8, L.apron, 0.12, -0.45), 0.9);
    ctx.strokeStyle = alpha('#000000', 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-4.5, -9.5);
    ctx.lineTo(6.6, -9.5);
    ctx.stroke();
  }
  // Belt with buckle and pouch.
  const belt = L.trim && !L.robe ? L.trim : L.robe ? (L.trim ?? LEATHER) : LEATHER;
  ctx.beginPath();
  ctx.moveTo(-6.6, -23.5);
  ctx.quadraticCurveTo(0, -21.8, 6.8, -23.5);
  ctx.lineTo(6.6, -20.8);
  ctx.quadraticCurveTo(0, -19.2, -6.4, -20.8);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -6, -23, 6, -20, belt, 0.25, -0.4), 0.7);
  if (!back) {
    ctx.fillStyle = L.robe ? (L.accent ?? GOLD) : GOLD;
    ctx.fillRect(1.6, -23.2, 2.6, 2.6);
    ctx.fillStyle = shade(belt, -0.3);
    ctx.fillRect(2.3, -22.5, 1.2, 1.2);
    if (L.bones) {
      // A little skull hanging from the sash.
      circle(ctx, -3.5, -18.5, 1.8);
      fillInk(ctx, rad(ctx, -3.5, -18.5, 1.8, L.accent ?? '#e8e0c8'), 0.5);
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(-4.3, -18.9, 0.7, 0.7);
      ctx.fillRect(-3.1, -18.9, 0.7, 0.7);
    } else if (!L.robe) {
      roundRect(ctx, -6.4, -21.5, 3, 3.4, 0.8);
      fillInk(ctx, lin(ctx, -6, -21, -3, -18, '#5a3e24'), 0.6);
    }
  }
}

function drawPauldron(ctx: CanvasRenderingContext2D, c: string, x: number, y: number, k: number) {
  const rot = x > 0 ? 0.25 : -0.25;
  ctx.beginPath();
  ctx.ellipse(x, y, 4.4 * k, 3.3 * k, rot, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(x, y + 2.8 * k, x - 4.4 * k * Math.cos(rot), y - 4.4 * k * Math.sin(rot));
  ctx.closePath();
  fillInk(ctx, rad(ctx, x, y - 1, 4.4 * k, c, 0.4, -0.45), 0.8);
  ctx.strokeStyle = alpha('#ffffff', 0.25);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(x, y + 0.6, 3.3 * k, 2.2 * k, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

function drawBoneSpikes(ctx: CanvasRenderingContext2D, c: string, x: number, dy = 0) {
  const s = Math.sign(x) || 1;
  for (let i = 0; i < 3; i++) {
    const bx = x + s * (i - 1) * 1.6;
    const by = -37.2 + dy + Math.abs(i - 1) * 0.6;
    poly(ctx, [bx - 0.9, by, bx + s * (1 + i * 0.5), by - 4.5 + Math.abs(i - 1), bx + 0.9, by]);
    fillInk(ctx, lin(ctx, bx - 1, by - 4, bx + 1, by, c, 0.2, -0.3), 0.5);
  }
}

function drawFace(ctx: CanvasRenderingContext2D, L: HumanoidLook, cy: number) {
  const dark = shade(L.skin, -0.6);
  // Brows and eyes, turned three quarters towards +x.
  ctx.fillStyle = '#1a1210';
  ctx.fillRect(1.3, cy - 1.1, 1.2, 1.1);
  ctx.fillRect(3.9, cy - 1.1, 1.1, 1.1);
  ctx.fillStyle = alpha('#ffffff', 0.55);
  ctx.fillRect(1.3, cy - 1.1, 0.4, 0.4);
  ctx.strokeStyle = L.beard ?? (L.head === 'hair' ? L.headColor : dark);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0.9, cy - 2.2);
  ctx.lineTo(2.8, cy - 2.5);
  ctx.moveTo(3.7, cy - 2.5);
  ctx.lineTo(5.3, cy - 2.1);
  ctx.stroke();
  // Nose and mouth.
  ctx.fillStyle = shade(L.skin, -0.25);
  poly(ctx, [4.6, cy - 0.6, 6.2, cy + 1.7, 4.6, cy + 1.9]);
  ctx.fill();
  if (!L.beard && !L.veil) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(2.6, cy + 3.3);
    ctx.lineTo(4.8, cy + 3.1);
    ctx.stroke();
  }
  if (L.drowned) {
    ctx.fillStyle = alpha('#203040', 0.4);
    ellipse(ctx, 2.5, cy + 0.4, 1.6, 1);
    ellipse(ctx, 4.7, cy + 0.4, 1.4, 1);
    ctx.fill();
  }
}

function drawBeard(ctx: CanvasRenderingContext2D, L: HumanoidLook, cy: number, back: boolean) {
  if (!L.beard || back) return;
  const long = L.longBeard ? 9 : 0;
  ctx.beginPath();
  ctx.moveTo(-1.6, cy - 0.5);
  ctx.quadraticCurveTo(-1, cy + 4.5 + long * 0.6, 2 + long * 0.1, cy + 6 + long);
  ctx.quadraticCurveTo(5.5, cy + 4.5 + long * 0.4, 6.2, cy + 1.4);
  ctx.quadraticCurveTo(4, cy + 2.4, 2.4, cy + 2.6);
  ctx.quadraticCurveTo(0.5, cy + 2, -0.2, cy - 0.5);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -1, cy, 5, cy + 6 + long, L.beard, 0.2, -0.35), 0.7);
  ctx.strokeStyle = alpha('#000000', 0.25);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(1.5, cy + 3);
  ctx.lineTo(1.8 + long * 0.05, cy + 5 + long * 0.8);
  ctx.moveTo(3.6, cy + 3);
  ctx.lineTo(3.4, cy + 4.5 + long * 0.6);
  ctx.stroke();
}

function drawHairCap(ctx: CanvasRenderingContext2D, c: string, style: HumanoidLook['hair'], cy: number, back: boolean, t: number) {
  const g = lin(ctx, -5, cy - 6, 5, cy + 2, c, 0.25, -0.4);
  if (style === 'bald') {
    ctx.fillStyle = alpha('#ffffff', 0.3);
    ellipse(ctx, -0.5, cy - 4, 2.2, 1.2, -0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-1, cy + 0.5, 4.8, 3.6, 0, Math.PI * 0.55, Math.PI * 1.25);
    ctx.lineTo(-2, cy);
    ctx.closePath();
    fillInk(ctx, g, 0.6);
    return;
  }
  ctx.beginPath();
  if (back) {
    ctx.ellipse(0, cy - 0.4, 5.9, 6.2, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-5.4, cy + 2.5);
    ctx.quadraticCurveTo(-6.4, cy - 6.5, 0.5, cy - 6.6);
    ctx.quadraticCurveTo(6.4, cy - 6.2, 6, cy - 2);
    ctx.quadraticCurveTo(3, cy - 3.6, 0.8, cy - 2.6);
    ctx.quadraticCurveTo(-1.8, cy - 1.2, -2.2, cy + 2.8);
    ctx.closePath();
  }
  fillInk(ctx, g, 0.8);
  if (style === 'wild') {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.05 + i * 0.2);
      const x = Math.cos(a) * 5.6;
      const y = cy - 0.5 + Math.sin(a) * 5.8;
      poly(ctx, [x - 1.4, y + 0.8, x + Math.cos(a) * 3 - 1, y + Math.sin(a) * 3.2 - 0.6, x + 1.4, y + 0.4]);
      fillInk(ctx, c, 0.5);
    }
  }
  if (style === 'tail') {
    const s = Math.sin(t * 2.5) * 0.8;
    ctx.beginPath();
    ctx.moveTo(-4.6, cy - 3.5);
    ctx.quadraticCurveTo(-10 + s, cy, -8.5 + s, cy + 9);
    ctx.quadraticCurveTo(-7 + s, cy + 3, -3.6, cy - 1);
    ctx.closePath();
    fillInk(ctx, g, 0.7);
    ctx.fillStyle = '#c84030';
    ctx.fillRect(-5.6, cy - 3.2, 1.6, 1.6);
  }
  if (style === 'long' && back) {
    ctx.beginPath();
    ctx.moveTo(-5.8, cy);
    ctx.quadraticCurveTo(-6.4, cy + 8, -5, cy + 10);
    ctx.lineTo(5, cy + 10);
    ctx.quadraticCurveTo(6.4, cy + 8, 5.8, cy);
    ctx.closePath();
    fillInk(ctx, g, 0.7);
  }
  // A highlight across the crown.
  ctx.strokeStyle = alpha('#ffffff', 0.18);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, cy - 0.5, 4.6, Math.PI * 1.15, Math.PI * 1.55);
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, L: HumanoidLook, back: boolean, t: number) {
  const cy = -44.5;
  const hood = L.head === 'hood';
  // Neck
  ctx.fillStyle = shade(L.skin, -0.3);
  ctx.fillRect(-1.6, -40.5, 3.6, 3);
  if (hood) {
    drawHood(ctx, L, cy, back, t);
    return;
  }
  // Ear, head
  if (!back) {
    ellipse(ctx, -2.6, cy + 0.3, 1.2, 1.8);
    fillInk(ctx, shade(L.skin, -0.12), 0.6);
  }
  ellipse(ctx, 0.3, cy, 5.3, 5.9);
  fillInk(ctx, rad(ctx, 1, cy, 6, L.skin, 0.25, -0.4), 1);
  if (!back) {
    ellipse(ctx, -2.6, cy + 0.3, 1.1, 1.7);
    ctx.fillStyle = shade(L.skin, -0.1);
    ctx.fill();
    ctx.strokeStyle = alpha('#000000', 0.35);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  const covered = L.head === 'greathelm';
  if (!back && !covered) drawFace(ctx, L, cy);
  if (L.veil && !back) {
    ctx.beginPath();
    ctx.moveTo(-1, cy + 0.6);
    ctx.lineTo(6.4, cy + 0.6);
    ctx.lineTo(5.6, cy + 5);
    ctx.quadraticCurveTo(2, cy + 7, -1.5, cy + 4);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -1, cy, 6, cy + 6, L.veil, 0.15, -0.35), 0.6);
  }
  drawBeard(ctx, L, cy, back);
  const hc = L.headColor;
  switch (L.head) {
    case 'hair':
      drawHairCap(ctx, hc, L.hair ?? 'short', cy, back, t);
      break;
    case 'cap': {
      ctx.beginPath();
      ctx.ellipse(0.3, cy - 1.5, 6, 5.4, 0, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -5, cy - 7, 6, cy, hc, 0.25, -0.4), 0.8);
      ctx.fillStyle = shade(hc, -0.3);
      ctx.fillRect(-5.6, cy - 2.2, 11.8, 1.6);
      ctx.strokeStyle = alpha('#000000', 0.3);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0.3, cy - 6.8);
      ctx.lineTo(0.3, cy - 2);
      ctx.stroke();
      break;
    }
    case 'skullcap':
    case 'helm':
    case 'fullhelm': {
      ctx.beginPath();
      ctx.ellipse(0.3, cy - 1.2, 6.3, 6, 0, Math.PI * 0.92, Math.PI * 2.08);
      if (L.head === 'fullhelm') {
        ctx.lineTo(6.2, cy + 4.5);
        ctx.lineTo(4.4, cy + 4.5);
        ctx.lineTo(4.4, cy - 0.6);
        ctx.lineTo(-1.5, cy - 0.6);
        ctx.lineTo(-1.5, cy + 5);
        ctx.lineTo(-5.8, cy + 4);
      }
      ctx.closePath();
      if (back && L.head === 'fullhelm') ellipse(ctx, 0.3, cy, 6.3, 6.4);
      fillInk(ctx, rad(ctx, 0, cy - 2, 6.6, hc, 0.45, -0.5), 0.9);
      ctx.fillStyle = shade(hc, -0.25);
      ctx.fillRect(-5.9, cy - 1.9, 12.4, 1.5);
      ctx.fillStyle = alpha('#ffffff', 0.5);
      for (const x of [-3.5, 0.3, 4]) ctx.fillRect(x, cy - 1.6, 0.7, 0.7);
      if (L.head !== 'skullcap' && !back) {
        // Nasal guard
        ctx.fillStyle = lin(ctx, 3.5, cy - 1, 5, cy + 3, hc, 0.3, -0.3);
        ctx.fillRect(3.6, cy - 0.8, 1.4, 4.2);
      }
      if (L.head !== 'skullcap') {
        ctx.strokeStyle = shade(hc, -0.35);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0.3, cy - 7.2);
        ctx.quadraticCurveTo(-2.5, cy - 5, -3.6, cy - 2);
        ctx.stroke();
      }
      break;
    }
    case 'greathelm': {
      roundRect(ctx, -5.6, cy - 7.2, 12, 12.8, 3);
      fillInk(ctx, lin(ctx, -6, cy - 7, 7, cy + 5, hc, 0.4, -0.5), 1);
      if (!back) {
        ctx.fillStyle = '#0c0a0a';
        ctx.fillRect(0.6, cy - 2, 5.6, 1.4);
        ctx.fillRect(3, cy - 2, 1.5, 5.5);
        ctx.fillStyle = alpha('#000000', 0.5);
        for (let i = 0; i < 3; i++) ctx.fillRect(4.6, cy + 1.8 + i * 1.1, 0.6, 0.6);
      }
      ctx.strokeStyle = alpha('#ffffff', 0.3);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-4.4, cy - 5);
      ctx.lineTo(-4.4, cy + 3.5);
      ctx.stroke();
      // Crest
      ctx.beginPath();
      ctx.moveTo(-3.5, cy - 7);
      ctx.quadraticCurveTo(-1, cy - 11 + Math.sin(t * 3) * 0.4, 4, cy - 8.5);
      ctx.quadraticCurveTo(1, cy - 8, -1, cy - 6.6);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -3, cy - 11, 4, cy - 6, '#a02a20', 0.3, -0.4), 0.6);
      break;
    }
    case 'wrapped': {
      ctx.beginPath();
      ctx.ellipse(0.3, cy - 1.5, 6.4, 5.8, 0, Math.PI * 0.9, Math.PI * 2.1);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -6, cy - 7, 6, cy, hc, 0.2, -0.4), 0.8);
      ctx.strokeStyle = alpha('#000000', 0.25);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-6, cy - 1.5 - i * 1.8);
        ctx.quadraticCurveTo(0, cy - 3.5 - i * 2.2, 6.5, cy - 2 - i * 1.6);
        ctx.stroke();
      }
      ctx.fillStyle = METAL;
      ctx.fillRect(-6, cy - 2.4, 12.6, 1.2);
      break;
    }
    case 'circlet': {
      if (L.hairUnder) drawHairCap(ctx, L.hairUnder, 'short', cy, back, t);
      ctx.strokeStyle = hc;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0.3, cy - 2.2, 5.8, 1.6, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
      ctx.stroke();
      if (!back) {
        circle(ctx, 3.4, cy - 0.9, 1);
        ctx.fillStyle = '#60c0ff';
        ctx.fill();
        glow(ctx, 3.4, cy - 0.9, 4, '#60c0ff', 0.5);
      }
      break;
    }
    case 'mitre': {
      ctx.beginPath();
      ctx.moveTo(-5.4, cy - 2);
      ctx.quadraticCurveTo(-6.4, cy - 11, 0.3, cy - 17);
      ctx.quadraticCurveTo(7, cy - 11, 6, cy - 2);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -6, cy - 17, 6, cy - 2, hc, 0.3, -0.4), 0.9);
      ctx.strokeStyle = L.trim ?? GOLD;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0.3, cy - 16);
      ctx.lineTo(0.3, cy - 2.5);
      ctx.moveTo(-2.6, cy - 9);
      ctx.lineTo(3.4, cy - 9);
      ctx.moveTo(-5.4, cy - 2.6);
      ctx.lineTo(6, cy - 2.6);
      ctx.stroke();
      if (L.accent && !back) glow(ctx, 0.3, cy - 9, 7, L.accent, 0.35);
      break;
    }
    case 'hat': {
      if (L.hairUnder) drawHairCap(ctx, L.hairUnder, 'short', cy, back, t);
      ellipse(ctx, 0.3, cy - 3, 10, 2.6, -0.06);
      fillInk(ctx, lin(ctx, -9, cy - 5, 10, cy - 1, hc, 0.2, -0.4), 0.9);
      ctx.beginPath();
      ctx.moveTo(-4.6, cy - 3.2);
      ctx.quadraticCurveTo(-5, cy - 10, 0.5, cy - 10.4);
      ctx.quadraticCurveTo(5.4, cy - 10, 5, cy - 3.2);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -5, cy - 10, 5, cy - 3, hc, 0.25, -0.4), 0.9);
      ctx.fillStyle = L.trim ?? GOLD;
      ctx.fillRect(-4.6, cy - 5.2, 9.6, 1.4);
      // Feather
      ctx.beginPath();
      ctx.moveTo(-3.5, cy - 5);
      ctx.quadraticCurveTo(-10, cy - 10, -8.5, cy - 16);
      ctx.quadraticCurveTo(-6, cy - 10, -2.4, cy - 5.4);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -9, cy - 16, -3, cy - 5, L.accent ?? '#c84040', 0.3, -0.3), 0.6);
      break;
    }
    case 'turban': {
      ctx.beginPath();
      ctx.ellipse(0.2, cy - 3.2, 6.8, 5, 0, Math.PI * 0.85, Math.PI * 2.15);
      ctx.closePath();
      fillInk(ctx, rad(ctx, 0, cy - 4, 7, hc, 0.3, -0.4), 0.9);
      ctx.strokeStyle = alpha('#000000', 0.22);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-6, cy - 1.5 - i * 2);
        ctx.quadraticCurveTo(0, cy - 4 - i * 2.4 + (i % 2), 6.8, cy - 2.2 - i * 2);
        ctx.stroke();
      }
      if (!back && L.accent) {
        circle(ctx, 3.8, cy - 4.4, 1.2);
        fillInk(ctx, rad(ctx, 3.8, cy - 4.4, 1.2, L.accent), 0.5);
      }
      break;
    }
  }
}

function drawHood(ctx: CanvasRenderingContext2D, L: HumanoidLook, cy: number, back: boolean, t: number) {
  const hc = L.headColor;
  // Mantle across the shoulders.
  ctx.beginPath();
  ctx.moveTo(-7.8, -35);
  ctx.quadraticCurveTo(-8, -40, -4, -40.5);
  ctx.lineTo(5, -40.5);
  ctx.quadraticCurveTo(9, -40, 8.4, -35);
  ctx.quadraticCurveTo(0.5, -32, -7.8, -35);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -8, -41, 8, -33, hc, 0.2, -0.45), 0.9);
  // The cowl, peaked at the back.
  ctx.beginPath();
  ctx.moveTo(-5.5, cy + 5.5);
  ctx.quadraticCurveTo(-7.8, cy - 3, -4.5, cy - 7);
  ctx.quadraticCurveTo(-3.5, cy - 9.6, -6.2, cy - 11.5);
  ctx.quadraticCurveTo(2.5, cy - 10.5, 5.8, cy - 5);
  ctx.quadraticCurveTo(7.8, cy - 1, 6.6, cy + 5.5);
  ctx.closePath();
  fillInk(ctx, rad(ctx, 0, cy - 2, 9, hc, 0.25, -0.5), 1);
  if (back) {
    ctx.strokeStyle = alpha('#000000', 0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4.5, cy - 8);
    ctx.quadraticCurveTo(0, cy - 1, 0.5, cy + 5);
    ctx.stroke();
    return;
  }
  // The opening: shadowed, with a face or just eyes in the dark.
  ctx.beginPath();
  ctx.moveTo(-0.6, cy + 5);
  ctx.quadraticCurveTo(-1.6, cy - 3.8, 3.4, cy - 5.4);
  ctx.quadraticCurveTo(7.2, cy - 4, 6.4, cy + 4.6);
  ctx.closePath();
  if (L.openHood) {
    ctx.save();
    ctx.clip();
    ellipse(ctx, 2.6, cy + 0.2, 4.8, 5.8);
    ctx.fillStyle = rad(ctx, 3.6, cy, 5.5, L.skin, 0.15, -0.45);
    ctx.fill();
    if (L.hairUnder) {
      ctx.fillStyle = L.hairUnder;
      ctx.beginPath();
      ctx.moveTo(-1, cy - 4);
      ctx.quadraticCurveTo(3.5, cy - 6, 7, cy - 3);
      ctx.lineTo(6, cy - 1.8);
      ctx.quadraticCurveTo(2, cy - 3.6, -0.5, cy + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.translate(-0.5, 0.6);
    drawFace(ctx, L, cy);
    ctx.restore();
    drawBeard(ctx, L, cy + 0.6, false);
  } else {
    const g = ctx.createRadialGradient(3.4, cy, 0.5, 3, cy, 6.5);
    g.addColorStop(0, '#0a0606');
    g.addColorStop(0.8, '#140c0a');
    g.addColorStop(1, shade(hc, -0.6));
    ctx.fillStyle = g;
    ctx.fill();
    if (L.eyeGlow) {
      const flick = 0.85 + 0.15 * Math.sin(t * 5);
      ctx.fillStyle = art.dead ? '#201810' : L.eyeGlow;
      ctx.fillRect(1.6, cy - 0.6, 1.4, 0.9 * flick);
      ctx.fillRect(4.2, cy - 0.6, 1.2, 0.9 * flick);
      glow(ctx, 3.4, cy - 0.2, 6, L.eyeGlow, 0.5 * flick);
    }
  }
  ctx.strokeStyle = shade(hc, 0.25);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-0.6, cy + 5);
  ctx.quadraticCurveTo(-1.6, cy - 3.8, 3.4, cy - 5.4);
  ctx.stroke();
  if (L.accent && L.trim) {
    ctx.strokeStyle = L.trim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7.4, -35.4);
    ctx.quadraticCurveTo(0.5, -32.4, 8.2, -35.4);
    ctx.stroke();
  }
}

function drawShield(ctx: CanvasRenderingContext2D, L: HumanoidLook, sw: number, back: boolean) {
  const c = L.shield!;
  const shape = L.shieldShape ?? 'heater';
  ctx.save();
  ctx.translate(-8.8, -26.5 + sw * 0.4);
  ctx.rotate(-0.08);
  const path = () => {
    ctx.beginPath();
    if (shape === 'round') {
      ctx.ellipse(0, 0, 6.4, 7, 0, 0, Math.PI * 2);
    } else if (shape === 'heater') {
      ctx.moveTo(-6, -7.5);
      ctx.lineTo(6, -7.5);
      ctx.lineTo(6, -1);
      ctx.quadraticCurveTo(5, 6, 0, 9);
      ctx.quadraticCurveTo(-5, 6, -6, -1);
      ctx.closePath();
    } else if (shape === 'kite') {
      ctx.moveTo(0, -9);
      ctx.quadraticCurveTo(6.5, -8.5, 6, -2);
      ctx.quadraticCurveTo(4, 6, 0, 12);
      ctx.quadraticCurveTo(-4, 6, -6, -2);
      ctx.quadraticCurveTo(-6.5, -8.5, 0, -9);
      ctx.closePath();
    } else {
      roundRect(ctx, -6.5, -10, 13, 21, 2.2);
    }
  };
  path();
  if (back) {
    fillInk(ctx, lin(ctx, -6, -9, 6, 10, '#5a3e24', 0.15, -0.45), 1.1);
    ctx.fillStyle = LEATHER;
    ctx.fillRect(-4, -1.5, 8, 2);
    ctx.restore();
    return;
  }
  fillInk(ctx, lin(ctx, -6, -9, 6, 10, c, 0.3, -0.45), 1.1);
  // Device: a pale cross or chevron, then the metal rim and boss.
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = alpha(L.trim && L.trim !== '#3a2a1a' ? L.trim : '#e8dcc0', 0.55);
  if (shape === 'round') {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2 + 0.4);
      ctx.fillRect(-0.6, 1.5, 1.2, 6);
      ctx.restore();
    }
  } else {
    ctx.fillRect(-1, -10, 2, 22);
    ctx.fillRect(-7, -3.5, 14, 2);
  }
  ctx.fillStyle = alpha('#ffffff', 0.12);
  ctx.fillRect(-7, -10, 5, 22);
  ctx.restore();
  path();
  ctx.strokeStyle = shape === 'round' && c === '#b08040' ? '#e0b060' : METAL;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  circle(ctx, 0, shape === 'round' ? 0 : -1, 1.8);
  fillInk(ctx, rad(ctx, 0, -1, 1.9, METAL, 0.6, -0.4), 0.5);
  ctx.restore();
}

function drawWeaponArm(ctx: CanvasRenderingContext2D, L: HumanoidLook, sx: number, sy: number, hx: number, hy: number, tool: number, atk: number, t: number) {
  const B = L.build ?? 1;
  const mx = (sx + hx) / 2;
  const my = (sy + hy) / 2;
  // Elbow bends outward from the shoulder-hand line.
  const dx = hx - sx;
  const dy = hy - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ex = mx + (-dy / len) * -1.8;
  const ey = my + (dx / len) * -1.8 + 0.6;
  const sleeve = L.bareArms ? L.skin : L.armor === 'plate' ? L.body : L.robe ? L.body : shade(L.body, -0.05);
  const fore = L.gloves ?? (L.bareArms || !L.robe ? L.skin : L.body);
  const twoHand = L.weapon === 'bow' || L.weapon === 'staff';
  if (L.weapon === 'bow' && atk > 0) {
    // Draw hand pulls the string back toward the chest.
    limb(ctx, [-2, sy + 1, hx - 6 - atk * 4, hy + 0.5], 3.2 * B, shade(fore, -0.1));
  }
  limb(ctx, [sx, sy, ex, ey], 4 * B, lin(ctx, sx - 2, sy - 2, ex + 2, ey + 2, sleeve, 0.2, -0.35));
  if (L.robe && !L.bareArms) {
    // Wide sleeve cuff.
    limb(ctx, [ex, ey, (ex + hx) / 2, (ey + hy) / 2], 4.4 * B, shade(L.body, -0.08));
    limb(ctx, [(ex + hx) / 2, (ey + hy) / 2, hx, hy], 2.8 * B, L.gloves ?? L.skin);
  } else {
    limb(ctx, [ex, ey, hx, hy], 3.3 * B, lin(ctx, ex - 2, ey - 2, hx + 2, hy + 2, fore, 0.2, -0.3));
  }
  if (L.armor === 'plate' && !L.bareArms) {
    circle(ctx, ex, ey, 1.7);
    fillInk(ctx, rad(ctx, ex, ey, 1.8, METAL), 0.5);
  }
  drawWeapon(ctx, L, hx, hy, tool, atk, t);
  circle(ctx, hx, hy, 1.8 * B);
  fillInk(ctx, rad(ctx, hx, hy, 1.9, L.gloves ?? L.skin, 0.2, -0.35), 0.7);
  void twoHand;
}

function bladePath(ctx: CanvasRenderingContext2D, len: number, w: number, curve: number) {
  ctx.beginPath();
  ctx.moveTo(-w, -4);
  ctx.quadraticCurveTo(-w - curve * 0.5, -4 - len * 0.6, -w * 0.4 + curve, -4 - len + 1.5);
  ctx.lineTo(curve * 1.2, -4 - len - 0.5);
  ctx.quadraticCurveTo(w + curve * 0.6, -4 - len * 0.55, w, -4);
  ctx.closePath();
}

function drawWeapon(ctx: CanvasRenderingContext2D, L: HumanoidLook, hx: number, hy: number, tool: number, atk: number, t: number) {
  const w = L.weapon;
  if (!w) return;
  const id = L.weaponId ?? '';
  const tier = L.weaponTier ?? 1;
  const steel = L.weaponColor ?? '#c8ccd4';
  const glowC = L.weaponGlow;
  ctx.save();
  ctx.translate(hx, hy);
  if (w === 'bow') {
    ctx.rotate(atk > 0 ? -0.05 : 0.35);
    const r = 13 + tier;
    const wood = id === 'recurve_bow' || id === 'composite_bow' ? '#5a3a22' : '#7a5532';
    const pull = atk > 0 ? Math.sin(Math.min(1, atk * 1.4) * Math.PI * 0.5) * 7 : 0;
    const tipA = -1.25;
    const tx = -4 + Math.cos(tipA) * r;
    const ty = Math.sin(tipA) * r;
    ctx.strokeStyle = alpha('#f0ece0', 0.75);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(tx + 1.5, ty);
    ctx.lineTo(-4 - pull, 0);
    ctx.lineTo(tx + 1.5, -ty);
    ctx.stroke();
    if (atk > 0 && atk < 0.95) {
      ctx.strokeStyle = '#8a6a40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4 - pull, 0);
      ctx.lineTo(r + 2, 0);
      ctx.stroke();
      ctx.fillStyle = METAL;
      poly(ctx, [r + 2, -1.3, r + 5, 0, r + 2, 1.3]);
      ctx.fill();
      ctx.fillStyle = '#c84030';
      poly(ctx, [-4 - pull, 0, -1 - pull, -1.3, -0.6 - pull, 0, -1 - pull, 1.3]);
      ctx.fill();
    }
    // Limbs with recurved tips.
    ctx.beginPath();
    ctx.moveTo(tx + 1.5, ty);
    ctx.quadraticCurveTo(-1, -r * 0.8, -4 + r * 0.95, -2);
    ctx.lineTo(-4 + r * 0.95, 2);
    ctx.quadraticCurveTo(-1, r * 0.8, tx + 1.5, -ty);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.8;
    ctx.stroke();
    ctx.strokeStyle = lin(ctx, 0, -r, 0, r, wood, 0.3, -0.3);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = LEATHER;
    ctx.fillRect(-4 + r * 0.95 - 1.4, -2.4, 2.8, 4.8);
    if (glowC) glow(ctx, -4 + r * 0.6, 0, 14, glowC, 0.3 + 0.1 * Math.sin(t * 4));
    ctx.restore();
    return;
  }
  ctx.rotate(tool + Math.PI / 2);
  if (w === 'staff') {
    const top = -28 - tier;
    const g = lin(ctx, -1.5, 0, 1.5, 0, WOOD, 0.25, -0.4);
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.quadraticCurveTo(1.2, -6, -0.4, top + 4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // Knots and a wrapped grip.
    ctx.fillStyle = shade(WOOD, -0.3);
    for (const y of [-8, -17]) {
      ellipse(ctx, 0.6, y, 1.6, 1.1);
      ctx.fill();
    }
    ctx.fillStyle = LEATHER;
    ctx.fillRect(-1.4, -2, 2.8, 5);
    const orb = steel;
    const oy = top - 0.5;
    if (id === 'dial_staff') {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.4;
      circle(ctx, -0.4, oy, 4.6);
      ctx.stroke();
    } else {
      // Claw prongs gripping the orb.
      ctx.strokeStyle = shade(WOOD, -0.15);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-0.4, top + 4);
      ctx.quadraticCurveTo(-4.5, oy, -2, oy - 4);
      ctx.moveTo(-0.4, top + 4);
      ctx.quadraticCurveTo(4, oy, 1.6, oy - 4);
      ctx.stroke();
    }
    circle(ctx, -0.4, oy, 3.2);
    fillInk(ctx, rad(ctx, -0.4, oy, 3.4, orb, 0.6, -0.35), 0.6);
    const pulse = 0.5 + 0.2 * Math.sin(t * 3.5);
    glow(ctx, -0.4, oy, 12, glowC ?? orb, glowC ? pulse : pulse * 0.6);
    ctx.restore();
    return;
  }
  if (w === 'wand') {
    const wood = id === 'bone_wand' ? '#e0d8c0' : id === 'glass_wand' ? '#80d0d0' : '#8a6a40';
    limb(ctx, [0, 3, 0, -12], 1.9, lin(ctx, -1, 0, 1, 0, wood, 0.3, -0.3), 1.2);
    if (id === 'bone_wand') {
      circle(ctx, 0, -13.5, 2.2);
      fillInk(ctx, rad(ctx, 0, -13.5, 2.2, '#e8e0c8'), 0.6);
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(-1, -14, 0.8, 0.8);
      ctx.fillRect(0.4, -14, 0.8, 0.8);
    } else {
      poly(ctx, [0, -16, 1.6, -13, 0, -11, -1.6, -13]);
      fillInk(ctx, steel === '#c8ccd4' ? '#a070ff' : steel, 0.6);
    }
    glow(ctx, 0, -13.5, 8, glowC ?? (steel === '#c8ccd4' ? '#a070ff' : steel), 0.5);
    ctx.restore();
    return;
  }
  // Grip and pommel.
  limb(ctx, [0, 3, 0, -3.5], 2.4, w === 'club' ? WOOD : LEATHER, 1.2);
  if (w === 'sword' || w === 'dagger') {
    const curved = id === 'scimitar' || id === 'jambiya' ? 1.8 : 0;
    const len = w === 'dagger' ? 8 + tier : 17 + tier * 2.5 + (id === 'claymore' ? 3 : 0);
    const bw = w === 'dagger' ? 1.3 : id === 'claymore' || id === 'broad_sword' ? 2 : 1.6;
    if (id === 'khopesh') {
      ctx.beginPath();
      ctx.moveTo(-1.2, -4);
      ctx.lineTo(-1, -13);
      ctx.quadraticCurveTo(-1, -22, 6, -23);
      ctx.quadraticCurveTo(9, -22, 8, -19);
      ctx.quadraticCurveTo(3, -20, 1.4, -13);
      ctx.lineTo(1.2, -4);
      ctx.closePath();
    } else {
      bladePath(ctx, len, bw, curved);
    }
    fillInk(ctx, lin(ctx, -bw, 0, bw, 0, steel, 0.55, -0.35), 0.8);
    // Fuller and a glint that runs up the edge with the swing.
    ctx.strokeStyle = alpha('#000000', 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(curved * 0.2, -5.5);
    ctx.lineTo(curved * 0.6, -4 - len * 0.75);
    ctx.stroke();
    ctx.fillStyle = alpha('#ffffff', 0.7);
    const gy = -6 - ((t * 0.6 + atk) % 1) * len * 0.8;
    ctx.fillRect(-bw + 0.2, gy, 0.8, 1.6);
    // Crossguard
    const cg = tier >= 2 ? GOLD : '#8a7a58';
    ctx.beginPath();
    ctx.moveTo(-4.5 - tier * 0.4, -4.6 - (tier >= 3 ? 1 : 0));
    ctx.quadraticCurveTo(0, -3, 4.5 + tier * 0.4, -4.6 - (tier >= 3 ? 1 : 0));
    ctx.lineTo(4.5 + tier * 0.4, -3.2);
    ctx.quadraticCurveTo(0, -2, -4.5 - tier * 0.4, -3.2);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -4, -5, 4, -3, cg, 0.4, -0.3), 0.6);
    circle(ctx, 0, 4, 1.4);
    fillInk(ctx, rad(ctx, 0, 4, 1.4, cg), 0.5);
    if (tier >= 3) {
      circle(ctx, 0, -3.9, 0.9);
      ctx.fillStyle = '#e03030';
      ctx.fill();
    }
    if (glowC) glow(ctx, 0, -4 - len * 0.5, len * 0.75, glowC, 0.32 + 0.1 * Math.sin(t * 4));
    ctx.restore();
    return;
  }
  // Hafted weapons.
  const len = w === 'club' ? 13 : 15 + tier * 2 + (id === 'great_axe' ? 3 : 0);
  if (w === 'club') {
    ctx.beginPath();
    ctx.moveTo(-1.2, -3);
    ctx.lineTo(-2.6, -len);
    ctx.quadraticCurveTo(0, -len - 4.5, 2.6, -len);
    ctx.lineTo(1.2, -3);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -2.5, 0, 2.5, 0, WOOD, 0.3, -0.4), 0.8);
    ctx.fillStyle = shade(WOOD, -0.35);
    for (const [x, y] of [[-1, -9], [1, -12], [-0.5, -14.5]]) {
      circle(ctx, x, y, 0.8);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  limb(ctx, [0, -3.5, 0, -len], 2.2, lin(ctx, -1, 0, 1, 0, WOOD, 0.3, -0.35), 1.2);
  if (w === 'axe') {
    const head = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -len + 1);
      ctx.lineTo(s * 3, -len + 0.5);
      ctx.quadraticCurveTo(s * 8.5, -len - 3.5 - tier * 0.6, s * 9, -len + 1.5);
      ctx.quadraticCurveTo(s * 10, -len + 6.5 + tier * 0.6, s * 8, -len + 9);
      ctx.quadraticCurveTo(s * 5.5, -len + 5, s * 3, -len + 5);
      ctx.lineTo(0, -len + 4.6);
      ctx.closePath();
      fillInk(ctx, lin(ctx, 0, -len - 3, s * 9, -len + 8, steel, 0.5, -0.35), 0.8);
      ctx.strokeStyle = alpha('#ffffff', 0.6);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(s * 9, -len + 0.5);
      ctx.quadraticCurveTo(s * 10, -len + 5, s * 8.2, -len + 8.5);
      ctx.stroke();
    };
    head(1);
    if (id === 'great_axe' || id === 'crescent_axe' || tier >= 3) head(-1);
    ctx.fillStyle = METAL;
    ctx.fillRect(-1.6, -len - 0.5, 3.2, 1.6);
  } else {
    // Mace family: flanged mace, spiked morning star, the smith's hammer.
    const cy = -len - 2.5;
    if (id === 'hammer') {
      roundRect(ctx, -3.8, cy - 2.6, 7.6, 5.2, 0.8);
      fillInk(ctx, lin(ctx, -4, cy - 3, 4, cy + 3, steel, 0.45, -0.35), 0.8);
    } else if (id === 'morning_star' || id === 'sun_flail') {
      ctx.fillStyle = id === 'sun_flail' ? GOLD : steel;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * (id === 'sun_flail' ? 1.5 : 0);
        poly(ctx, [Math.cos(a - 0.3) * 3, cy + Math.sin(a - 0.3) * 3, Math.cos(a) * 6, cy + Math.sin(a) * 6, Math.cos(a + 0.3) * 3, cy + Math.sin(a + 0.3) * 3]);
        ctx.fill();
      }
      circle(ctx, 0, cy, 3.6);
      fillInk(ctx, rad(ctx, 0, cy, 3.8, id === 'sun_flail' ? GOLD : steel, 0.5, -0.45), 0.8);
      if (id === 'sun_flail') glow(ctx, 0, cy, 10, '#ffc040', 0.4);
    } else {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        poly(ctx, [Math.cos(a - 0.45) * 2.6, cy + Math.sin(a - 0.45) * 3.2, Math.cos(a) * 5, cy + Math.sin(a) * 5.6, Math.cos(a + 0.45) * 2.6, cy + Math.sin(a + 0.45) * 3.2]);
        fillInk(ctx, lin(ctx, -5, cy - 5, 5, cy + 5, steel, 0.45, -0.4), 0.6);
      }
      ellipse(ctx, 0, cy, 3, 3.4);
      fillInk(ctx, rad(ctx, 0, cy, 3.4, steel, 0.5, -0.45), 0.7);
    }
  }
  if (glowC) glow(ctx, 0, -len, 10, glowC, 0.35 + 0.1 * Math.sin(t * 4));
  ctx.restore();
}
