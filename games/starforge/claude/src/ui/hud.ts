import { BUILDINGS, BUILD_MENU, RESOURCES, UNITS, type BuildingKind, type Cost, type UnitKind } from '../game/defs';
import type { Entity } from '../game/entity';
import { HUMAN } from '../game/world';
import type { Game } from './game';
import { ICONS } from './icons';

interface Btn {
  id: string;
  icon: string;
  label: string;
  hotkey?: string;
  cost?: Cost;
  state?: 'ok' | 'dim' | 'locked' | 'active';
  action: () => void;
}

const UNIT_HOTKEYS: Record<UnitKind, string> = { harvester: 'H', trooper: 'T', ranger: 'R', raider: 'R', crawler: 'C', wasp: 'W' };
const BUILD_HOTKEYS: Record<BuildingKind, string> = { core: 'C', habitat: 'H', extractor: 'E', garrison: 'G', turret: 'T', works: 'W', skyport: 'K' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** DOM overlay: resource bar, selection panel, command card, toasts and menus. */
export class Hud {
  readonly el: HTMLElement;
  readonly minimapCanvas: HTMLCanvasElement;
  private top: HTMLElement;
  private panel: HTMLElement;
  private info: HTMLElement;
  private card: HTMLElement;
  private toasts: HTMLElement;
  private hint: HTMLElement;
  private quick: HTMLElement;
  private overlay: HTMLElement;
  private cardSig = '';
  private buttons: Btn[] = [];
  private icons = new Map<string, string>();
  private isDirty = true;
  private infoHtml = '';

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="topbar">
        <div class="res crystal" title="Crystal"><i></i><span data-r="crystal">0</span></div>
        <div class="res flux" title="Flux"><i></i><span data-r="flux">0</span></div>
        <div class="res supply" title="Supply"><i></i><span data-r="supply">0/0</span></div>
        <div class="clock" data-r="clock">0:00</div>
        <button class="icon-btn" data-a="menu" aria-label="Menu">${ICONS.menu}</button>
      </div>
      <div class="quick">
        <button class="icon-btn" data-a="army" aria-label="Select army">${ICONS.army}<span class="lbl">Army</span></button>
        <button class="icon-btn" data-a="idle" aria-label="Idle harvester">${ICONS.worker}<span class="lbl">Idle</span><b class="badge" data-r="idle"></b></button>
        <button class="icon-btn" data-a="box" aria-label="Box select">${ICONS.box}<span class="lbl">Select</span></button>
        <button class="icon-btn" data-a="home" aria-label="Base">${ICONS.home}<span class="lbl">Base</span></button>
      </div>
      <div class="hint"></div>
      <div class="toasts"></div>
      <div class="panel">
        <canvas class="minimap"></canvas>
        <div class="info"></div>
        <div class="card"></div>
      </div>
      <div class="overlay hidden"></div>`;
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    this.top = q('.topbar');
    this.panel = q('.panel');
    this.info = q('.info');
    this.card = q('.card');
    this.toasts = q('.toasts');
    this.hint = q('.hint');
    this.quick = q('.quick');
    this.overlay = q('.overlay');
    this.minimapCanvas = q('.minimap');

    this.el.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (!a) return;
      game.audio.unlock();
      switch (a) {
        case 'menu': game.togglePause(true); break;
        case 'army': game.selectArmy(); break;
        case 'idle': game.nextIdleWorker(); break;
        case 'box': game.toggleBoxMode(); break;
        case 'home': game.centerBase(); break;
      }
    });
    this.card.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      if (!b) return;
      game.audio.unlock();
      this.buttons[Number(b.dataset.i)]?.action();
      this.dirty();
      this.update();
    });
    this.info.addEventListener('pointerdown', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-id],[data-q]');
      if (!t) return;
      e.preventDefault();
      if (t.dataset.q) game.cancelTrain();
      else if (t.dataset.id) game.select([Number(t.dataset.id)]);
      this.update();
    });
    // Keep HUD gestures from leaking to the page (no scroll/zoom on mobile).
    for (const el of [this.top, this.panel, this.quick]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  topHeight() {
    return this.top.getBoundingClientRect().height || 40;
  }

  bottomHeight() {
    return this.panel.getBoundingClientRect().height || 120;
  }

  dirty() {
    this.isDirty = true;
  }

  private icon(kind: UnitKind | BuildingKind) {
    let i = this.icons.get(kind);
    if (!i) {
      i = this.game.renderer.icon(kind);
      this.icons.set(kind, i);
    }
    return `<img src="${i}" alt="">`;
  }

  pressHotkey(k: string): boolean {
    const b = this.buttons.find((x) => x.hotkey === k);
    if (!b) return false;
    b.action();
    this.dirty();
    this.update();
    return true;
  }

  update() {
    const g = this.game;
    const w = g.world;
    const p = w.players[HUMAN];
    const set = (r: string, v: string) => {
      const el = this.el.querySelector<HTMLElement>(`[data-r="${r}"]`)!;
      if (el.textContent !== v) el.textContent = v;
    };
    set('crystal', String(Math.floor(p.crystal)));
    set('flux', String(Math.floor(p.flux)));
    const used = w.supplyUsed(HUMAN);
    const cap = w.supplyCap(HUMAN);
    set('supply', `${used}/${cap}`);
    this.el.querySelector('.supply')!.classList.toggle('blocked', used >= cap && cap < 200);
    const secs = Math.floor(w.time);
    set('clock', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    const idle = g.idleWorkers().length;
    set('idle', idle ? String(idle) : '');
    this.quick.querySelector('[data-a="box"]')!.classList.toggle('active', g.boxMode);

    const hint =
      g.mode.type === 'attack' ? 'Tap a target or location to attack' :
      g.mode.type === 'rally' ? 'Tap to set the rally point' :
      g.mode.type === 'place' ? 'Tap to position the building, tap again or ✓ to confirm' :
      g.boxMode ? 'Drag to select units' : '';
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    this.hint.classList.toggle('show', !!hint);

    this.renderInfo();
    const btns = this.cardSpec();
    const sig = btns.map((b) => `${b.id}:${b.state ?? 'ok'}`).join('|');
    this.buttons = btns;
    if (sig !== this.cardSig || this.isDirty) {
      this.cardSig = sig;
      this.card.innerHTML = btns
        .map(
          (b, i) => `<button class="cmd ${b.state ?? 'ok'}" data-i="${i}" aria-label="${esc(b.label)}">
            ${b.icon}
            ${b.hotkey ? `<span class="hk">${b.hotkey}</span>` : ''}
            ${b.cost ? `<span class="cost">${b.cost.crystal}${b.cost.flux ? `<em>${b.cost.flux}</em>` : ''}</span>` : `<span class="nm">${esc(b.label)}</span>`}
          </button>`,
        )
        .join('');
    }
    this.isDirty = false;
  }

  private cardSpec(): Btn[] {
    const g = this.game;
    const w = g.world;
    if (g.mode.type === 'place') {
      return [
        { id: 'ok', icon: ICONS.ok, label: 'Confirm', state: 'active', action: () => g.confirmPlace() },
        { id: 'x', icon: ICONS.cancel, label: 'Cancel', hotkey: 'X', action: () => g.setMode({ type: 'normal' }) },
      ];
    }
    if (g.mode.type !== 'normal') return [{ id: 'x', icon: ICONS.cancel, label: 'Cancel', hotkey: 'X', action: () => g.setMode({ type: 'normal' }) }];
    const own = g.selected().filter((e) => e.owner === HUMAN);
    const units = own.filter((e) => e.cls === 'unit');
    const buildings = own.filter((e) => e.cls === 'building');
    const affordState = (c: Cost, locked: boolean): Btn['state'] => (locked ? 'locked' : w.canAfford(HUMAN, c) ? 'ok' : 'dim');
    if (units.length) {
      const hasHarvester = units.some((u) => u.kind === 'harvester');
      if (g.buildMenu && hasHarvester) {
        return [
          ...BUILD_MENU.map((k): Btn => {
            const d = BUILDINGS[k];
            const locked = !!w.missingRequirement(HUMAN, k);
            return { id: k, icon: locked ? ICONS.lock : this.icon(k), label: d.name, hotkey: BUILD_HOTKEYS[k], cost: d.cost, state: affordState(d.cost, locked), action: () => g.chooseBuild(k) };
          }),
          { id: 'back', icon: ICONS.back, label: 'Back', hotkey: 'X', action: () => g.closeBuildMenu() },
        ];
      }
      const out: Btn[] = [
        { id: 'atk', icon: ICONS.attack, label: 'Attack', hotkey: 'A', action: () => g.cmdAttack() },
        { id: 'stop', icon: ICONS.stop, label: 'Stop', hotkey: 'S', action: () => g.cmdStop() },
        { id: 'hold', icon: ICONS.hold, label: 'Hold', hotkey: 'H', action: () => g.cmdHold() },
      ];
      if (hasHarvester) {
        out.push({ id: 'build', icon: ICONS.build, label: 'Build', hotkey: 'B', action: () => g.openBuildMenu() });
        if (units.some((u) => u.carry > 0)) out.push({ id: 'ret', icon: ICONS.ret, label: 'Return', hotkey: 'Q', action: () => g.cmdReturn() });
      }
      return out;
    }
    if (buildings.length) {
      const b = buildings[0];
      const d = BUILDINGS[b.kind as BuildingKind];
      if (!b.built) return [{ id: 'cxl', icon: ICONS.cancel, label: 'Cancel', hotkey: 'X', action: () => g.cancelBuilding() }];
      const out: Btn[] = (d.trains ?? []).map((k): Btn => {
        const u = UNITS[k];
        const locked = !!w.missingRequirement(HUMAN, k);
        return { id: k, icon: this.icon(k), label: u.name, hotkey: UNIT_HOTKEYS[k], cost: u.cost, state: affordState(u.cost, locked), action: () => g.train(k) };
      });
      if (d.trains) out.push({ id: 'rally', icon: ICONS.rally, label: 'Rally', hotkey: 'Y', action: () => g.rallyMode() });
      if (buildings.some((x) => x.queue.length)) out.push({ id: 'cq', icon: ICONS.cancel, label: 'Cancel', hotkey: 'X', action: () => g.cancelTrain() });
      return out;
    }
    return [];
  }

  private status(e: Entity): string {
    const w = this.game.world;
    if (e.cls === 'resource') {
      if (e.kind === 'crystal') return `${e.amount} crystal remaining`;
      return e.extractorId ? 'Extractor built' : `${e.amount} flux · build an Extractor`;
    }
    if (e.owner !== HUMAN) return e.owner === 0 ? '' : 'Enemy';
    if (e.cls === 'building') {
      if (!e.built) return `Constructing… ${Math.floor(e.progress * 100)}%`;
      if (e.kind === 'extractor') {
        const v = w.get(e.ventId);
        return `${v?.amount ?? 0} flux remaining`;
      }
      if (e.queue.length) return `Training ${UNITS[e.queue[0]].name} ${Math.floor((e.prodTime / UNITS[e.queue[0]].buildTime) * 100)}%`;
      const sp = BUILDINGS[e.kind as BuildingKind].supplyProvided;
      return sp ? `Provides ${sp} supply` : 'Ready';
    }
    const o = e.order;
    const carry = e.carry ? ` · carrying ${e.carry} ${e.carryType}` : '';
    switch (o.type) {
      case 'idle': return (e.targetId ? 'Engaging' : 'Idle') + carry;
      case 'hold': return 'Holding position';
      case 'move': return 'Moving' + carry;
      case 'attackMove': return 'Attack-moving';
      case 'attack': return 'Attacking';
      case 'gather': return (o.phase === 'mining' ? 'Harvesting' : o.phase === 'toBase' ? 'Returning cargo' : 'Heading to resource') + carry;
      case 'build': return `Constructing ${BUILDINGS[o.kind].name}`;
    }
  }

  private renderInfo() {
    const g = this.game;
    const sel = g.selected();
    let html = '';
    if (sel.length === 1) {
      const e = sel[0];
      const name = e.cls === 'resource' ? RESOURCES[e.kind as 'crystal' | 'vent'].name : e.cls === 'unit' ? UNITS[e.kind as UnitKind].name : BUILDINGS[e.kind as BuildingKind].name;
      const portrait = e.cls === 'resource' ? `<div class="res-portrait ${e.kind}"></div>` : this.icon(e.kind as UnitKind);
      const hp = e.cls === 'resource' ? '' : `<div class="hpbar"><i style="width:${(e.hp / e.maxHp) * 100}%"></i></div><div class="hp">${Math.ceil(e.hp)} / ${e.maxHp}</div>`;
      let queue = '';
      if (e.cls === 'building' && e.owner === HUMAN && e.queue.length) {
        queue = `<div class="queue">${e.queue
          .map((k, i) => `<button data-q="${i}" class="qslot">${this.icon(k)}${i === 0 ? `<i style="width:${(e.prodTime / UNITS[k].buildTime) * 100}%"></i>` : ''}</button>`)
          .join('')}</div>`;
      }
      html = `<div class="single"><div class="portrait">${portrait}</div><div class="details"><div class="name">${name}</div>${hp}<div class="status">${esc(this.status(e))}</div>${queue}</div></div>`;
    } else if (sel.length > 1) {
      const max = 24;
      html = `<div class="multi">${sel
        .slice(0, max)
        .map((e) => `<button data-id="${e.id}" class="mini">${this.icon(e.kind as UnitKind)}<i style="width:${(e.hp / e.maxHp) * 100}%"></i></button>`)
        .join('')}${sel.length > max ? `<span class="more">+${sel.length - max}</span>` : ''}</div>`;
    } else {
      html = `<div class="empty">Tap a unit to select it · long-press & drag to box-select · pinch to zoom</div>`;
    }
    if (this.infoHtml !== html) {
      this.infoHtml = html;
      this.info.innerHTML = html;
    }
  }

  toast(msg: string, kind: 'info' | 'error' | 'alert', seconds = 2.5, onClick?: () => void) {
    const last = this.toasts.lastElementChild as HTMLElement | null;
    if (last && last.dataset.msg === msg) {
      last.dataset.t = String(performance.now());
      return;
    }
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    t.dataset.msg = msg;
    if (onClick) {
      t.classList.add('clickable');
      t.addEventListener('click', onClick);
    }
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, seconds * 1000);
  }

  showPause(show: boolean) {
    const g = this.game;
    if (!show) {
      this.overlay.classList.add('hidden');
      return;
    }
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="dialog">
        <h2>Paused</h2>
        <button class="primary" data-o="resume">Resume</button>
        <div class="row">
          <span>Speed</span>
          ${[1, 1.5, 2].map((s) => `<button class="chip ${g.speed === s ? 'on' : ''}" data-speed="${s}">${s}×</button>`).join('')}
        </div>
        <div class="row"><span>Sound</span><button class="chip ${g.audio.muted ? '' : 'on'}" data-o="sound">${g.audio.muted ? 'Off' : 'On'}</button></div>
        <button data-o="restart">Restart</button>
        <button data-o="quit">Quit to menu</button>
        <p class="help">Tap: select / command · Long-press drag: box select · Double-tap: select all of type · Pinch: zoom · Drag: pan<br>
        Mouse: left select, right command, wheel zoom, arrows pan, Ctrl+1-9 groups</p>
      </div>`;
    this.overlay.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.speed) {
        g.speed = Number(t.dataset.speed);
        this.showPause(true);
      }
      switch (t.dataset.o) {
        case 'resume': g.togglePause(false); break;
        case 'sound': g.audio.muted = !g.audio.muted; this.showPause(true); break;
        case 'restart': g.cb.onRestart(); break;
        case 'quit': g.cb.onExit(); break;
      }
    };
  }

  showEnd(victory: boolean) {
    const g = this.game;
    const s = g.world.players[HUMAN].stats;
    const secs = Math.floor(g.world.time);
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="dialog end ${victory ? 'win' : 'lose'}">
        <h2>${victory ? 'Victory' : 'Defeat'}</h2>
        <p>${victory ? 'The enemy forge has fallen.' : 'Your base has been destroyed.'}</p>
        <table>
          <tr><td>Game time</td><td>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</td></tr>
          <tr><td>Units produced</td><td>${s.produced}</td></tr>
          <tr><td>Enemies destroyed</td><td>${s.killed}</td></tr>
          <tr><td>Losses</td><td>${s.lost}</td></tr>
          <tr><td>Resources gathered</td><td>${s.gathered}</td></tr>
        </table>
        <button class="primary" data-o="restart">Play again</button>
        <button data-o="quit">Main menu</button>
      </div>`;
    this.overlay.onclick = (e) => {
      const o = (e.target as HTMLElement).dataset.o;
      if (o === 'restart') g.cb.onRestart();
      if (o === 'quit') g.cb.onExit();
    };
  }
}
