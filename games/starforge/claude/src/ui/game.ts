import { AIController, type Difficulty } from '../game/ai';
import { BUILDINGS, type BuildingKind, type UnitKind } from '../game/defs';
import type { Entity } from '../game/entity';
import { generateMap } from '../game/map';
import { DT, ENEMY, HUMAN, World } from '../game/world';
import { Camera } from '../render/camera';
import { Renderer, type Marker, type RenderState } from '../render/renderer';
import { Audio } from './audio';
import { Hud } from './hud';
import { Input } from './input';
import { Minimap } from './minimap';

export interface GameOptions {
  difficulty: Difficulty;
  seed: number;
}

export type Mode =
  | { type: 'normal' }
  | { type: 'attack' }
  | { type: 'rally' }
  | { type: 'place'; kind: BuildingKind; tx: number; ty: number; placed: boolean };

export interface GameCallbacks {
  onExit(): void;
  onRestart(): void;
}

/** Owns one match: simulation, AI, camera, selection and the interaction state machine. */
export class Game {
  readonly world: World;
  readonly ai: AIController;
  readonly cam: Camera;
  readonly renderer: Renderer;
  readonly audio: Audio;
  readonly hud: Hud;
  readonly minimap: Minimap;
  private input: Input;
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;

  selection: number[] = [];
  mode: Mode = { type: 'normal' };
  buildMenu = false;
  boxMode = false;
  speed = 1;
  paused = false;
  over = false;
  private box: RenderState['box'] = null;
  private markers: Marker[] = [];
  private acc = 0;
  private lastT = 0;
  private raf = 0;
  private frameN = 0;
  private keys = new Set<string>();
  private groups = new Map<string, number[]>();
  private lastGroupKey = { k: '', t: 0 };
  private hover: { x: number; y: number } | null = null;
  private idleIdx = 0;
  private coreIdx = 0;
  private onResize = () => this.resize();

  constructor(
    root: HTMLElement,
    readonly opts: GameOptions,
    readonly cb: GameCallbacks,
  ) {
    this.world = new World(generateMap(opts.seed));
    this.world.setupStart();
    this.ai = new AIController(this.world, ENEMY, opts.difficulty);
    this.cam = new Camera(this.world.w, this.world.h);

    this.el = document.createElement('div');
    this.el.className = 'game';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'view';
    this.el.appendChild(this.canvas);
    root.appendChild(this.el);

    this.renderer = new Renderer(this.canvas, this.world);
    this.audio = new Audio();
    this.hud = new Hud(this);
    this.el.appendChild(this.hud.el);
    this.minimap = new Minimap(this, this.hud.minimapCanvas);

    this.input = new Input(this.canvas, {
      tap: (x, y, mouse, shift) => this.tap(x, y, mouse, shift),
      doubleTap: (x, y, shift) => this.doubleTap(x, y, shift),
      command: (x, y, shift) => this.rightClick(x, y, shift),
      box: (x0, y0, x1, y1, shift, done) => this.boxSelect(x0, y0, x1, y1, shift, done),
      boxCancel: () => (this.box = null),
      hover: (x, y) => this.onHover(x, y),
      pan: (dx, dy) => this.cam.panBy(dx, dy),
      zoom: (x, y, f) => this.cam.zoomAt(x, y, f),
      boxMode: () => this.boxMode,
      key: (e) => this.key(e),
      keyState: (c, d) => (d ? this.keys.add(c) : this.keys.delete(c)),
    });

    window.addEventListener('resize', this.onResize);
    this.resize();
    const core = this.world.buildingsOf(HUMAN)[0];
    this.cam.zoom = Math.max(26, Math.min(40, Math.min(this.cam.viewW, this.cam.viewH) / 11));
    this.cam.centerOn(core.x + 3, core.y + 2);
    this.hud.toast('Gather resources, build an army and destroy the enemy base.', 'info', 5);
  }

  start() {
    this.lastT = performance.now();
    const loop = (t: number) => {
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    window.removeEventListener('resize', this.onResize);
    this.el.remove();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.cam.padTop = this.hud.topHeight();
    this.cam.padBottom = this.hud.bottomHeight();
    this.cam.resize(w, h);
    this.minimap.resize();
  }

  // ---------------------------------------------------------------- loop

  private frame(t: number) {
    const dt = Math.min(0.1, (t - this.lastT) / 1000);
    this.lastT = t;
    this.frameN++;
    if (!this.paused) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= DT && n < 8) {
        this.ai.update();
        this.world.step();
        this.acc -= DT;
        n++;
      }
      if (n === 8) this.acc = 0;
    }
    this.processEvents();
    this.keyboardPan(dt);
    for (const m of this.markers) m.age += dt;
    this.markers = this.markers.filter((m) => m.age < 0.6);
    const before = this.selection.length;
    this.selection = this.selection.filter((id) => this.world.get(id));
    if (before && !this.selection.length) this.buildMenu = false;

    this.renderer.draw(this.cam, {
      selection: new Set(this.selection),
      alpha: this.paused ? 1 : Math.min(1, this.acc / DT),
      ghost: this.ghost(),
      box: this.box,
      markers: this.markers,
      time: t / 1000,
    });
    if (this.frameN % 3 === 0) this.minimap.draw();
    if (this.frameN % 6 === 0) this.hud.update();
  }

  private keyboardPan(dt: number) {
    const s = 900 * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('ArrowLeft')) dx += s;
    if (this.keys.has('ArrowRight')) dx -= s;
    if (this.keys.has('ArrowUp')) dy += s;
    if (this.keys.has('ArrowDown')) dy -= s;
    if (dx || dy) this.cam.panBy(dx, dy);
  }

  private processEvents() {
    const w = this.world;
    const b = this.cam.bounds();
    const visible = (x: number, y: number) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && w.players[HUMAN].vis[Math.floor(y) * w.w + Math.floor(x)] === 2;
    for (const ev of w.events) {
      switch (ev.type) {
        case 'error':
          if (ev.player === HUMAN) {
            this.hud.toast(ev.msg, 'error');
            this.audio.play('error');
          }
          break;
        case 'underAttack':
          if (ev.player === HUMAN) {
            this.hud.toast('We are under attack!', 'alert', 3, () => this.cam.centerOn(ev.x, ev.y));
            this.minimap.ping(ev.x, ev.y);
            this.audio.play('alert');
          }
          break;
        case 'buildingDone':
          if (ev.player === HUMAN) {
            this.hud.toast(`${BUILDINGS[ev.kind].name} complete`, 'info');
            this.audio.play('build');
          }
          break;
        case 'unitReady':
          if (ev.player === HUMAN) this.audio.play('ready', 0.6);
          break;
        case 'death':
          if (visible(ev.x, ev.y)) this.audio.play('boom', 0.7);
          break;
        case 'shot':
          if (visible(ev.x, ev.y)) this.audio.play(ev.fx === 'laser' ? 'laser' : ev.fx === 'shell' ? 'shell' : 'bolt', 0.5);
          break;
        case 'gameOver':
          this.over = true;
          setTimeout(() => this.hud.showEnd(ev.winner === HUMAN), 1200);
          break;
      }
    }
    w.events.length = 0;
  }

  // ---------------------------------------------------------------- selection helpers

  selected(): Entity[] {
    return this.selection.map((id) => this.world.get(id)).filter((e): e is Entity => !!e);
  }

  selectedOwnUnits() {
    return this.selected().filter((e) => e.owner === HUMAN && e.cls === 'unit');
  }

  select(ids: number[], add = false) {
    if (add) {
      const set = new Set(this.selection);
      for (const id of ids) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      }
      this.selection = [...set];
    } else {
      this.selection = ids;
    }
    this.buildMenu = false;
    this.hud.dirty();
  }

  private worldAt(sx: number, sy: number) {
    return this.cam.toWorld(sx, sy);
  }

  // ---------------------------------------------------------------- input actions

  private tap(sx: number, sy: number, mouse: boolean, shift: boolean) {
    this.audio.unlock();
    const p = this.worldAt(sx, sy);
    this.tapWorld(p.x, p.y, mouse, shift);
  }

  /** Handles a tap/click at a world position (also used by the minimap in targeting modes). */
  tapWorld(x: number, y: number, mouse: boolean, shift: boolean) {
    const w = this.world;
    switch (this.mode.type) {
      case 'attack':
        this.attackAt(x, y);
        if (!shift) this.setMode({ type: 'normal' });
        return;
      case 'rally':
        w.issue(HUMAN, { type: 'rally', ids: this.selection, x, y });
        this.markers.push({ x, y, age: 0, color: '#5dff7a' });
        this.setMode({ type: 'normal' });
        return;
      case 'place': {
        const spot = this.snapPlacement(this.mode.kind, x, y);
        const same = this.mode.placed && spot.tx === this.mode.tx && spot.ty === this.mode.ty;
        this.mode = { ...this.mode, ...spot, placed: true };
        if (mouse || same) this.confirmPlace(shift);
        this.hud.dirty();
        return;
      }
    }
    const e = w.entityAt(x, y, HUMAN, mouse ? 0.3 : 0.65);
    if (mouse) {
      if (e) this.select([e.id], shift && e.owner === HUMAN);
      else if (!shift) this.select([]);
      if (e) this.audio.play('click');
      return;
    }
    const units = this.selectedOwnUnits();
    if (e && e.owner === HUMAN) {
      const carrying = units.some((u) => u.kind === 'harvester' && u.carry > 0);
      const toDropOff = e.cls === 'building' && BUILDINGS[e.kind as BuildingKind].dropOff && carrying;
      const toExtractor = e.kind === 'extractor' && e.built && units.some((u) => u.kind === 'harvester');
      if (units.length && (toDropOff || toExtractor)) {
        this.smart(x, y);
      } else {
        this.select([e.id], shift);
        this.audio.play('click');
      }
    } else if (units.length) {
      this.smart(x, y);
    } else if (e) {
      this.select([e.id]);
    } else {
      this.select([]);
    }
  }

  private doubleTap(sx: number, sy: number, shift: boolean) {
    const p = this.worldAt(sx, sy);
    const e = this.world.entityAt(p.x, p.y, HUMAN, 0.65);
    if (this.mode.type !== 'normal' || !e || e.owner !== HUMAN) {
      this.tap(sx, sy, false, shift);
      return;
    }
    const b = this.cam.bounds();
    const same = this.world.list.filter(
      (u) => !u.dead && u.owner === HUMAN && u.kind === e.kind && u.x >= b.x0 && u.x <= b.x1 && u.y >= b.y0 && u.y <= b.y1,
    );
    this.select(same.map((u) => u.id), shift);
  }

  private rightClick(sx: number, sy: number, shift: boolean) {
    this.audio.unlock();
    if (this.mode.type !== 'normal') {
      this.setMode({ type: 'normal' });
      return;
    }
    const p = this.worldAt(sx, sy);
    this.smart(p.x, p.y, shift);
  }

  smart(x: number, y: number, _shift = false) {
    const own = this.selected().filter((e) => e.owner === HUMAN);
    if (!own.length) return;
    const target = this.world.entityAt(x, y, HUMAN);
    const hostile = target && target.owner === ENEMY;
    this.world.issue(HUMAN, { type: 'smart', ids: own.map((e) => e.id), x, y });
    this.markers.push({ x, y, age: 0, color: hostile ? '#ff4d4d' : '#5dff7a' });
  }

  private attackAt(x: number, y: number) {
    const ids = this.selectedOwnUnits().map((e) => e.id);
    const t = this.world.entityAt(x, y, HUMAN);
    if (t && t.owner === ENEMY) this.world.issue(HUMAN, { type: 'attack', ids, target: t.id });
    else this.world.issue(HUMAN, { type: 'attackMove', ids, x, y });
    this.markers.push({ x, y, age: 0, color: '#ff4d4d' });
  }

  private boxSelect(x0: number, y0: number, x1: number, y1: number, shift: boolean, done: boolean) {
    if (!done) {
      this.box = { x0, y0, x1, y1 };
      return;
    }
    this.box = null;
    const a = this.worldAt(Math.min(x0, x1), Math.min(y0, y1));
    const b = this.worldAt(Math.max(x0, x1), Math.max(y0, y1));
    const inBox = this.world.list.filter(
      (e) => !e.dead && e.owner === HUMAN && e.cls === 'unit' && e.x + e.radius >= a.x && e.x - e.radius <= b.x && e.y + e.radius >= a.y && e.y - e.radius <= b.y,
    );
    const army = inBox.filter((e) => e.kind !== 'harvester');
    const pick = army.length ? army : inBox;
    if (pick.length || !shift) this.select(pick.map((e) => e.id), shift);
    if (pick.length) this.audio.play('click');
    if (this.boxMode && pick.length) this.boxMode = false;
  }

  private onHover(sx: number, sy: number) {
    this.hover = this.worldAt(sx, sy);
    if (this.mode.type === 'place') {
      const spot = this.snapPlacement(this.mode.kind, this.hover.x, this.hover.y);
      this.mode = { ...this.mode, ...spot, placed: true };
    }
  }

  private key(e: KeyboardEvent) {
    if (e.code === 'Escape') {
      if (this.mode.type !== 'normal') this.setMode({ type: 'normal' });
      else if (this.buildMenu) this.closeBuildMenu();
      else this.select([]);
      return;
    }
    if (e.code.startsWith('Digit')) {
      const k = e.code.slice(5);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.groups.set(k, [...this.selection]);
        this.hud.toast(`Group ${k} assigned`, 'info', 1);
      } else {
        const g = (this.groups.get(k) ?? []).filter((id) => this.world.get(id));
        if (g.length) {
          const now = performance.now();
          if (this.lastGroupKey.k === k && now - this.lastGroupKey.t < 400) this.centerOnSelection();
          this.lastGroupKey = { k, t: now };
          this.select(g, e.shiftKey);
        }
      }
      return;
    }
    if (e.code === 'KeyP' || e.code === 'F10') {
      this.togglePause();
      return;
    }
    if (e.code === 'Space') {
      this.centerOnSelection();
      return;
    }
    if (e.key.length === 1 && this.hud.pressHotkey(e.key.toUpperCase())) e.preventDefault();
  }

  // ---------------------------------------------------------------- commands from HUD

  setMode(m: Mode) {
    this.mode = m;
    this.hud.dirty();
  }

  cmdAttack() {
    if (this.selectedOwnUnits().length) this.setMode({ type: 'attack' });
  }

  cmdStop() {
    this.world.issue(HUMAN, { type: 'stop', ids: this.selection });
  }

  cmdHold() {
    this.world.issue(HUMAN, { type: 'hold', ids: this.selection });
  }

  cmdReturn() {
    this.world.issue(HUMAN, { type: 'returnCargo', ids: this.selection });
  }

  openBuildMenu() {
    this.buildMenu = true;
    this.hud.dirty();
  }

  closeBuildMenu() {
    this.buildMenu = false;
    this.hud.dirty();
  }

  chooseBuild(kind: BuildingKind) {
    const err = this.world.missingRequirement(HUMAN, kind);
    if (err) {
      this.hud.toast(`Requires ${BUILDINGS[err].name}`, 'error');
      this.audio.play('error');
      return;
    }
    const ce = this.world.costError(HUMAN, BUILDINGS[kind].cost);
    if (ce) {
      this.hud.toast(ce, 'error');
      this.audio.play('error');
      return;
    }
    const at = this.hover ?? this.worldAt(this.cam.viewW / 2, (this.cam.viewH + this.cam.padTop - this.cam.padBottom) / 2);
    const spot = this.snapPlacement(kind, at.x, at.y);
    this.setMode({ type: 'place', kind, ...spot, placed: true });
  }

  /** Converts a world point into a footprint origin; extractors snap to a nearby vent. */
  snapPlacement(kind: BuildingKind, x: number, y: number) {
    const d = BUILDINGS[kind];
    if (d.onVent) {
      let best: Entity | undefined;
      let bestD = 5;
      for (const v of this.world.list) {
        if (v.dead || v.kind !== 'vent') continue;
        const dd = Math.hypot(v.x - x, v.y - y);
        if (dd < bestD) {
          bestD = dd;
          best = v;
        }
      }
      if (best) return { tx: best.tx, ty: best.ty };
    }
    return { tx: Math.round(x - d.w / 2), ty: Math.round(y - d.h / 2) };
  }

  private ghost(): RenderState['ghost'] {
    if (this.mode.type !== 'place' || !this.mode.placed) return null;
    const { kind, tx, ty } = this.mode;
    const ok = !this.world.placementError(HUMAN, kind, tx, ty) && this.world.canAfford(HUMAN, BUILDINGS[kind].cost);
    return { kind, tx, ty, ok };
  }

  confirmPlace(keep = false) {
    if (this.mode.type !== 'place') return;
    const { kind, tx, ty } = this.mode;
    const builders = this.selectedOwnUnits().filter((u) => u.kind === 'harvester');
    if (!builders.length) {
      this.setMode({ type: 'normal' });
      return;
    }
    const before = this.world.events.length;
    this.world.issue(HUMAN, { type: 'build', ids: builders.map((u) => u.id), kind, tx, ty });
    const failed = this.world.events.slice(before).some((e) => e.type === 'error');
    if (failed) return;
    this.audio.play('click');
    if (!keep) {
      this.setMode({ type: 'normal' });
      this.buildMenu = false;
    }
  }

  train(kind: UnitKind) {
    const producers = this.selected().filter((b) => b.owner === HUMAN && b.cls === 'building' && BUILDINGS[b.kind as BuildingKind].trains?.includes(kind));
    if (!producers.length) return;
    producers.sort((a, b) => a.queue.length - b.queue.length);
    this.world.issue(HUMAN, { type: 'train', id: producers[0].id, kind });
    this.audio.play('click');
    this.hud.dirty();
  }

  cancelTrain() {
    const b = this.selected().find((e) => e.owner === HUMAN && e.queue.length);
    if (b) this.world.issue(HUMAN, { type: 'cancelTrain', id: b.id });
    this.hud.dirty();
  }

  cancelBuilding() {
    for (const b of this.selected()) if (b.owner === HUMAN && b.cls === 'building' && !b.built) this.world.issue(HUMAN, { type: 'cancelBuilding', id: b.id });
  }

  rallyMode() {
    this.setMode({ type: 'rally' });
  }

  selectArmy() {
    const army = this.world.unitsOf(HUMAN).filter((u) => u.kind !== 'harvester');
    if (!army.length) {
      this.hud.toast('No combat units', 'info', 1);
      return;
    }
    const same = army.length === this.selection.length && army.every((u) => this.selection.includes(u.id));
    this.select(army.map((u) => u.id));
    if (same) this.centerOnSelection();
  }

  idleWorkers() {
    return this.world.unitsOf(HUMAN).filter((u) => u.kind === 'harvester' && u.order.type === 'idle');
  }

  nextIdleWorker() {
    const idle = this.idleWorkers();
    if (!idle.length) {
      this.hud.toast('No idle harvesters', 'info', 1);
      return;
    }
    const u = idle[this.idleIdx++ % idle.length];
    this.select([u.id]);
    this.cam.centerOn(u.x, u.y);
  }

  centerBase() {
    const cores = this.world.buildingsOf(HUMAN).filter((b) => b.kind === 'core');
    const list = cores.length ? cores : this.world.buildingsOf(HUMAN);
    if (!list.length) return;
    const c = list[this.coreIdx++ % list.length];
    this.cam.centerOn(c.x, c.y);
  }

  centerOnSelection() {
    const s = this.selected();
    if (!s.length) return;
    const x = s.reduce((n, e) => n + e.x, 0) / s.length;
    const y = s.reduce((n, e) => n + e.y, 0) / s.length;
    this.cam.centerOn(x, y);
  }

  toggleBoxMode() {
    this.boxMode = !this.boxMode;
    this.hud.dirty();
  }

  togglePause(force?: boolean) {
    this.paused = force ?? !this.paused;
    this.hud.showPause(this.paused);
  }
}
