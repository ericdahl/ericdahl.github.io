import { AREA_BY_ID } from '../game/areas';
import type { Character } from '../game/character';
import { MOD_LABEL } from '../game/monsters';
import { SKILL_BY_ID } from '../game/skills';
import { World, type Interactable } from '../game/world';
import { baseIconUrl, skillIconUrl } from '../render/icons';
import { Renderer } from '../render/renderer';
import { Audio } from './audio';
import { h, isTouch } from './dom';
import { itemActions, panelItemContext, renderPanel, type PanelHost, type PanelKind, type Selection } from './panels';
import { loadSettings, saveCharacter, saveSettings, type Settings } from './save';

const TOUCH_JOY_ZONE = 0.42;

export class Game implements PanelHost {
  world: World;
  renderer: Renderer;
  audio = new Audio();
  settings: Settings = loadSettings();
  sel: Selection | null = null;
  panel: PanelKind | null = null;
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private hud!: Record<string, HTMLElement>;
  private panelEl!: HTMLElement;
  private overlayEl!: HTMLElement;
  private last = 0;
  private acc = 0;
  private saveT = 0;
  private running = true;
  private raf = 0;
  private held: { slot: number; t: number } | null = null;
  private mouse = { x: 0, y: 0, left: false, right: false, shift: false, repeat: 0 };
  private joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private drag: { id: number; x: number; y: number; t: number; moved: boolean } | null = null;
  private hudCache: Record<string, string> = {};
  private paused = false;
  private onExit: () => void;

  constructor(root: HTMLElement, char: Character, onExit: () => void, seed?: number) {
    this.root = root;
    this.onExit = onExit;
    this.world = new World(char, seed);
    root.innerHTML = '';
    this.canvas = h('canvas', { class: 'view' });
    root.append(this.canvas);
    this.renderer = new Renderer(this.canvas);
    this.renderer.showLabels = this.settings.labels;
    this.renderer.showWeather = this.settings.weather;
    this.renderer.screenFx = this.settings.screenFx;
    this.renderer.automap = this.settings.automap === 'full' ? 'mini' : this.settings.automap;
    this.audio.setEnabled(this.settings.sound);
    this.audio.setMusic(this.settings.music);
    this.buildHud();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    this.renderer.cam.snap(this.world.player.x, this.world.player.y);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    (window as unknown as { game: Game }).game = this;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.audio.close();
  }

  private onHide = () => {
    if (document.visibilityState === 'hidden') this.save();
  };

  save() {
    saveCharacter(this.world.char);
  }

  private resize = () => {
    const w = this.root.clientWidth || window.innerWidth;
    const h2 = this.root.clientHeight || window.innerHeight;
    this.renderer.resize(w, h2);
  };

  // ---------------------------------------------------------------- loop

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const w = this.world;
    this.paused = !!this.panel;
    // A freeze frame holds the action (not the screen) for a beat after a heavy hit.
    const frozen = this.freeze > 0;
    if (frozen) this.freeze -= dt;
    else this.freezeGap -= dt;
    if (!this.paused && !frozen) {
      this.updateHeld();
      this.acc += dt;
      while (this.acc >= 1 / 60) {
        w.step(1 / 60);
        this.acc -= 1 / 60;
      }
    } else this.acc = 0;
    this.drainEvents();
    this.updateMusic();
    this.renderer.render(w, this.paused ? 0 : frozen ? dt * 0.1 : dt);
    this.updateHud();
    this.saveT += dt;
    if (this.saveT > 15) {
      this.saveT = 0;
      this.save();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Feed the score how hard the fight is and how close to death the player is. */
  private updateMusic() {
    const m = this.audio.music;
    if (!m) return;
    const w = this.world;
    const p = w.player;
    let threat = 0;
    for (const mo of w.area.monsters) {
      if (mo.dead || !mo.alert || Math.abs(mo.x - p.x) > 12 || Math.abs(mo.y - p.y) > 12) continue;
      threat += mo.rarity === 'boss' ? 6 : mo.rarity === 'unique' || mo.rarity === 'champion' ? 2 : 1;
    }
    m.setIntensity(w.inTown ? 0 : threat / 8);
    m.life = p.dead ? 1 : p.life / Math.max(1, w.stats.maxLife);
  }

  private updateHeld() {
    const w = this.world;
    const p = w.player;
    if (this.held && !p.action && !p.intent) {
      const s = w.char.hotbar[this.held.slot];
      if (s) w.cmdAutoSkill(s);
    }
    // Desktop: holding a mouse button keeps acting toward the cursor.
    this.mouse.repeat -= 1 / 60;
    if ((this.mouse.left || this.mouse.right) && this.mouse.repeat <= 0 && !p.action) {
      this.mouse.repeat = 0.15;
      this.mouseAction(this.mouse.right ? 'right' : 'left', true);
    }
    if (this.drag && this.drag.moved) {
      // Hold-and-drag on the right side walks toward the finger.
      const ps = this.renderer.cam.toScreen(p.x, p.y);
      const d = this.screenDirToWorld(this.drag.x - ps.x, this.drag.y - (ps.y - 20));
      w.cmdMoveDir(d);
    }
  }

  private drainEvents() {
    const w = this.world;
    for (const e of w.events) {
      switch (e.type) {
        case 'sound':
          this.audio.play(e.id);
          break;
        case 'msg':
          this.toast(e.text, e.color);
          break;
        case 'open':
          this.open(e.panel);
          break;
        case 'death':
          this.showDeath();
          break;
        case 'victory':
          this.showVictory();
          break;
        case 'area':
          this.banner(AREA_BY_ID[e.id].name);
          this.audio.ambience(e.id);
          this.renderer.cam.snap(w.player.x, w.player.y);
          this.save();
          break;
        case 'levelup':
          this.flashButton('char');
          this.flashButton('skills');
          break;
        case 'shake':
          if (this.settings.screenFx) this.renderer.cam.shake = Math.max(this.renderer.cam.shake, e.amount);
          break;
        case 'hitstop':
          // Small freezes need a gap between them, or rapid crits would stutter; big ones always land.
          if (this.settings.screenFx && (e.t >= 0.2 || this.freezeGap <= 0)) {
            this.freeze = Math.min(0.4, Math.max(this.freeze, e.t));
            this.freezeGap = 0.4;
          }
          break;
        case 'flash':
          this.renderer.flash(e.color, e.a);
          break;
        case 'quest':
          this.save();
          break;
      }
    }
    w.events.length = 0;
    if (!this.settings.numbers) w.area.fx = w.area.fx.filter((f) => f.kind !== 'text' || /[A-Za-z]/.test(f.text ?? ''));
  }

  // ---------------------------------------------------------------- HUD

  private buildHud() {
    const btn = (id: string, label: string, title: string, fn: () => void) =>
      h('button', { class: `hbtn hb-${id}`, title, 'aria-label': title, 'data-id': id, onpointerdown: (e: Event) => e.stopPropagation(), onclick: (e: Event) => { e.stopPropagation(); this.audio.unlock(); fn(); } }, label);
    const orb = (cls: string) => h('div', { class: `orb ${cls}` }, h('div', { class: 'orb-fill' }), h('div', { class: 'orb-shine' }), h('div', { class: 'orb-txt' }));
    const belt = h('div', { class: 'belt' });
    for (let i = 0; i < 4; i++)
      belt.append(h('button', { class: 'bslot', 'data-col': i, title: `Potion (${i + 1})`, onpointerdown: (e: Event) => e.stopPropagation(), onclick: (e: Event) => { e.stopPropagation(); this.world.usePotion(i); } }, h('img', { alt: '' }), h('span', { class: 'cnt' }), h('span', { class: 'key' }, String(i + 1))));
    const skills = h('div', { class: 'skillbar' });
    for (let i = 0; i < 4; i++) {
      const b = h('button', { class: `sbtn s${i}`, 'data-slot': i, 'aria-label': `Skill ${i + 1}` }, h('img', { alt: '' }), h('span', { class: 'key' }, 'QWER'[i]));
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.audio.unlock();
        const s = this.world.char.hotbar[i];
        if (!s) return this.open('skills');
        this.held = { slot: i, t: 0 };
        this.world.cmdAutoSkill(s);
        b.classList.add('down');
      });
      const up = () => {
        if (this.held?.slot === i) this.held = null;
        b.classList.remove('down');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.open('skills');
      });
      skills.append(b);
    }
    const ctxBtn = h('button', { class: 'ctxbtn hidden', onpointerdown: (e: Event) => e.stopPropagation(), onclick: (e: Event) => { e.stopPropagation(); this.useContext(); } });
    const target = h('div', { class: 'target hidden' }, h('div', { class: 'tname' }), h('div', { class: 'tbar' }, h('div', { class: 'tfill' })), h('div', { class: 'tmods' }));
    const msgs = h('div', { class: 'msgs' });
    const xp = h('div', { class: 'xpbar' }, h('div', { class: 'xpfill' }));
    const hud = h(
      'div',
      { class: `hud ${isTouch() ? 'touch' : 'mouse'}` },
      target,
      msgs,
      h('div', { class: 'topbtns' }, btn('map', '◈', 'Automap (Tab)', () => this.toggleMap()), btn('menu', '≡', 'Menu (Esc)', () => this.open('menu'))),
      h('div', { class: 'area-name' }),
      h('div', { class: 'joy hidden' }, h('div', { class: 'joy-knob' })),
      h(
        'div',
        { class: 'bottom' },
        orb('life'),
        h(
          'div',
          { class: 'mid' },
          xp,
          h('div', { class: 'midrow' }, belt, h('div', { class: 'menubtns' }, btn('char', '☗', 'Character (C)', () => this.toggle('character')), btn('inv', '▣', 'Inventory (I)', () => this.toggle('inventory')), btn('skills', '✦', 'Skills (K)', () => this.toggle('skills')), btn('tp', '◎', 'Town Portal (T)', () => this.world.castTownPortal()))),
        ),
        orb('mana'),
      ),
      skills,
      ctxBtn,
    );
    this.panelEl = h('div', {
      class: 'panel-wrap hidden',
      onpointerdown: (e: Event) => e.stopPropagation(),
      onclick: (e: Event) => { if (e.target === this.panelEl) this.close(); },
      onpointermove: (e: PointerEvent) => { this.pointer = { x: e.clientX, y: e.clientY }; },
      // Right-click an item for its main action (equip, drink, buy, sell, move to/from the stash).
      oncontextmenu: (e: MouseEvent) => {
        const sel = this.itemAt(e.clientX, e.clientY);
        if (!sel) return;
        e.preventDefault();
        this.runItemAction(sel, (a) => !!a.primary);
      },
    });
    this.overlayEl = h('div', { class: 'overlay hidden' });
    this.root.append(hud, this.panelEl, this.overlayEl);
    const q = (s: string) => hud.querySelector(s) as HTMLElement;
    this.hud = {
      root: hud, target, tname: q('.tname'), tfill: q('.tfill'), tmods: q('.tmods'), msgs, xp: q('.xpfill'),
      life: q('.orb.life'), mana: q('.orb.mana'), belt, skills, ctx: ctxBtn, area: q('.area-name'), joy: q('.joy'), knob: q('.joy-knob'),
      tp: q('.hb-tp'), skillsBtn: q('.hb-skills'), charBtn: q('.hb-char'),
    };
  }

  private setText(key: string, el: HTMLElement, text: string) {
    if (this.hudCache[key] === text) return;
    this.hudCache[key] = text;
    el.textContent = text;
  }

  private updateHud() {
    const w = this.world;
    const p = w.player;
    const s = w.stats;
    const c = w.char;
    const H = this.hud;
    const orb = (el: HTMLElement, v: number, max: number, key: string) => {
      const pct = Math.max(0, Math.min(1, v / Math.max(1, max)));
      const k = `${key}${Math.round(pct * 200)}`;
      if (this.hudCache[key + 'f'] !== k) {
        this.hudCache[key + 'f'] = k;
        (el.querySelector('.orb-fill') as HTMLElement).style.transform = `translateY(${(1 - pct) * 100}%)`;
      }
      this.setText(key, el.querySelector('.orb-txt') as HTMLElement, `${Math.max(0, Math.ceil(v))}/${max}`);
    };
    orb(H.life, p.life, s.maxLife, 'life');
    orb(H.mana, p.mana, s.maxMana, 'mana');
    H.life.classList.toggle('poison', p.poison.t > 0);
    const xpk = `${Math.round(w.xpProgress * 400)}`;
    if (this.hudCache.xp !== xpk) {
      this.hudCache.xp = xpk;
      H.xp.style.width = `${w.xpProgress * 100}%`;
    }
    // Belt
    const rows = s.beltRows;
    const beltKey = c.belt.map((col) => col.join(',')).join('|') + rows;
    if (this.hudCache.belt !== beltKey) {
      this.hudCache.belt = beltKey;
      H.belt.querySelectorAll<HTMLElement>('.bslot').forEach((el, i) => {
        const col = c.belt[i];
        const img = el.querySelector('img') as HTMLImageElement;
        if (col.length) {
          img.src = baseIconUrl(col[0]);
          img.style.visibility = 'visible';
        } else img.style.visibility = 'hidden';
        (el.querySelector('.cnt') as HTMLElement).textContent = col.length > 1 ? String(col.length) : '';
      });
    }
    // Skills
    const sk = c.hotbar.join(',') + (w.inTown ? 't' : '');
    if (this.hudCache.sk !== sk) {
      this.hudCache.sk = sk;
      H.skills.querySelectorAll<HTMLElement>('.sbtn').forEach((el, i) => {
        const id = c.hotbar[i];
        const img = el.querySelector('img') as HTMLImageElement;
        if (id) {
          img.src = skillIconUrl(id);
          img.style.visibility = 'visible';
          el.title = SKILL_BY_ID[id].name;
        } else {
          img.style.visibility = 'hidden';
          el.title = 'Assign a skill';
        }
        el.classList.toggle('empty', !id);
      });
      H.skills.classList.toggle('town', w.inTown);
    }
    const manaKey = c.hotbar.map((id) => (id && SKILL_BY_ID[id].mana(Math.max(1, c.skills[id] ?? 1)) > p.mana ? 1 : 0)).join('');
    if (this.hudCache.mk !== manaKey) {
      this.hudCache.mk = manaKey;
      H.skills.querySelectorAll<HTMLElement>('.sbtn').forEach((el, i) => el.classList.toggle('nomana', manaKey[i] === '1'));
    }
    this.setText('tp', H.tp, `◎${c.tpCharges}`);
    H.skillsBtn.classList.toggle('badge', c.skillPoints > 0);
    H.charBtn.classList.toggle('badge', c.statPoints > 0);
    // Target bar
    const m = w.focusMonster() ?? (this.renderer.hoverId >= 0 ? w.area.monsters.find((x) => x.id === this.renderer.hoverId && !x.dead) ?? null : null);
    if (m) {
      H.target.classList.remove('hidden');
      const col = m.rarity === 'champion' ? '#7f9cff' : m.rarity === 'unique' || m.rarity === 'boss' ? '#d8b878' : '#e8e2d0';
      this.setText('tn', H.tname, m.name);
      H.tname.style.color = col;
      H.tfill.style.width = `${Math.max(0, (m.life / m.maxLife) * 100)}%`;
      const mods = [...m.mods.map((x) => MOD_LABEL[x])];
      if (m.def.undead) mods.unshift('Undead');
      for (const [k, n] of [['fire', 'Fire'], ['cold', 'Cold'], ['light', 'Lightning'], ['poison', 'Poison'], ['phys', 'Physical']] as const) if (m.res[k] >= 100) mods.push(`Immune to ${n}`);
      this.setText('tm', H.tmods, mods.join(' · '));
    } else H.target.classList.add('hidden');
    this.setText('area', H.area, `${AREA_BY_ID[w.area.def.id].name}`);
    // Context button: nearest interactable.
    const near = w.interactablesNear(p.x, p.y, 2.6)[0];
    if (near && !p.dead) {
      const label = w.interactLabel(near.target);
      this.setText('ctx', H.ctx, label);
      H.ctx.classList.remove('hidden');
      (H.ctx as unknown as { _t: Interactable })._t = near.target;
    } else H.ctx.classList.add('hidden');
  }

  private useContext() {
    const t = (this.hud.ctx as unknown as { _t?: Interactable })._t;
    if (t) this.world.cmdInteract(t);
  }

  toast(text: string, color = '#e8e2d0') {
    const el = h('div', { class: 'msg', style: { color } }, text);
    this.hud.msgs.append(el);
    while (this.hud.msgs.children.length > 5) this.hud.msgs.firstElementChild!.remove();
    setTimeout(() => el.classList.add('fade'), 3200);
    setTimeout(() => el.remove(), 4200);
  }

  private banner(text: string) {
    this.root.querySelectorAll('.banner').forEach((b) => b.remove());
    const el = h('div', { class: 'banner' }, text);
    this.root.append(el);
    setTimeout(() => el.classList.add('fade'), 1800);
    setTimeout(() => el.remove(), 3000);
  }

  private flashButton(id: 'char' | 'skills') {
    const el = id === 'char' ? this.hud.charBtn : this.hud.skillsBtn;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  // ---------------------------------------------------------------- panels

  open(p: PanelKind) {
    this.audio.unlock();
    if (this.panel !== p) this.sel = null;
    this.panel = p;
    this.world.cmdMoveDir(null);
    this.world.stop();
    this.held = null;
    this.refresh();
  }

  toggle(p: PanelKind) {
    if (this.panel === p) this.close();
    else this.open(p);
  }

  close() {
    this.panel = null;
    this.sel = null;
    this.panelEl.classList.add('hidden');
    this.panelEl.innerHTML = '';
    this.save();
  }

  refresh() {
    if (!this.panel) return;
    const scroll = this.panelEl.querySelector('.p-body')?.scrollTop ?? 0;
    this.panelEl.innerHTML = '';
    this.panelEl.append(renderPanel(this, this.panel));
    this.panelEl.classList.remove('hidden');
    const body = this.panelEl.querySelector('.p-body');
    if (body) body.scrollTop = scroll;
  }

  select(s: Selection | null) {
    this.sel = s;
    this.refresh();
    // On small screens the detail sits below the grids: bring the stat changes and buttons into view.
    if (s) this.panelEl.querySelector('.detail .acts')?.scrollIntoView({ block: 'nearest' });
  }

  toggleSetting(k: 'sound' | 'music' | 'weather' | 'screenFx' | 'labels' | 'numbers') {
    this.settings[k] = !this.settings[k];
    if (k === 'sound') this.audio.setEnabled(this.settings.sound);
    if (k === 'music') this.audio.setMusic(this.settings.music);
    if (k === 'weather') this.renderer.showWeather = this.settings.weather;
    if (k === 'screenFx') this.renderer.screenFx = this.settings.screenFx;
    if (k === 'labels') this.renderer.showLabels = this.settings.labels;
    saveSettings(this.settings);
  }

  private toggleMap() {
    const r = this.renderer;
    r.automap = r.automap === 'mini' ? 'full' : r.automap === 'full' ? 'off' : 'mini';
    this.settings.automap = r.automap;
    saveSettings(this.settings);
  }

  quitToMenu() {
    this.save();
    this.destroy();
    this.onExit();
  }

  private showDeath() {
    const c = this.world.char;
    this.save();
    this.overlayEl.innerHTML = '';
    this.overlayEl.classList.remove('hidden');
    const hc = c.hardcore;
    this.overlayEl.append(
      h(
        'div',
        { class: 'ov-box death' },
        h('div', { class: 'ov-title' }, 'You have died'),
        h('div', { class: 'ov-sub' }, hc ? `${c.name} has fallen forever. Hardcore heroes do not return.` : 'You will awaken in Emberwatch Camp. Some of your gold has been lost.'),
        h('button', {
          class: 'btn primary', onclick: () => {
            this.overlayEl.classList.add('hidden');
            if (hc) this.quitToMenu();
            else {
              this.world.respawn();
              this.save();
            }
          },
        }, hc ? 'Return to Menu' : 'Respawn in Town'),
      ),
    );
  }

  private showVictory() {
    this.save();
    this.overlayEl.innerHTML = '';
    this.overlayEl.classList.remove('hidden');
    const next = ['Nightmare', 'Hell', null][this.world.char.difficulty];
    this.overlayEl.append(
      h(
        'div',
        { class: 'ov-box victory' },
        h('div', { class: 'ov-title' }, 'The Hellforge Grows Cold'),
        h('div', { class: 'ov-sub' }, `Vhorza, Mother of Cinders, is slain. ${next ? `${next} difficulty is now unlocked from the character screen.` : 'You have conquered every difficulty. Legends will be sung of you.'}`),
        h('button', { class: 'btn primary', onclick: () => this.overlayEl.classList.add('hidden') }, 'Continue'),
      ),
    );
  }

  // ---------------------------------------------------------------- input

  private screenDirToWorld(dx: number, dy: number) {
    const cam = this.renderer.cam;
    const a = cam.toWorld(cam.w / 2, cam.h / 2);
    const b = cam.toWorld(cam.w / 2 + dx, cam.h / 2 + dy);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) return { x: 0, y: 0 };
    const mag = Math.min(1, Math.hypot(dx, dy) / 50);
    return { x: ((b.x - a.x) / len) * mag, y: ((b.y - a.y) / len) * mag };
  }

  private bindInput() {
    const cv = this.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      if (this.panel) return;
      if (e.pointerType === 'mouse') {
        this.mouse.x = e.offsetX;
        this.mouse.y = e.offsetY;
        this.mouse.shift = e.shiftKey;
        if (e.button === 0) this.mouse.left = true;
        if (e.button === 2) this.mouse.right = true;
        this.mouse.repeat = 0.25;
        this.mouseAction(e.button === 2 ? 'right' : 'left', false);
        return;
      }
      cv.setPointerCapture(e.pointerId);
      const leftZone = e.clientX < this.renderer.cam.w * TOUCH_JOY_ZONE && e.clientY > this.renderer.cam.h * 0.25;
      if (leftZone && !this.joy) {
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        this.hud.joy.classList.remove('hidden');
        this.hud.joy.style.left = `${e.clientX}px`;
        this.hud.joy.style.top = `${e.clientY}px`;
        this.hud.knob.style.transform = 'translate(-50%, -50%)';
        return;
      }
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.mouse.x = e.offsetX;
        this.mouse.y = e.offsetY;
        const wp = this.renderer.cam.toWorld(e.offsetX, e.offsetY + 18 * this.renderer.cam.zoom);
        const pick = this.world.pickAt(wp.x, wp.y);
        this.renderer.hoverId = pick.monster?.id ?? -1;
        cv.style.cursor = pick.monster ? 'crosshair' : pick.target || this.labelAt(e.offsetX, e.offsetY) !== null ? 'pointer' : 'default';
        return;
      }
      if (this.joy && e.pointerId === this.joy.id) {
        this.joy.x = e.clientX;
        this.joy.y = e.clientY;
        let dx = e.clientX - this.joy.ox;
        let dy = e.clientY - this.joy.oy;
        const len = Math.hypot(dx, dy);
        const max = 50;
        if (len > max) {
          // The stick follows the finger so you never run out of throw.
          this.joy.ox += (dx / len) * (len - max);
          this.joy.oy += (dy / len) * (len - max);
          this.hud.joy.style.left = `${this.joy.ox}px`;
          this.hud.joy.style.top = `${this.joy.oy}px`;
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        this.hud.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.world.cmdMoveDir(this.screenDirToWorld(dx, dy));
        return;
      }
      if (this.drag && e.pointerId === this.drag.id) {
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        if (performance.now() - this.drag.t > 220 || Math.hypot(e.movementX, e.movementY) > 6) this.drag.moved = true;
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouse.left = false;
        if (e.button === 2) this.mouse.right = false;
        return;
      }
      if (this.joy && e.pointerId === this.joy.id) {
        this.joy = null;
        this.hud.joy.classList.add('hidden');
        this.world.cmdMoveDir(null);
        return;
      }
      if (this.drag && e.pointerId === this.drag.id) {
        const d = this.drag;
        this.drag = null;
        if (d.moved && performance.now() - d.t > 220) this.world.cmdMoveDir(null);
        else this.tapAt(d.x, d.y);
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const cam = this.renderer.cam;
      cam.zoom = Math.max(0.6, Math.min(2, cam.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    }, { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.mouse.left = this.mouse.right = false;
      this.world.cmdMoveDir(null);
    });
  }

  private labelAt(x: number, y: number): number | null {
    for (const r of this.renderer.labels) if (x >= r.x && x <= r.x + r.w && y >= r.y - 3 && y <= r.y + r.h + 3) return r.groundId;
    return null;
  }

  private tapAt(x: number, y: number) {
    const w = this.world;
    const label = this.labelAt(x, y);
    if (label !== null) return w.cmdInteract({ kind: 'item', id: label });
    const wp = this.renderer.cam.toWorld(x, y + 18 * this.renderer.cam.zoom);
    const pick = w.pickAt(wp.x, wp.y);
    if (pick.monster) {
      const s = w.char.hotbar[0] ?? 'attack';
      return w.cmdSkill(s, pick.monster.x, pick.monster.y, pick.monster.id);
    }
    if (pick.target) return w.cmdInteract(pick.target);
    const g = this.renderer.cam.toWorld(x, y);
    w.cmdMoveTo(g.x, g.y);
  }

  private mouseAction(button: 'left' | 'right', repeat: boolean) {
    const w = this.world;
    const { x, y } = this.mouse;
    const cam = this.renderer.cam;
    const g = cam.toWorld(x, y);
    const wp = cam.toWorld(x, y + 18 * cam.zoom);
    const pick = w.pickAt(wp.x, wp.y);
    const slot = button === 'right' ? 1 : 0;
    const skill = w.char.hotbar[slot] ?? 'attack';
    if (button === 'right') {
      if (w.inTown) return;
      return w.cmdSkill(skill, pick.monster?.x ?? g.x, pick.monster?.y ?? g.y, pick.monster?.id);
    }
    if (!repeat) {
      const label = this.labelAt(x, y);
      if (label !== null) return w.cmdInteract({ kind: 'item', id: label });
    }
    if (pick.monster) return w.cmdSkill(skill, pick.monster.x, pick.monster.y, pick.monster.id);
    if (this.mouse.shift && !w.inTown) return w.cmdSkill(skill, g.x, g.y);
    if (pick.target && !repeat) return w.cmdInteract(pick.target);
    if (repeat && w.player.intent?.kind === 'interact') return;
    w.cmdMoveTo(g.x, g.y);
  }

  private freeze = 0;
  private freezeGap = 0;
  private keysDown = new Set<string>();
  private pointer = { x: -1, y: -1 };

  /** The item tile or vendor row under a screen point, if any. */
  private itemAt(x: number, y: number): Selection | null {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-uid]');
    if (!el || !this.panelEl.contains(el)) return null;
    return { uid: Number(el.dataset.uid), from: el.dataset.from as Selection['from'], slot: (el.dataset.slot || undefined) as Selection['slot'] };
  }

  /** Runs the first action of an item that matches; returns whether one ran. */
  private runItemAction(sel: Selection, match: (a: ReturnType<typeof itemActions>[number]) => boolean): boolean {
    const ctx = panelItemContext(this.panel);
    if (!ctx) return false;
    const a = itemActions(this, sel, ctx).find(match);
    if (!a) return false;
    a.run();
    this.refresh();
    return true;
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
    if (/^Key[QWER]$/.test(e.code) && this.held && this.held.slot === 'QWER'.indexOf(e.code[3])) this.held = null;
  };

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const w = this.world;
    const code = e.code;
    const repeat = this.keysDown.has(code);
    this.keysDown.add(code);
    if (code === 'Escape') {
      if (this.panel) this.close();
      else this.open('menu');
      return;
    }
    if (code === 'Tab') {
      e.preventDefault();
      this.toggleMap();
      return;
    }
    if (repeat && !/^Key[QWER]$/.test(code)) return;
    // Item shortcuts: act on the hovered item, or the selected one.
    if (this.panel && /^Key[A-Z]$/.test(code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = this.itemAt(this.pointer.x, this.pointer.y) ?? this.sel;
      if (sel && this.runItemAction(sel, (a) => a.key === code[3])) return;
    }
    switch (code) {
      case 'KeyI':
      case 'KeyB':
        return this.toggle('inventory');
      case 'KeyC':
        return this.toggle('character');
      case 'KeyK':
      case 'KeyS':
        return this.toggle('skills');
      case 'KeyM':
        return this.toggleMap();
      case 'Space':
        if (this.panel) this.close();
        return;
      case 'KeyT':
        if (!this.panel) w.castTownPortal();
        return;
      case 'KeyZ':
      case 'AltLeft':
        e.preventDefault();
        return this.toggleSetting('labels');
      case 'KeyF':
        return this.useContext();
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
        w.usePotion(Number(code[5]) - 1);
        return;
    }
    if (/^Key[QWER]$/.test(code) && !this.panel) {
      const slot = 'QWER'.indexOf(code[3]);
      const s = w.char.hotbar[slot];
      if (!s || w.inTown || w.player.action) return;
      const cam = this.renderer.cam;
      const g = cam.toWorld(this.mouse.x, this.mouse.y);
      const wp = cam.toWorld(this.mouse.x, this.mouse.y + 18 * cam.zoom);
      const pick = w.pickAt(wp.x, wp.y);
      w.cmdSkill(s, pick.monster?.x ?? g.x, pick.monster?.y ?? g.y, pick.monster?.id);
    }
  };
}
