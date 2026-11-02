import { baseOf, type Item } from '../game/items';
import { FLOOR, WALL, type Level, type Prop } from '../game/map';
import { tileHash } from '../game/rng';
import type { AreaState, Fx, Monster, Npc, Projectile, World } from '../game/world';
import { Camera, TILE_H, TILE_W } from './camera';
import { baseIconCanvas } from './icons';
import { drawHumanoid, drawMonsterShape, floorTile, shade, treeSprite, wallBlock, WALL_H, TREE_W, TREE_H, type HumanoidLook, type Pose } from './sprites';

interface Drawable {
  depth: number;
  draw: () => void;
}

interface Light {
  x: number;
  y: number;
  r: number;
  a: number;
}

export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  groundId: number;
}

const OUTDOOR = new Set(['fields', 'forest', 'town']);
const BLOCK_PROPS = new Set(['pillar', 'tent', 'campfire']);

export class Renderer {
  readonly cam = new Camera();
  readonly ctx: CanvasRenderingContext2D;
  private dark: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private dpr = 1;
  labels: LabelRect[] = [];
  showLabels = true;
  automap: 'off' | 'mini' | 'full' = 'mini';
  hoverId = -1;
  private propIndex = new WeakMap<Level, Map<number, Prop>>();
  private mapCache = new WeakMap<AreaState, { canvas: HTMLCanvasElement; t: number; ox: number; oy: number }>();
  private time = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.dark = document.createElement('canvas');
    this.dctx = this.dark.getContext('2d')!;
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // Lighting is soft, so a lower-resolution buffer is plenty.
    this.dark.width = Math.ceil(w / 2);
    this.dark.height = Math.ceil(h / 2);
    this.cam.resize(w, h);
  }

  private props(l: Level): Map<number, Prop> {
    let m = this.propIndex.get(l);
    if (!m) {
      m = new Map();
      for (const p of l.props) m.set(p.y * l.w + p.x, p);
      this.propIndex.set(l, m);
    }
    return m;
  }

  render(w: World, dt: number) {
    this.time += dt;
    const ctx = this.ctx;
    const cam = this.cam;
    const a = w.area;
    const l = a.level;
    const p = w.player;
    cam.follow(p.x, p.y, dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cam.w, cam.h);
    const z = cam.zoom;
    const b = cam.bounds(3);
    const lightR = a.def.light;
    const visR = lightR + 3;
    const props = this.props(l);
    const lights: Light[] = [{ x: p.x, y: p.y, r: lightR, a: 1 }];
    const theme = l.theme;
    const outdoor = OUTDOOR.has(theme);
    const town = a.def.id === 'town';

    // Floor pass.
    for (let y = Math.max(0, b.y0); y <= Math.min(l.h - 1, b.y1); y++)
      for (let x = Math.max(0, b.x0); x <= Math.min(l.w - 1, b.x1); x++) {
        const t = l.tiles[y * l.w + x];
        if (!a.explored[y * l.w + x] && !town) continue;
        const pr = props.get(y * l.w + x);
        if (t !== FLOOR && !(pr && BLOCK_PROPS.has(pr.kind)) && !outdoor && theme !== 'cave') continue;
        const s = cam.toScreen(x, y);
        if (s.x < -TILE_W * z || s.x > cam.w + TILE_W * z || s.y < -TILE_H * z * 2 || s.y > cam.h + TILE_H * z) continue;
        const v = Math.floor(tileHash(x, y) * 4);
        ctx.drawImage(floorTile(theme, v), s.x - (TILE_W / 2) * z, s.y, TILE_W * z, TILE_H * z);
        if (pr?.kind === 'lava') {
          ctx.fillStyle = `rgba(255,${90 + 30 * Math.sin(this.time * 2 + x)},20,0.55)`;
          diamondPath(ctx, s.x, s.y, TILE_W * z * 0.8, TILE_H * z * 0.8);
          ctx.fill();
          lights.push({ x: x + 0.5, y: y + 0.5, r: 2.2, a: 0.5 });
        }
      }

    const items: Drawable[] = [];
    const add = (depth: number, draw: () => void) => items.push({ depth, draw });
    const near = (x: number, y: number, r = visR) => Math.hypot(x - p.x, y - p.y) <= r || town;

    // Walls, trees and blocking props.
    const pScreen = cam.toScreen(p.x, p.y);
    for (let y = Math.max(0, b.y0); y <= Math.min(l.h - 1, b.y1); y++)
      for (let x = Math.max(0, b.x0); x <= Math.min(l.w - 1, b.x1); x++) {
        const i = y * l.w + x;
        if (l.tiles[i] !== WALL) continue;
        if (!town && !a.explored[i]) continue;
        if (!touchesFloor(l, x, y)) continue;
        const pr = props.get(i);
        const s = cam.toScreen(x, y);
        if (s.x < -TILE_W * z * 1.5 || s.x > cam.w + TILE_W * z * 1.5 || s.y < -WALL_H * z * 2 || s.y > cam.h + WALL_H * z * 2) continue;
        const depth = x + y + 1;
        if (pr && BLOCK_PROPS.has(pr.kind)) {
          add(depth, () => this.drawProp(pr, lights));
          continue;
        }
        // Fade walls standing between the camera and the player.
        const occl = depth > p.x + p.y && Math.abs(s.x - pScreen.x) < 70 * z && s.y - WALL_H * z < pScreen.y && s.y + TILE_H * z > pScreen.y - 40 * z;
        if (outdoor || theme === 'cave') {
          add(depth, () => {
            const v = Math.floor(tileHash(x, y, 7) * 6);
            const spr = treeSprite(town ? 'town' : theme, v);
            const c = cam.toScreen(x + 0.5, y + 0.5);
            const k = z * (0.75 + tileHash(x, y, 3) * 0.35);
            if (occl) ctx.globalAlpha = 0.35;
            ctx.drawImage(spr, c.x - (TREE_W / 2) * k, c.y - (TREE_H - 16) * k, TREE_W * k, TREE_H * k);
            ctx.globalAlpha = 1;
          });
        } else {
          add(depth, () => {
            if (occl) ctx.globalAlpha = 0.35;
            ctx.drawImage(wallBlock(theme, Math.floor(tileHash(x, y) * 6)), s.x - (TILE_W / 2) * z, s.y - WALL_H * z, TILE_W * z, (TILE_H + WALL_H) * z);
            ctx.globalAlpha = 1;
          });
        }
      }

    // Floor props.
    for (const pr of l.props) {
      if (BLOCK_PROPS.has(pr.kind) || pr.kind === 'lava') continue;
      if (pr.x < b.x0 || pr.x > b.x1 || pr.y < b.y0 || pr.y > b.y1) continue;
      if (!town && !a.explored[pr.y * l.w + pr.x]) continue;
      add(pr.x + pr.y + 1, () => this.drawProp(pr, lights));
    }

    // Exits, waypoint, stash, portal.
    l.exits.forEach((e) => {
      if (!near(e.x, e.y, visR + 4) && !a.explored[e.y * l.w + e.x]) return;
      add(e.x + e.y + 0.9, () => this.drawExit(e.x + 0.5, e.y + 0.5, e.kind, e.label));
    });
    if (l.waypoint) {
      const wp = l.waypoint;
      const active = w.char.waypoints.includes(w.wpKey(a.def.id));
      add(wp.x + wp.y + 0.8, () => this.drawWaypoint(wp.x + 0.5, wp.y + 0.5, active));
      lights.push({ x: wp.x + 0.5, y: wp.y + 0.5, r: 3, a: active ? 0.6 : 0.3 });
    }
    if (l.spots.stash) {
      const st = l.spots.stash;
      add(st.x + st.y + 1, () => this.drawChest(st.x + 0.5, st.y + 0.5, false, true));
    }
    const pp = w.portalPos();
    if (pp) {
      add(pp.x + pp.y, () => this.drawPortal(pp.x, pp.y));
      lights.push({ x: pp.x, y: pp.y, r: 3.5, a: 0.8 });
    }

    // Objects.
    for (const o of a.objects) {
      if (!near(o.x, o.y)) continue;
      add(o.x + o.y, () => {
        if (o.kind === 'chest') this.drawChest(o.x, o.y, o.used, false);
        else if (o.kind === 'barrel') this.drawBarrel(o.x, o.y, o.used);
        else this.drawShrine(o.x, o.y, o.used, o.shrine!);
      });
      if (o.kind === 'shrine' && !o.used) lights.push({ x: o.x, y: o.y, r: 2.5, a: 0.5 });
    }

    // Ground items (below creatures).
    for (const g of a.ground) {
      if (!near(g.x, g.y)) continue;
      add(g.x + g.y - 0.3, () => this.drawGround(g.x, g.y, g.item, g.gold, g.t));
    }

    // Creatures.
    for (const m of a.monsters) {
      if (!near(m.x, m.y, lightR + 1.5)) continue;
      add(m.x + m.y + (m.dead ? -0.4 : 0), () => this.drawMonster(m));
    }
    for (const n of a.npcs) add(n.x + n.y, () => this.drawNpc(n, w));
    add(p.x + p.y, () => this.drawPlayer(w));

    // Projectiles drawn in world order too.
    for (const pr of a.projectiles) {
      add(pr.x + pr.y + 0.2, () => this.drawProjectile(pr));
      if (pr.kind !== 'arrow' && pr.kind !== 'm_arrow') lights.push({ x: pr.x, y: pr.y, r: 2.2, a: 0.6 });
    }

    items.sort((q, r) => q.depth - r.depth);
    for (const it of items) it.draw();

    // Meteors in flight.
    for (const h of a.hazards) {
      if (h.fired) {
        lights.push({ x: h.x, y: h.y, r: h.radius + 1, a: 0.7 });
        continue;
      }
      const k = h.t / h.delay;
      const s = cam.toScreen(h.x, h.y);
      const hy = (1 - k) * 420 * z;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gx = s.x - hy * 0.4;
      const gy = s.y - hy;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 18 * z);
      g.addColorStop(0, 'rgba(255,240,180,1)');
      g.addColorStop(0.4, 'rgba(255,120,30,0.8)');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, 18 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Additive effects.
    for (const f of a.fx) this.drawFx(f, lights);

    this.drawLighting(lights, a.def.dark);

    // Screen-space overlays.
    this.drawLabels(w);
    for (const f of a.fx) if (f.kind === 'text') this.drawFloatText(f);
    for (const n of a.npcs) {
      const s = cam.toScreen(n.x, n.y);
      this.text(n.name, s.x, s.y - 62 * z, '#e8c860', 12);
    }
    if (p.hurt > 0) {
      ctx.fillStyle = `rgba(160,0,0,${p.hurt * 0.6})`;
      ctx.fillRect(0, 0, cam.w, cam.h);
    }
    if (this.automap !== 'off') this.drawAutomap(w);
  }

  // ---------------------------------------------------------------- lighting

  private drawLighting(lights: Light[], dark: number) {
    const d = this.dctx;
    const cam = this.cam;
    const W = this.dark.width;
    const H = this.dark.height;
    const sx = W / cam.w;
    d.globalCompositeOperation = 'source-over';
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(0,0,0,${dark})`;
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const unit = (TILE_W / 2) * cam.zoom * sx;
    for (const L of lights) {
      const s = cam.toScreen(L.x, L.y);
      const r = L.r * unit * 1.45;
      // Squash vertically so light pools match the isometric ground plane.
      d.setTransform(1, 0, 0, 0.62, s.x * sx, s.y * sx - 14 * cam.zoom * sx);
      const flicker = 1 + Math.sin(this.time * 9 + L.x * 3) * 0.02;
      const g = d.createRadialGradient(0, 0, 0, 0, 0, r * flicker);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`);
      g.addColorStop(0.55, `rgba(0,0,0,${L.a * 0.75})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath();
      d.arc(0, 0, r, 0, Math.PI * 2);
      d.fill();
    }
    d.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.dark, 0, 0, cam.w, cam.h);
  }

  // ---------------------------------------------------------------- entities

  private pose(facing: number, walk: number, moving: boolean, attack: number, cast: number): Pose {
    // World facing to screen direction.
    const sdx = Math.cos(facing) - Math.sin(facing);
    const sdy = Math.cos(facing) + Math.sin(facing);
    return { dir: sdx >= 0 ? 1 : -1, back: sdy < 0, walk, moving, attack, cast };
  }

  private shadow(x: number, y: number, r: number) {
    const ctx = this.ctx;
    const s = this.cam.toScreen(x, y);
    const z = this.cam.zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r * 26 * z, r * 13 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private playerLook(w: World): HumanoidLook {
    const c = w.char;
    const eq = c.equipment;
    const cls = w.classDef();
    const wb = eq.weapon ? baseOf(eq.weapon) : null;
    const ab = eq.body ? baseOf(eq.body) : null;
    const hb = eq.head ? baseOf(eq.head) : null;
    const armorCol = ab ? (ab.qlvl >= 11 ? '#8f939c' : ab.qlvl >= 3 ? '#6b4a2e' : '#a8936a') : null;
    const look: HumanoidLook = {
      body: armorCol ?? (c.classId === 'reaver' ? '#7a4a2a' : c.classId === 'arcanist' ? '#33508f' : '#3d5a32'),
      trim: c.classId === 'arcanist' ? '#c8a858' : '#3a2a1a',
      skin: c.classId === 'arcanist' ? '#e0c0a0' : '#c89878',
      legs: c.classId === 'reaver' ? '#4a3020' : '#2e2a24',
      head: hb ? (hb.id === 'cap' ? 'cap' : 'helm') : c.classId === 'arcanist' ? 'hood' : 'hair',
      headColor: hb ? (hb.qlvl >= 11 ? '#9a9ea8' : '#7a5a3a') : c.classId === 'reaver' ? '#3a2410' : c.classId === 'arcanist' ? '#2a3f72' : '#b0702a',
      weapon: wb ? (wb.cat === 'mace' && wb.id === 'club' ? 'club' : wb.cat!) : null,
      weaponColor: eq.weapon?.rarity === 'unique' ? '#e8c27a' : eq.weapon?.rarity === 'rare' ? '#f0e070' : undefined,
      shield: eq.offhand ? (baseOf(eq.offhand).qlvl >= 11 ? '#8a8e98' : '#6b4a2e') : null,
      robe: c.classId === 'arcanist' && !ab,
      cape: c.classId === 'huntress' ? '#2e4a2a' : c.classId === 'reaver' ? undefined : '#22305a',
    };
    void cls;
    return look;
  }

  private drawPlayer(w: World) {
    const p = w.player;
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(p.x, p.y);
    this.shadow(p.x, p.y, 0.55);
    const act = p.action;
    let attack = 0;
    let cast = 0;
    let lift = 0;
    if (act) {
      const k = Math.min(1, act.t / act.dur);
      if (act.kind === 'melee' || act.kind === 'shoot' || act.kind === 'whirl') attack = act.kind === 'whirl' ? (act.t * 3) % 1 : k;
      if (act.kind === 'cast') cast = k;
      if (act.kind === 'leap') lift = Math.sin(k * Math.PI) * 60;
    }
    const pose = this.pose(p.facing, p.walk, p.moving, attack, cast);
    if (p.frenzy.stacks > 0 || p.buffs.battle_shout) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.frenzy.stacks > 0 ? 'rgba(200,40,20,0.25)' : 'rgba(255,220,120,0.18)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 22 * z, 11 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(s.x, s.y - lift * z);
    ctx.scale(z, z);
    if (p.dead) {
      ctx.rotate(-Math.PI / 2);
      ctx.translate(0, 10);
    }
    if (act?.kind === 'whirl') ctx.scale(Math.cos(p.facing * 2) > 0 ? 1 : -1, 1);
    drawHumanoid(ctx, this.playerLook(w), pose);
    ctx.restore();
    if (p.buffs.frost_shell) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(150,220,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 26 * z, 15 * z, 28 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawNpc(n: Npc, w: World) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(n.x, n.y);
    this.shadow(n.x, n.y, 0.5);
    const looks: Record<string, HumanoidLook> = {
      healer: { body: '#d8d0c0', trim: '#a02020', skin: '#e0c0a0', legs: '#333', head: 'hood', headColor: '#e8e0d0', robe: true, weapon: 'staff', weaponColor: '#ff8080' },
      smith: { body: '#5a3a22', trim: '#2a1a10', skin: '#c08868', legs: '#2a2018', head: 'hair', headColor: '#2a1a0a', weapon: 'mace', weaponColor: '#888' },
      sage: { body: '#4a5068', trim: '#c8b060', skin: '#d8b898', legs: '#222', head: 'hair', headColor: '#e8e8e8', robe: true, weapon: 'staff', weaponColor: '#a0d8ff' },
      fence: { body: '#5a2a5a', trim: '#d8b850', skin: '#d0a888', legs: '#222', head: 'cap', headColor: '#2a1a2a', cape: '#3a1a3a' },
    };
    const pose = this.pose(n.facing, 0, false, 0, 0);
    ctx.save();
    ctx.translate(s.x, s.y + Math.sin(this.time * 1.5 + n.id) * 0.5);
    ctx.scale(z, z);
    drawHumanoid(ctx, looks[n.kind], pose);
    ctx.restore();
    void w;
  }

  private drawMonster(m: Monster) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(m.x, m.y);
    const k = m.def.scale;
    if (m.dead) {
      const fade = m.deadT > 30 ? Math.max(0, 1 - (m.deadT - 30) / 10) : 1;
      const fall = Math.min(1, m.deadT / 0.35);
      ctx.save();
      ctx.globalAlpha = fade;
      if (m.deadT > 0.2 && !m.def.undead && m.def.shape !== 'wraith') {
        ctx.fillStyle = 'rgba(90,0,0,0.55)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, Math.min(1, m.deadT) * 18 * z * k, Math.min(1, m.deadT) * 8 * z * k, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (m.def.shape === 'wraith' || m.def.shape === 'bat') {
        ctx.restore();
        return;
      }
      ctx.translate(s.x, s.y);
      ctx.scale(z * k, z * k * (1 - fall * 0.45));
      ctx.rotate(-fall * Math.PI * 0.42);
      drawMonsterShape(ctx, m.def.shape, shade(m.def.color, -0.35), this.pose(m.facing, 0, false, 0, 0), 0);
      ctx.restore();
      return;
    }
    // Aura ring for special monsters.
    const ring = m.rarity === 'champion' ? '#5c7cff' : m.rarity === 'unique' ? '#d8b050' : m.rarity === 'boss' ? '#ff4020' : null;
    if (ring) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = ring;
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, m.def.radius * 48 * z, m.def.radius * 24 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.shadow(m.x, m.y, m.def.radius * 1.4);
    const act = m.action;
    const attack = act ? Math.min(1, act.t / act.dur) : 0;
    const pose = this.pose(m.facing, m.walk, m.walk > 0 && !act, attack, act?.kind === 'cast' ? attack : 0);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z * k, z * k);
    let color = m.def.color;
    if (m.rarity === 'champion') color = shade(color, 0.15);
    if (m.mods.includes('fireEnch')) color = '#d8602a';
    if (m.mods.includes('coldEnch')) color = '#7aa8d8';
    drawMonsterShape(ctx, m.def.shape, color, pose, this.time + m.id);
    if (m.flash > 0 || m.chill > 0 || this.hoverId === m.id) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = m.flash > 0 ? 0.55 : this.hoverId === m.id ? 0.25 : 0.35;
      drawMonsterShape(ctx, m.def.shape, m.flash > 0 ? '#ffffff' : m.chill > 0 ? '#3080ff' : '#806040', pose, this.time + m.id);
    }
    ctx.restore();
    if (m.stun > 0.3) this.text('✦', s.x, s.y - 54 * z * k, '#ffe080', 12);
  }

  private drawProjectile(pr: Projectile) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(pr.x, pr.y);
    const h = 22 * z;
    const sdx = (pr.vx - pr.vy) * (TILE_W / 2);
    const sdy = (pr.vx + pr.vy) * (TILE_H / 2);
    const ang = Math.atan2(sdy, sdx);
    ctx.save();
    ctx.translate(s.x, s.y - h);
    if (pr.kind === 'arrow' || pr.kind === 'm_arrow' || pr.kind === 'frostarrow' || pr.kind === 'firearrow') {
      ctx.rotate(ang);
      ctx.strokeStyle = pr.kind === 'm_arrow' ? '#d8d0b8' : '#8a6a40';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.moveTo(-14 * z, 0);
      ctx.lineTo(6 * z, 0);
      ctx.stroke();
      ctx.fillStyle = pr.kind === 'frostarrow' ? '#9fe0ff' : pr.kind === 'firearrow' ? '#ff9030' : '#ccc';
      ctx.beginPath();
      ctx.moveTo(10 * z, 0);
      ctx.lineTo(4 * z, -3 * z);
      ctx.lineTo(4 * z, 3 * z);
      ctx.fill();
      if (pr.kind === 'frostarrow' || pr.kind === 'firearrow') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = pr.kind === 'frostarrow' ? 'rgba(120,200,255,0.5)' : 'rgba(255,120,30,0.5)';
        ctx.beginPath();
        ctx.arc(6 * z, 0, 6 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    const col: Record<string, [string, string, number]> = {
      firebolt: ['#fff0b0', '#ff6a10', 9],
      fireball: ['#fff4c0', '#ff7a10', 15],
      icebolt: ['#ffffff', '#5ab8ff', 9],
      charged: ['#ffffff', '#9fc8ff', 6],
      m_fire: ['#ffe0a0', '#ff5010', 8],
      m_fireball: ['#ffe8a0', '#ff4a00', 13],
      m_cold: ['#ffffff', '#3a90ff', 8],
      m_light: ['#ffffff', '#e8e060', 7],
    };
    const [c0, c1, r0] = col[pr.kind] ?? ['#fff', '#f80', 8];
    const r = r0 * z;
    ctx.globalCompositeOperation = 'lighter';
    // Trail
    ctx.rotate(ang);
    const tg = ctx.createLinearGradient(-r * 3.5, 0, 0, 0);
    tg.addColorStop(0, 'rgba(0,0,0,0)');
    tg.addColorStop(1, c1);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(-r * 1.6, 0, r * 2, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, c0);
    g.addColorStop(0.45, c1);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    if (pr.kind === 'charged' || pr.kind === 'm_light') {
      ctx.strokeStyle = 'rgba(220,235,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a2 = Math.random() * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a2) * r * 1.6, Math.sin(a2) * r * 1.6);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGround(x: number, y: number, item: Item | undefined, gold: number | undefined, t: number) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    const bounce = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 18 * z : 0;
    if (gold) {
      ctx.fillStyle = '#e8c040';
      for (let i = 0; i < Math.min(6, 2 + Math.floor(gold / 20)); i++) {
        ctx.beginPath();
        ctx.ellipse(s.x + ((i * 7) % 11 - 5) * z, s.y - bounce + ((i * 5) % 5 - 2) * z, 3 * z, 1.8 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (!item) return;
    const b = baseOf(item);
    if (item.rarity === 'unique' || item.rarity === 'set') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, s.y - 120 * z, 0, s.y);
      const c = item.rarity === 'unique' ? '200,160,90' : '60,210,80';
      g.addColorStop(0, `rgba(${c},0)`);
      g.addColorStop(1, `rgba(${c},0.45)`);
      ctx.fillStyle = g;
      ctx.fillRect(s.x - 6 * z, s.y - 120 * z, 12 * z, 120 * z);
      ctx.restore();
    }
    const icon = baseIconCanvas(b.id);
    const scale = (z * 0.55) / 2;
    const iw = icon.width * scale;
    const ih = icon.height * scale;
    ctx.save();
    ctx.translate(s.x, s.y - bounce);
    ctx.rotate(0.9);
    ctx.drawImage(icon, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }

  private drawProp(pr: Prop, lights: Light[]) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(pr.x + 0.5, pr.y + 0.5);
    const t = this.time;
    const flame = (x: number, y: number, r: number) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const fy = y - i * r * 0.5 - Math.abs(Math.sin(t * 8 + i + pr.x)) * r * 0.4;
        const g = ctx.createRadialGradient(x, fy, 0, x, fy, r * (1 - i * 0.2));
        g.addColorStop(0, 'rgba(255,240,170,0.9)');
        g.addColorStop(0.5, 'rgba(255,120,20,0.6)');
        g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, fy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    switch (pr.kind) {
      case 'torch':
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(s.x - 1.5 * z, s.y - 30 * z, 3 * z, 30 * z);
        flame(s.x, s.y - 32 * z, 7 * z);
        lights.push({ x: pr.x + 0.5, y: pr.y + 0.5, r: 4, a: 0.75 });
        break;
      case 'brazier':
        ctx.fillStyle = '#4a4440';
        ctx.fillRect(s.x - 2 * z, s.y - 22 * z, 4 * z, 22 * z);
        ctx.fillStyle = '#5a524a';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 22 * z, 10 * z, 4 * z, 0, 0, Math.PI);
        ctx.fill();
        flame(s.x, s.y - 26 * z, 9 * z);
        lights.push({ x: pr.x + 0.5, y: pr.y + 0.5, r: 5, a: 0.85 });
        break;
      case 'campfire':
        ctx.strokeStyle = '#4a3020';
        ctx.lineWidth = 5 * z;
        ctx.beginPath();
        ctx.moveTo(s.x - 14 * z, s.y + 2 * z);
        ctx.lineTo(s.x + 14 * z, s.y - 4 * z);
        ctx.moveTo(s.x - 12 * z, s.y - 5 * z);
        ctx.lineTo(s.x + 12 * z, s.y + 3 * z);
        ctx.stroke();
        flame(s.x, s.y - 6 * z, 16 * z);
        lights.push({ x: pr.x + 0.5, y: pr.y + 0.5, r: 8, a: 0.95 });
        break;
      case 'bones':
        ctx.strokeStyle = 'rgba(220,210,190,0.7)';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(s.x - 8 * z, s.y);
        ctx.lineTo(s.x + 6 * z, s.y - 3 * z);
        ctx.moveTo(s.x - 2 * z, s.y + 4 * z);
        ctx.lineTo(s.x + 4 * z, s.y - 5 * z);
        ctx.stroke();
        ctx.fillStyle = 'rgba(220,210,190,0.8)';
        ctx.beginPath();
        ctx.arc(s.x + 9 * z, s.y + 1 * z, 3.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'grave':
        ctx.fillStyle = '#5a5850';
        ctx.beginPath();
        ctx.moveTo(s.x - 7 * z, s.y);
        ctx.lineTo(s.x - 7 * z, s.y - 16 * z);
        ctx.arc(s.x, s.y - 16 * z, 7 * z, Math.PI, 0);
        ctx.lineTo(s.x + 7 * z, s.y);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(s.x - 3 * z, s.y - 18 * z, 6 * z, 1.5 * z);
        break;
      case 'banner':
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(s.x - 1.5 * z, s.y - 56 * z, 3 * z, 56 * z);
        ctx.fillStyle = '#8a1a1a';
        ctx.beginPath();
        ctx.moveTo(s.x + 1.5 * z, s.y - 54 * z);
        ctx.lineTo(s.x + 18 * z + Math.sin(t * 2) * 2 * z, s.y - 50 * z);
        ctx.lineTo(s.x + 16 * z + Math.sin(t * 2 + 1) * 2 * z, s.y - 32 * z);
        ctx.lineTo(s.x + 1.5 * z, s.y - 36 * z);
        ctx.fill();
        break;
      case 'pillar': {
        const top = s.y - 70 * z;
        const g = ctx.createLinearGradient(s.x - 10 * z, 0, s.x + 10 * z, 0);
        g.addColorStop(0, '#6a6460');
        g.addColorStop(1, '#3a3632');
        ctx.fillStyle = g;
        ctx.fillRect(s.x - 10 * z, top, 20 * z, 70 * z);
        ctx.fillStyle = '#7a746e';
        ctx.fillRect(s.x - 13 * z, top - 4 * z, 26 * z, 6 * z);
        ctx.fillRect(s.x - 13 * z, s.y - 4 * z, 26 * z, 6 * z);
        break;
      }
      case 'tent': {
        const c = this.cam.toScreen(pr.x + 0.5, pr.y + 0.5);
        ctx.fillStyle = '#7a6a4a';
        ctx.beginPath();
        ctx.moveTo(c.x - 34 * z, c.y + 4 * z);
        ctx.lineTo(c.x, c.y - 46 * z);
        ctx.lineTo(c.x + 34 * z, c.y + 4 * z);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5a4a32';
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 46 * z);
        ctx.lineTo(c.x + 34 * z, c.y + 4 * z);
        ctx.lineTo(c.x + 8 * z, c.y + 10 * z);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1a140c';
        ctx.beginPath();
        ctx.moveTo(c.x - 8 * z, c.y + 6 * z);
        ctx.lineTo(c.x - 2 * z, c.y - 18 * z);
        ctx.lineTo(c.x + 4 * z, c.y + 7 * z);
        ctx.fill();
        break;
      }
    }
  }

  private drawExit(x: number, y: number, kind: string, label: string) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    if (kind === 'path') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,210,120,${0.18 + 0.08 * Math.sin(this.time * 3)})`;
      diamondPath(ctx, s.x, s.y, TILE_W * z * 1.3, TILE_H * z * 1.3);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = kind === 'down' ? '#050403' : '#2a2620';
      diamondPath(ctx, s.x, s.y, TILE_W * z * 1.1, TILE_H * z * 1.1);
      ctx.fill();
      ctx.strokeStyle = '#6a5a48';
      ctx.lineWidth = 2 * z;
      for (let i = 1; i <= 3; i++) {
        const k = 1 - i * 0.22;
        ctx.beginPath();
        ctx.moveTo(s.x - TILE_W * z * 0.5 * k, s.y - TILE_H * z * 0.05 * i);
        ctx.lineTo(s.x, s.y + TILE_H * z * 0.5 * k - TILE_H * z * 0.05 * i);
        ctx.stroke();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,200,120,0.12)';
      diamondPath(ctx, s.x, s.y, TILE_W * z * 1.5, TILE_H * z * 1.5);
      ctx.fill();
      ctx.restore();
    }
    this.text(label, s.x, s.y - 26 * z, '#e8d9a8', 11);
  }

  private drawWaypoint(x: number, y: number, active: boolean) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    ctx.fillStyle = '#5a5650';
    diamondPath(ctx, s.x, s.y, TILE_W * z * 1.6, TILE_H * z * 1.6);
    ctx.fill();
    ctx.fillStyle = '#6e6a62';
    diamondPath(ctx, s.x, s.y - 3 * z, TILE_W * z * 1.4, TILE_H * z * 1.4);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = active ? `rgba(90,170,255,${0.6 + 0.3 * Math.sin(this.time * 3)})` : 'rgba(90,120,160,0.3)';
    ctx.lineWidth = 2.5 * z;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 3 * z, 26 * z, 13 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (active) {
      const g = ctx.createLinearGradient(0, s.y - 60 * z, 0, s.y);
      g.addColorStop(0, 'rgba(60,140,255,0)');
      g.addColorStop(1, 'rgba(60,140,255,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - 22 * z, s.y - 60 * z, 44 * z, 57 * z);
    }
    ctx.restore();
  }

  private drawPortal(x: number, y: number) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(s.x, s.y - 30 * z, 2, s.x, s.y - 30 * z, 30 * z);
    g.addColorStop(0, 'rgba(220,240,255,0.95)');
    g.addColorStop(0.4, 'rgba(60,130,255,0.75)');
    g.addColorStop(1, 'rgba(20,40,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 30 * z, 16 * z, 30 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,210,255,0.7)';
    ctx.lineWidth = 1.5 * z;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 30 * z, (6 + i * 4) * z, (12 + i * 7) * z, this.time * (1 + i * 0.5), 0, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawChest(x: number, y: number, open: boolean, stash: boolean) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    const w = (stash ? 22 : 16) * z;
    const h = (stash ? 14 : 11) * z;
    ctx.fillStyle = stash ? '#5a3a1c' : '#5a4024';
    ctx.fillRect(s.x - w, s.y - h * 1.6, w * 2, h * 1.6);
    ctx.fillStyle = stash ? '#c8a040' : '#8a7040';
    ctx.fillRect(s.x - w, s.y - h * 1.6, w * 2, 2.5 * z);
    ctx.fillRect(s.x - 2 * z, s.y - h * 1.2, 4 * z, 5 * z);
    ctx.fillStyle = open ? '#1a1008' : stash ? '#6a4a24' : '#6a5030';
    ctx.beginPath();
    if (open) ctx.rect(s.x - w, s.y - h * 2.6, w * 2, h);
    else ctx.ellipse(s.x, s.y - h * 1.6, w, h * 0.6, 0, Math.PI, 0);
    ctx.fill();
  }

  private drawBarrel(x: number, y: number, broken: boolean) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    if (broken) {
      ctx.fillStyle = '#4a3420';
      for (let i = 0; i < 4; i++) ctx.fillRect(s.x + (i * 6 - 10) * z, s.y - (i % 2) * 3 * z, 5 * z, 2 * z);
      return;
    }
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(s.x - 9 * z, s.y - 24 * z, 18 * z, 24 * z);
    ctx.fillStyle = '#7a5a34';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 24 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(s.x - 9 * z, s.y - 18 * z, 18 * z, 2 * z);
    ctx.fillRect(s.x - 9 * z, s.y - 7 * z, 18 * z, 2 * z);
  }

  private drawShrine(x: number, y: number, used: boolean, kind: string) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(x, y);
    ctx.fillStyle = '#5a5650';
    ctx.fillRect(s.x - 7 * z, s.y - 34 * z, 14 * z, 34 * z);
    ctx.fillStyle = '#6e6a62';
    ctx.fillRect(s.x - 10 * z, s.y - 38 * z, 20 * z, 5 * z);
    const col = { armor: '90,160,255', combat: '255,90,60', refill: '255,80,160', experience: '255,220,90' }[kind] ?? '200,200,200';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = used ? 'rgba(120,120,120,0.3)' : `rgba(${col},${0.6 + 0.3 * Math.sin(this.time * 3)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 46 * z, 7 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- effects

  private drawFx(f: Fx, lights: Light[]) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = this.cam.toScreen(f.x, f.y);
    const k = f.t / f.dur;
    const unitX = (TILE_W / 2) * z;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    switch (f.kind) {
      case 'blood':
      case 'spark': {
        ctx.globalCompositeOperation = f.kind === 'blood' ? 'source-over' : 'lighter';
        ctx.fillStyle = f.color ?? '#a00';
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4 + f.x * 10;
          const d = k * 18 * z * (0.6 + (i % 3) * 0.3);
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * d, s.y - 22 * z + Math.sin(a) * d * 0.6 + k * k * 14 * z, 2.2 * z, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'nova':
      case 'shout':
      case 'slam':
      case 'portal_open': {
        const r = (f.r ?? 3) * unitX * 1.4 * (0.2 + k * 0.8);
        ctx.strokeStyle = f.color ?? (f.kind === 'slam' ? '#c8a878' : f.kind === 'portal_open' ? '#6aa8ff' : '#ffe080');
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 6 * z * (1 - k) + 1;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (f.kind === 'nova') {
          ctx.fillStyle = 'rgba(150,220,255,0.15)';
          ctx.fill();
        }
        break;
      }
      case 'explosion': {
        const r = (f.r ?? 2) * unitX * 1.3 * (0.3 + k * 0.7);
        const g = ctx.createRadialGradient(s.x, s.y - 10 * z, 0, s.x, s.y - 10 * z, r);
        g.addColorStop(0, `rgba(255,240,180,${1 - k})`);
        g.addColorStop(0.4, `rgba(255,120,20,${0.8 * (1 - k)})`);
        g.addColorStop(1, 'rgba(120,20,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 10 * z, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        lights.push({ x: f.x, y: f.y, r: (f.r ?? 2) + 2, a: 1 - k });
        break;
      }
      case 'chain': {
        ctx.strokeStyle = `rgba(210,230,255,${1 - k})`;
        ctx.lineWidth = 2.5 * z;
        ctx.beginPath();
        const pts = f.pts ?? [];
        pts.forEach((pt, i) => {
          const q = this.cam.toScreen(pt.x, pt.y);
          if (i === 0) ctx.moveTo(q.x, q.y - 22 * z);
          else {
            const prev = this.cam.toScreen(pts[i - 1].x, pts[i - 1].y);
            for (let j = 1; j <= 4; j++) {
              const t = j / 4;
              ctx.lineTo(prev.x + (q.x - prev.x) * t + (j < 4 ? (Math.random() - 0.5) * 14 * z : 0), prev.y + (q.y - prev.y) * t - 22 * z + (j < 4 ? (Math.random() - 0.5) * 14 * z : 0));
            }
          }
          lights.push({ x: pt.x, y: pt.y, r: 2, a: 0.6 * (1 - k) });
        });
        ctx.stroke();
        break;
      }
      case 'meteor_mark': {
        const r = (f.r ?? 2) * unitX * 1.3;
        ctx.strokeStyle = `rgba(255,80,30,${0.4 + 0.4 * Math.sin(this.time * 12)})`;
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r * (1 - k * 0.3), r * 0.5 * (1 - k * 0.3), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'burn': {
        const g = ctx.createRadialGradient(s.x, s.y - 8 * z, 0, s.x, s.y - 8 * z, 12 * z);
        g.addColorStop(0, `rgba(255,220,120,${1 - k})`);
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 8 * z - k * 14 * z, 12 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'teleport':
      case 'levelup':
      case 'revive':
      case 'shrine':
      case 'heal': {
        const col = f.kind === 'teleport' ? '170,110,255' : f.kind === 'levelup' ? '255,220,120' : f.kind === 'revive' ? '255,120,40' : f.kind === 'shrine' ? '120,190,255' : f.color === '#4f7dff' ? '80,120,255' : '255,70,70';
        const hgt = (f.kind === 'levelup' ? 140 : 70) * z;
        const g = ctx.createLinearGradient(0, s.y - hgt, 0, s.y);
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(1, `rgba(${col},${0.6 * (1 - k)})`);
        ctx.fillStyle = g;
        const wdt = (f.kind === 'levelup' ? 26 : 18) * z;
        ctx.fillRect(s.x - wdt, s.y - hgt * (0.4 + k * 0.6), wdt * 2, hgt * (0.4 + k * 0.6));
        break;
      }
      case 'whirl': {
        ctx.strokeStyle = `rgba(220,230,240,${0.7 * (1 - k)})`;
        ctx.lineWidth = 3 * z;
        const r = (f.r ?? 1.5) * unitX;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 18 * z, r, r * 0.5, 0, k * 6, k * 6 + 2.5);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  private drawFloatText(f: Fx) {
    const s = this.cam.toScreen(f.x, f.y);
    const z = this.cam.zoom;
    const k = f.t / f.dur;
    this.ctx.globalAlpha = 1 - k * k;
    this.text(f.text!, s.x + ((f.x * 97) % 1) * 10 - 5, s.y - 50 * z - k * 26 * z, f.color ?? '#fff', 13, true);
    this.ctx.globalAlpha = 1;
  }

  text(t: string, x: number, y: number, color: string, size: number, bold = false) {
    const ctx = this.ctx;
    ctx.font = `${bold ? 'bold ' : ''}${size}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(t, x, y);
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  }

  private drawLabels(w: World) {
    this.labels = [];
    if (!this.showLabels) return;
    const ctx = this.ctx;
    const a = w.area;
    const p = w.player;
    const z = this.cam.zoom;
    const vis = a.def.light + 3;
    const list = a.ground
      .filter((g) => Math.hypot(g.x - p.x, g.y - p.y) < vis || a.def.id === 'town')
      .map((g) => ({ g, s: this.cam.toScreen(g.x, g.y), l: w.groundLabel(g) }))
      .sort((q, r) => r.s.y - q.s.y);
    ctx.font = '12px Georgia, serif';
    const placed: LabelRect[] = [];
    for (const { g, s, l } of list) {
      const tw = ctx.measureText(l.text).width + 10;
      const rect = { x: s.x - tw / 2, y: s.y - 30 * z, w: tw, h: 17, groundId: g.id };
      for (let tries = 0; tries < 12 && placed.some((o) => overlap(o, rect)); tries++) rect.y -= 18;
      placed.push(rect);
      ctx.fillStyle = 'rgba(10,10,14,0.78)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = l.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.text, s.x, rect.y + rect.h / 2 + 1);
    }
    this.labels = placed;
  }

  // ---------------------------------------------------------------- automap

  private automapCanvas(w: World) {
    const a = w.area;
    const l = a.level;
    let c = this.mapCache.get(a);
    const S = 6;
    if (c && this.time - c.t < 0.5) return { ...c, S };
    if (!c) {
      const canvas = document.createElement('canvas');
      canvas.width = (l.w + l.h) * (S / 2) + S;
      canvas.height = (l.w + l.h) * (S / 4) + S;
      c = { canvas, t: 0, ox: l.h * (S / 2), oy: 0 };
      this.mapCache.set(a, c);
    }
    c.t = this.time;
    const ctx = c.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const town = a.def.id === 'town';
    ctx.fillStyle = 'rgba(200,190,160,0.12)';
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const i = y * l.w + x;
        if (!a.explored[i] && !town) continue;
        const px = c.ox + (x - y) * (S / 2);
        const py = c.oy + (x + y) * (S / 4);
        if (l.tiles[i] === FLOOR) {
          ctx.fillStyle = 'rgba(200,190,160,0.10)';
          ctx.fillRect(px - S / 4, py, S / 2, S / 2);
        } else if (touchesFloor(l, x, y)) {
          ctx.fillStyle = 'rgba(220,210,180,0.85)';
          ctx.fillRect(px - S / 4, py, S / 2, S / 2);
        }
      }
    for (const e of l.exits) {
      if (!a.explored[e.y * l.w + e.x] && !town) continue;
      ctx.fillStyle = '#ffcf6a';
      ctx.fillRect(c.ox + (e.x - e.y) * (S / 2) - 3, c.oy + (e.x + e.y) * (S / 4) - 1, 6, 6);
    }
    if (l.waypoint && (town || a.explored[l.waypoint.y * l.w + l.waypoint.x])) {
      ctx.fillStyle = '#5aa8ff';
      ctx.fillRect(c.ox + (l.waypoint.x - l.waypoint.y) * (S / 2) - 3, c.oy + (l.waypoint.x + l.waypoint.y) * (S / 4) - 1, 6, 6);
    }
    return { ...c, S };
  }

  private drawAutomap(w: World) {
    const ctx = this.ctx;
    const cam = this.cam;
    const { canvas, ox, oy, S } = this.automapCanvas(w);
    const p = w.player;
    const full = this.automap === 'full';
    const k = full ? Math.max(1, cam.zoom * 1.2) : 0.75;
    const box = full
      ? { x: 0, y: 0, w: cam.w, h: cam.h }
      : { x: cam.w - Math.min(170, cam.w * 0.3) - 8, y: 8, w: Math.min(170, cam.w * 0.3), h: Math.min(120, cam.h * 0.24) };
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const ppx = ox + (p.x - p.y) * (S / 2);
    const ppy = oy + (p.x + p.y) * (S / 4);
    ctx.save();
    if (!full) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = 'rgba(160,130,80,0.6)';
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    }
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.globalAlpha = full ? 0.85 : 1;
    ctx.drawImage(canvas, cx - ppx * k, cy - ppy * k, canvas.width * k, canvas.height * k);
    ctx.globalAlpha = 1;
    const mark = (wx: number, wy: number, col: string, r: number) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx + (ox + (wx - wy) * (S / 2) - ppx) * k, cy + (oy + (wx + wy) * (S / 4) - ppy) * k + S * k * 0.25, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const n of w.area.npcs) mark(n.x, n.y, '#e8c860', 2.5);
    const pp = w.portalPos();
    if (pp) mark(pp.x, pp.y, '#6aa8ff', 3);
    if (full) for (const m of w.area.monsters) if (!m.dead && Math.hypot(m.x - p.x, m.y - p.y) < w.area.def.light + 1) mark(m.x, m.y, '#ff4030', 2);
    mark(p.x, p.y, '#ffffff', 3);
    ctx.restore();
    if (full) this.text(w.area.def.name, cam.w / 2, 24, '#e8d9a8', 16, true);
  }
}

function touchesFloor(l: Level, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < l.w && ny < l.h && l.tiles[ny * l.w + nx] === FLOOR) return true;
    }
  return false;
}

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

function overlap(a: LabelRect, b: LabelRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
