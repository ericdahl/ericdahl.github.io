// Monster bodies. Figure space as in figures.ts: feet at (0,0), facing +x.
import {
  alpha, art, circle, drawHumanoid, slitEyes, swingPose, ellipse, mix, eyes, fillInk, glow, ink, INK, lin, limb, poly, rad, roundRect, shade,
  type HumanoidLook, type Pose,
} from './figures';

export interface MonsterDrawOpts {
  /** Corpse: no glowing eyes or auras. */
  dead?: boolean;
  /** The monster def id, for variants that share a shape (jackal/hound, golem/brute...). */
  id?: string;
}

interface S {
  sw: number;
  atk: number;
  t: number;
  pose: Pose;
  id: string;
}

const BONE = '#e8dfc6';
const RUST = '#8a7a6a';

/** Monster figures, feet at (0,0). `t` is a free-running time for idle motion. */
export function drawMonsterShape(ctx: CanvasRenderingContext2D, shape: string, color: string, pose: Pose, t: number, opts: MonsterDrawOpts = {}) {
  const prevDead = art.dead;
  art.dead = !!opts.dead;
  ctx.save();
  if (pose.dir < 0) ctx.scale(-1, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s: S = {
    sw: pose.moving ? Math.sin(pose.walk * 3.5) : 0,
    atk: pose.attack > 0 ? Math.sin(pose.attack * Math.PI) : 0,
    t,
    pose,
    id: opts.id ?? shape,
  };
  try {
    switch (shape) {
      case 'imp': imp(ctx, color, s, false); break;
      case 'hexer': imp(ctx, color, s, true); break;
      case 'ghoul': ghoul(ctx, color, s); break;
      case 'glutton': glutton(ctx, color, s); break;
      case 'skeleton':
      case 'archer':
      case 'warden': skeleton(ctx, color, s, shape); break;
      case 'bat': bat(ctx, color, s); break;
      case 'hound': hound(ctx, color, s); break;
      case 'brute': if (s.id === 'grave_golem') golem(ctx, color, s); else brute(ctx, color, s); break;
      case 'wraith': wraith(ctx, color, s); break;
      case 'cultist':
      case 'bishop':
      case 'raider':
      case 'acolyte':
      case 'mirage':
      case 'corvin': robed(ctx, shape, color, s); break;
      case 'scarab': scarab(ctx, color, s); break;
      case 'scorpion': scorpion(ctx, color, s); break;
      case 'burrower': burrower(ctx, color, s); break;
      case 'kite': kite(ctx, color, s); break;
      case 'mummy': mummy(ctx, color, s); break;
      case 'colossus': colossus(ctx, color, s); break;
      case 'noon': noon(ctx, color, s); break;
      case 'mother': mother(ctx, color, s); break;
    }
  } finally {
    ctx.restore();
    art.dead = prevDead;
  }
}

/** A curved stroke with an ink outline. */
function curve(ctx: CanvasRenderingContext2D, build: () => void, w: number, color: string | CanvasGradient, outline = 1.4) {
  build();
  if (outline > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + outline;
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function horn(ctx: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, bend: number, w: number, c = '#e8d8b0') {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo((x + tx) / 2 + bend - w * 0.4, (y + ty) / 2, tx, ty);
  ctx.quadraticCurveTo((x + tx) / 2 + bend + w * 0.4, (y + ty) / 2 + w * 0.3, x + w, y);
  ctx.closePath();
  fillInk(ctx, lin(ctx, x, y, tx, ty, c, 0.3, -0.45), 0.7);
}

function claws(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, c = '#e8dcc0') {
  ctx.strokeStyle = c;
  ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    const a = ang + i * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.7, y + Math.sin(a) * len * 0.7 - 0.6, x + Math.cos(a + 0.3) * len, y + Math.sin(a + 0.3) * len);
    ctx.stroke();
  }
}

function teeth(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, n: number, h: number, up = false, c = '#f0e8d0') {
  ctx.fillStyle = c;
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    poly(ctx, [x, y, x + step / 2, y + (up ? -h : h), x + step, y]);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ act 1

function imp(ctx: CanvasRenderingContext2D, c: string, s: S, hexer: boolean) {
  const { sw, atk, t } = s;
  const dark = shade(c, -0.38);
  // Barbed tail
  const tx = -12 + Math.sin(t * 3) * 1.5;
  const ty = -25 + Math.cos(t * 2.4);
  curve(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-3, -13);
    ctx.bezierCurveTo(-13, -11 + sw, -16, -20, tx, ty);
  }, 1.6, dark);
  poly(ctx, [tx - 1.8, ty + 1.2, tx + 0.5, ty - 3.4, tx + 2.2, ty + 0.6]);
  fillInk(ctx, dark, 0.6);
  if (!hexer) {
    // Stubby leathery wings
    const f = Math.sin(t * 10) * 0.5 + 0.5;
    ctx.beginPath();
    ctx.moveTo(-1, -25);
    ctx.lineTo(-10, -33 - f * 4);
    ctx.lineTo(-15, -29 - f * 3);
    ctx.quadraticCurveTo(-12, -27, -12.5, -23 - f);
    ctx.quadraticCurveTo(-9, -23.5, -8.5, -20);
    ctx.quadraticCurveTo(-5, -21, -2, -19);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -14, -33, -2, -19, shade(c, -0.45), 0.15, -0.3), 0.8);
    ctx.strokeStyle = alpha('#000000', 0.4);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-10, -33 - f * 4);
    ctx.lineTo(-12.5, -23 - f);
    ctx.moveTo(-10, -33 - f * 4);
    ctx.lineTo(-8.5, -20);
    ctx.stroke();
  }
  // Goat legs: thigh back, shin forward, hoof.
  const leg = (hx: number, k: number, far: boolean) => {
    const col = far ? dark : shade(c, -0.15);
    limb(ctx, [hx, -13, hx - 3 + k * 3, -7.5, hx - 0.5 + k * 4.2, -1.6], far ? 2.8 : 3.2, col, 1.2);
    ellipse(ctx, hx + 0.6 + k * 4.2, -0.9, 1.9, 1.1);
    fillInk(ctx, '#1e1410', 0.5);
  };
  leg(-1.5, -sw, true);
  leg(2.2, sw, false);
  // Hunched body with a paler belly.
  ellipse(ctx, 0, -18.5, 6.8, 8.4, 0.35);
  fillInk(ctx, rad(ctx, 0, -19, 8.5, c, 0.3, -0.5), 1);
  ellipse(ctx, 2.6, -16.5, 3, 5, 0.3);
  ctx.fillStyle = alpha(shade(c, 0.35), 0.45);
  ctx.fill();
  ctx.strokeStyle = alpha('#000000', 0.25);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0.8 + i * 0.4, -20 + i * 2.4);
    ctx.lineTo(4.4 + i * 0.2, -19.5 + i * 2.4);
    ctx.stroke();
  }
  if (hexer) {
    // Ragged shawl and a necklace of little bones.
    ctx.beginPath();
    ctx.moveTo(-6, -25);
    ctx.quadraticCurveTo(1, -29, 7, -24);
    ctx.lineTo(6, -17);
    ctx.lineTo(4, -19);
    ctx.lineTo(2, -15);
    ctx.lineTo(0, -18);
    ctx.lineTo(-2.5, -14.5);
    ctx.lineTo(-4, -18);
    ctx.lineTo(-6.5, -16);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -6, -28, 6, -15, '#5e3418', 0.2, -0.4), 0.8);
    ctx.fillStyle = BONE;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + i * 0.17);
      ctx.fillRect(1 + Math.cos(a) * 4.5 - 0.5, -26 + Math.sin(a) * 2.5, 1, 2);
    }
  }
  // Far arm
  limb(ctx, [-2.5, -23, -5.5, -18, -4.5 + sw, -13], 2.2, dark, 1.1);
  claws(ctx, -4.5 + sw, -13, 1.4, 2.4);
  // Head: snout forward, swept-back horns, pointed ear.
  const hy = -28 + Math.sin(t * 4) * 0.4;
  poly(ctx, [0.5, hy, -5, hy - 3.5, -0.5, hy + 2]);
  fillInk(ctx, shade(c, -0.15), 0.7);
  ellipse(ctx, 3.8, hy, 5, 4.8);
  fillInk(ctx, rad(ctx, 4, hy, 5.2, c, 0.3, -0.45), 1);
  ellipse(ctx, 7.6, hy + 1.6, 3, 2.3, 0.2);
  fillInk(ctx, rad(ctx, 7.6, hy + 1.4, 3, shade(c, 0.08), 0.3, -0.4), 0.8);
  horn(ctx, 1.5, hy - 3.5, -3.5, hy - 10.5, 2.2, 1.3);
  horn(ctx, 5, hy - 4.2, 6, hy - 11.5, -2.5, 1.2);
  // Grin
  ctx.fillStyle = '#2a0806';
  ctx.beginPath();
  ctx.moveTo(5.6, hy + 2.8);
  ctx.quadraticCurveTo(8, hy + 4.4 + atk * 1.5, 10.2, hy + 2.4);
  ctx.quadraticCurveTo(8, hy + 3.2, 5.6, hy + 2.8);
  ctx.fill();
  teeth(ctx, 6.4, 9.8, hy + 2.9, 4, 0.9);
  eyes(ctx, 6.2, hy - 1.1, 3.2, '#ffd040', 1.05);
  // Weapon arm
  const hx2 = 10 + atk * 5;
  const hy2 = -21 - atk * 4;
  limb(ctx, [3.5, -22.5, 7.5, -19, hx2, hy2], 2.5, shade(c, -0.05), 1.1);
  if (hexer) {
    // Bone staff topped with a horned skull and a hex-fire.
    const topY = -41;
    limb(ctx, [hx2 - 1, hy2 + 8, hx2 + 1.5, topY + 3], 1.6, '#6a4a2a', 1.2);
    circle(ctx, hx2 + 1.5, topY, 2.8);
    fillInk(ctx, rad(ctx, hx2 + 1.5, topY, 3, BONE), 0.7);
    ctx.fillStyle = '#1a0c06';
    ctx.fillRect(hx2 + 1.4, topY - 0.6, 1, 1);
    ctx.fillRect(hx2 + 2.8, topY - 0.6, 0.9, 1);
    const fl = 0.5 + 0.3 * Math.sin(t * 6);
    glow(ctx, hx2 + 1.5, topY - 1, 10, '#ff8c28', fl);
    if (!art.dead) {
      ctx.fillStyle = alpha('#ffb040', 0.8);
      ctx.beginPath();
      ctx.moveTo(hx2 - 0.5, topY - 2);
      ctx.quadraticCurveTo(hx2 + 1.5, topY - 8 - Math.sin(t * 9) * 1.5, hx2 + 3.5, topY - 2);
      ctx.fill();
    }
  } else {
    // Little trident
    const bx = hx2 - 2;
    const by = hy2 + 6;
    const ex = hx2 + 3 + atk * 3;
    const ey = hy2 - 13 - atk * 2;
    limb(ctx, [bx, by, ex, ey], 1.3, '#5a4030', 1);
    const a = Math.atan2(ey - by, ex - bx);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    ctx.strokeStyle = '#9a9aa2';
    ctx.lineWidth = 1;
    for (const k of [-1.6, 0, 1.6]) {
      ctx.beginPath();
      ctx.moveTo(ex + px * k, ey + py * k);
      ctx.lineTo(ex + px * k + Math.cos(a) * 3.5, ey + py * k + Math.sin(a) * 3.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(ex - px * 1.8, ey - py * 1.8);
    ctx.lineTo(ex + px * 1.8, ey + py * 1.8);
    ctx.stroke();
  }
  circle(ctx, hx2, hy2, 1.4);
  fillInk(ctx, c, 0.6);
}

function ghoul(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const dark = shade(c, -0.4);
  // Legs: bony, knock-kneed.
  limb(ctx, [-2, -15, -3.2 - sw * 3, -8, -3 - sw * 4.6, -1.2], 3.2, dark, 1.2);
  limb(ctx, [2.2, -15, 3 + sw * 3, -8, 3.2 + sw * 4.6, -1.2], 3.6, shade(c, -0.12), 1.2);
  for (const [x, col] of [[-3 - sw * 4.6, dark], [3.2 + sw * 4.6, shade(c, -0.12)]] as const) {
    ellipse(ctx, x + 1.6, -0.8, 2.6, 1.1);
    fillInk(ctx, col, 0.6);
  }
  // Far arm hangs low.
  limb(ctx, [-2, -30, -4.5, -22, -3 + sw * 2, -13], 2.6, dark, 1.2);
  claws(ctx, -3 + sw * 2, -13, 1.6, 3);
  // Hunched torso
  ctx.beginPath();
  ctx.moveTo(-5, -15);
  ctx.quadraticCurveTo(-9, -24, -6, -31);
  ctx.quadraticCurveTo(-2, -36, 5, -33);
  ctx.quadraticCurveTo(9, -28, 7, -21);
  ctx.quadraticCurveTo(6, -16, 4, -15);
  ctx.closePath();
  fillInk(ctx, rad(ctx, -1, -26, 11, c, 0.25, -0.5), 1);
  // Ribs and spine knobs
  ctx.strokeStyle = alpha(shade(c, -0.55), 0.8);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0.5 + i * 0.3, -29 + i * 2.6);
    ctx.quadraticCurveTo(4 + i * 0.3, -30 + i * 2.6, 6.5 - i * 0.2, -27.5 + i * 2.6);
    ctx.stroke();
  }
  ctx.fillStyle = shade(c, 0.2);
  for (let i = 0; i < 4; i++) {
    circle(ctx, -7 + i * 0.7 + (i > 2 ? 0.8 : 0), -29 + i * 3.4, 0.9);
    ctx.fill();
  }
  // Tattered loincloth
  ctx.beginPath();
  ctx.moveTo(-5.2, -17);
  ctx.lineTo(4.6, -17.5);
  ctx.lineTo(4, -11);
  ctx.lineTo(2.2, -13);
  ctx.lineTo(0.8, -9.5);
  ctx.lineTo(-1, -12.5);
  ctx.lineTo(-3, -10);
  ctx.lineTo(-4.6, -13);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -5, -17, 4, -10, '#4a3a2a', 0.15, -0.4), 0.8);
  // Head thrust forward, jaw hanging.
  const hx = 8;
  const hy = -33 + Math.sin(t * 2.5) * 0.5;
  ellipse(ctx, hx, hy, 4.6, 4.2);
  fillInk(ctx, rad(ctx, hx, hy, 4.8, shade(c, 0.1), 0.3, -0.45), 1);
  ctx.fillStyle = '#200a06';
  poly(ctx, [hx + 1, hy + 2, hx + 5, hy + 1.2, hx + 4.6, hy + 4.4 + atk * 2, hx + 1.4, hy + 3.6 + atk]);
  ctx.fill();
  teeth(ctx, hx + 1.4, hx + 4.8, hy + 1.6, 4, 1.1);
  ctx.fillStyle = shade(c, -0.05);
  poly(ctx, [hx + 1, hy + 3.6 + atk, hx + 4.8, hy + 4.4 + atk * 2, hx + 4, hy + 5.6 + atk * 2, hx + 0.6, hy + 4.8 + atk]);
  fillInk(ctx, shade(c, -0.05), 0.6);
  ctx.strokeStyle = alpha('#2a2a18', 0.7);
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 3 + i * 1.6, hy - 3.6);
    ctx.quadraticCurveTo(hx - 5 + i, hy - 1, hx - 4.5 + i * 0.8, hy + 2 + (i % 2));
    ctx.stroke();
  }
  // Sunken sockets with a sickly glow.
  ctx.fillStyle = '#1a1208';
  ellipse(ctx, hx + 1.6, hy - 0.8, 1.4, 1.1);
  ellipse(ctx, hx + 4, hy - 0.6, 1.1, 1);
  ctx.fill();
  eyes(ctx, hx + 2.8, hy - 0.7, 2.4, '#d0ff60', 0.6);
  // Reaching arm
  const ax = 13 + atk * 8;
  const ay = -17 - atk * 9;
  limb(ctx, [4, -29, 9 + atk * 3, -25 - atk * 4, ax, ay], 3, shade(c, -0.05), 1.2);
  claws(ctx, ax, ay, 0.6 - atk * 0.8, 3.6);
}

function glutton(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const dark = shade(c, -0.38);
  limb(ctx, [-5, -14, -6 + sw * 3, -2], 7, dark, 1.6);
  limb(ctx, [5, -14, 6 - sw * 3, -2], 7.4, shade(c, -0.15), 1.6);
  ellipse(ctx, -5 + sw * 3, -1.2, 4.6, 2);
  fillInk(ctx, '#2a1e14', 0.8);
  ellipse(ctx, 7.5 - sw * 3, -1.2, 4.8, 2.1);
  fillInk(ctx, '#3a2a1c', 0.8);
  // Far arm, flabby
  limb(ctx, [-12, -34, -18, -25, -16 + sw, -15], 6, dark, 1.4);
  circle(ctx, -16 + sw, -14.5, 3);
  fillInk(ctx, dark, 0.8);
  // Belly
  const br = Math.sin(t * 2) * 0.6;
  ellipse(ctx, 0, -24 + br * 0.3, 17 + br, 16);
  fillInk(ctx, rad(ctx, 1, -26, 18, c, 0.3, -0.5), 1.3);
  // Flab folds, navel and a ragged stitched scar.
  ctx.strokeStyle = alpha(shade(c, -0.55), 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(2, -40, 12, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(1, -12, 13, 4, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ellipse(ctx, 3, -20, 1.2, 1.6);
  ctx.fillStyle = shade(c, -0.6);
  ctx.fill();
  ctx.strokeStyle = '#5a2018';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-8, -30);
  ctx.quadraticCurveTo(-2, -23, 9, -26);
  ctx.stroke();
  ctx.strokeStyle = '#2a1410';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    const x = -7 + i * 2.8;
    const y = -29 + Math.sin(i * 0.9) * 1.2 + i * 0.8 - (i > 3 ? (i - 3) * 1.6 : 0);
    ctx.beginPath();
    ctx.moveTo(x - 0.8, y - 1.2);
    ctx.lineTo(x + 0.8, y + 1.2);
    ctx.stroke();
  }
  // Butcher's apron, bloodied
  ctx.beginPath();
  ctx.moveTo(-3, -34);
  ctx.lineTo(10, -33);
  ctx.quadraticCurveTo(14, -22, 11, -10);
  ctx.lineTo(-2, -10);
  ctx.quadraticCurveTo(-5, -22, -3, -34);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -3, -34, 12, -10, '#9a8e78', 0.15, -0.4), 0.9);
  ctx.fillStyle = alpha('#6a0c08', 0.75);
  for (const [x, y, r] of [[3, -20, 2.6], [7, -15, 1.8], [1, -28, 1.4], [8, -26, 1.2], [4, -12, 1.8]] as const) {
    ellipse(ctx, x, y, r, r * 0.8);
    ctx.fill();
  }
  // Tiny head, chins, drool
  const hy = -42;
  ellipse(ctx, 4, hy + 4.5, 6.5, 3);
  fillInk(ctx, shade(c, -0.05), 0.8);
  ellipse(ctx, 4, hy, 6, 6);
  fillInk(ctx, rad(ctx, 4, hy, 6.4, shade(c, 0.1), 0.3, -0.45), 1);
  ctx.fillStyle = '#280806';
  ctx.beginPath();
  ctx.moveTo(4.5, hy + 2);
  ctx.quadraticCurveTo(7.5, hy + 4.5 + atk * 2, 10, hy + 1.6);
  ctx.quadraticCurveTo(7.5, hy + 2.6, 4.5, hy + 2);
  ctx.fill();
  teeth(ctx, 5.2, 9.6, hy + 2.1, 5, 1);
  if (!art.dead) {
    ctx.strokeStyle = alpha('#c0d870', 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(6, hy + 3.6);
    ctx.lineTo(6.2, hy + 6 + Math.sin(t * 3) * 1.5);
    ctx.stroke();
  }
  eyes(ctx, 5.8, hy - 1.6, 3.4, '#d0ff60', 0.9);
  // Cleaver arm
  const hx = 19 + atk * 6;
  const hy2 = -18 - atk * 14;
  limb(ctx, [12, -34, 18 + atk * 4, -26 - atk * 8, hx, hy2], 6, shade(c, -0.05), 1.4);
  ctx.save();
  ctx.translate(hx, hy2);
  ctx.rotate(-0.4 - atk * 1.4);
  limb(ctx, [0, 2, 0, -4], 2, '#4a3020', 1);
  poly(ctx, [-1.5, -4, -1.5, -15, 7, -16, 7, -5]);
  fillInk(ctx, lin(ctx, -1, -15, 7, -4, '#b8b8c0', 0.4, -0.4), 0.9);
  ctx.fillStyle = alpha('#6a0c08', 0.7);
  ctx.fillRect(3, -10, 4, 5);
  circle(ctx, 0.5, -13, 0.9);
  ctx.fillStyle = '#1a1410';
  ctx.fill();
  ctx.restore();
  circle(ctx, hx, hy2, 3);
  fillInk(ctx, shade(c, 0.05), 0.8);
}

function bone(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, c: string) {
  limb(ctx, [x1, y1, x2, y2], w, c, 1.3);
  ctx.fillStyle = c;
  circle(ctx, x2, y2, w * 0.62);
  ctx.fill();
}

function skeleton(ctx: CanvasRenderingContext2D, c: string, s: S, shape: string) {
  const { sw, atk, t, pose } = s;
  const big = shape === 'warden';
  const archer = shape === 'archer';
  const raised = s.id === 'raised_skeleton';
  if (big) ctx.scale(1.5, 1.5);
  const dark = shade(c, -0.3);
  const eye = big ? '#60c0ff' : raised ? '#90ff70' : '#ff4020';
  if (big) {
    // Tattered burial cloak behind.
    ctx.beginPath();
    ctx.moveTo(-6, -37);
    ctx.lineTo(6, -37);
    ctx.quadraticCurveTo(8, -18, 7 - Math.abs(sw) * 2, -4);
    for (let i = 0; i < 6; i++) ctx.lineTo(5 - i * 2.6 - Math.abs(sw) * 2, -4 + (i % 2 ? -3 : 0.5));
    ctx.quadraticCurveTo(-11, -20, -6, -37);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -10, -36, 8, -4, '#2a2e3a', 0.1, -0.45), 0.9);
  }
  // Legs
  const leg = (hx: number, k: number, col: string) => {
    const kx = hx + k * 3;
    const fx = hx + k * 5.2;
    bone(ctx, hx, -19, kx, -10, 1.8, col);
    bone(ctx, kx, -10, fx, -1.6, 1.5, col);
    poly(ctx, [fx - 0.8, -2.2, fx + 3, -1.2, fx + 2.8, -0.2, fx - 1, -0.4]);
    fillInk(ctx, col, 0.5);
  };
  leg(-2.4, -sw, dark);
  // Far arm
  if (archer) {
    // Bow arm extended forward
    bone(ctx, -4.5, -35, 1, -32, 1.5, dark);
    bone(ctx, 1, -32, 7, -31, 1.3, dark);
  } else if (!big) {
    bone(ctx, -5, -35, -6.5 - sw, -28, 1.5, dark);
    bone(ctx, -6.5 - sw, -28, -5.5 - sw * 2, -21, 1.3, dark);
  }
  leg(2.4, sw, c);
  // Pelvis
  ctx.beginPath();
  ctx.moveTo(-4.5, -21);
  ctx.quadraticCurveTo(-5, -17, -2, -17.5);
  ctx.lineTo(0, -19);
  ctx.lineTo(2, -17.5);
  ctx.quadraticCurveTo(5, -17, 4.5, -21);
  ctx.quadraticCurveTo(0, -23, -4.5, -21);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -4, -22, 4, -17, c, 0.25, -0.4), 0.8);
  // Spine
  for (let i = 0; i < 6; i++) {
    roundRect(ctx, -1.2, -23 - i * 2.2, 2.4, 1.6, 0.6);
    fillInk(ctx, i % 2 ? c : shade(c, -0.1), 0.5);
  }
  // Ribcage
  for (let i = 0; i < 4; i++) {
    const y = -34 + i * 2.5;
    const w = 6 - i * 0.7;
    ctx.beginPath();
    ctx.ellipse(0.4, y, w, 2, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.3;
    ctx.stroke();
    ctx.strokeStyle = i % 2 ? shade(c, -0.08) : c;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  limb(ctx, [0.6, -35, 0.8, -28], 1.4, c, 1);
  // Clavicles
  limb(ctx, [-5.2, -36.4, 5.6, -36.4], 1.5, c, 1.1);
  if (big) {
    // Pauldron and a rusted breastplate strap.
    ctx.beginPath();
    ctx.ellipse(-5.5, -36, 4, 3, -0.3, Math.PI, Math.PI * 2);
    ctx.closePath();
    fillInk(ctx, rad(ctx, -5.5, -37, 4, '#5a6068', 0.4, -0.45), 0.8);
    limb(ctx, [-5, -36, 5, -24], 1.4, '#4a3828', 0.8);
  }
  // Skull
  const hy = -43.5 + (pose.moving ? Math.abs(sw) * -0.5 : Math.sin(t * 2) * 0.3);
  ellipse(ctx, 0.6, hy, 4.9, 5);
  fillInk(ctx, rad(ctx, 0.6, hy, 5.2, c, 0.35, -0.4), 1);
  const jawOpen = atk * 1.5 + (archer ? 0 : Math.max(0, Math.sin(t * 3)) * 0.4);
  roundRect(ctx, 0.4, hy + 3 + jawOpen, 5.2, 2.6, 1);
  fillInk(ctx, shade(c, -0.05), 0.7);
  ctx.strokeStyle = alpha('#000000', 0.55);
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(1.4 + i * 1.1, hy + 3 + jawOpen);
    ctx.lineTo(1.4 + i * 1.1, hy + 4.4 + jawOpen);
    ctx.stroke();
  }
  ctx.fillStyle = '#140c08';
  ellipse(ctx, 1.8, hy - 0.2, 1.5, 1.6);
  ellipse(ctx, 4.6, hy - 0.1, 1.2, 1.5);
  ctx.fill();
  poly(ctx, [4.2, hy + 1.6, 5, hy + 2.8, 3.6, hy + 2.8]);
  ctx.fill();
  eyes(ctx, 3.2, hy - 0.2, 2.8, eye, 0.6);
  if (big) {
    // Horned iron crown
    ctx.beginPath();
    ctx.moveTo(-4.4, hy - 2.5);
    ctx.lineTo(-3.5, hy - 7);
    ctx.lineTo(-1.5, hy - 4.5);
    ctx.lineTo(0.6, hy - 8.5);
    ctx.lineTo(2.6, hy - 4.5);
    ctx.lineTo(4.8, hy - 7.5);
    ctx.lineTo(5.6, hy - 2.5);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -4, hy - 8, 5, hy - 2, '#6a7078', 0.4, -0.4), 0.8);
    horn(ctx, -3.6, hy - 3.5, -9, hy - 9, -2, 1.1, '#c8c0a8');
    glow(ctx, 2, hy, 12, '#60c0ff', 0.25 + 0.1 * Math.sin(t * 3));
  }
  if (archer) {
    // Bow held out front, string drawn back by the near hand.
    const pull = s.pose.attack > 0 ? Math.sin(Math.min(1, s.pose.attack * 1.3) * Math.PI * 0.5) * 6 : 0;
    ctx.strokeStyle = alpha('#e8e0d0', 0.7);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(4.5, -42);
    ctx.lineTo(4.8 - pull, -31);
    ctx.lineTo(4.5, -20);
    ctx.stroke();
    curve(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(4.5, -42);
      ctx.quadraticCurveTo(12, -37, 9, -31);
      ctx.quadraticCurveTo(12, -25, 4.5, -20);
    }, 1.8, '#6b5030', 1.2);
    if (pull > 1) {
      limb(ctx, [4.8 - pull, -31, 15, -31], 0.8, '#8a6a40', 0);
      ctx.fillStyle = RUST;
      poly(ctx, [15, -32, 17.5, -31, 15, -30]);
      ctx.fill();
    }
    bone(ctx, 4.5, -35, 3 - pull * 0.4, -31, 1.5, c);
    bone(ctx, 3 - pull * 0.4, -31, 4.8 - pull, -31, 1.3, c);
  } else {
    // Sword arm (rusted blade), with a shield on the far arm for the Warden.
    if (big) {
      ctx.save();
      ctx.translate(-7.5, -27 + sw * 0.4);
      roundRect(ctx, -4.6, -7, 9.2, 15, 2);
      fillInk(ctx, lin(ctx, -4, -7, 4, 8, '#4a4e58', 0.3, -0.45), 1);
      ctx.strokeStyle = '#8a8e98';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      circle(ctx, 0, 0, 2.2);
      fillInk(ctx, rad(ctx, 0, 0, 2.2, BONE), 0.5);
      ctx.fillStyle = '#140c08';
      ctx.fillRect(-1.1, -0.6, 0.8, 0.8);
      ctx.fillRect(0.4, -0.6, 0.8, 0.8);
      ctx.restore();
    }
    const sp = swingPose(s.pose.attack, 0, big ? 'axe' : 'sword');
    const hx = 5 + Math.cos(sp.arm) * 9.5;
    const hy2 = -35 + Math.sin(sp.arm) * 9.5;
    const ex = (5 + hx) / 2 + 1.2;
    const ey = (-35 + hy2) / 2 + 1;
    bone(ctx, 5, -35, ex, ey, 1.5, c);
    ctx.save();
    ctx.translate(hx, hy2);
    ctx.rotate(sp.tool + Math.PI / 2);
    if (big) {
      // Great axe
      limb(ctx, [0, 6, 0, -22], 1.8, '#4a3828', 1.1);
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.quadraticCurveTo(9, -26, 9, -18);
      ctx.quadraticCurveTo(10, -12, 7, -10);
      ctx.quadraticCurveTo(4, -15, 0, -15);
      ctx.closePath();
      fillInk(ctx, lin(ctx, 0, -25, 9, -10, '#9aa0a8', 0.45, -0.4), 0.8);
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.quadraticCurveTo(-6, -23, -5.5, -17);
      ctx.quadraticCurveTo(-3, -16, 0, -16.5);
      ctx.closePath();
      fillInk(ctx, '#7a8088', 0.6);
    } else {
      limb(ctx, [0, 2.5, 0, -3], 1.6, '#3a2a1a', 1);
      ctx.beginPath();
      ctx.moveTo(-1.2, -3.5);
      ctx.lineTo(-1, -16);
      ctx.lineTo(0.2, -18);
      ctx.lineTo(1.3, -15.5);
      ctx.lineTo(1.2, -10);
      ctx.lineTo(0.6, -9);
      ctx.lineTo(1.2, -7.5);
      ctx.lineTo(1.2, -3.5);
      ctx.closePath();
      fillInk(ctx, lin(ctx, -1, 0, 1, 0, '#a09888', 0.3, -0.35), 0.7);
      ctx.fillStyle = alpha('#6a3818', 0.6);
      ctx.fillRect(-1, -12, 1.5, 3);
      ctx.fillRect(0, -6, 1.2, 1.6);
      limb(ctx, [-3.2, -3.6, 3.2, -3.6], 1.2, '#6a5a40', 0.8);
    }
    ctx.restore();
    bone(ctx, ex, ey, hx, hy2, 1.3, c);
  }
}

function bat(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { atk, t } = s;
  const flap = Math.sin(t * 18);
  ctx.translate(0, -26 + Math.sin(t * 4) * 3);
  const mem = shade(c, -0.3);
  const wing = (side: number) => {
    const tipY = -7 - flap * 9;
    const midY = -3 - flap * 5;
    ctx.beginPath();
    ctx.moveTo(side * 2.5, -2);
    ctx.lineTo(side * 9, midY - 2);
    ctx.lineTo(side * 17, tipY);
    ctx.quadraticCurveTo(side * 15, tipY + 4, side * 14.5, tipY + 7 + flap * 2);
    ctx.quadraticCurveTo(side * 12, tipY + 6, side * 10.5, midY + 5);
    ctx.quadraticCurveTo(side * 8, midY + 4, side * 6.5, midY + 6.5);
    ctx.quadraticCurveTo(side * 4.5, 2, side * 2.5, 3);
    ctx.closePath();
    fillInk(ctx, lin(ctx, 0, tipY, side * 16, 6, mem, 0.25, -0.35), 0.9);
    ctx.strokeStyle = alpha(shade(c, 0.2), 0.65);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(side * 9, midY - 2);
    ctx.lineTo(side * 14.5, tipY + 7 + flap * 2);
    ctx.moveTo(side * 9, midY - 2);
    ctx.lineTo(side * 10.5, midY + 5);
    ctx.moveTo(side * 9, midY - 2);
    ctx.lineTo(side * 6.5, midY + 6.5);
    ctx.stroke();
  };
  wing(-1);
  // Body and ears
  ellipse(ctx, 0, 0, 4.6, 6);
  fillInk(ctx, rad(ctx, 0, -1, 6, c, 0.3, -0.45), 1);
  ctx.strokeStyle = alpha(shade(c, 0.3), 0.4);
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-2.5 + i * 1.2, 1);
    ctx.lineTo(-2.8 + i * 1.2, 3.5);
    ctx.stroke();
  }
  poly(ctx, [-2.8, -4, -3.8, -9.5, -0.8, -5.5]);
  fillInk(ctx, c, 0.6);
  poly(ctx, [1, -5.5, 3.6, -9.8, 3, -4]);
  fillInk(ctx, c, 0.6);
  ctx.fillStyle = '#d07080';
  poly(ctx, [1.6, -5.6, 3.2, -8.4, 2.7, -4.6]);
  ctx.fill();
  // Snout, fangs, feet
  ellipse(ctx, 2.6, -2.2, 2, 1.5);
  fillInk(ctx, shade(c, 0.08), 0.5);
  ctx.fillStyle = '#f0e8d8';
  poly(ctx, [1.6, -1, 2.1, 0.8 + atk, 2.5, -1]);
  poly(ctx, [3, -1, 3.4, 0.6 + atk, 3.8, -1]);
  ctx.fill();
  eyes(ctx, 1.8, -3.6, 2.4, '#ff3030', 0.75);
  limb(ctx, [-1.2, 5, -1.6, 7.5], 0.8, shade(c, -0.4), 0.6);
  limb(ctx, [1.2, 5, 1.4, 7.5], 0.8, shade(c, -0.4), 0.6);
  wing(1);
}

function hound(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const jackal = s.id === 'jackal';
  const dark = shade(c, -0.38);
  const leg = (fx: number, k: number, front: boolean, col: string) => {
    if (front) {
      limb(ctx, [fx, -12, fx + 0.8 + k * 2.5, -6, fx + 1 + k * 4, -1.2], 2.6, col, 1.1);
    } else {
      limb(ctx, [fx, -13, fx - 2.4 + k * 1.5, -8, fx - 1 + k * 3, -4.5, fx + k * 4, -1.2], 2.8, col, 1.1);
    }
    ellipse(ctx, fx + 1.2 + k * 4, -0.8, 1.9, 1);
    fillInk(ctx, col, 0.5);
  };
  // Far legs
  leg(5.5, -sw, true, dark);
  leg(-8.5, sw, false, dark);
  // Tail
  const wag = Math.sin(t * (jackal ? 6 : 3)) * 2;
  curve(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-11, -15);
    ctx.quadraticCurveTo(-17, -15 + wag * 0.5, -19, -21 + wag);
  }, jackal ? 2.6 : 2, jackal ? shade(c, -0.1) : shade(c, -0.2), 1.2);
  if (jackal) {
    ctx.fillStyle = '#2a1e14';
    circle(ctx, -19, -21 + wag, 1.3);
    ctx.fill();
  }
  // Body: deep chest, tucked waist.
  ctx.beginPath();
  ctx.moveTo(-12, -14);
  ctx.quadraticCurveTo(-10, -19, -3, -18);
  ctx.quadraticCurveTo(3, -20, 7, -20);
  ctx.quadraticCurveTo(11, -19, 10, -14);
  ctx.quadraticCurveTo(9.5, -9.5, 5, -9);
  ctx.quadraticCurveTo(0, -11.5, -4, -11);
  ctx.quadraticCurveTo(-9, -9, -12, -14);
  ctx.closePath();
  fillInk(ctx, lin(ctx, 0, -20, 0, -9, c, 0.25, -0.45), 1);
  if (jackal) {
    // Dark saddle along the back.
    ctx.fillStyle = alpha('#2a1e14', 0.45);
    ctx.beginPath();
    ctx.moveTo(-11, -15);
    ctx.quadraticCurveTo(-4, -19.5, 7, -19.6);
    ctx.quadraticCurveTo(0, -16, -11, -15);
    ctx.fill();
  } else {
    // Bristling mane and smouldering cracks.
    ctx.fillStyle = shade(c, -0.3);
    for (let i = 0; i < 6; i++) {
      const x = -6 + i * 2.4;
      const y = -18.6 - Math.sin(i) * 0.3 - (i > 3 ? 0.8 : 0);
      poly(ctx, [x - 1.2, y + 0.8, x - 0.8 - 0.6, y - 2.6, x + 1.2, y + 0.4]);
      ctx.fill();
    }
    const pulse = 0.55 + 0.25 * Math.sin(t * 5);
    ctx.strokeStyle = art.dead ? '#2a1a10' : alpha('#ff8a30', pulse);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-9, -14);
    ctx.lineTo(-6, -15.5);
    ctx.lineTo(-3.5, -14.2);
    ctx.lineTo(-0.5, -16);
    ctx.moveTo(2, -17);
    ctx.lineTo(4.5, -14.5);
    ctx.lineTo(7, -15.5);
    ctx.stroke();
    glow(ctx, -1, -15, 10, '#ff6e1e', pulse * 0.4);
  }
  // Near legs
  leg(-7, -sw, false, shade(c, -0.12));
  leg(7, sw, true, shade(c, -0.08));
  // Head
  const hx = 13.5 + atk * 4;
  const hy = -20 + atk * 2.5;
  limb(ctx, [8, -17, hx - 2, hy + 1], 4.8, shade(c, -0.05), 1.2);
  // Ears
  const earH = jackal ? 7 : 4.2;
  poly(ctx, [hx - 3.2, hy - 1.8, hx - 3.4, hy - 1.8 - earH, hx - 0.8, hy - 2.6]);
  fillInk(ctx, shade(c, -0.2), 0.6);
  ellipse(ctx, hx, hy, 4.2, 3.4);
  fillInk(ctx, rad(ctx, hx, hy, 4.4, c, 0.3, -0.45), 1);
  // Muzzle with a jaw that drops on the bite.
  const open = atk * 2.6;
  poly(ctx, [hx + 1.4, hy + 0.8 + open * 0.3, hx + 7.6, hy + 2 + open, hx + 7, hy + 3.4 + open, hx + 1, hy + 3]);
  fillInk(ctx, shade(c, -0.1), 0.7);
  ctx.fillStyle = '#2a0806';
  poly(ctx, [hx + 2, hy + 0.6, hx + 7.4, hy + 1.6 + open * 0.6, hx + 7.2, hy + 2 + open]);
  ctx.fill();
  poly(ctx, [hx + 1.2, hy - 2, hx + 7.8, hy - 0.4, hx + 7.8, hy + 1.6, hx + 1.2, hy + 1.2]);
  fillInk(ctx, lin(ctx, hx, hy - 2, hx + 8, hy + 2, c, 0.25, -0.35), 0.8);
  circle(ctx, hx + 7.7, hy - 0.2, 0.9);
  ctx.fillStyle = '#140c08';
  ctx.fill();
  teeth(ctx, hx + 3.6, hx + 7.4, hy + 1.6, 3, 0.9);
  poly(ctx, [hx - 2, hy - 2.2, hx - 2.4, hy - 2.2 - earH, hx + 0.6, hy - 2.6]);
  fillInk(ctx, c, 0.6);
  if (jackal) {
    ctx.fillStyle = '#d07070';
    poly(ctx, [hx - 1.6, hy - 2.6, hx - 1.9, hy - 1.2 - earH * 0.8, hx - 0.2, hy - 2.8]);
    ctx.fill();
  }
  eyes(ctx, hx + 1.6, hy - 1, 1.6, jackal ? '#ffd040' : '#ff7020', 0.8);
}

function brute(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const dark = shade(c, -0.38);
  limb(ctx, [-5, -16, -6.5 + sw * 3.5, -8, -6 + sw * 4, -1.5], 6, dark, 1.5);
  limb(ctx, [5, -16, 6 - sw * 3.5, -8, 6.5 - sw * 4, -1.5], 6.4, shade(c, -0.15), 1.5);
  for (const [x, col] of [[-6 + sw * 4, dark], [6.5 - sw * 4, shade(c, -0.15)]] as const) {
    ellipse(ctx, x + 1.5, -1, 4, 1.8);
    fillInk(ctx, col, 0.8);
  }
  // Far arm, knuckles near the ground.
  limb(ctx, [-11, -37, -15, -27, -13 + sw * 2, -18], 5.6, dark, 1.5);
  circle(ctx, -13 + sw * 2, -16.5, 3.2);
  fillInk(ctx, dark, 0.9);
  // Torso: a slab of muscle.
  ctx.beginPath();
  ctx.moveTo(-8, -16);
  ctx.quadraticCurveTo(-14, -26, -13, -36);
  ctx.quadraticCurveTo(-11, -43, -2, -42);
  ctx.quadraticCurveTo(10, -44, 13, -37);
  ctx.quadraticCurveTo(14, -26, 8, -16);
  ctx.closePath();
  fillInk(ctx, rad(ctx, 0, -30, 16, c, 0.3, -0.5), 1.3);
  ctx.strokeStyle = alpha(shade(c, -0.55), 0.7);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-5, -34);
  ctx.quadraticCurveTo(0, -31, 1, -35);
  ctx.quadraticCurveTo(3, -31, 9, -34);
  ctx.moveTo(1, -30);
  ctx.lineTo(1, -18);
  ctx.moveTo(-3, -26);
  ctx.lineTo(5, -26);
  ctx.moveTo(-3, -22);
  ctx.lineTo(5, -22);
  ctx.stroke();
  // Scars
  ctx.strokeStyle = alpha(shade(c, 0.35), 0.7);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-9, -32);
  ctx.lineTo(-4, -27);
  ctx.moveTo(6, -40);
  ctx.lineTo(10, -36);
  ctx.stroke();
  // Loincloth and a belt with a skull buckle.
  ctx.beginPath();
  ctx.moveTo(-8, -19);
  ctx.lineTo(8, -19);
  ctx.lineTo(6, -9 + sw);
  ctx.lineTo(2, -11);
  ctx.lineTo(-1, -8 + sw * 0.5);
  ctx.lineTo(-5, -11);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -8, -19, 6, -8, '#3a2618', 0.15, -0.4), 0.9);
  roundRect(ctx, -8.5, -21, 17, 3, 1);
  fillInk(ctx, '#2a1a10', 0.7);
  circle(ctx, 1.5, -19.5, 1.8);
  fillInk(ctx, BONE, 0.5);
  // Head sunk between the shoulders, tusks and horns.
  const hy = -44 + Math.sin(t * 2) * 0.3;
  ellipse(ctx, 4, hy, 5.6, 5);
  fillInk(ctx, rad(ctx, 4, hy, 6, shade(c, -0.05), 0.3, -0.45), 1);
  horn(ctx, 1.5, hy - 3.5, 7, hy - 11, -3.5, 1.4);
  horn(ctx, -1.5, hy - 2.5, -6, hy - 9, 2, 1.3, '#c8b890');
  ctx.fillStyle = shade(c, -0.25);
  poly(ctx, [2, hy + 1.6, 9.5, hy + 1.2, 9, hy + 4.4, 3, hy + 4.6]);
  ctx.fill();
  horn(ctx, 4.5, hy + 2.6, 4.5, hy - 1.5, 0.5, 0.7, '#f0e4c8');
  horn(ctx, 8, hy + 2.4, 8.6, hy - 1, -0.5, 0.6, '#f0e4c8');
  ctx.fillStyle = '#1a0a06';
  ctx.fillRect(3.4, hy - 2.4, 6.4, 1.2);
  slitEyes(ctx, 6.6, hy - 1.4, 3.4, '#ffcc30', 2);
  // Spiked club
  const hx = 16 + atk * 4;
  const hy2 = -20 - atk * 18;
  limb(ctx, [11, -37, 16 + atk * 3, -29 - atk * 8, hx, hy2], 5.6, shade(c, -0.05), 1.5);
  const ex = 20 + atk * 14;
  const ey = -38 - atk * 8;
  ctx.save();
  ctx.translate(hx, hy2);
  ctx.rotate(Math.atan2(ey - hy2, ex - hx) + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-1.6, 2);
  ctx.lineTo(-3.8, -18);
  ctx.quadraticCurveTo(0, -23, 3.8, -18);
  ctx.lineTo(1.6, 2);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -4, 0, 4, 0, '#5a3e24', 0.3, -0.45), 1);
  ctx.fillStyle = '#b8b8c0';
  for (const [x, y, d] of [[-3.3, -15, -1], [3.3, -12, 1], [-2.8, -9, -1], [3, -18, 1], [0, -21, 0]] as const) {
    poly(ctx, d === 0 ? [x - 1, y, x, y - 2.6, x + 1, y] : [x, y - 1, x + d * 2.6, y, x, y + 1]);
    ctx.fill();
  }
  ctx.restore();
  circle(ctx, hx, hy2, 3);
  fillInk(ctx, shade(c, 0.05), 0.9);
}

function golem(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const core = '#90ff70';
  const stone = (pts: number[], col: string) => {
    poly(ctx, pts);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    fillInk(ctx, lin(ctx, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), col, 0.3, -0.45), 1);
  };
  // Legs: stacked stones
  stone([-8 + sw * 2, -16, -2 + sw * 2, -16, -3 + sw * 3, -1, -9 + sw * 3, -1], shade(c, -0.25));
  stone([2 - sw * 2, -16, 8 - sw * 2, -16, 9 - sw * 3, -1, 3 - sw * 3, -1], shade(c, -0.1));
  // Far arm
  stone([-12, -38, -16, -36, -18, -24, -13 + sw, -18, -10, -26], shade(c, -0.3));
  // Torso boulder with bones mortared in.
  stone([-12, -40, -2, -45, 11, -41, 13, -28, 8, -15, -8, -15, -13, -26], c);
  ctx.strokeStyle = alpha('#000000', 0.45);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-2, -45);
  ctx.lineTo(-3, -34);
  ctx.lineTo(-13, -30);
  ctx.moveTo(-3, -34);
  ctx.lineTo(5, -29);
  ctx.lineTo(13, -30);
  ctx.moveTo(5, -29);
  ctx.lineTo(2, -15);
  ctx.stroke();
  limb(ctx, [-9, -22, -2, -18], 1.5, BONE, 1);
  limb(ctx, [6, -38, 10, -33], 1.3, BONE, 1);
  circle(ctx, -6, -37, 2.2);
  fillInk(ctx, rad(ctx, -6, -37, 2.2, BONE), 0.6);
  // Moss
  ctx.fillStyle = alpha('#4a6a2a', 0.7);
  ellipse(ctx, -6, -41, 4, 1.6, -0.3);
  ellipse(ctx, 9, -40, 3, 1.3, 0.3);
  ctx.fill();
  // Glowing grave-light in the chest crack.
  const p = 0.6 + 0.25 * Math.sin(t * 3);
  ctx.fillStyle = art.dead ? '#1a1410' : alpha(core, 0.9);
  poly(ctx, [-1, -33, 2.5, -31, 3.5, -27, 0, -28.5]);
  ctx.fill();
  glow(ctx, 1, -30, 12, core, p * 0.6);
  // Head stone
  stone([0, -44, 9, -46, 10, -40, 2, -38.5], shade(c, 0.05));
  eyes(ctx, 6, -42.5, 3.2, core, 0.9);
  // Fist arm
  const hx = 16 + atk * 4;
  const hy2 = -20 - atk * 18;
  stone([10, -40, 14, -40, hx + 3, hy2 - 2, hx - 2, hy2 + 1], shade(c, -0.05));
  stone([hx - 4, hy2 - 3, hx + 4, hy2 - 4, hx + 5, hy2 + 4, hx - 3, hy2 + 5], shade(c, 0.1));
}

function wraith(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { atk, t } = s;
  const fire = s.id === 'shade';
  const bob = Math.sin(t * 3) * 3;
  ctx.translate(0, bob - 6);
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * 0.85;
  // Trailing wisps
  if (!art.dead) {
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.7 + i * 0.25) % 1);
      ctx.fillStyle = alpha(fire ? '#ffb050' : c, 0.35 * (1 - k));
      ellipse(ctx, -6 - k * 12 + i, -4 - i * 6 - k * 4, 3 - k * 2, 1.6 - k);
      ctx.fill();
    }
  }
  // Flowing shroud with a ragged hem.
  const g = ctx.createLinearGradient(0, -50, 0, 6);
  g.addColorStop(0, shade(c, 0.15));
  g.addColorStop(0.45, c);
  g.addColorStop(1, alpha(fire ? '#ff6020' : c, 0));
  ctx.beginPath();
  ctx.moveTo(-8, -38);
  ctx.quadraticCurveTo(-12, -20, -13 + Math.cos(t * 5) * 2.5, 5);
  for (let i = 0; i < 6; i++) {
    const x = -13 + (i + 1) * 4.4;
    const y = (i % 2 ? 5 : -1.5) + Math.sin(t * 6 + i * 1.7) * 2;
    ctx.lineTo(x + Math.sin(t * 4 + i) * 1.2, y);
  }
  ctx.quadraticCurveTo(12, -20, 8.5, -38);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = alpha('#ffffff', 0.18);
  ctx.lineWidth = 0.8;
  for (const x of [-4, 1, 5]) {
    ctx.beginPath();
    ctx.moveTo(x * 0.6, -32);
    ctx.quadraticCurveTo(x, -18, x * 1.3 + Math.sin(t * 4 + x) * 1.5, -2);
    ctx.stroke();
  }
  // Hood
  ctx.beginPath();
  ctx.moveTo(-8.5, -34);
  ctx.quadraticCurveTo(-10, -48, -2, -52);
  ctx.quadraticCurveTo(-6, -48, -1, -50);
  ctx.quadraticCurveTo(9, -50, 9.5, -34);
  ctx.quadraticCurveTo(0, -31, -8.5, -34);
  ctx.closePath();
  ctx.fillStyle = rad(ctx, 0, -42, 10, c, 0.3, -0.35);
  ctx.fill();
  ctx.globalAlpha = prevA;
  const vg = ctx.createRadialGradient(2, -41, 0.5, 2, -41, 6);
  vg.addColorStop(0, '#000000');
  vg.addColorStop(1, alpha('#000000', 0.55));
  ctx.fillStyle = vg;
  ellipse(ctx, 2, -41, 4.8, 5.6);
  ctx.fill();
  eyes(ctx, 2.6, -42, 3.2, fire ? '#ffd080' : '#bfe8ff', 0.9);
  // Skeletal hands reaching out of the sleeves.
  const reach = atk * 7;
  ctx.globalAlpha = prevA * 0.85;
  ctx.beginPath();
  ctx.moveTo(4, -35);
  ctx.quadraticCurveTo(10 + reach * 0.5, -36 - atk * 3, 13 + reach, -30 - atk * 4);
  ctx.lineTo(10 + reach, -27 - atk * 3);
  ctx.quadraticCurveTo(7, -30, 4, -28);
  ctx.closePath();
  ctx.fillStyle = shade(c, -0.1);
  ctx.fill();
  ctx.globalAlpha = prevA;
  const fx = 13 + reach;
  const fy = -29 - atk * 3.6;
  ctx.strokeStyle = fire ? '#ffe0b0' : '#e8f0ff';
  ctx.lineWidth = 0.7;
  for (let i = -1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx + 2.5, fy + i * 1.2 - 1, fx + 4 + Math.abs(i) * -0.4, fy + i * 1.6 + 0.5);
    ctx.stroke();
  }
  if (fire) {
    glow(ctx, 0, -30, 22, '#ff8a30', 0.3 + 0.1 * Math.sin(t * 7));
    if (!art.dead) {
      ctx.fillStyle = alpha('#ffd080', 0.8);
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.9 + i * 0.27) % 1;
        ctx.fillRect(-6 + i * 4 + Math.sin(t * 3 + i) * 2, -10 - k * 40, 1, 1);
      }
    }
  } else {
    glow(ctx, 1, -38, 18, '#a8d0ff', 0.2);
  }
}

const ROBED: Record<string, (c: string) => HumanoidLook> = {
  cultist: (c) => ({
    body: c, trim: '#a07040', skin: '#c9a98a', legs: '#222', boots: '#1a1418', head: 'hood', headColor: shade(c, -0.15), robe: true,
    weapon: 'staff', weaponColor: '#c080ff', weaponGlow: '#c080ff', eyeGlow: '#d090ff', accent: '#a07040',
  }),
  bishop: (c) => ({
    body: c, trim: '#c8b060', skin: '#9fb7a8', legs: '#222', head: 'mitre', headColor: '#d8d0b0', robe: true, weapon: 'staff', weaponColor: '#9fe8ff',
    weaponGlow: '#9fe8ff', beard: '#56685e', longBeard: true, drowned: true, accent: '#9fe8ff', cape: shade(c, -0.35),
  }),
  raider: (c) => ({
    body: c, trim: '#3a2a18', skin: '#a87850', legs: '#4a3a24', boots: '#2e2216', head: 'turban', headColor: '#c8b488', veil: '#a89470', weapon: 'bow',
    weaponId: 'recurve_bow', armor: 'leather', quiver: true, cape: '#6a5434', gloves: '#4a3420',
  }),
  acolyte: (c) => ({
    body: c, trim: '#fff0a8', skin: '#b08860', legs: '#222', head: 'mitre', headColor: '#f0c858', robe: true, weapon: 'staff', weaponId: 'dial_staff',
    weaponColor: '#ffe080', weaponGlow: '#ffd060', accent: '#ffe080',
  }),
  mirage: (c) => ({
    body: c, trim: '#ff8040', skin: '#d8b078', legs: '#222', head: 'hair', hair: 'long', headColor: '#2a1810', veil: '#e8c070', veils: '#ff9050',
    robe: true, weapon: 'wand', weaponId: 'glass_wand', weaponColor: '#ffe0a0', weaponGlow: '#ffe0a0', build: 0.9,
  }),
  corvin: () => ({
    body: '#4a5068', trim: '#c8b060', skin: '#d8b898', legs: '#222', head: 'hair', hair: 'long', headColor: '#e8e8e8', beard: '#e8e8e8', longBeard: true,
    robe: true, weapon: 'staff', weaponColor: '#a0d8ff', weaponGlow: '#a0d8ff', cape: '#2a2e40', accent: '#c8b060',
  }),
};

function robed(ctx: CanvasRenderingContext2D, shape: string, c: string, s: S) {
  const { t } = s;
  if (shape === 'acolyte') {
    // A sun disc behind her head.
    glow(ctx, -1, -50, 16, '#ffd060', 0.35 + 0.1 * Math.sin(t * 3));
    ctx.strokeStyle = alpha('#ffe080', art.dead ? 0.2 : 0.7);
    ctx.lineWidth = 1;
    circle(ctx, -1, -50, 9);
    ctx.stroke();
  }
  if (shape === 'corvin') glow(ctx, 0, -30, 26, '#a0d8ff', 0.15);
  drawHumanoid(ctx, ROBED[shape](c), { ...s.pose, dir: 1 }, t);
  if (shape === 'bishop' && !art.dead) {
    // Water still running off him; weed tangled in the hem.
    ctx.fillStyle = alpha('#9fe8ff', 0.7);
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.8 + i * 0.21) % 1;
      ctx.fillRect(-8 + i * 4, -30 + k * 30, 0.8, 1.6);
    }
  }
  if (shape === 'bishop') {
    ctx.strokeStyle = '#3a6a3a';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-9 + i * 5, -1);
      ctx.quadraticCurveTo(-10 + i * 5 + Math.sin(t * 2 + i), -5, -9 + i * 5, -9 - (i % 2) * 2);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ act 2

function scarab(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const bob = Math.abs(sw) * 1.5;
  const legs = (far: boolean) => {
    ctx.strokeStyle = INK;
    const col = far ? shade(c, -0.6) : shade(c, -0.45);
    for (let i = 0; i < 3; i++) {
      const x = -5 + i * 5;
      const k = (i % 2 ? sw : -sw) * (far ? -1 : 1);
      const y0 = -8 - bob;
      const dy = far ? -1.5 : 0;
      limb(ctx, [x, y0 + dy, x - 3 + k * 2 + i, -6 + dy, x - 4 + k * 3 + i * 2, -0.6 + dy], 1.2, col, 0.9);
    }
  };
  legs(true);
  // Antennae and horn
  ctx.strokeStyle = shade(c, -0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(11, -12 - bob);
  ctx.quadraticCurveTo(14, -18 - bob, 16 + Math.sin(t * 5), -17 - bob);
  ctx.moveTo(10, -12 - bob);
  ctx.quadraticCurveTo(12, -19 - bob, 13.5, -19.5 - bob + Math.cos(t * 4));
  ctx.stroke();
  // Head and pronotum
  ellipse(ctx, 10.2, -10.5 - bob, 3.4, 2.8);
  fillInk(ctx, rad(ctx, 10, -11 - bob, 3.6, shade(c, -0.45), 0.3, -0.4), 0.8);
  horn(ctx, 11.5, -12.5 - bob, 15 + atk * 2, -17 - bob, -1, 0.9, shade(c, -0.2));
  ellipse(ctx, 6.5, -11 - bob, 4.6, 4.2);
  fillInk(ctx, rad(ctx, 6, -12 - bob, 4.8, c, 0.45, -0.55), 0.9);
  // Glass shell: two elytra with a seam.
  const g = ctx.createLinearGradient(-9, -19 - bob, 6, -3 - bob);
  g.addColorStop(0, '#e4ffff');
  g.addColorStop(0.3, shade(c, 0.25));
  g.addColorStop(0.65, c);
  g.addColorStop(1, shade(c, -0.6));
  ellipse(ctx, -1, -10 - bob, 9.5, 7.4);
  fillInk(ctx, g, 1);
  ctx.strokeStyle = alpha('#000000', 0.45);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(4.5, -15.5 - bob);
  ctx.quadraticCurveTo(-1, -9 - bob, -9.5, -9.5 - bob);
  ctx.stroke();
  // Facets and specular highlight
  ctx.strokeStyle = alpha('#d8ffff', 0.35);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-6, -15 - bob);
  ctx.lineTo(-2, -11 - bob);
  ctx.lineTo(-7, -7 - bob);
  ctx.moveTo(1, -16 - bob);
  ctx.lineTo(-2, -11 - bob);
  ctx.lineTo(3, -6 - bob);
  ctx.stroke();
  ctx.fillStyle = alpha('#ffffff', 0.75);
  ellipse(ctx, -3.5, -14.5 - bob, 3, 1.1, -0.35);
  ctx.fill();
  const tw = Math.max(0, Math.sin(t * 2.3 + s.id.length));
  if (!art.dead && tw > 0.9) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -15.8 - bob, 0.8, 3);
    ctx.fillRect(-7.1, -14.7 - bob, 3, 0.8);
  }
  glow(ctx, 0, -10 - bob, 12, '#70e0e0', 0.18);
  eyes(ctx, 11.6, -11.2 - bob, 1.8, '#ffe860', 0.65);
  legs(false);
}

function scorpion(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const boss = s.id === 'skarn';
  const dark = shade(c, -0.42);
  const legs = (far: boolean) => {
    for (let i = 0; i < 4; i++) {
      // Front pair reaches forward, back pairs splay backward.
      const x = -6 + i * 4;
      const k = (i % 2 ? sw : -sw) * (far ? -1 : 1);
      const off = far ? -1.8 : 0;
      const spread = (i - 1.6) * 2.6;
      const kx = x + spread * 1.1;
      const ky = (far ? -11.5 : -9) + off;
      const fx = x + spread * 1.9 + k * 2.5;
      limb(ctx, [x, -8 + off, kx, ky, fx, -0.8 + off], far ? 1.3 : 1.6, far ? shade(dark, -0.25) : dark, 1);
      ctx.fillStyle = alpha('#ffffff', 0.2);
      circle(ctx, kx, ky, 0.6);
      ctx.fill();
    }
  };
  legs(true);
  // Tail: five tapering segments arcing over the back, then the stinger.
  const p0 = [-11, -9];
  const p1 = [-26, -20];
  const p2 = [-17 + atk * 16, -36 + atk * 8];
  const p3 = [-11 + atk * 18, -40 + atk * 8];
  const p4 = [-5 + atk * 22, -32 + atk * 10];
  const pts: number[][] = [];
  const N = 11;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // Two chained quadratics, as the old tail was.
    const [a, b, d] = u < 0.5 ? [p0, p1, p2] : [p2, p3, p4];
    const v = u < 0.5 ? u * 2 : (u - 0.5) * 2;
    pts.push([
      (1 - v) * (1 - v) * a[0] + 2 * (1 - v) * v * b[0] + v * v * d[0],
      (1 - v) * (1 - v) * a[1] + 2 * (1 - v) * v * b[1] + v * v * d[1],
    ]);
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const r = 3.3 - i * 0.16;
    ellipse(ctx, x, y, r, r * 0.88);
    ctx.fillStyle = rad(ctx, x, y, r, i % 2 ? shade(c, -0.05) : shade(c, 0.06), 0.35, -0.45);
    ctx.fill();
    ctx.strokeStyle = alpha('#000000', 0.35);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  const [sx, sy] = pts[pts.length - 1];
  ellipse(ctx, sx, sy, 2.6, 2.2);
  fillInk(ctx, rad(ctx, sx, sy, 2.6, '#c8b048', 0.4, -0.4), 0.7);
  ctx.beginPath();
  ctx.moveTo(sx + 1.5, sy - 1);
  ctx.quadraticCurveTo(sx + 5, sy - 1, sx + 5, sy + 3.5);
  ctx.quadraticCurveTo(sx + 3, sy + 1.4, sx + 1.4, sy + 1.4);
  ctx.closePath();
  fillInk(ctx, '#2a2010', 0.5);
  glow(ctx, sx + 4.5, sy + 3, 6, '#d8e070', 0.6 + 0.2 * Math.sin(t * 6));
  legs(false);
  // Carapace
  ellipse(ctx, 1, -9, 13, 6.5);
  fillInk(ctx, rad(ctx, 1, -11, 13, c, 0.35, -0.5), 1.1);
  ctx.strokeStyle = alpha('#000000', 0.4);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const x = -8 + i * 4;
    ctx.beginPath();
    ctx.moveTo(x, -14.5 + Math.abs(i - 1.5) * 0.8);
    ctx.quadraticCurveTo(x + 1, -9, x, -3.5);
    ctx.stroke();
  }
  ctx.fillStyle = alpha('#ffffff', 0.22);
  ellipse(ctx, -2, -13, 7, 1.5, -0.08);
  ctx.fill();
  if (boss) {
    ctx.fillStyle = shade(c, -0.5);
    for (let i = 0; i < 5; i++) {
      const x = -7 + i * 3.5;
      poly(ctx, [x - 1.2, -14.5, x, -19 - (i % 2) * 2, x + 1.2, -14.5]);
      ctx.fill();
    }
    ctx.fillStyle = alpha('#90c050', 0.5);
    ellipse(ctx, -4, -11, 2.5, 1.2);
    ellipse(ctx, 5, -12, 1.8, 0.9);
    ctx.fill();
  }
  // Pincers
  const claw = (y: number, far: boolean) => {
    const reach = atk * 5;
    const open = 0.35 + atk * 0.45;
    const col = far ? dark : shade(c, -0.08);
    limb(ctx, [11, -9 + y, 16 + reach * 0.6, -12 + y, 19 + reach, -11 + y], 2.4, col, 1.1);
    const cx = 21 + reach;
    const cy = -11 + y;
    ellipse(ctx, cx, cy, 3.4, 2.4, -0.2);
    fillInk(ctx, rad(ctx, cx, cy, 3.4, col, 0.3, -0.45), 0.8);
    ctx.save();
    ctx.translate(cx + 2.5, cy);
    for (const d of [-1, 1]) {
      ctx.save();
      ctx.rotate(d * open);
      ctx.beginPath();
      ctx.moveTo(0, -0.9 * d);
      ctx.quadraticCurveTo(3.5, -1.8 * d, 5.5, 0.2 * d);
      ctx.quadraticCurveTo(3, 0.4 * d, 0, 0.8 * d);
      ctx.closePath();
      fillInk(ctx, col, 0.6);
      ctx.restore();
    }
    ctx.restore();
  };
  claw(-1.4, true);
  claw(1.2, false);
  eyes(ctx, 11.5, -12.5, 2.4, boss ? '#a0ff60' : '#ff6030', boss ? 1 : 0.8);
}

function burrower(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const up = 1 + atk * 0.25;
  // Heaped sand
  ellipse(ctx, 0, -2, 20, 8);
  fillInk(ctx, rad(ctx, 0, -4, 20, '#b8946a', 0.25, -0.45), 0.9);
  ctx.fillStyle = alpha('#6a5034', 0.5);
  for (let i = 0; i < 10; i++) ctx.fillRect(-16 + i * 3.4, -3 + Math.sin(i * 2.1) * 3, 1, 0.8);
  // Body rising out of it
  const sx = sw * 2;
  ctx.beginPath();
  ctx.moveTo(-12, -1);
  ctx.quadraticCurveTo(-13 + sx, -28 * up, sx, -42 * up);
  ctx.quadraticCurveTo(13 + sx, -28 * up, 12, -1);
  ctx.closePath();
  fillInk(ctx, lin(ctx, -12, -40, 12, 0, c, 0.3, -0.5), 1.1);
  // Armoured rings with a paler underside.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = alpha(shade(c, 0.35), 0.4);
  ctx.beginPath();
  ctx.moveTo(4, -1);
  ctx.quadraticCurveTo(7 + sx, -26 * up, 3 + sx, -38 * up);
  ctx.lineTo(12, -38 * up);
  ctx.lineTo(12, -1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (let i = 1; i < 6; i++) {
    const y = -7 * i * up;
    const half = 12 - i * 1.6;
    ctx.beginPath();
    ctx.moveTo(-half + sx * (i / 6), y);
    ctx.quadraticCurveTo(sx * (i / 6), y + 3, half + sx * (i / 6), y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = alpha(shade(c, 0.3), 0.5);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  // Ring mouth, turned towards its prey.
  const mx = 1 + sx;
  const my = -37 * up;
  ellipse(ctx, mx, my, 8.5, 6.2 + atk * 3);
  fillInk(ctx, shade(c, -0.15), 1);
  const g = ctx.createRadialGradient(mx, my, 0.5, mx, my, 7);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.6, '#3a0a08');
  g.addColorStop(1, '#8a2a20');
  ellipse(ctx, mx, my, 7, 5 + atk * 3);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#efe4c8';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + t * 0.5;
    const px = mx + Math.cos(a) * 7;
    const py = my + Math.sin(a) * (5 + atk * 3);
    const ix = mx + Math.cos(a) * 3.4;
    const iy = my + Math.sin(a) * (2.4 + atk * 1.4);
    ctx.beginPath();
    ctx.moveTo(px - Math.sin(a) * 1.2, py + Math.cos(a) * 1.2);
    ctx.lineTo(ix, iy);
    ctx.lineTo(px + Math.sin(a) * 1.2, py - Math.cos(a) * 1.2);
    ctx.fill();
  }
  // Sand pouring off
  if (!art.dead) {
    ctx.fillStyle = alpha('#d0b080', 0.8);
    for (let i = 0; i < 6; i++) {
      const k = (t * 1.3 + i * 0.17) % 1;
      ctx.fillRect(-9 + i * 3.6 + sx * (1 - k), -30 * up + k * 28, 1, 1);
    }
  }
}

function kite(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { atk, t } = s;
  const king = s.id === 'karrik';
  const flap = Math.sin(t * 9);
  ctx.translate(0, -28 + Math.sin(t * 3) * 3);
  const wing = (side: number, far: boolean) => {
    const col = far ? shade(c, -0.4) : shade(c, -0.15);
    const lift = flap * (far ? 0.85 : 1);
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(side * 9, -10 - lift * 8, side * 17, -7 - lift * 12);
    ctx.lineTo(side * 18, -2 - lift * 8);
    ctx.lineTo(side * 7, 5);
    ctx.closePath();
    fillInk(ctx, lin(ctx, 0, -10, side * 18, 4, col, 0.25, -0.35), 0.9);
    // Primary feathers fanning from the wrist.
    for (let i = 0; i < 5; i++) {
      const bx = side * (17 - i * 2.5);
      const by = -6 - lift * (11 - i * 1.6) + i * 1.8;
      const ex = side * (25 - i * 2.2);
      const ey = by + 3 + i * 1.5 - lift * 2;
      ctx.beginPath();
      ctx.moveTo(bx, by - 1.2);
      ctx.quadraticCurveTo((bx + ex) / 2, by - 1.6, ex, ey);
      ctx.quadraticCurveTo((bx + ex) / 2, by + 2.4, bx - side * 1.5, by + 2.4);
      ctx.closePath();
      fillInk(ctx, i % 2 ? shade(col, -0.15) : col, 0.6);
    }
    ctx.strokeStyle = alpha(shade(c, 0.35), 0.4);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(side * 2, -2);
    ctx.quadraticCurveTo(side * 9, -8 - lift * 7, side * 16, -6 - lift * 11);
    ctx.stroke();
  };
  wing(-1, true);
  // Tail fan and dangling talons
  poly(ctx, [-3, 6, -8, 13, -4, 12, -2, 14, 1, 7]);
  fillInk(ctx, shade(c, -0.25), 0.7);
  limb(ctx, [1, 7, 2 + atk * 3, 11 + atk * 2], 1, '#c8a060', 0.8);
  claws(ctx, 2 + atk * 3, 11 + atk * 2, 1.2, 2.4, '#2a2018');
  // Body
  ellipse(ctx, 0, 0, 6, 8.5, -0.2);
  fillInk(ctx, rad(ctx, 0, -2, 8.5, c, 0.25, -0.5), 1);
  ctx.strokeStyle = alpha('#000000', 0.3);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, -3 + i * 3, 3, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // Ruff of pale feathers, then the bald head and hooked beak.
  ctx.fillStyle = king ? '#2a1a2a' : '#d8ccb8';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.9 + i * 0.2);
    ellipse(ctx, 2 + Math.cos(a) * 4, -8 + Math.sin(a) * 2.4, 2, 1.4, a);
    ctx.fill();
  }
  ink(ctx, 0.4);
  const hx = 4.5 + atk * 2;
  const hy = -11.5 + atk * 1.5;
  limb(ctx, [2, -8, hx - 1, hy + 1.5], 2, '#b07868', 1);
  ellipse(ctx, hx, hy, 3.4, 3);
  fillInk(ctx, rad(ctx, hx, hy, 3.6, king ? '#8a5a6a' : '#c48870', 0.3, -0.4), 0.8);
  ctx.beginPath();
  ctx.moveTo(hx + 2.2, hy - 1.2);
  ctx.quadraticCurveTo(hx + 7 + atk * 2, hy - 1.4, hx + 6.4 + atk * 2, hy + 2.6);
  ctx.quadraticCurveTo(hx + 5.4, hy + 1.2, hx + 2.4, hy + 1.4);
  ctx.closePath();
  fillInk(ctx, lin(ctx, hx + 2, hy - 1, hx + 7, hy + 3, '#d8c080', 0.3, -0.4), 0.6);
  eyes(ctx, hx + 1.2, hy - 0.8, 1.6, '#ff3020', 0.65);
  if (king) {
    // A crown of finger bones.
    ctx.fillStyle = BONE;
    for (let i = 0; i < 4; i++) {
      poly(ctx, [hx - 2.4 + i * 1.6, hy - 2.4, hx - 2 + i * 1.6, hy - 6 - (i % 2) * 1.5, hx - 1.4 + i * 1.6, hy - 2.6]);
      ctx.fill();
    }
    glow(ctx, hx, hy, 10, '#ff4030', 0.25);
  }
  wing(1, false);
}

function mummy(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const vizier = s.id === 'embalmer' || c === '#d8c068';
  const dark = shade(c, -0.25);
  const wraps = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    ctx.strokeStyle = alpha(shade(c, -0.5), 0.65);
    ctx.lineWidth = 0.6;
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const x = x0 + (x1 - x0) * k;
      const y = y0 + (y1 - y0) * k;
      ctx.beginPath();
      ctx.moveTo(x - 2.2, y - 0.8 + (i % 2) * 0.6);
      ctx.lineTo(x + 2.2, y + 0.6 - (i % 2) * 0.6);
      ctx.stroke();
    }
  };
  // Shuffling legs
  limb(ctx, [-2.6, -19, -3.4 + sw * 2.2, -10, -3.6 + sw * 3, -1.4], 4.4, dark, 1.3);
  wraps(-2.6, -19, -3.6 + sw * 3, -1.4, 6);
  limb(ctx, [2.8, -19, 3.4 - sw * 2.2, -10, 3.8 - sw * 3, -1.4], 4.6, c, 1.3);
  wraps(2.8, -19, 3.8 - sw * 3, -1.4, 6);
  // Far arm stretched forward, stiff.
  limb(ctx, [-5, -34, 3, -33 + atk * 3, 11 + atk * 5, -31 + atk * 6], 3.6, dark, 1.2);
  // Torso
  roundRect(ctx, -7.6, -38.5, 15.2, 21.5, 4.5);
  fillInk(ctx, lin(ctx, -8, -38, 8, -17, c, 0.25, -0.4), 1);
  ctx.save();
  roundRect(ctx, -7.6, -38.5, 15.2, 21.5, 4.5);
  ctx.clip();
  ctx.strokeStyle = alpha(shade(c, -0.5), 0.6);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 8; i++) {
    const y = -38 + i * 2.8;
    ctx.beginPath();
    ctx.moveTo(-8, y + (i % 2) * 1.8);
    ctx.lineTo(8, y + ((i + 1) % 2) * 1.8);
    ctx.stroke();
  }
  ctx.fillStyle = alpha('#3a2a18', 0.25);
  ellipse(ctx, 3, -27, 3, 2);
  ellipse(ctx, -3, -21, 2, 1.5);
  ctx.fill();
  ctx.restore();
  if (vizier) {
    // Broad collar of gold and lapis.
    ctx.beginPath();
    ctx.ellipse(0, -37.5, 8.5, 5, 0, 0, Math.PI);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -8, -38, 8, -32, '#d8a830', 0.4, -0.3), 0.8);
    ctx.strokeStyle = '#2a4a9a';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(0, -37.5, 6, 3.2, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  // Loose bandage trailing in the wind.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(-6.5, -24);
    ctx.quadraticCurveTo(-12 + Math.sin(t * 4) * 2, -18, -14 + Math.sin(t * 4 + 1) * 3, -9);
  };
  tail();
  ctx.stroke();
  tail();
  ctx.strokeStyle = shade(c, -0.1);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Head
  const hy = -44 + Math.sin(t * 1.6) * 0.3;
  if (vizier) {
    // Striped nemes headdress over a gold mask.
    ctx.beginPath();
    ctx.moveTo(-6.5, hy + 7);
    ctx.lineTo(-6, hy - 3);
    ctx.quadraticCurveTo(0, hy - 9, 6.5, hy - 3);
    ctx.lineTo(7, hy + 6);
    ctx.lineTo(4.5, hy + 4);
    ctx.lineTo(-3, hy + 4);
    ctx.closePath();
    fillInk(ctx, lin(ctx, -6, hy - 8, 7, hy + 7, '#e0b040', 0.3, -0.3), 0.9);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-8, hy - 6 + i * 2);
      ctx.lineTo(8, hy - 6 + i * 2 + 1);
      ctx.stroke();
    }
    ctx.restore();
    ellipse(ctx, 2, hy + 0.5, 3.8, 4.4);
    fillInk(ctx, rad(ctx, 2, hy, 4.4, '#f0c850', 0.5, -0.35), 0.8);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0.2, hy - 1.2, 1.8, 0.7);
    ctx.fillRect(3, hy - 1.2, 1.8, 0.7);
    eyes(ctx, 2.6, hy - 0.2, 2.8, '#ffc840', 0.6);
    ctx.fillStyle = '#c89a28';
    poly(ctx, [1.2, hy + 4.5, 3, hy + 4.5, 2.6, hy + 8, 1.6, hy + 8]);
    fillInk(ctx, '#c89a28', 0.5);
    ctx.fillStyle = '#e0b040';
    poly(ctx, [1.2, hy - 6.5, 2, hy - 9, 2.8, hy - 6.5]);
    ctx.fill();
  } else {
    ellipse(ctx, 1, hy, 5.4, 5.8);
    fillInk(ctx, rad(ctx, 1, hy, 6, c, 0.3, -0.4), 1);
    ctx.strokeStyle = alpha(shade(c, -0.5), 0.65);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-4.5, hy - 4 + i * 2);
      ctx.lineTo(6.4, hy - 3 + i * 1.8 + (i % 2));
      ctx.stroke();
    }
    ctx.fillStyle = '#140c06';
    ctx.fillRect(1, hy - 1.6, 5.4, 2);
    eyes(ctx, 3.6, hy - 0.6, 2.8, '#70e0ff', 0.75);
  }
  // Near arm reaching
  const ax = 15 + atk * 6;
  const ay = -32 + atk * 7;
  limb(ctx, [6, -34, 10, -33 + atk * 3, ax, ay], 3.8, shade(c, 0.05), 1.2);
  wraps(6, -34, ax, ay, 4);
  claws(ctx, ax + 0.5, ay, 0.15, 2.4, '#3a2a18');
  if (vizier) {
    // Crook of office
    limb(ctx, [ax - 2, ay + 14, ax + 1, ay - 12], 1.3, '#e0b040', 1);
    curve(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(ax + 1, ay - 12);
      ctx.quadraticCurveTo(ax + 2, ay - 17, ax + 5, ay - 15);
      ctx.quadraticCurveTo(ax + 6, ay - 13, ax + 4.5, ay - 12);
    }, 1.3, '#1e3a8a', 1);
    glow(ctx, ax + 3, ay - 14, 10, '#ffc840', 0.3 + 0.1 * Math.sin(t * 4));
  }
}

function colossus(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const facet = (pts: number[], k: number) => {
    poly(ctx, pts);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    const base = mix(shade(c, k * 1.6 - 0.05), '#8ab8c8', 0.12);
    fillInk(ctx, lin(ctx, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), base, 0.3, -0.3), 0.9);
  };
  // Legs: crystal columns
  facet([-10 + sw * 2, -17, -3 + sw * 2, -17, -3 + sw * 3, -1, -11 + sw * 3, -1], -0.35);
  facet([-6 + sw * 2, -17, -3 + sw * 2, -17, -3 + sw * 3, -1, -7 + sw * 3, -1], -0.2);
  facet([3 - sw * 2, -17, 10 - sw * 2, -17, 11 - sw * 3, -1, 3 - sw * 3, -1], -0.15);
  facet([7 - sw * 2, -17, 10 - sw * 2, -17, 11 - sw * 3, -1, 8 - sw * 3, -1], -0.35);
  // Far arm
  const lift = atk * 26;
  facet([-14, -38, -19, -34, -22, -16 - lift, -15, -14 - lift], -0.4);
  // Torso: a cut crystal
  facet([-15, -38, -11, -14, 12, -13, 16, -40, 4, -47, -7, -46], 0);
  facet([1, -42, 13, -38, 10, -16, 1, -18], -0.18);
  facet([-7, -46, 4, -47, 1, -42, -9, -40], 0.3);
  facet([-15, -38, -9, -40, -6, -24, -11, -14], -0.08);
  // Glowing fault lines and core
  const p = 0.5 + 0.3 * Math.sin(t * 2.5);
  ctx.strokeStyle = art.dead ? alpha('#000000', 0.3) : alpha('#a8f0ff', 0.55 + p * 0.3);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(1, -42);
  ctx.lineTo(-2, -30);
  ctx.lineTo(3, -22);
  ctx.moveTo(-2, -30);
  ctx.lineTo(-8, -26);
  ctx.moveTo(3, -22);
  ctx.lineTo(9, -25);
  ctx.stroke();
  glow(ctx, 0, -29, 14, '#60d8ff', p * 0.45);
  // Salt crystals growing out of the shoulders.
  for (const [x, h, lean] of [[-14, 14, -3], [-10, 20, -2], [-6, 10, -1], [14, 17, 3], [10, 11, 2]] as const) {
    poly(ctx, [x - 3.4, -41, x + lean, -41 - h, x + 3.4, -41]);
    fillInk(ctx, lin(ctx, x - 3, -41 - h, x + 3, -41, '#f8f8f2', 0.2, -0.3), 0.8);
    ctx.fillStyle = alpha('#b8d8e8', 0.6);
    poly(ctx, [x + lean, -41 - h, x + 3.4, -41, x + 0.4, -41]);
    ctx.fill();
  }
  // Head: a blunt shard with two cold eyes.
  facet([-4, -44, 1, -54, 9, -50, 9, -42, 0, -39], 0.12);
  facet([1, -54, 9, -50, 9, -42, 3, -45], -0.15);
  ctx.fillStyle = '#1a2a30';
  poly(ctx, [1.5, -48.5, 8.5, -47, 8, -45, 1.5, -46]);
  ctx.fill();
  slitEyes(ctx, 5, -47, 3.6, '#60d8ff', 2.2);
  // Near fist, raised for the slam.
  facet([12, -38, 16, -36, 23 + atk * 2, -16 - lift, 17 + atk * 2, -14 - lift], -0.08);
  facet([15 + atk * 2, -18 - lift, 25 + atk * 2, -19 - lift, 26 + atk * 2, -10 - lift, 16 + atk * 2, -9 - lift], 0.1);
  if (atk > 0.3) glow(ctx, 20, -12 - lift, 12, '#ffffff', atk * 0.4);
}

function noon(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { atk, t } = s;
  const lift = 8 + Math.sin(t * 2) * 2;
  ctx.translate(0, -lift);
  const pale = c === '#fff0b0';
  // Burning halo
  const g = ctx.createRadialGradient(0, -44, 2, 0, -44, 40);
  g.addColorStop(0, alpha('#fff8d0', art.dead ? 0 : 0.9));
  g.addColorStop(0.4, alpha('#ffb040', art.dead ? 0 : 0.35));
  g.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-42, -86, 84, 84);
  if (!art.dead) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.5;
      const r0 = 13;
      const r1 = i % 2 ? 20 : 27 + Math.sin(t * 4 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.08) * r0, -44 + Math.sin(a - 0.08) * r0);
      ctx.lineTo(Math.cos(a) * r1, -44 + Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + 0.08) * r0, -44 + Math.sin(a + 0.08) * r0);
      ctx.fillStyle = alpha(i % 2 ? '#ffd870' : '#fff0b0', 0.85);
      ctx.fill();
    }
    ctx.strokeStyle = alpha('#fff8e0', 0.9);
    ctx.lineWidth = 1.4;
    circle(ctx, 0, -44, 12.5);
    ctx.stroke();
  }
  // Robe falling into flame-tongues
  ctx.beginPath();
  ctx.moveTo(-8, -37);
  ctx.lineTo(8, -37);
  ctx.quadraticCurveTo(12, -18, 13, 2);
  for (let i = 0; i < 6; i++) {
    const x = 13 - (i + 1) * (26 / 6);
    ctx.lineTo(x + 2, (i % 2 ? 3 : -4) + Math.sin(t * 7 + i) * 2);
  }
  ctx.quadraticCurveTo(-12, -18, -8, -37);
  ctx.closePath();
  const rg = ctx.createLinearGradient(0, -38, 0, 4);
  rg.addColorStop(0, shade(c, 0.2));
  rg.addColorStop(0.6, c);
  rg.addColorStop(1, pale ? alpha('#ffffff', 0.2) : alpha('#ff7010', 0.4));
  fillInk(ctx, rg, 1);
  ctx.strokeStyle = '#fff0b0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1, -36);
  ctx.lineTo(1.5, -4);
  ctx.stroke();
  // Void face
  circle(ctx, 0, -44, 7.6);
  const vg = ctx.createRadialGradient(0, -44, 0, 0, -44, 8);
  vg.addColorStop(0, '#000000');
  vg.addColorStop(1, '#2a1a08');
  fillInk(ctx, vg, 0.8);
  slitEyes(ctx, 1.5, -44, 5, '#fff6c0', 3);
  // Arms of light
  const arm = (side: number) => {
    const ex = side * (18 + atk * 8);
    const ey = -26 - atk * 18;
    limb(ctx, [side * 7, -34, side * 12, -30 - atk * 8, ex, ey], 3.6, c, 1.2);
    glow(ctx, ex, ey, 10, '#fff0b0', 0.6 + atk * 0.4);
    ctx.fillStyle = art.dead ? '#3a2a10' : '#fffbe8';
    circle(ctx, ex, ey, 2);
    ctx.fill();
  };
  arm(-1);
  arm(1);
}

function mother(ctx: CanvasRenderingContext2D, c: string, s: S) {
  const { sw, atk, t } = s;
  const dark = shade(c, -0.45);
  const fl = Math.sin(t * 2.5) * 4;
  const breathe = Math.sin(t * 2) * 1.5;
  // Wings: bony fingers with torn membranes.
  const wing = (side: number) => {
    const tip = [side * 32, -54 - fl];
    ctx.beginPath();
    ctx.moveTo(side * 6, -36);
    ctx.lineTo(side * 18, -50 - fl * 0.6);
    ctx.lineTo(tip[0], tip[1]);
    ctx.quadraticCurveTo(side * 30, -40, side * 28, -30);
    ctx.quadraticCurveTo(side * 24, -32, side * 22, -26);
    ctx.quadraticCurveTo(side * 18, -30, side * 15, -25);
    ctx.quadraticCurveTo(side * 11, -30, side * 8, -28);
    ctx.closePath();
    fillInk(ctx, lin(ctx, 0, -54, side * 30, -26, shade(c, -0.5), 0.2, -0.4), 1);
    limb(ctx, [side * 6, -36, side * 18, -50 - fl * 0.6, tip[0], tip[1]], 1.6, shade(c, -0.2), 1);
    for (const [x, y] of [[28, -30], [22, -26], [15, -25]]) limb(ctx, [side * 18, -50 - fl * 0.6, side * x, y], 0.9, shade(c, -0.25), 0.8);
    // Embers glowing through the membrane
    glow(ctx, side * 20, -40, 10, '#ff6a20', 0.25 + 0.1 * Math.sin(t * 5 + side));
  };
  wing(-1);
  wing(1);
  // Tail
  curve(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-5, -14);
    ctx.bezierCurveTo(-16, -10, -20, -2 + sw, -26 + Math.sin(t * 2) * 2, -6);
  }, 3, dark, 1.4);
  // Hooved legs
  limb(ctx, [-5, -16, -8 + sw * 3, -9, -6 + sw * 4.5, -1.5], 5, dark, 1.4);
  limb(ctx, [5, -16, 2 - sw * 3, -9, 6 - sw * 4.5, -1.5], 5.4, shade(c, -0.25), 1.4);
  for (const x of [-6 + sw * 4.5, 6 - sw * 4.5]) {
    ellipse(ctx, x + 1, -1, 3, 1.6);
    fillInk(ctx, '#1a0a06', 0.7);
  }
  // Body with a molten heart showing through cracks.
  ctx.beginPath();
  ctx.moveTo(-6, -14);
  ctx.quadraticCurveTo(-5, -22, -7, -27);
  ctx.quadraticCurveTo(-13, -34, -11, -39 - breathe);
  ctx.quadraticCurveTo(0, -43 - breathe, 11, -39 - breathe);
  ctx.quadraticCurveTo(13, -34, 7, -27);
  ctx.quadraticCurveTo(5, -22, 6, -14);
  ctx.closePath();
  fillInk(ctx, rad(ctx, 0, -28, 15, c, 0.25, -0.55), 1.2);
  const p = 0.6 + 0.3 * Math.sin(t * 3);
  ctx.strokeStyle = art.dead ? '#1a0a06' : alpha('#ffd060', 0.65 + p * 0.3);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(-4, -30);
  ctx.lineTo(-6, -36);
  ctx.moveTo(0, -24);
  ctx.lineTo(5, -31);
  ctx.lineTo(6, -37);
  ctx.moveTo(0, -24);
  ctx.lineTo(-2, -17);
  ctx.moveTo(0, -24);
  ctx.lineTo(4, -16);
  ctx.stroke();
  const hg = ctx.createRadialGradient(0, -24, 0, 0, -24, 8);
  hg.addColorStop(0, art.dead ? '#2a1008' : '#fff2a0');
  hg.addColorStop(0.5, art.dead ? '#1a0806' : '#ff8a20');
  hg.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = hg;
  circle(ctx, 0, -24, 8);
  ctx.fill();
  glow(ctx, 0, -24, 20, '#ff7020', p * 0.5);
  // Far arm
  limb(ctx, [-9, -35, -15, -27, -16, -19], 4, dark, 1.3);
  claws(ctx, -16, -19, 1.6, 4, '#2a1a10');
  // Head, crown of horns and hair of fire
  const hy = -47 - breathe;
  if (!art.dead) {
    for (let i = 0; i < 5; i++) {
      const x = -4 + i * 2.4;
      const h = 8 + Math.sin(t * 8 + i * 1.3) * 3 + (i === 2 ? 4 : 0);
      ctx.beginPath();
      ctx.moveTo(x - 2.4, hy - 3);
      ctx.quadraticCurveTo(x - 2 + Math.sin(t * 6 + i), hy - 3 - h * 0.6, x + Math.sin(t * 5 + i) * 1.5 - 2, hy - 3 - h);
      ctx.quadraticCurveTo(x + 1.5, hy - 3 - h * 0.5, x + 2.4, hy - 3);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? alpha('#ff8a20', 0.85) : alpha('#ffd050', 0.85);
      ctx.fill();
    }
    glow(ctx, 0, hy - 8, 14, '#ff9030', 0.5);
  }
  ellipse(ctx, 2, hy, 6.2, 6.6);
  fillInk(ctx, rad(ctx, 2, hy, 6.8, shade(c, 0.05), 0.3, -0.45), 1);
  horn(ctx, -1, hy - 4, -9, hy - 17, 4, 1.6, '#2a1a10');
  horn(ctx, 5, hy - 4.5, 12, hy - 18, -4, 1.5, '#2a1a10');
  // Brow ridge, slit eyes and a fanged snarl.
  ctx.fillStyle = shade(c, -0.4);
  poly(ctx, [-1, hy - 2.6, 8.4, hy - 1.4, 8, hy - 0.3, -0.6, hy - 1.2]);
  ctx.fill();
  ctx.fillStyle = '#1a0606';
  ctx.beginPath();
  ctx.moveTo(2.5, hy + 2.6);
  ctx.quadraticCurveTo(5.5, hy + 5 + atk * 2.5, 8.6, hy + 2);
  ctx.quadraticCurveTo(5.5, hy + 3.4, 2.5, hy + 2.6);
  ctx.fill();
  teeth(ctx, 3.2, 8, hy + 2.7, 4, 1.4);
  teeth(ctx, 3.8, 7.6, hy + 4.4 + atk * 2, 3, 1, true);
  slitEyes(ctx, 4.2, hy + 0.2, 4.2, '#ffee60', 2.6);
  // Near arm
  const hx = 18 + atk * 6;
  const hy2 = -20 - atk * 14;
  limb(ctx, [9, -35, 15 + atk * 3, -29 - atk * 6, hx, hy2], 4.4, shade(c, -0.05), 1.3);
  claws(ctx, hx, hy2, -0.6 - atk, 4.6, '#2a1a10');
  glow(ctx, hx, hy2, 9, '#ff7020', 0.3 + atk * 0.5);
}
