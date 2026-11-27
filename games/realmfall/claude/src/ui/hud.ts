/** The in-game HUD: unit frames, hotbar, combat log, minimap, floating combat text. */
import type { World } from '../game/world';
import { nm, cap, plural } from '../game/world';
import type { Entity, GameEvent, LogKind } from '../game/types';
import { ABILITIES, CLASSES, CON_HEX, conColor, xpToNext, MAX_LEVEL, realmRank, RANK_TITLES, REALM_RANKS } from '../game/data';
import { REALM_DEFS, WORLD_R, KEEPS } from '../game/geo';
import type { Renderer } from '../render/scene';
import { iconUrl } from './icons';
import { sfx } from './audio';
import { formatMoney } from '../game/items';
import { ownerColor } from '../render/structures';

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

interface Floater { el: HTMLElement; id: number; t: number; dx: number }
interface LogEntry { text: string; kind: LogKind; seq: number }

const LOG_COLORS: Record<LogKind, string> = {
  'hit-out': '#f3e6c4', 'hit-in': '#ff7b6b', miss: '#a9a091', spell: '#9fd0ff', heal: '#7dff9a', xp: '#e8c766', loot: '#d8c48f',
  system: '#e8e2d0', realm: '#ff9f4a', chat: '#7fd0ff', say: '#ffffff', error: '#ff9b8b', death: '#ff5a4a',
};

export class Hud {
  root: HTMLElement;
  private w: World;
  private r: Renderer;
  private floaters: Floater[] = [];
  private log: LogEntry[] = [];
  private logEl: HTMLElement;
  private logFilter: 'all' | 'combat' | 'chat' = 'all';
  private slots: HTMLElement[] = [];
  private lastSlow = 0;
  private minimap: HTMLCanvasElement;
  mapZoom = 1;
  onSlot: (i: number) => void = () => {};
  onButton: (name: string) => void = () => {};
  private bannerTimer = 0;

  constructor(parent: HTMLElement, w: World, r: Renderer) {
    this.w = w;
    this.r = r;
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="frame" id="pframe">
        <div class="fname"><span class="lvl"></span><span class="nm"></span></div>
        <div class="sub"></div>
        <div class="bar hp"><i></i><span></span></div>
        <div class="bar pw"><i></i><span></span></div>
        <div class="bar en"><i></i><span></span></div>
        <div class="buffs"></div>
      </div>
      <div class="frame" id="tframe">
        <div class="fname"><span class="lvl"></span><span class="nm"></span></div>
        <div class="sub"></div>
        <div class="bar hp"><i></i><span></span></div>
        <div class="buffs"></div>
      </div>
      <div id="castbar"><i></i><span></span></div>
      <div id="bottom">
        <div id="hotbar"></div>
        <div id="xp"><i></i><b></b><span></span></div>
      </div>
      <div id="log"><div class="tabs"><button data-f="all" class="on">All</button><button data-f="combat">Combat</button><button data-f="chat">Chat</button></div><div class="lines"></div></div>
      <div id="mm">
        <canvas width="200" height="200"></canvas>
        <div class="zone"></div>
        <div class="coords"></div>
        <div class="mmbtns">
          <button data-b="zoomin" title="Zoom in">+</button><button data-b="zoomout" title="Zoom out">−</button>
        </div>
      </div>
      <div id="menubar">
        <button data-b="char" title="Character (C)">Character</button>
        <button data-b="bag" title="Backpack (I)">Bag</button>
        <button data-b="abilities" title="Abilities (K)">Abilities</button>
        <button data-b="map" title="War map (M)">Map</button>
        <button data-b="help" title="Help (F1)">Help</button>
        <button data-b="menu" title="Menu (Esc)">Menu</button>
      </div>
      <div id="money"></div>
      <div id="prompt"></div>
      <div id="banner"></div>
      <div id="death"><h2>You have died.</h2><p></p><button>Release</button></div>
      <div id="floaters"></div>
      <div id="tip"></div>
      <div id="task"></div>
    `;
    parent.appendChild(root);
    this.root = root;
    this.logEl = $(root, '#log .lines');
    this.minimap = $<HTMLCanvasElement>(root, '#mm canvas');
    const hb = $(root, '#hotbar');
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = `<img alt=""><div class="cd"></div><b>${i < 10 ? (i + 1) % 10 : i === 10 ? 'G' : 'V'}</b><span class="n"></span>`;
      if (i === 10) s.classList.add('potion');
      if (i === 11) s.classList.add('potion');
      s.addEventListener('click', () => this.onSlot(i));
      s.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (i < 10 && w.char) w.char.hotbar[i] = null;
      });
      s.addEventListener('dragover', (e) => { if (i < 10) e.preventDefault(); });
      s.addEventListener('drop', (e) => {
        e.preventDefault();
        const ab = e.dataTransfer?.getData('text/ability');
        const from = e.dataTransfer?.getData('text/slot');
        const ch = w.char;
        if (!ch || i >= 10) return;
        if (from) {
          const f = +from;
          [ch.hotbar[f], ch.hotbar[i]] = [ch.hotbar[i], ch.hotbar[f]];
        } else if (ab) {
          const prev = ch.hotbar.indexOf(ab);
          if (prev >= 0) ch.hotbar[prev] = ch.hotbar[i];
          ch.hotbar[i] = ab;
        }
      });
      s.draggable = i < 10;
      s.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/slot', String(i)));
      s.addEventListener('mouseenter', () => this.slotTip(i, s));
      s.addEventListener('mouseleave', () => this.tip(null));
      hb.appendChild(s);
      this.slots.push(s);
    }
    root.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) => b.addEventListener('click', () => {
      sfx.click();
      if (b.dataset.b === 'zoomin') this.mapZoom = Math.min(3, this.mapZoom * 1.4);
      else if (b.dataset.b === 'zoomout') this.mapZoom = Math.max(0.5, this.mapZoom / 1.4);
      else this.onButton(b.dataset.b!);
    }));
    root.querySelectorAll<HTMLButtonElement>('#log .tabs button').forEach((b) => b.addEventListener('click', () => {
      this.logFilter = b.dataset.f as 'all';
      root.querySelectorAll('#log .tabs button').forEach((x) => x.classList.toggle('on', x === b));
      this.renderLog(true);
    }));
    $(root, '#death button').addEventListener('click', () => this.w.release());
    $(root, '#pframe').addEventListener('click', () => { if (w.player) w.player.target = w.player.id; });
  }

  tip(html: string | null, anchor?: HTMLElement) {
    const t = $(this.root, '#tip');
    if (!html) {
      t.style.display = 'none';
      return;
    }
    t.innerHTML = html;
    t.style.display = 'block';
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const tw = t.offsetWidth, th = t.offsetHeight;
      t.style.left = `${Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2))}px`;
      t.style.top = `${r.top - th - 8 < 6 ? r.bottom + 8 : r.top - th - 8}px`;
    }
  }

  private slotTip(i: number, el: HTMLElement) {
    const ch = this.w.char;
    if (!ch) return;
    if (i === 10) return this.tip(`<b>Healing Draught</b><br>Restores 45% of your life. 25 s cooldown.<br><i>Key: G</i>`, el);
    if (i === 11) return this.tip(`<b>Draught of Clarity</b><br>Restores 45% of your power. 25 s cooldown.<br><i>Key: V</i>`, el);
    const id = ch.hotbar[i];
    if (!id) return this.tip(`<i>Empty. Drag an ability here from the Abilities window (K).</i>`, el);
    this.tip(abilityTip(id), el);
  }

  private seq = 0;
  say(text: string, kind: LogKind = 'system') {
    this.log.push({ text, kind, seq: ++this.seq });
    this.renderLog(false);
  }

  banner(text: string, color = '#f3e6c4') {
    const b = $(this.root, '#banner');
    b.textContent = text;
    b.style.color = color;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    this.bannerTimer = 4;
  }

  handle(events: GameEvent[]) {
    const w = this.w;
    const p = w.player;
    if (!p) return;
    for (const ev of events) {
      switch (ev.type) {
        case 'dmg': {
          const mine = ev.src === p.id, onMe = ev.id === p.id;
          const tgt = ev.id === p.target;
          if (!mine && !onMe && !tgt) break;
          if (ev.result === 'hit') {
            this.float(ev.id, `${ev.amount}${ev.crit ? '!' : ''}`, onMe ? 'in' : mine ? (ev.crit ? 'crit' : 'out') : 'other');
            if (mine || onMe) ev.school === 'melee' ? sfx.hit() : ev.school === 'arrow' ? sfx.hit() : null;
          } else {
            this.float(ev.id, ev.result, 'miss');
            if ((mine || onMe) && (ev.result === 'block' || ev.result === 'parry')) sfx.block();
          }
          break;
        }
        case 'heal':
          if ((ev.id === p.id || ev.src === p.id) && ev.amount > 0) this.float(ev.id, `+${ev.amount}`, 'heal');
          break;
        case 'swing':
          if (ev.id === p.id) p.weapon.ranged ? sfx.bow() : sfx.swing();
          break;
        case 'castStart':
          if (ev.id === p.id) {
            const ab = ABILITIES[ev.ab];
            ab.kind === 'shot' ? sfx.bow() : sfx.cast(ab.school);
          }
          break;
        case 'castEnd':
          if (ev.id === p.id && ev.ok) {
            const ab = ABILITIES[ev.ab];
            if (ab.kind === 'spell') ab.heal ? sfx.heal() : sfx.release(ab.school);
          }
          break;
        case 'levelup':
          sfx.level();
          if (ev.level > 0) this.banner(`Level ${ev.level}`, '#ffe58a');
          else this.banner(RANK_TITLES[w.char!.realm][realmRank(w.char!.rp)], '#ff9f4a');
          break;
        case 'death':
          if (ev.id === p.id) sfx.death();
          break;
        case 'capture': {
          const k = w.keeps[ev.keep];
          const r = ev.realm as number;
          if (r >= 0) {
            this.banner(`${REALM_DEFS[r].name} captures ${k.site.name}`, REALM_DEFS[r].color);
            sfx.horn();
          }
          break;
        }
      }
    }
    const lines = w.logs.splice(0);
    for (const l of lines) this.log.push({ text: l.text, kind: l.kind, seq: ++this.seq });
    if (this.log.length > 300) this.log.splice(0, this.log.length - 250);
    if (lines.length) this.renderLog(false);
    if (lines.some((l) => l.kind === 'loot' && /copper|silver|gold/.test(l.text))) sfx.coin();
  }

  private float(id: number, text: string, cls: string) {
    const el = document.createElement('div');
    el.className = `fl ${cls}`;
    el.textContent = text;
    $(this.root, '#floaters').appendChild(el);
    this.floaters.push({ el, id, t: 0, dx: (Math.random() - 0.5) * 40 });
    if (this.floaters.length > 40) {
      const f = this.floaters.shift()!;
      f.el.remove();
    }
  }

  private shownSeq = 0;
  private renderLog(full: boolean) {
    const want = (k: LogKind) =>
      this.logFilter === 'all' ? true : this.logFilter === 'chat' ? k === 'chat' || k === 'say' || k === 'realm' : k !== 'chat' && k !== 'say';
    if (full) {
      this.logEl.innerHTML = '';
      this.shownSeq = 0;
    }
    const frag = document.createDocumentFragment();
    for (const l of this.log) {
      if (l.seq <= this.shownSeq || !want(l.kind)) continue;
      const d = document.createElement('div');
      d.textContent = l.text;
      d.style.color = LOG_COLORS[l.kind];
      frag.appendChild(d);
    }
    this.shownSeq = this.seq;
    this.logEl.appendChild(frag);
    while (this.logEl.childElementCount > 150) this.logEl.firstElementChild!.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  update(dt: number) {
    const w = this.w;
    const p = w.player;
    const ch = w.char;
    if (!p || !ch) return;
    // floating text follows its owner
    const pt = { x: 0, y: 0 };
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.3 || !this.r.project(f.id, pt, 0.3)) {
        f.el.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      f.el.style.transform = `translate(${pt.x + f.dx}px, ${pt.y - f.t * 55}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.8) / 0.5);
    }
    // cast bar every frame
    const cb = $(this.root, '#castbar');
    if (p.cast) {
      const ab = ABILITIES[p.cast.ab];
      const k = (w.t - p.cast.start) / (p.cast.end - p.cast.start);
      cb.style.display = 'block';
      ($(cb, 'i')).style.width = `${Math.min(100, k * 100)}%`;
      $(cb, 'span').textContent = `${ab.name}${p.cast.focus ? ' (focused)' : ''}`;
    } else cb.style.display = 'none';
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) $(this.root, '#banner').classList.remove('show');
    }
    this.lastSlow += dt;
    if (this.lastSlow < 0.1) return;
    this.lastSlow = 0;
    this.frame($(this.root, '#pframe'), p, true);
    const t = w.get(p.target);
    const tf = $(this.root, '#tframe');
    if (t && (!t.dead || t.kind === 'mob')) {
      tf.style.display = 'block';
      this.frame(tf, t, false);
    } else tf.style.display = 'none';
    this.hotbar();
    // xp
    const xpEl = $(this.root, '#xp');
    const need = xpToNext(ch.level);
    const frac = ch.level >= MAX_LEVEL ? 1 : ch.xp / need;
    ($(xpEl, 'i')).style.width = `${frac * 100}%`;
    const rr = realmRank(ch.rp);
    const next = REALM_RANKS[rr + 1];
    ($(xpEl, 'b')).style.width = next ? `${((ch.rp - REALM_RANKS[rr]) / (next - REALM_RANKS[rr])) * 100}%` : '100%';
    $(xpEl, 'span').textContent = ch.level >= MAX_LEVEL
      ? `Level ${ch.level} (max) · Realm rank ${rr + 1}: ${ch.rp} RP`
      : `Level ${ch.level} · ${ch.xp.toLocaleString()} / ${need.toLocaleString()} xp · Realm rank ${rr + 1} · ${ch.rp} RP`;
    $(this.root, '#money').textContent = formatMoney(ch.copper);
    // death
    const dd = $(this.root, '#death');
    dd.style.display = p.dead ? 'flex' : 'none';
    if (p.dead) $(dd, 'p').textContent = `Release to return to ${w.bindPoint().name}.`;
    // interaction prompt
    const it = w.interactable();
    const pr = $(this.root, '#prompt');
    if (it) {
      pr.style.display = 'block';
      pr.innerHTML = 'kind' in it ? `<b>F</b> Talk to ${it.name}` : `<b>F</b> Travel from ${it.site.name}`;
    } else pr.style.display = 'none';
    // task tracker
    const tk = $(this.root, '#task');
    const band = w.war.ledBy(p);
    const bits: string[] = [];
    if (ch.task) bits.push(`<b>Task</b> Slay ${plural(ch.task.mobName)} in ${ch.task.zone}: ${ch.task.have}/${ch.task.need}${ch.task.have >= ch.task.need ? '<br><i>Return to the Taskmaster.</i>' : ''}`);
    if (band) {
      const alive = band.members.map((id) => w.get(id)).filter((e): e is Entity => !!e && !e.dead);
      bits.push(`<b>Your warband</b> · ${alive.length} strong${alive.map((e) => `<div class="wb"><span>${e.name}</span><i style="width:${Math.round((e.hp / e.maxHp) * 100)}%"></i></div>`).join('')}`);
    }
    if (bits.length) {
      tk.style.display = 'block';
      tk.innerHTML = bits.join('<hr>');
    } else tk.style.display = 'none';
    this.drawMinimap();
  }

  private frame(el: HTMLElement, e: Entity, self: boolean) {
    const w = this.w;
    const p = w.player!;
    const lvl = $(el, '.lvl'), nmEl = $(el, '.nm'), sub = $(el, '.sub');
    lvl.textContent = String(e.level);
    nmEl.textContent = e.kind === 'mob' && !e.named ? cap(e.name) : e.kind === 'door' ? `Gate of ${e.name}` : e.name;
    let color = '#f3e6c4';
    let subText = '';
    if (self) {
      subText = `${CLASSES[e.cls!].name} · ${REALM_DEFS[e.realm as number].name}${e.title ? ' · ' + e.title : ''}`;
      color = REALM_DEFS[e.realm as number].color;
    } else if (e.kind === 'mob') {
      color = CON_HEX[conColor(p.level, e.level)];
      subText = e.named ? 'Named' : '';
    } else if (e.realm === p.realm) {
      color = '#8fd7ff';
      subText = e.kind === 'npc' ? roleName(e) : `${e.cls ? CLASSES[e.cls].name : ''}${e.kind === 'guard' ? ' · Guard' : e.kind === 'soldier' ? ' · Warband' : e.kind === 'lord' ? ' · Keep lord' : ''}`;
    } else {
      color = CON_HEX[conColor(p.level, e.level)];
      const realm = e.realm === -1 ? 'Mistborn' : REALM_DEFS[e.realm as number].name;
      subText = e.kind === 'door' ? `${realm} keep gate` : `${realm} ${e.cls ? CLASSES[e.cls].name : ''}${e.kind === 'lord' ? ' · Keep lord' : ''}`;
    }
    nmEl.style.color = color;
    sub.textContent = subText;
    const hp = $(el, '.hp');
    ($(hp, 'i')).style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
    $(hp, 'span').textContent = self ? `${Math.ceil(e.hp)} / ${e.maxHp}` : `${Math.ceil((e.hp / e.maxHp) * 100)}%`;
    if (self) {
      const pw = $(el, '.pw');
      pw.style.display = e.maxPower ? 'block' : 'none';
      ($(pw, 'i')).style.width = `${e.maxPower ? (e.power / e.maxPower) * 100 : 0}%`;
      $(pw, 'span').textContent = `${Math.floor(e.power)} / ${e.maxPower}`;
      const en = $(el, '.en');
      ($(en, 'i')).style.width = `${e.endu}%`;
      $(en, 'span').textContent = `${Math.floor(e.endu)}%`;
    }
    const buffs = $(el, '.buffs');
    const parts = e.effects.map((f) => {
      const left = Math.max(0, Math.ceil(f.until - w.t));
      const good = f.type === 'buff' || f.type === 'hot' || f.type === 'absorb' || f.type === 'focus';
      const label = f.type === 'snare' ? 'Slowed' : f.type === 'stun' ? 'Stunned' : f.type === 'root' ? 'Rooted' : f.type === 'dot' ? 'Bleeding' : f.type === 'taunt' ? 'Taunted' : f.type === 'focus' ? 'Focus' : f.name;
      return `<span class="${good ? 'good' : 'bad'}">${label} ${left > 99 ? Math.ceil(left / 60) + 'm' : left + 's'}</span>`;
    });
    if (self && e.sprinting) parts.unshift('<span class="good">Sprinting</span>');
    if (self && e.attacking) parts.unshift('<span class="good">Attacking</span>');
    buffs.innerHTML = parts.join('');
  }

  private hotbar() {
    const w = this.w;
    const p = w.player!;
    const ch = w.char!;
    const tgt = w.get(p.target);
    for (let i = 0; i < 12; i++) {
      const s = this.slots[i];
      const img = $<HTMLImageElement>(s, 'img');
      const cd = $(s, '.cd');
      const n = $(s, '.n');
      if (i >= 10) {
        const kind = i === 10 ? 'health' : 'power';
        img.src = iconUrl(i === 10 ? 'potion' : 'potion2', i === 10 ? 'potion' : 'potion2');
        n.textContent = String(ch.potions[kind]);
        const left = (p.cds.potion ?? 0) - w.t;
        cd.style.background = left > 0 ? `conic-gradient(rgba(0,0,0,0.65) ${(left / 25) * 360}deg, transparent 0)` : 'none';
        s.classList.toggle('dim', ch.potions[kind] <= 0 || (kind === 'power' && !p.maxPower));
        s.style.display = kind === 'power' && !p.maxPower ? 'none' : '';
        continue;
      }
      const id = ch.hotbar[i];
      if (!id) {
        img.style.visibility = 'hidden';
        cd.style.background = 'none';
        n.textContent = '';
        s.classList.remove('dim', 'queued', 'active');
        continue;
      }
      const ab = ABILITIES[id];
      img.style.visibility = 'visible';
      const url = iconUrl(ab.icon, ab.school);
      if (img.dataset.k !== url.slice(-40)) { img.src = url; img.dataset.k = url.slice(-40); }
      const ready = p.cds[id] ?? 0;
      const left = ready - w.t;
      cd.style.background = left > 0 && ab.cd ? `conic-gradient(rgba(0,0,0,0.7) ${(left / ab.cd) * 360}deg, transparent 0)` : 'none';
      n.textContent = left > 0 ? String(Math.ceil(left)) : '';
      let usable = !p.dead && left <= 0;
      if (usable && ab.costType === 'endu' && p.endu < ab.cost) usable = false;
      if (usable && ab.costType === 'power' && p.maxPower && p.power < (ab.cost / 100) * p.maxPower) usable = false;
      if (usable && ab.kind === 'style' && tgt && w.styleBlocked(p, tgt, ab)) usable = false;
      if (usable && (ab.target === 'enemy' || ab.target === 'enemyAoe') && (!tgt || !w.hostile(p, tgt))) usable = false;
      s.classList.toggle('dim', !usable);
      s.classList.toggle('queued', p.queuedStyle === id || p.cast?.ab === id);
      // highlight follow-up and reactive styles when they are open
      const open = ab.req && tgt && w.hostile(p, tgt) && !w.styleBlocked(p, tgt, ab);
      s.classList.toggle('active', !!open);
    }
  }

  private drawMinimap() {
    const w = this.w;
    const p = w.player!;
    const c = this.minimap;
    const g = c.getContext('2d')!;
    const S = c.width;
    const span = 360 / this.mapZoom; // metres across
    const scale = S / span;
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#2a3a2a';
    g.fillRect(0, 0, S, S);
    const map = this.r.mapCanvas;
    if (map) {
      const n = map.width;
      const k = n / (WORLD_R * 2);
      const sx = (p.x - span / 2 + WORLD_R) * k, sz = (p.z - span / 2 + WORLD_R) * k;
      g.imageSmoothingEnabled = true;
      g.drawImage(map, sx, sz, span * k, span * k, 0, 0, S, S);
    }
    const toS = (x: number, z: number) => [S / 2 + (x - p.x) * scale, S / 2 + (z - p.z) * scale];
    // keeps
    for (const k of w.keeps) {
      const [x, y] = toS(k.site.x, k.site.z);
      if (x < -10 || y < -10 || x > S + 10 || y > S + 10) continue;
      g.fillStyle = ownerColor(k.owner);
      g.strokeStyle = '#000';
      g.lineWidth = 1.5;
      g.fillRect(x - 5, y - 5, 10, 10);
      g.strokeRect(x - 5, y - 5, 10, 10);
    }
    w.near(p.x, p.z, span * 0.75, (e) => {
      if (e === p || e.dead || e.kind === 'door') return;
      const [x, y] = toS(e.x, e.z);
      let col = '#ddd';
      if (e.kind === 'mob') col = CON_HEX[conColor(p.level, e.level)];
      else if (e.realm === p.realm) col = e.kind === 'npc' ? '#ffffff' : '#5fd068';
      else col = '#ff4b3e';
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, e.kind === 'mob' ? 2 : 2.6, 0, Math.PI * 2);
      g.fill();
      if (e.id === p.target) {
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.stroke();
      }
    });
    // the hero
    g.translate(S / 2, S / 2);
    g.rotate(p.facing + Math.PI / 2);
    g.fillStyle = '#ffe58a';
    g.strokeStyle = '#000';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5.5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5.5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.strokeStyle = '#c9a65a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#f3e6c4';
    g.font = 'bold 13px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('N', S / 2, 16);
    const zone = w.geo.zoneAt(p.x, p.z);
    $(this.root, '#mm .zone').textContent = zone.name;
    const day = this.r.dayFrac();
    const hh = Math.floor(day * 24), mm = Math.floor((day * 24 - hh) * 60);
    $(this.root, '#mm .coords').textContent = `${Math.round(p.x)}, ${Math.round(-p.z)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}

function roleName(e: Entity) {
  return e.role === 'merchant' ? 'Merchant' : e.role === 'teleporter' ? 'Porter' : e.role === 'healer' ? 'Healer' : e.role === 'taskmaster' ? 'Taskmaster' : 'Gatekeeper';
}

export function abilityTip(id: string) {
  const ab = ABILITIES[id];
  const bits: string[] = [];
  if (ab.kind === 'style') bits.push('Style (next swing)');
  if (ab.cast) bits.push(`${ab.kind === 'shot' ? 'Draw' : 'Cast'} ${ab.cast}s`);
  else if (ab.kind !== 'style') bits.push('Instant');
  if (ab.cd) bits.push(`Recast ${ab.cd}s`);
  if (ab.range && ab.kind !== 'style') bits.push(`Range ${ab.range}m`);
  bits.push(ab.costType === 'endu' ? `${ab.cost} endurance` : `${ab.cost}% power`);
  return `<b>${ab.name}</b> <small>level ${ab.level}</small><br><span class="meta">${bits.join(' · ')}</span><br>${ab.desc}`;
}

export { nm, KEEPS };
