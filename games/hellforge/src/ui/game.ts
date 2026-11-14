import { AREA_BY_ID } from '../game/areas';
import { POTION_POOLS, potionCount, potionSummary, potionTiers, type Character } from '../game/character';
import { MOD_LABEL } from '../game/monsters';
import { SKILL_BY_ID } from '../game/skills';
import { STORIES, type StoryBeat } from '../game/story';
import { DODGE_COOLDOWN, HEAT_MAX, HEAT_SLAG, HEAT_VENT, SPREE_TIERS, SPREE_WINDOW, World, type Interactable } from '../game/world';
import { baseIconUrl, skillIconUrl } from '../render/icons';
import { Renderer } from '../render/renderer';
import { Audio } from './audio';
import { h, isTouch } from './dom';
import { forgeKey, resetForgeUi } from './forge';
import { itemActions, panelItemContext, renderPanel, resetRespecUi, resetStashUi, type PanelHost, type PanelKind, type Selection } from './panels';
import { loadSettings, loadShared, saveCharacter, saveSettings, saveShared, type Settings } from './save';

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
  private lastRaf = 0;
  /** Smoothed time between animation frames, in milliseconds: the display's refresh interval. */
  private rafMs = 1000 / 60;
  private skipFrame = false;
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
  private storyOpen = false;
  private onExit: () => void;

  constructor(root: HTMLElement, char: Character, onExit: () => void, seed?: number) {
    this.root = root;
    this.onExit = onExit;
    this.world = new World(char, seed, loadShared(char.hardcore));
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
    this.last = this.lastRaf = performance.now();
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
    saveShared(this.world.char.hardcore, this.world.shared);
  }

  private resize = () => {
    const w = this.root.clientWidth || window.innerWidth;
    const h2 = this.root.clientHeight || window.innerHeight;
    this.renderer.resize(w, h2);
  };

  // ---------------------------------------------------------------- loop

  private frame = (now: number) => {
    if (!this.running) return;
    // The world moves 60 times a second, so a 120 Hz screen would draw every moment twice, and drawing is
    // what costs. On displays faster than about 100 Hz, draw every other frame.
    this.rafMs += (Math.min(50, now - this.lastRaf) - this.rafMs) * 0.1;
    this.lastRaf = now;
    this.skipFrame = this.rafMs < 10 && !this.skipFrame;
    if (this.skipFrame) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const w = this.world;
    this.paused = !!this.panel || this.storyOpen;
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
        case 'story':
          this.showStory(STORIES[e.id]);
          break;
        case 'area':
          this.banner(w.area.def.name);
          this.audio.ambience(e.id, w.area.def);
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
        case 'announce':
          this.announce(e.text, e.sub, e.color);
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
    POTION_POOLS.forEach((pool, i) => {
      // Touch has no hover, so a long press shows what the title shows on desktop.
      let timer = 0;
      let longPressed = false;
      const release = () => clearTimeout(timer);
      belt.append(h('button', {
        class: 'bslot', 'data-col': i,
        onpointerdown: (e: Event) => {
          e.stopPropagation();
          longPressed = false;
          timer = window.setTimeout(() => { longPressed = true; this.toast(potionSummary(this.world.char, pool)); }, 450);
        },
        onpointerup: release,
        onpointerleave: release,
        onpointercancel: release,
        oncontextmenu: (e: Event) => e.preventDefault(),
        onclick: (e: Event) => { e.stopPropagation(); if (!longPressed) this.world.usePotion(pool); },
      }, h('img', { alt: '' }), h('span', { class: 'cnt' }), h('span', { class: 'key' }, String(i + 1))));
    });
    const skills = h('div', { class: 'skillbar' });
    for (let i = 0; i < 4; i++) {
      const b = h('button', { class: `sbtn s${i}`, 'data-slot': i, 'aria-label': `Skill ${i + 1}` }, h('img', { alt: '' }), h('span', { class: 'key' }, 'QWER'[i]), h('span', { class: 'sbadge' }));
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
      // A long press on a phone arrives as a context menu. Holding a skill button means "keep casting", nothing else.
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      skills.append(b);
    }
    const dodge = h('button', { class: 'dbtn', title: 'Dodge (Space)', 'aria-label': 'Dodge' }, h('span', { class: 'dglyph' }, '➠'), h('span', { class: 'key' }, 'Space'));
    dodge.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.audio.unlock();
      this.dodge();
    });
    dodge.addEventListener('contextmenu', (e) => e.preventDefault());
    const spree = h('div', { class: 'spree hidden' }, h('div', { class: 'spree-n' }), h('div', { class: 'spree-t' }), h('div', { class: 'spree-bar' }, h('div', { class: 'spree-fill' })));
    const buffs = h('div', { class: 'buffs' });
    const ember = h('div', { class: 'ember hidden', title: "Vhorza's ember" }, h('span', { class: 'ember-icon' }), h('div', { class: 'ember-bar' }, h('div', { class: 'ember-fill' }), h('div', { class: 'frost-fill' })), h('span', { class: 'ember-t' }));
    // The Forgewright's Heat gauge: a wide bar over the middle of the bottom row, with marks where Slag Burst unlocks and where it leaves fire.
    const heat = h('div', { class: 'heat hidden', role: 'meter', 'aria-label': 'Heat', 'aria-valuemin': 0, 'aria-valuemax': HEAT_MAX },
      h('div', { class: 'heat-fill' }),
      h('div', { class: 'heat-mark', style: { left: `${HEAT_VENT}%` } }),
      h('div', { class: 'heat-mark slag', style: { left: `${HEAT_SLAG}%` } }),
      h('div', { class: 'heat-txt' }));
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
          heat,
          xp,
          h('div', { class: 'midrow' }, belt, h('div', { class: 'menubtns' }, btn('char', '☗', 'Character (C)', () => this.toggle('character')), btn('inv', '▣', 'Inventory (I)', () => this.toggle('inventory')), btn('skills', '✦', 'Skills (K)', () => this.toggle('skills')), btn('tp', '◎', 'Town Portal (T)', () => this.world.castTownPortal()))),
        ),
        orb('mana'),
      ),
      skills,
      dodge,
      spree,
      buffs,
      ember,
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
      dodge, spree, spreeN: q('.spree-n'), spreeT: q('.spree-t'), spreeFill: q('.spree-fill'), buffs,
      ember, emberFill: q('.ember-fill'), frostFill: q('.frost-fill'), emberT: q('.ember-t'),
      heat, heatFill: q('.heat-fill'), heatTxt: q('.heat-txt'),
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
    // Potions
    const nextPotions = POTION_POOLS.map((pool) => w.nextPotion(pool));
    const beltKey = `${nextPotions.join()}|${JSON.stringify(c.potions)}|${s.potionCap}`;
    if (this.hudCache.belt !== beltKey) {
      this.hudCache.belt = beltKey;
      H.belt.querySelectorAll<HTMLElement>('.bslot').forEach((el, i) => {
        const pool = POTION_POOLS[i];
        (el.querySelector('img') as HTMLImageElement).src = baseIconUrl(nextPotions[i] ?? potionTiers(pool)[0].id);
        el.classList.toggle('empty', !nextPotions[i]);
        (el.querySelector('.cnt') as HTMLElement).textContent = nextPotions[i] ? `×${potionCount(c, pool)}` : '';
        el.title = `${potionSummary(c, pool)} (${i + 1})`;
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
    // Greyed out: not enough mana, or (for Slag Burst) not enough Heat.
    const manaKey = c.hotbar.map((id) => (id && (SKILL_BY_ID[id].mana(Math.max(1, c.skills[id] ?? 1)) > p.mana || (SKILL_BY_ID[id].kind === 'vent' && p.heat < HEAT_VENT)) ? 1 : 0)).join('');
    if (this.hudCache.mk !== manaKey) {
      this.hudCache.mk = manaKey;
      H.skills.querySelectorAll<HTMLElement>('.sbtn').forEach((el, i) => el.classList.toggle('nomana', manaKey[i] === '1'));
    }
    const skels = w.skeletonCount();
    const built = c.hotbar.map((id) => (id ? w.constructCount(id) : null));
    const skelKey = `${c.hotbar.join(',')}:${skels?.alive}/${skels?.max}:${built.map((b) => (b ? `${b.alive}/${b.max}` : '')).join()}`;
    if (this.hudCache.skel !== skelKey) {
      this.hudCache.skel = skelKey;
      H.skills.querySelectorAll<HTMLElement>('.sbtn').forEach((el, i) => {
        const badge = el.querySelector('.sbadge') as HTMLElement;
        // Servants standing against the cap: skeletons, or what a construct skill has built (once something is up).
        const n = c.hotbar[i] === 'raise_skeleton' ? skels : built[i]?.alive ? built[i] : null;
        badge.textContent = n ? `${n.alive}/${n.max}` : '';
        badge.classList.toggle('full', !!n && n.alive >= n.max);
      });
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
      if (m.def.rises && !m.rose) mods.push('Rises Again');
      if (m.def.support) mods.push('Wards Allies');
      for (const [k, n] of [['fire', 'Fire'], ['cold', 'Cold'], ['light', 'Lightning'], ['poison', 'Poison'], ['phys', 'Physical']] as const) if (m.res[k] >= 100) mods.push(`Immune to ${n}`);
      this.setText('tm', H.tmods, mods.join(' · '));
    } else H.target.classList.add('hidden');
    // Dodge cooldown sweeps round the button.
    const cd = Math.max(0, Math.ceil((w.dodgeCd / DODGE_COOLDOWN) * 20));
    if (this.hudCache.cd !== String(cd)) {
      this.hudCache.cd = String(cd);
      H.dodge.style.setProperty('--cd', `${cd * 5}%`);
      H.dodge.classList.toggle('cooling', cd > 0);
    }
    // Spree meter: appears a couple of kills in, so a run can be seen building.
    const sk2 = w.streak;
    const showSpree = sk2.n >= 3 && !w.inTown;
    H.spree.classList.toggle('hidden', !showSpree);
    if (showSpree) {
      const tier = w.spreeTier();
      const next = SPREE_TIERS[sk2.tier + 1];
      this.setText('spn', H.spreeN, `×${sk2.n}`);
      this.setText('spt', H.spreeT, tier ? tier.title : `${next.n - sk2.n} more for a spree`);
      const col = tier?.color ?? '#c8b890';
      if (this.hudCache.spc !== col) {
        this.hudCache.spc = col;
        H.spree.style.setProperty('--spree', col);
        H.spree.classList.toggle('ranked', !!tier);
      }
      H.spreeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, sk2.t / SPREE_WINDOW))})`;
      if (this.hudCache.spk !== String(sk2.n)) {
        this.hudCache.spk = String(sk2.n);
        H.spreeN.classList.remove('pop');
        void H.spreeN.offsetWidth;
        H.spreeN.classList.add('pop');
      }
    }
    // Heat gauge.
    const forge = c.classId === 'forgewright';
    if (this.hudCache.forge !== String(forge)) {
      this.hudCache.forge = String(forge);
      H.heat.classList.toggle('hidden', !forge);
    }
    if (forge) {
      const hv = Math.round(p.heat);
      const state = p.buffs.white_heat ? 'white' : p.overheat ? 'over' : hv >= HEAT_SLAG ? 'hot' : hv >= HEAT_VENT ? 'warm' : 'cool';
      const hk = `${hv}${state}${state === 'white' ? Math.ceil(p.buffs.white_heat.t) : ''}`;
      if (this.hudCache.heat !== hk) {
        this.hudCache.heat = hk;
        H.heatFill.style.transform = `scaleX(${hv / HEAT_MAX})`;
        H.heat.dataset.state = state;
        H.heat.setAttribute('aria-valuenow', String(hv));
        H.heatTxt.textContent = state === 'over' ? `OVERHEATED ${hv}` : state === 'white' ? `WHITE HEAT ${Math.ceil(p.buffs.white_heat.t)}s` : `HEAT ${hv}`;
      }
    }
    // Shrine blessings and how long they have left.
    const names: Record<string, string> = { shrine_armor: 'Armor', shrine_combat: 'Combat', shrine_experience: 'Experience', shrine_storm: 'Storm', shrine_fortune: 'Fortune', shrine_haste: 'Fleet' };
    const chips = Object.entries(p.buffs).filter(([k]) => names[k]).map(([k, b]) => `${k}:${names[k]} ${Math.ceil(b.t)}s`);
    // The hired companion sits with the blessings: how hurt they are, or that they have fallen.
    const hired = c.hireling;
    if (hired) {
      const mi = w.hirelingMinion();
      chips.push(hired.dead || !mi ? `shrine_hiredown:${hired.name} ${hired.dead ? 'has fallen' : 'is waiting'}` : `shrine_hire:${hired.name} ${Math.ceil((mi.life / mi.maxLife) * 20) * 5}%`);
    }
    const bk = chips.join('|');
    if (this.hudCache.buffs !== bk) {
      this.hudCache.buffs = bk;
      H.buffs.replaceChildren(...chips.map((c) => h('span', { class: `buff b-${c.slice(7, c.indexOf(':'))}` }, c.slice(c.indexOf(':') + 1))));
    }
    // The ember: how much heat it has left, and the frostbite that follows once it is out.
    const showEmber = w.cold && !p.dead;
    if (this.hudCache.emberOn !== String(showEmber)) {
      this.hudCache.emberOn = String(showEmber);
      H.ember.classList.toggle('hidden', !showEmber);
      H.root.classList.toggle('has-ember', showEmber);
    }
    if (showEmber) {
      const state = w.frost >= 1 ? 'freezing' : w.ember <= 0 ? 'out' : w.nearFire ? 'warm' : w.ember < 0.3 ? 'low' : 'lit';
      const ek = `${Math.round(w.ember * 50)}:${Math.round(w.frost * 50)}:${state}`;
      if (this.hudCache.ember !== ek) {
        this.hudCache.ember = ek;
        H.emberFill.style.transform = `scaleX(${w.ember})`;
        H.frostFill.style.transform = `scaleX(${w.frost})`;
        H.ember.dataset.state = state;
        this.setText('embt', H.emberT, { freezing: 'Freezing!', out: 'Ember out: find a fire', warm: 'By the fire', low: 'Ember low', lit: '' }[state]);
      }
    }
    const strays = w.stragglers().length;
    const beacons = w.unlitBeacons().length;
    const stairs = w.depth ? (w.wardenAlive() ? ' · stairs sealed' : ' · stairs open') : '';
    this.setText('area', H.area, `${w.area.def.name}${stairs || (beacons ? ` · ${beacons} ${beacons === 1 ? 'beacon' : 'beacons'} dark` : strays ? ` · ${strays} left` : '')}`);
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

  /** A big line mid-screen for sprees, purges and ambushes. A new one replaces the last. */
  private announce(text: string, sub: string | undefined, color: string) {
    this.root.querySelectorAll('.announce, .banner').forEach((b) => b.remove());
    const el = h('div', { class: 'announce', style: { color } }, h('div', { class: 'an-t' }, text), sub ? h('div', { class: 'an-s' }, sub) : null);
    this.root.append(el);
    setTimeout(() => el.remove(), 2400);
  }

  /** Roll toward the cursor with a mouse; with a joystick, the way it is pushed. */
  private dodge(towardMouse = false) {
    const w = this.world;
    if (this.panel || this.storyOpen) return;
    let dir: { x: number; y: number } | null = null;
    if (towardMouse && !w.player.moveDir) {
      const g = this.renderer.cam.toWorld(this.mouse.x, this.mouse.y);
      dir = { x: g.x - w.player.x, y: g.y - w.player.y };
    }
    w.cmdDodge(dir);
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
    if (this.panel !== p) {
      this.sel = null;
      if (p === 'forge') resetForgeUi();
      if (p === 'stash') resetStashUi();
      resetRespecUi();
    }
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
        h('div', { class: 'ov-sub' }, hc ? `${c.name} has fallen forever. Hardcore heroes do not return.` : `You will awaken in ${AREA_BY_ID[this.world.homeTown].name}. Some of your gold has been lost.`),
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

  /** A story beat. The game holds still until it is dismissed. */
  private showStory(beat: StoryBeat) {
    this.save();
    this.storyOpen = true;
    this.overlayEl.innerHTML = '';
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.append(
      h(
        'div',
        { class: 'ov-box victory story' },
        h('div', { class: 'ov-title' }, beat.title),
        ...beat.lines.map((line) => h('div', { class: 'ov-sub' }, line)),
        h('button', { class: 'btn primary', onclick: () => { this.storyOpen = false; this.overlayEl.classList.add('hidden'); } }, 'Continue'),
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
        { class: 'ov-box victory story' },
        h('div', { class: 'ov-title' }, STORIES.rekindle.title),
        ...STORIES.rekindle.lines.map((line) => h('div', { class: 'ov-sub' }, line)),
        h('div', { class: 'ov-sub' }, `${next ? `${next} difficulty is now unlocked from the character screen.` : 'You have conquered every difficulty. Legends will be sung of you.'}`),
        h('div', { class: 'ov-sub' }, 'You have earned a respec. Spend it from the Character or Skills panel to take back every skill and attribute point and place them again.'),
        h('div', { class: 'ov-sub' }, 'And under the Heart, something has opened. The Underforge can be entered from any waypoint: an endless descent, a floor at a time.'),
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
    // The forge's sub-menus and its hammer-timing game take their keys first.
    if (this.panel === 'forge' && forgeKey(this, e)) return;
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
        e.preventDefault();
        if (this.panel) this.close();
        else this.dodge(true);
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
        w.usePotion(POTION_POOLS[Number(code[5]) - 1]);
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
