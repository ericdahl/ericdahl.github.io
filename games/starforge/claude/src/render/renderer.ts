import { BUILDINGS, RESOURCES, UNITS, isUnitKind, type BuildingKind, type UnitKind } from '../game/defs';
import { Entity } from '../game/entity';
import { ROCK } from '../game/map';
import { HUMAN, type Effect, type World } from '../game/world';
import type { Camera } from './camera';
import { CRYSTAL, FLUX, SELECT, TEAM, TEAM_DARK, TEAM_GLOW } from './colors';

export interface Marker {
  x: number;
  y: number;
  age: number;
  color: string;
}

export interface RenderState {
  selection: Set<number>;
  /** Interpolation factor between the previous and current simulation tick. */
  alpha: number;
  ghost: { kind: BuildingKind; tx: number; ty: number; ok: boolean } | null;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  markers: Marker[];
  time: number;
}

const TERRAIN_PX = 32;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private fog: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogImg: ImageData;
  /** Crystal sprites keyed by remaining-amount level; glow is expensive to draw live on mobile. */
  private sprites = new Map<number, HTMLCanvasElement>();
  dpr = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.terrain = renderTerrain(world);
    this.fog = document.createElement('canvas');
    this.fog.width = world.w;
    this.fog.height = world.h;
    this.fogCtx = this.fog.getContext('2d')!;
    this.fogImg = this.fogCtx.createImageData(world.w, world.h);
  }

  /** Renders a unit or building portrait to a data URL for HUD buttons. */
  icon(kind: UnitKind | BuildingKind, owner = HUMAN, size = 96): string {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const prev = this.ctx;
    this.ctx = cv.getContext('2d')!;
    if (isUnitKind(kind)) {
      const d = UNITS[kind];
      const e = new Entity(0, kind, 'unit', owner, 0, 0, 1, d.radius);
      e.angle = -Math.PI / 4;
      // Small units would be specks at true scale, so portraits are normalised by radius.
      const sc = size / Math.max(1.0, d.radius * 3.2);
      this.ctx.setTransform(sc, 0, 0, sc, size / 2, size / 2 + (d.air ? sc * 0.4 : 0));
      this.drawUnit(e, { x: 0, y: 0 }, 0);
    } else {
      const d = BUILDINGS[kind];
      const e = new Entity(0, kind, 'building', owner, d.w / 2, d.h / 2, 1, 1);
      e.w = d.w;
      e.h = d.h;
      e.angle = -Math.PI / 4;
      const sc = size / (Math.max(d.w, d.h) + 0.3);
      this.ctx.setTransform(sc, 0, 0, sc, size / 2 - (d.w / 2) * sc, size / 2 - (d.h / 2) * sc);
      this.drawBuildingShape(e, 0);
    }
    this.ctx = prev;
    return cv.toDataURL();
  }

  get terrainCanvas() {
    return this.terrain;
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  draw(cam: Camera, st: RenderState) {
    const ctx = this.ctx;
    const w = this.world;
    const z = cam.zoom * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0, w.w, w.h);

    const b = cam.bounds();
    const onScreen = (e: Entity, pad = 2) => e.x > b.x0 - pad && e.x < b.x1 + pad && e.y > b.y0 - pad && e.y < b.y1 + pad;
    const vis = w.players[HUMAN].vis;
    const seen = (e: Entity) => w.isVisibleTo(e, HUMAN);
    const pos = (e: Entity) =>
      e.cls === 'unit' ? { x: e.lastX + (e.x - e.lastX) * st.alpha, y: e.lastY + (e.y - e.lastY) * st.alpha } : { x: e.x, y: e.y };

    // Ground layer: resources & buildings
    for (const e of w.list) {
      if (e.dead || e.cls === 'unit' || !onScreen(e, 4) || !seen(e)) continue;
      if (e.cls === 'resource') this.drawResource(e, st.time);
    }
    for (const e of w.list) {
      if (e.dead || e.cls !== 'building' || !onScreen(e, 4) || !seen(e)) continue;
      if (st.selection.has(e.id)) this.drawSelectRect(e);
      this.drawBuilding(e, st.time);
    }

    // Selection circles beneath units
    for (const id of st.selection) {
      const e = w.get(id);
      if (!e || e.cls !== 'unit') continue;
      const p = pos(e);
      const air = !!UNITS[e.kind as UnitKind].air;
      ctx.strokeStyle = e.owner === HUMAN ? SELECT : e.owner === 0 ? '#ffd84d' : '#ff4d4d';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + (air ? 0.3 : 0.05), e.radius + 0.12, (e.radius + 0.12) * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const units = w.list.filter((e) => !e.dead && e.cls === 'unit' && onScreen(e) && seen(e));
    for (const e of units) if (!UNITS[e.kind as UnitKind].air) this.drawUnit(e, pos(e), st.time);
    for (const e of units) if (UNITS[e.kind as UnitKind].air) this.drawUnit(e, pos(e), st.time);

    for (const f of w.effects) this.drawEffect(f);

    // Health bars for selected & damaged things
    for (const e of [...units, ...w.list.filter((x) => !x.dead && x.cls === 'building' && onScreen(x, 4) && seen(x))]) {
      const sel = st.selection.has(e.id);
      if (!sel && e.hp >= e.maxHp && (e.cls !== 'building' || e.built)) continue;
      const p = pos(e);
      if (e.cls === 'unit') {
        const air = UNITS[e.kind as UnitKind].air ? 0.6 : 0;
        this.bar(p.x - e.radius - 0.05, p.y - e.radius - 0.32 - air, e.radius * 2 + 0.1, e.hp / e.maxHp);
      } else {
        this.bar(e.tx + 0.2, e.ty - 0.3, e.w - 0.4, e.hp / e.maxHp);
        if (!e.built) this.bar(e.tx + 0.2, e.ty + e.h + 0.1, e.w - 0.4, e.progress, '#f0c040');
        else if (e.queue.length && e.owner === HUMAN) this.bar(e.tx + 0.2, e.ty + e.h + 0.1, e.w - 0.4, e.prodTime / UNITS[e.queue[0]].buildTime, '#5fd0ff');
      }
    }

    // Rally lines for selected own production buildings
    for (const id of st.selection) {
      const e = w.get(id);
      if (!e || e.owner !== HUMAN || e.cls !== 'building' || !e.rally) continue;
      ctx.strokeStyle = 'rgba(93,255,122,0.6)';
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.2, 0.15]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.rally.x, e.rally.y);
      ctx.stroke();
      ctx.setLineDash([]);
      flag(ctx, e.rally.x, e.rally.y);
    }

    for (const m of st.markers) {
      const t = m.age / 0.6;
      ctx.strokeStyle = m.color;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 0.6 * (1 - t) + 0.15, 0.45 * (1 - t) + 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.drawFog(vis);

    if (st.ghost) this.drawGhost(st.ghost);

    if (st.box) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const { x0, y0, x1, y1 } = st.box;
      ctx.fillStyle = 'rgba(93,255,122,0.12)';
      ctx.strokeStyle = SELECT;
      ctx.lineWidth = 1.5;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  private drawFog(vis: Uint8Array) {
    const d = this.fogImg.data;
    for (let i = 0; i < vis.length; i++) {
      const v = vis[i];
      d[i * 4] = 2;
      d[i * 4 + 1] = 3;
      d[i * 4 + 2] = 8;
      d[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 140 : 255;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.fog, 0, 0, this.world.w, this.world.h);
  }

  private bar(x: number, y: number, w: number, frac: number, color?: string) {
    const ctx = this.ctx;
    frac = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 0.03, y - 0.03, w + 0.06, 0.16);
    ctx.fillStyle = color ?? (frac > 0.6 ? '#4dff6a' : frac > 0.3 ? '#ffd23f' : '#ff4040');
    ctx.fillRect(x, y, w * frac, 0.1);
  }

  private drawSelectRect(e: Entity) {
    const ctx = this.ctx;
    ctx.strokeStyle = e.owner === HUMAN ? SELECT : e.owner === 0 ? '#ffd84d' : '#ff4d4d';
    ctx.lineWidth = 0.07;
    roundRect(ctx, e.tx - 0.1, e.ty - 0.1, e.w + 0.2, e.h + 0.2, 0.3);
    ctx.stroke();
  }

  private drawGhost(g: NonNullable<RenderState['ghost']>) {
    const ctx = this.ctx;
    const d = BUILDINGS[g.kind];
    ctx.fillStyle = g.ok ? 'rgba(80,255,120,0.35)' : 'rgba(255,60,60,0.4)';
    ctx.strokeStyle = g.ok ? '#5dff7a' : '#ff4d4d';
    ctx.lineWidth = 0.06;
    ctx.fillRect(g.tx, g.ty, d.w, d.h);
    ctx.strokeRect(g.tx, g.ty, d.w, d.h);
    ctx.globalAlpha = 0.6;
    const fake = { kind: g.kind, tx: g.tx, ty: g.ty, w: d.w, h: d.h, x: g.tx + d.w / 2, y: g.ty + d.h / 2, owner: HUMAN, built: true, angle: 0 } as Entity;
    this.drawBuildingShape(fake, 0);
    ctx.globalAlpha = 1;
  }

  private drawResource(e: Entity, t: number) {
    const ctx = this.ctx;
    if (e.kind === 'crystal') {
      const level = Math.max(1, Math.ceil((e.amount / RESOURCES.crystal.amount) * 4));
      let sprite = this.sprites.get(level);
      if (!sprite) {
        sprite = crystalSprite(level / 4);
        this.sprites.set(level, sprite);
      }
      ctx.drawImage(sprite, e.x - CRYSTAL_BOX.x, e.y - CRYSTAL_BOX.y, CRYSTAL_BOX.w, CRYSTAL_BOX.h);
    } else {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = '#0b120d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.45, 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1d3a24';
      ctx.lineWidth = 0.12;
      ctx.stroke();
      if (!e.extractorId) {
        const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.9);
        const pulse = 0.5 + 0.2 * Math.sin(t * 2 + e.id);
        g.addColorStop(0, `rgba(125,255,138,${pulse})`);
        g.addColorStop(1, 'rgba(125,255,138,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.0, 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.6 + i / 3 + e.id * 0.13) % 1;
          ctx.fillStyle = `rgba(160,255,170,${0.35 * (1 - ph)})`;
          ctx.beginPath();
          ctx.arc(Math.sin(i * 2.1 + e.id) * 0.4, -ph * 1.4, 0.15 + ph * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  private drawBuilding(e: Entity, t: number) {
    const ctx = this.ctx;
    if (!e.built) ctx.globalAlpha = 0.45 + 0.4 * e.progress;
    this.drawBuildingShape(e, t);
    if (!e.built) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(240,192,64,0.8)';
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.25, 0.2]);
      ctx.strokeRect(e.tx + 0.1, e.ty + 0.1, e.w - 0.2, e.h - 0.2);
      ctx.setLineDash([]);
      const sweepY = e.ty + e.h * (1 - ((t * 0.7) % 1));
      ctx.fillStyle = 'rgba(240,220,120,0.35)';
      ctx.fillRect(e.tx + 0.1, sweepY, e.w - 0.2, 0.08);
    }
  }

  private drawBuildingShape(e: Entity, t: number) {
    const ctx = this.ctx;
    const c = TEAM[e.owner];
    const dark = TEAM_DARK[e.owner];
    const k = e.kind as BuildingKind;
    const x = e.tx;
    const y = e.ty;
    const w = e.w;
    const h = e.h;
    // shadow + base plate
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x + 0.18, y + 0.22, w - 0.1, h - 0.1, 0.35);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#4a5466');
    g.addColorStop(1, '#232a36');
    ctx.fillStyle = g;
    roundRect(ctx, x + 0.08, y + 0.08, w - 0.16, h - 0.16, 0.3);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.1;
    ctx.stroke();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const pulse = 0.6 + 0.4 * Math.sin(t * 3 + e.id);
    ctx.save();
    switch (k) {
      case 'core': {
        ctx.fillStyle = '#323b4b';
        polygon(ctx, cx, cy, 1.25, 8, Math.PI / 8);
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.09;
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = c;
        ctx.shadowBlur = 14;
        ctx.fillStyle = c;
        ctx.globalAlpha *= 0.5 + 0.5 * pulse;
        ctx.beginPath();
        ctx.arc(cx, cy, 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = dark;
        for (const [dx, dy] of [[-1.55, -1.0], [1.55, -1.0], [-1.55, 1.0], [1.55, 1.0]]) {
          ctx.fillRect(cx + dx - 0.2, cy + dy - 0.2, 0.4, 0.4);
        }
        break;
      }
      case 'habitat': {
        for (const [dx, dy, r] of [[-0.35, -0.3, 0.5], [0.4, 0.35, 0.42]]) {
          const dg = ctx.createRadialGradient(cx + dx - 0.15, cy + dy - 0.15, 0.05, cx + dx, cy + dy, r);
          dg.addColorStop(0, '#9fb0c8');
          dg.addColorStop(1, '#3a4558');
          ctx.fillStyle = dg;
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = c;
        ctx.fillRect(cx - 0.75, cy + 0.6, 0.5, 0.1);
        break;
      }
      case 'extractor': {
        ctx.fillStyle = '#2b3442';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 0.9, 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = FLUX;
        ctx.shadowBlur = 12;
        ctx.fillStyle = FLUX;
        ctx.globalAlpha *= 0.4 + 0.5 * pulse;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 0.4, 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 0.9, 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'garrison': {
        ctx.fillStyle = '#2d3544';
        ctx.fillRect(x + 0.4, y + 0.4, w - 0.8, h - 1.1);
        ctx.fillStyle = c;
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 0.55 + i * 0.5, y + 0.55, 0.3, 0.12);
        ctx.fillStyle = '#11151c';
        ctx.fillRect(cx - 0.45, y + h - 0.75, 0.9, 0.55);
        ctx.fillStyle = dark;
        ctx.fillRect(cx - 0.45, y + h - 0.75, 0.9, 0.1);
        break;
      }
      case 'works': {
        ctx.fillStyle = '#2d3544';
        ctx.fillRect(x + 0.35, y + 0.9, w - 0.7, h - 1.3);
        for (const dx of [0.7, 2.0]) {
          ctx.fillStyle = '#596377';
          ctx.fillRect(x + dx, y + 0.25, 0.35, 0.8);
          ctx.fillStyle = `rgba(255,160,60,${0.4 + 0.4 * pulse})`;
          ctx.fillRect(x + dx + 0.05, y + 0.25, 0.25, 0.1);
        }
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.arc(cx, cy + 0.4, 0.45, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t * 0.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 0.45, cy + 0.4 + Math.sin(a) * 0.45);
          ctx.lineTo(cx + Math.cos(a) * 0.62, cy + 0.4 + Math.sin(a) * 0.62);
          ctx.stroke();
        }
        break;
      }
      case 'skyport': {
        ctx.fillStyle = '#20262f';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.08;
        ctx.stroke();
        ctx.strokeStyle = '#d8e0ea';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(cx - 0.45, cy - 0.45);
        ctx.lineTo(cx + 0.45, cy + 0.45);
        ctx.moveTo(cx + 0.45, cy - 0.45);
        ctx.lineTo(cx - 0.45, cy + 0.45);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.fillStyle = (Math.floor(t * 4) % 8) === i ? c : '#3a4352';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * 0.95, cy + Math.sin(a) * 0.95, 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'turret': {
        ctx.fillStyle = '#323b4b';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.08;
        ctx.stroke();
        ctx.translate(cx, cy);
        ctx.rotate(e.angle);
        ctx.fillStyle = '#8994a8';
        ctx.fillRect(0, -0.18, 0.85, 0.12);
        ctx.fillRect(0, 0.06, 0.85, 0.12);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(0, 0, 0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  private drawUnit(e: Entity, p: { x: number; y: number }, t: number) {
    const ctx = this.ctx;
    const c = TEAM[e.owner];
    const dark = TEAM_DARK[e.owner];
    const k = e.kind as UnitKind;
    const air = !!UNITS[k].air;
    const hover = air ? 0.55 + Math.sin(t * 3 + e.id) * 0.05 : 0;
    if (air) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x + 0.1, p.y + 0.3, e.radius * 0.9, e.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(p.x, p.y - hover);
    ctx.rotate(e.angle);
    ctx.lineJoin = 'round';
    switch (k) {
      case 'harvester': {
        ctx.fillStyle = '#5a6476';
        roundRect(ctx, -0.3, -0.24, 0.52, 0.48, 0.1);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.fillRect(-0.24, -0.08, 0.3, 0.16);
        ctx.strokeStyle = '#c9d2de';
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(0.22, -0.16);
        ctx.lineTo(0.38, -0.1);
        ctx.moveTo(0.22, 0.16);
        ctx.lineTo(0.38, 0.1);
        ctx.stroke();
        if (e.carry > 0) {
          ctx.fillStyle = e.carryType === 'flux' ? FLUX : CRYSTAL;
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(-0.12, 0, 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
        if (e.order.type === 'gather' && e.order.phase === 'mining') {
          ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 20)})`;
          ctx.beginPath();
          ctx.arc(0.45, 0, 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'trooper': {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(0, 0, 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, 0, 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cfd7e2';
        ctx.fillRect(0.05, 0.06, 0.38, 0.08);
        break;
      }
      case 'ranger': {
        ctx.fillStyle = dark;
        polygon(ctx, 0, 0, 0.38, 4, 0);
        ctx.fill();
        ctx.fillStyle = c;
        polygon(ctx, 0, 0, 0.24, 4, 0);
        ctx.fill();
        ctx.fillStyle = '#e8eef5';
        ctx.fillRect(0.1, -0.035, 0.6, 0.07);
        break;
      }
      case 'raider': {
        ctx.fillStyle = `rgba(255,190,90,${0.3 + 0.3 * Math.sin(t * 25 + e.id)})`;
        ctx.beginPath();
        ctx.ellipse(-0.5, 0, 0.18, 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(0.5, 0);
        ctx.lineTo(-0.4, -0.32);
        ctx.lineTo(-0.25, 0);
        ctx.lineTo(-0.4, 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0.35, 0);
        ctx.lineTo(-0.2, -0.16);
        ctx.lineTo(-0.2, 0.16);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'crawler': {
        ctx.strokeStyle = '#7a8496';
        ctx.lineWidth = 0.1;
        const step = Math.sin(t * 8 + e.id) * (e.moving ? 0.12 : 0);
        for (const [lx, ly, s] of [[0.35, 0.5, 1], [-0.35, 0.5, -1], [0.35, -0.5, -1], [-0.35, -0.5, 1]]) {
          ctx.beginPath();
          ctx.moveTo(lx * 0.5, ly * 0.5);
          ctx.lineTo(lx + step * s, ly);
          ctx.stroke();
        }
        ctx.fillStyle = dark;
        polygon(ctx, 0, 0, 0.5, 6, 0);
        ctx.fill();
        ctx.fillStyle = '#4a5466';
        polygon(ctx, 0, 0, 0.36, 6, 0);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, 0, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c0c8d4';
        ctx.fillRect(0.1, -0.07, 0.75, 0.14);
        break;
      }
      case 'wasp': {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(0.55, 0);
        ctx.lineTo(-0.4, -0.5);
        ctx.lineTo(-0.2, 0);
        ctx.lineTo(-0.4, 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0.45, 0);
        ctx.lineTo(-0.15, -0.18);
        ctx.lineTo(-0.15, 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(120,200,255,${0.4 + 0.3 * Math.sin(t * 30)})`;
        ctx.beginPath();
        ctx.arc(-0.3, -0.25, 0.08, 0, Math.PI * 2);
        ctx.arc(-0.3, 0.25, 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  private drawEffect(f: Effect) {
    const ctx = this.ctx;
    const t = f.age / f.life;
    const c = TEAM[f.owner];
    if (f.kind === 'shot') {
      switch (f.fx) {
        case 'bolt': {
          const a = Math.min(1, t * 1.6);
          const x = f.x + (f.x2 - f.x) * a;
          const y = f.y + (f.y2 - f.y) * a;
          const bx = f.x + (f.x2 - f.x) * Math.max(0, a - 0.25);
          const by = f.y + (f.y2 - f.y) * Math.max(0, a - 0.25);
          ctx.strokeStyle = c;
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        }
        case 'laser': {
          ctx.strokeStyle = TEAM_GLOW[f.owner];
          ctx.lineWidth = 0.18 * (1 - t);
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x2, f.y2);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.05 * (1 - t);
          ctx.stroke();
          break;
        }
        case 'slash': {
          ctx.strokeStyle = `rgba(255,255,255,${1 - t})`;
          ctx.lineWidth = 0.07;
          ctx.beginPath();
          ctx.arc(f.x2, f.y2, 0.3, t * 4, t * 4 + 2);
          ctx.stroke();
          break;
        }
        case 'shell':
        case 'missile': {
          const x = f.x + (f.x2 - f.x) * t;
          const y = f.y + (f.y2 - f.y) * t - (f.fx === 'shell' ? Math.sin(t * Math.PI) * 1.2 : 0);
          ctx.fillStyle = f.fx === 'shell' ? '#ffcf70' : c;
          ctx.beginPath();
          ctx.arc(x, y, f.fx === 'shell' ? 0.14 : 0.09, 0, Math.PI * 2);
          ctx.fill();
          if (t > 0.85) {
            ctx.fillStyle = 'rgba(255,170,60,0.6)';
            ctx.beginPath();
            ctx.arc(f.x2, f.y2, f.fx === 'shell' ? 1.1 : 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }
    } else if (f.kind === 'boom') {
      const r = f.size * (0.3 + t * 0.7);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,255,220,${1 - t})`);
      g.addColorStop(0.4, `rgba(255,150,40,${0.8 * (1 - t)})`);
      g.addColorStop(1, 'rgba(120,30,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'ping' && f.owner === HUMAN) {
      ctx.strokeStyle = `rgba(255,60,60,${1 - t})`;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1 + ((f.age * 3) % 1) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

const CRYSTAL_BOX = { x: 1.2, y: 1.5, w: 2.4, h: 2.3 };
const SPRITE_PX = 48;

function crystalSprite(amountFrac: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(CRYSTAL_BOX.w * SPRITE_PX);
  cv.height = Math.ceil(CRYSTAL_BOX.h * SPRITE_PX);
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(SPRITE_PX, 0, 0, SPRITE_PX, CRYSTAL_BOX.x * SPRITE_PX, CRYSTAL_BOX.y * SPRITE_PX);
  const frac = 0.55 + 0.45 * amountFrac;
  const shards = [
    [-0.55, 0.25, 0.35, 0.75, -0.2],
    [-0.1, 0.3, 0.42, 1.0, 0.1],
    [0.45, 0.25, 0.32, 0.7, 0.25],
    [0.15, 0.35, 0.25, 0.5, -0.35],
  ];
  ctx.shadowColor = CRYSTAL;
  ctx.shadowBlur = 10;
  for (let i = 0; i < shards.length; i++) {
    const [sx, sy, sw, sh, rot] = shards[i];
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    const hgt = sh * frac;
    const g = ctx.createLinearGradient(0, -hgt, 0, 0);
    g.addColorStop(0, '#e8fdff');
    g.addColorStop(0.5, i % 2 ? '#56c9ff' : '#9b7cff');
    g.addColorStop(1, '#1d3c8a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-sw / 2, 0);
    ctx.lineTo(-sw / 3, -hgt * 0.7);
    ctx.lineTo(0, -hgt);
    ctx.lineTo(sw / 3, -hgt * 0.7);
    ctx.lineTo(sw / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return cv;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function flag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#d8e0ea';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 0.8);
  ctx.stroke();
  ctx.fillStyle = SELECT;
  ctx.beginPath();
  ctx.moveTo(x, y - 0.8);
  ctx.lineTo(x + 0.45, y - 0.65);
  ctx.lineTo(x, y - 0.5);
  ctx.fill();
}

/** Pre-renders the static terrain once into an offscreen canvas. */
function renderTerrain(world: World): HTMLCanvasElement {
  const S = TERRAIN_PX;
  const cv = document.createElement('canvas');
  cv.width = world.w * S;
  cv.height = world.h * S;
  const ctx = cv.getContext('2d')!;
  const { w, h, terrain } = world;
  const deco = world.map.deco;
  const rock = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || terrain[y * w + x] === ROCK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = deco[y * w + x];
      if (!rock(x, y)) {
        const l = 13 + (d % 4) * 0.25;
        ctx.fillStyle = `hsl(${218 + (d % 5)}, 17%, ${l}%)`;
        ctx.fillRect(x * S, y * S, S, S);
        if (d % 7 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(x * S + S / 2, y * S + S / 2, S * 0.3, S * 0.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (d % 11 === 0) {
          ctx.fillStyle = 'rgba(140,180,255,0.08)';
          ctx.fillRect(x * S + (d % S), y * S + ((d * 7) % S), 3, 3);
        }
      }
    }
  }
  // Large soft blotches break up the tile grid.
  for (let i = 0; i < deco.length; i += 9) {
    const d = deco[i];
    const bx = (i % w) * S + (d % S);
    const by = Math.floor(i / w) * S + ((d * 3) % S);
    const r = S * (1.5 + (d % 4));
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, d % 3 === 0 ? 'rgba(120,140,190,0.06)' : 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!rock(x, y)) continue;
      const d = deco[y * w + x];
      ctx.fillStyle = `hsl(${235 + (d % 10)}, 14%, ${24 + (d % 6)}%)`;
      ctx.fillRect(x * S, y * S, S, S);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x * S + (d % 20), y * S + ((d >> 3) % 20), 8, 6);
      // Lit top edge and shadowed bottom edge facing open ground give the rock height.
      if (!rock(x, y - 1)) {
        ctx.fillStyle = 'rgba(200,215,255,0.28)';
        ctx.fillRect(x * S, y * S, S, 4);
      }
      if (!rock(x - 1, y)) {
        ctx.fillStyle = 'rgba(200,215,255,0.14)';
        ctx.fillRect(x * S, y * S, 3, S);
      }
      if (!rock(x, y + 1)) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x * S, y * S + S - 8, S, 8);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x * S, (y + 1) * S, S, 6);
      }
      if (!rock(x + 1, y)) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x * S + S - 4, y * S, 4, S);
      }
    }
  }
  return cv;
}
