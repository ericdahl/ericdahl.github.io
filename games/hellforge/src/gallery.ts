// Dev-only page (npm run dev, then /gallery.html): every character model in a few poses.
// Not part of the game build.
import { makeItem, type ClassId } from './game/items';
import { MONSTERS } from './game/monsters';
import type { NpcKind } from './game/world';
import { drawMonsterShape } from './render/creatures';
import { drawHumanoid, drawTinted, type HumanoidLook, type Pose } from './render/figures';
import { heroLook, npcLook, type Gear } from './render/looks';

const params = new URLSearchParams(location.search);
const ZOOM = Number(params.get('zoom') ?? 3);
const T = Number(params.get('t') ?? 0.7);
const app = document.getElementById('app')!;

const POSES: [string, Pose][] = [
  ['idle', { dir: 1, back: false, walk: 0, moving: false, attack: 0, cast: 0 }],
  ['walk', { dir: 1, back: false, walk: 0.45, moving: true, attack: 0, cast: 0 }],
  ['attack', { dir: 1, back: false, walk: 0, moving: false, attack: 0.35, cast: 0 }],
  ['back', { dir: -1, back: true, walk: 0.2, moving: true, attack: 0, cast: 0 }],
];

function section(title: string) {
  const h = document.createElement('h2');
  h.textContent = title;
  app.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  app.appendChild(row);
  return row;
}

function cell(row: HTMLElement, label: string, scale: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const f = document.createElement('figure');
  const c = document.createElement('canvas');
  const w = Math.ceil(64 * ZOOM * Math.max(1, scale * 0.8));
  const h = Math.ceil(84 * ZOOM * Math.max(1, scale * 0.8));
  const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.translate(w / 2, h * 0.86);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14 * ZOOM * scale, 7 * ZOOM * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(ZOOM * scale, ZOOM * scale);
  draw(ctx);
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  f.append(c, cap);
  row.appendChild(f);
}

const gear = (ids: Partial<Record<keyof Gear, string>>, rarity: 'normal' | 'unique' | 'rare' = 'normal'): Gear => {
  const g: Gear = {};
  for (const [slot, id] of Object.entries(ids)) g[slot as keyof Gear] = makeItem(id, 30, slot === 'weapon' ? rarity : 'normal');
  return g;
};

const LOADOUTS: Record<ClassId, Gear[]> = {
  reaver: [gear({ weapon: 'short_sword' }), gear({ weapon: 'war_axe', body: 'studded_leather', head: 'cap', offhand: 'small_shield' }), gear({ weapon: 'claymore', body: 'plate_mail', head: 'great_helm', gloves: 'gauntlets', boots: 'greaves' }, 'unique')],
  arcanist: [gear({}), gear({ weapon: 'short_staff' }), gear({ weapon: 'dial_staff', body: 'chain_mail', head: 'circlet' }, 'rare')],
  huntress: [gear({ weapon: 'short_bow' }), gear({ weapon: 'long_bow', body: 'hard_leather', head: 'skull_cap' }), gear({ weapon: 'recurve_bow', body: 'scale_mail', head: 'full_helm' }, 'unique')],
  necromancer: [gear({ weapon: 'bone_wand' }), gear({ weapon: 'yew_wand', offhand: 'buckler' }), gear({ weapon: 'glass_wand', body: 'lamellar', head: 'wrapped_helm', offhand: 'kite_shield' }, 'rare')],
};

for (const cls of Object.keys(LOADOUTS) as ClassId[]) {
  const row = section(`Hero: ${cls}`);
  LOADOUTS[cls].forEach((g, i) => {
    const look = heroLook(cls, g);
    for (const [name, pose] of POSES) cell(row, `${i} ${name}`, 1, (ctx) => drawHumanoid(ctx, look, pose, T));
  });
  const look = heroLook(cls, LOADOUTS[cls][1]);
  cell(row, 'cast', 1, (ctx) => drawHumanoid(ctx, look, { ...POSES[0][1], cast: 0.5 }, T));
  cell(row, 'hurt', 1, (ctx) => {
    drawHumanoid(ctx, look, POSES[0][1], T);
    drawTinted(ctx, (c) => drawHumanoid(c, look, POSES[0][1], T), '#ff4020', 0.4);
  });
}

const npcs: NpcKind[] = ['healer', 'smith', 'sage', 'fence', 'caravan'];
for (const act of [1, 2]) {
  const row = section(`Townsfolk, act ${act}`);
  for (const k of npcs) {
    const look: HumanoidLook = npcLook(k, act);
    cell(row, k, 1, (ctx) => drawHumanoid(ctx, look, POSES[0][1], T));
    cell(row, `${k} back`, 1, (ctx) => drawHumanoid(ctx, look, { ...POSES[0][1], back: true }, T));
  }
}

const only = params.get('m');
const row = section('Monsters');
for (const def of Object.values(MONSTERS)) {
  if (only && !only.split(',').includes(def.id)) continue;
  const scale = def.scale;
  for (const [name, pose] of POSES.slice(0, 3)) {
    cell(row, `${def.id} ${name}`, scale, (ctx) => drawMonsterShape(ctx, def.shape, def.color, pose, T + def.id.length, { id: def.id }));
  }
  cell(row, `${def.id} hit`, scale, (ctx) => {
    const draw = (c: CanvasRenderingContext2D) => drawMonsterShape(c, def.shape, def.color, POSES[0][1], T, { id: def.id });
    draw(ctx);
    drawTinted(ctx, draw, '#ffffff', 0.55);
  });
  cell(row, `${def.id} dead`, scale, (ctx) => {
    ctx.scale(1, 0.55);
    ctx.rotate(-Math.PI * 0.42);
    drawMonsterShape(ctx, def.shape, def.color, POSES[0][1], 0, { dead: true, id: def.id });
  });
  for (const ph of def.phases ?? []) {
    if (ph.shape) cell(row, `${def.id} ${ph.name}`, scale, (ctx) => drawMonsterShape(ctx, ph.shape!, ph.color ?? def.color, POSES[2][1], T, { id: def.id }));
  }
}
