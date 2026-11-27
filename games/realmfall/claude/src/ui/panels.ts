/** Windows: character, backpack, abilities, war map, NPC dialogue, help and the game menu. */
import type { World } from '../game/world';
import { moneyText, plural, dist } from '../game/world';
import type { Entity } from '../game/types';
import type { KeepState } from '../game/war';
import { ABILITIES, CLASSES, STATS, STAT_NAMES, realmRank, RANK_TITLES, REALM_RANKS, xpToNext } from '../game/data';
import { REALM_DEFS, WORLD_R, SITES, FRONTIER_R, ROADS } from '../game/geo';
import { SLOTS, SLOT_NAMES, RARITY_HEX, RARITY_NAMES, formatMoney, shopPrice, itemScore, type Item } from '../game/items';
import type { Renderer } from '../render/scene';
import { ownerColor } from '../render/structures';
import { iconUrl } from './icons';
import { abilityTip, type Hud } from './hud';
import { sfx } from './audio';

export type PanelId = 'char' | 'bag' | 'abilities' | 'map' | 'dialog' | 'help' | 'menu';

export class Panels {
  private w: World;
  private r: Renderer;
  private hud: Hud;
  private host: HTMLElement;
  open: Set<PanelId> = new Set();
  private els = new Map<PanelId, HTMLElement>();
  private dialogWith: Entity | KeepState | null = null;
  private shop = false;
  onQuit: () => void = () => {};
  onSettings: (k: string, v: boolean) => void = () => {};
  settings = { muted: false, shadows: true };

  constructor(parent: HTMLElement, w: World, r: Renderer, hud: Hud) {
    this.w = w;
    this.r = r;
    this.hud = hud;
    this.host = document.createElement('div');
    this.host.id = 'panels';
    parent.appendChild(this.host);
  }

  private panel(id: PanelId, title: string, cls = ''): HTMLElement {
    let el = this.els.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = `panel ${cls}`;
      el.dataset.id = id;
      el.innerHTML = `<header><h3></h3><button class="x" title="Close">×</button></header><div class="body"></div>`;
      el.querySelector('.x')!.addEventListener('click', () => this.close(id));
      this.host.appendChild(el);
      this.els.set(id, el);
    }
    el.querySelector('h3')!.textContent = title;
    return el;
  }

  toggle(id: PanelId) {
    if (this.open.has(id)) this.close(id);
    else this.show(id);
  }

  show(id: PanelId) {
    sfx.click();
    this.open.add(id);
    this.refresh(id);
    this.els.get(id)!.style.display = 'flex';
  }

  close(id: PanelId) {
    this.open.delete(id);
    const el = this.els.get(id);
    if (el) el.style.display = 'none';
    if (id === 'dialog') this.dialogWith = null;
    this.hud.tip(null);
  }

  closeTop(): boolean {
    const last = [...this.open].pop();
    if (!last) return false;
    this.close(last);
    return true;
  }

  private tick = 0;
  update(dt: number) {
    this.tick += dt;
    if (this.tick < 0.5) return;
    this.tick = 0;
    for (const id of this.open) if (id === 'char' || id === 'map') this.refresh(id);
    if (this.dialogWith && this.w.player && dist(this.w.player, 'site' in this.dialogWith ? this.dialogWith.site : this.dialogWith) > 12) this.close('dialog');
  }

  refresh(id: PanelId) {
    switch (id) {
      case 'char': return this.charPanel();
      case 'bag': return this.bagPanel();
      case 'abilities': return this.abilityPanel();
      case 'map': return this.mapPanel();
      case 'dialog': return this.dialogPanel();
      case 'help': return this.helpPanel();
      case 'menu': return this.menuPanel();
    }
  }

  // ---------- character ----------

  private charPanel() {
    const w = this.w, ch = w.char!, p = w.player!;
    const el = this.panel('char', ch.name, 'left');
    const cls = CLASSES[ch.cls];
    const rr = realmRank(ch.rp);
    const rows = STATS.map((s) => `<tr><td>${STAT_NAMES[s]}</td><td>${Math.round(p.stats[s])}</td></tr>`).join('');
    const slots = SLOTS.map((s) => {
      const it = ch.equip[s];
      return `<div class="eq" data-uid="${it?.uid ?? ''}"><small>${SLOT_NAMES[s]}</small><span style="color:${it ? RARITY_HEX[it.rarity] : '#777'}">${it ? it.name : '—'}</span></div>`;
    }).join('');
    const absorb = Math.round((p.af / (p.af + 10 + 2 * p.level)) * 100);
    el.querySelector('.body')!.innerHTML = `
      <p class="lead" style="color:${REALM_DEFS[ch.realm].color}">Level ${ch.level} ${cls.name} of ${REALM_DEFS[ch.realm].name}</p>
      <p class="muted">${RANK_TITLES[ch.realm][rr]} · realm rank ${rr + 1} · ${ch.rp.toLocaleString()} realm points${REALM_RANKS[rr + 1] ? ` (next at ${REALM_RANKS[rr + 1].toLocaleString()})` : ''}</p>
      <div class="cols">
        <table class="stats">${rows}
          <tr><td>Hit points</td><td>${p.maxHp}</td></tr>
          ${p.maxPower ? `<tr><td>Power</td><td>${p.maxPower}</td></tr>` : ''}
          <tr><td>Weapon DPS</td><td>${p.weapon.dps.toFixed(1)} (${p.weapon.speed.toFixed(1)}s)</td></tr>
          <tr><td>Armour</td><td>${p.af.toFixed(0)} AF (~${absorb}% vs. equals)</td></tr>
          <tr><td>Evade / Parry / Block</td><td>${Math.round(p.evade * 100)}% / ${Math.round(p.parry * 100)}% / ${Math.round(p.block * 100)}%</td></tr>
        </table>
        <div class="equip">${slots}</div>
      </div>
      <p class="muted">Experience ${ch.xp.toLocaleString()} / ${xpToNext(ch.level).toLocaleString()} · ${ch.kills} kills · ${ch.realmKills} enemies of the realm · ${ch.deaths} deaths · played ${Math.floor(ch.played / 60)} min</p>
    `;
    el.querySelectorAll<HTMLElement>('.eq').forEach((d) => {
      const uid = +(d.dataset.uid ?? 0);
      const it = Object.values(ch.equip).find((x) => x?.uid === uid);
      if (!it) return;
      d.addEventListener('mouseenter', () => this.hud.tip(itemTip(it, ch.level), d));
      d.addEventListener('mouseleave', () => this.hud.tip(null));
    });
  }

  // ---------- backpack ----------

  private bagPanel() {
    const w = this.w, ch = w.char!;
    const el = this.panel('bag', this.shop ? 'Merchant' : 'Backpack', 'right');
    const body = el.querySelector('.body')!;
    const items = ch.bag.map((it) => {
      const better = itemScore(it) > itemScore(ch.equip[it.slot]);
      return `<div class="item" data-uid="${it.uid}"><span class="iname" style="color:${RARITY_HEX[it.rarity]}">${it.name}</span><small>${SLOT_NAMES[it.slot]} · lvl ${it.level}${better ? ' · <em>upgrade</em>' : ''}</small>
        <span class="acts"><button data-a="equip">Equip</button>${this.shop ? `<button data-a="sell">Sell ${formatMoney(it.value)}</button>` : '<button data-a="drop">Drop</button>'}</span></div>`;
    }).join('') || '<p class="muted">Your backpack is empty.</p>';
    let shopHtml = '';
    if (this.shop) {
      const stock = w.shopStock();
      shopHtml = `<h4>For sale</h4>
        <div class="item"><span class="iname">Healing Draught</span><small>restores 45% life · you have ${ch.potions.health}</small><span class="acts"><button data-buy="health">Buy ${formatMoney(w.potionPrice('health'))}</button></span></div>
        ${w.player!.maxPower ? `<div class="item"><span class="iname">Draught of Clarity</span><small>restores 45% power · you have ${ch.potions.power}</small><span class="acts"><button data-buy="power">Buy ${formatMoney(w.potionPrice('power'))}</button></span></div>` : ''}
        ${stock.map((it, i) => `<div class="item stock" data-i="${i}"><span class="iname">${it.name}</span><small>${SLOT_NAMES[it.slot]} · lvl ${it.level}${itemScore(it) > itemScore(ch.equip[it.slot]) ? ' · <em>upgrade</em>' : ''}</small><span class="acts"><button data-stock="${i}">Buy ${formatMoney(shopPrice(it))}</button></span></div>`).join('')}
        <div class="row"><button data-a="sellall">Sell everything that isn't an upgrade</button></div>
        <h4>Your backpack</h4>`;
      body.innerHTML = shopHtml + items;
      body.querySelectorAll<HTMLElement>('.stock').forEach((d) => {
        const it = stock[+d.dataset.i!];
        d.addEventListener('mouseenter', () => this.hud.tip(itemTip(it, ch.level, ch.equip[it.slot]), d));
        d.addEventListener('mouseleave', () => this.hud.tip(null));
      });
      body.querySelectorAll<HTMLButtonElement>('[data-stock]').forEach((b) => b.addEventListener('click', () => { if (w.buy(stock[+b.dataset.stock!])) sfx.coin(); this.bagPanel(); }));
      body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => { if (w.buy(b.dataset.buy as 'health')) sfx.coin(); this.bagPanel(); }));
      body.querySelector('[data-a="sellall"]')?.addEventListener('click', () => {
        for (const it of [...ch.bag]) if (itemScore(it) <= itemScore(ch.equip[it.slot])) w.sell(it.uid);
        sfx.coin();
        this.bagPanel();
      });
    } else body.innerHTML = `<p class="muted">${ch.bag.length}/30 · ${formatMoney(ch.copper)}</p>` + items;
    body.querySelectorAll<HTMLElement>('.item[data-uid]').forEach((d) => {
      const uid = +d.dataset.uid!;
      const it = ch.bag.find((x) => x.uid === uid)!;
      d.addEventListener('mouseenter', () => this.hud.tip(itemTip(it, ch.level, ch.equip[it.slot]), d));
      d.addEventListener('mouseleave', () => this.hud.tip(null));
      d.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'equip') w.equip(uid);
        if (a === 'sell') { w.sell(uid); sfx.coin(); }
        if (a === 'drop') w.destroy(uid);
        this.hud.tip(null);
        this.bagPanel();
        if (this.open.has('char')) this.charPanel();
      }));
    });
  }

  openShop() {
    this.shop = true;
    this.show('bag');
  }

  // ---------- abilities ----------

  private abilityPanel() {
    const w = this.w, ch = w.char!;
    const el = this.panel('abilities', 'Abilities', 'left');
    const cls = CLASSES[ch.cls];
    const list = cls.abilities.map((id) => {
      const ab = ABILITIES[id];
      const known = ab.level <= ch.level;
      return `<div class="abil ${known ? '' : 'locked'}" draggable="${known}" data-ab="${id}"><img src="${iconUrl(ab.icon, ab.school)}" alt=""><div><b>${ab.name}</b> <small>level ${ab.level}</small><br><small>${ab.desc}</small></div></div>`;
    }).join('');
    el.querySelector('.body')!.innerHTML = `<p class="muted">${cls.desc}</p><p class="muted">Drag an ability onto the hotbar. Right-click a hotbar slot to clear it.</p>${list}
      <h4>Everyone</h4><p class="muted"><b>Shift</b> sprint (uses endurance) · <b>Z</b> toggle attack · <b>G</b>/<b>V</b> potions</p>`;
    el.querySelectorAll<HTMLElement>('.abil').forEach((d) => {
      d.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/ability', d.dataset.ab!));
      d.addEventListener('mouseenter', () => this.hud.tip(abilityTip(d.dataset.ab!), d));
      d.addEventListener('mouseleave', () => this.hud.tip(null));
      d.addEventListener('dblclick', () => {
        const free = ch.hotbar.indexOf(null);
        const id = d.dataset.ab!;
        if (free >= 0 && !ch.hotbar.includes(id) && ABILITIES[id].level <= ch.level) ch.hotbar[free] = id;
      });
    });
  }

  // ---------- war map ----------

  private mapPanel() {
    const w = this.w;
    const el = this.panel('map', 'The Realms', 'wide');
    const body = el.querySelector('.body') as HTMLElement;
    let c = body.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) {
      body.innerHTML = `<div class="mapwrap"><canvas width="720" height="720"></canvas><div class="keeplist"></div></div>`;
      c = body.querySelector('canvas')!;
    }
    const g = c.getContext('2d')!;
    const S = c.width;
    const k = S / (WORLD_R * 2);
    const toS = (x: number, z: number) => [(x + WORLD_R) * k, (z + WORLD_R) * k];
    g.clearRect(0, 0, S, S);
    if (this.r.mapCanvas) g.drawImage(this.r.mapCanvas, 0, 0, S, S);
    g.fillStyle = 'rgba(20,16,10,0.15)';
    g.fillRect(0, 0, S, S);
    // frontier ring
    g.strokeStyle = 'rgba(255,230,180,0.5)';
    g.setLineDash([6, 6]);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(S / 2, S / 2, FRONTIER_R * k, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    // roads
    g.strokeStyle = 'rgba(120,95,60,0.7)';
    g.lineWidth = 2;
    for (const road of ROADS) {
      g.beginPath();
      road.forEach((pt, i) => { const [x, y] = toS(pt.x, pt.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    }
    // realm names
    g.textAlign = 'center';
    for (const r of REALM_DEFS) {
      const [x, y] = toS(Math.cos(r.angle) * 860, Math.sin(r.angle) * 860);
      g.font = 'bold 26px Cinzel, Georgia, serif';
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.strokeText(r.name.toUpperCase(), x, y - 40);
      g.fillStyle = r.color;
      g.fillText(r.name.toUpperCase(), x, y - 40);
    }
    // sites
    for (const s of SITES) {
      const [x, y] = toS(s.x, s.z);
      g.font = '13px Georgia, serif';
      if (s.kind === 'keep') {
        const ks = w.keeps.find((kk) => kk.site.id === s.id)!;
        const attacked = w.t - ks.lastAttacked < 15;
        g.fillStyle = ownerColor(ks.owner);
        g.strokeStyle = attacked ? '#ff3b2a' : '#111';
        g.lineWidth = attacked ? 3 : 2;
        g.beginPath();
        g.rect(x - 9, y - 9, 18, 18);
        g.fill();
        g.stroke();
        if (attacked) crossedSwords(g, x + 14, y - 14);
      } else {
        g.fillStyle = s.kind === 'town' ? '#f3e6c4' : REALM_DEFS[s.realm as number].color;
        g.beginPath();
        g.arc(x, y, s.kind === 'town' ? 7 : 6, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#111';
        g.lineWidth = 2;
        g.stroke();
      }
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.strokeText(s.name, x, y + 24);
      g.fillStyle = '#f3e6c4';
      g.fillText(s.name, x, y + 24);
    }
    // friendly warbands (scouts report your own realm's movements)
    const p = w.player!;
    for (const b of w.war.bands) {
      if (b.realm !== p.realm) continue;
      const lead = w.get(b.members[0]);
      if (!lead) continue;
      const [x, y] = toS(lead.x, lead.z);
      g.fillStyle = REALM_DEFS[b.realm].color;
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y - 7);
      g.lineTo(x + 6, y + 5);
      g.lineTo(x - 6, y + 5);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // the hero
    const [px, py] = toS(p.x, p.z);
    g.save();
    g.translate(px, py);
    g.rotate(p.facing + Math.PI / 2);
    g.fillStyle = '#ffe58a';
    g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(7, 8);
    g.lineTo(0, 4);
    g.lineTo(-7, 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // keep list
    const counts = [0, 0, 0];
    for (const kk of w.keeps) if (kk.owner !== -1) counts[kk.owner as number]++;
    const list = body.querySelector('.keeplist')!;
    list.innerHTML = `<h4>Keeps held</h4>${REALM_DEFS.map((r) => `<div><span class="sw" style="background:${r.color}"></span>${r.name}: <b>${counts[r.id]}</b></div>`).join('')}
      <h4>Keeps</h4>${w.keeps.map((kk) => {
        const attacked = w.t - kk.lastAttacked < 15;
        const door = w.get(kk.doorId);
        const owner = kk.owner === -1 ? 'Mistborn (neutral)' : REALM_DEFS[kk.owner as number].name;
        return `<div><span class="sw" style="background:${ownerColor(kk.owner)}"></span>${kk.site.name} <small>${owner}${attacked ? ' · <span class="warn">under attack</span>' : ''}${door?.dead ? ' · gate broken' : ''}</small></div>`;
      }).join('')}
      <p class="muted">Triangles are your realm's warbands. Crossed swords mark fighting at a keep.</p>`;
  }

  // ---------- dialogue ----------

  talk(target: Entity | KeepState) {
    this.dialogWith = target;
    this.shop = false;
    if ('kind' in target && target.role === 'merchant') {
      this.openShop();
      return;
    }
    this.show('dialog');
  }

  private dialogPanel() {
    const w = this.w, ch = w.char!, p = w.player!;
    const t = this.dialogWith;
    if (!t) return;
    const isKeep = 'site' in t;
    const el = this.panel('dialog', isKeep ? t.site.name : t.name, 'center');
    const body = el.querySelector('.body')!;
    let html = '';
    const travel = () => w.travelOptions().map((o, i) => `<button class="opt" data-travel="${i}">${o.label}</button>`).join('') || '<p class="muted">Nowhere to go from here.</p>';
    if (isKeep) {
      html = `<p>The banner of ${REALM_DEFS[ch.realm].name} flies over ${t.site.name}. A courier offers to take you along the realm's roads.</p>${travel()}`;
    } else if (t.role === 'teleporter' || t.role === 'gatekeeper') {
      html = t.role === 'teleporter'
        ? `<p>“The Frontier is no place for the green, ${CLASSES[ch.cls].name}. The other realms send warbands against our keeps day and night. Most who go out there are level 15 or better. Shall I send you?”</p>${travel()}`
        : `<p>“Beyond this gate lies the Frontier. Keeps held by ${REALM_DEFS[ch.realm].name} can take you in; I can send you home, or to any of them.”</p>${travel()}`;
    } else if (t.kind === 'soldier') {
      const b = w.war.band(t);
      const led = w.war.ledBy(p);
      const n = b?.members.length ?? 0;
      const k = b ? w.keeps[b.objective] : null;
      if (b && led === b) html = `<p>“We're with you, ${p.title ?? CLASSES[ch.cls].name}. Point us at something.”</p><p class="muted">Your warband of ${n} follows you and attacks whatever you attack.</p><button class="opt" data-lead="release">Carry on without me (they return to the war)</button>`;
      else html = `<p>“${n} of us, ${b?.mode === 'hold' ? `holding ${k?.site.name}` : b?.mode === 'siege' || b?.mode === 'rally' ? `pressing ${k?.site.name}` : `bound for ${k?.site.name ?? 'the front'}`}. ${p.level >= 15 ? 'We could use someone to lead us.' : 'You look a little green for this, but we\'ll take any sword.'}”</p><button class="opt" data-lead="follow">“Follow me.” Take command of this warband</button>${led ? '<p class="muted">You will give up the warband you lead now.</p>' : ''}`;
    } else if (t.role === 'healer') {
      html = `<p>“Let me see to those wounds.”</p><button class="opt" data-heal="1">Heal me</button>`;
    } else if (t.role === 'taskmaster') {
      const task = ch.task;
      if (task && task.have >= task.need) html = `<p>“Done already? Good work.”</p><button class="opt" data-task="done">Collect ${moneyText(task.copper)} and ${task.xp} experience</button>`;
      else if (task) html = `<p>“Still ${task.need - task.have} ${plural(task.mobName)} to go, in ${task.zone}.”</p><button class="opt" data-task="drop">Give up the task</button>`;
      else {
        const offer = w.offerTask();
        (this as unknown as { offer: unknown }).offer = offer;
        html = offer ? `<p>“The ${plural(offer.mobName)} in ${offer.zone} have grown bold. Slay ${offer.need} of them and you'll be paid ${moneyText(offer.copper)}.”</p><button class="opt" data-task="take">Accept the task</button>` : `<p>“Nothing for you right now.”</p>`;
      }
    }
    body.innerHTML = html;
    body.querySelectorAll<HTMLButtonElement>('[data-travel]').forEach((b) => b.addEventListener('click', () => {
      const o = w.travelOptions()[+b.dataset.travel!];
      if (o && w.teleport(o.x, o.z, o.name)) { this.close('dialog'); sfx.cast('energy'); }
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-lead]').forEach((b) => b.addEventListener('click', () => {
      if (!('kind' in t)) return;
      if (b.dataset.lead === 'follow') {
        const band = w.war.lead(t, p);
        if (band) {
          w.log(`[Realm] ${t.name}: Warband, on ${p.name}! Follow!`, 'chat');
          sfx.horn();
        }
      } else {
        w.war.release(p);
        w.log(`[Realm] ${t.name}: Understood. Back to it!`, 'chat');
      }
      this.close('dialog');
    }));
    body.querySelector('[data-heal]')?.addEventListener('click', () => {
      p.hp = p.maxHp;
      p.power = p.maxPower;
      p.effects = p.effects.filter((f) => f.type === 'buff');
      w.log(`${t && 'name' in t ? t.name : 'The healer'} heals your wounds.`, 'heal');
      sfx.heal();
      this.close('dialog');
    });
    body.querySelectorAll<HTMLButtonElement>('[data-task]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.task;
      if (a === 'take') w.acceptTask((this as unknown as { offer: Parameters<World['acceptTask']>[0] }).offer);
      if (a === 'drop') { ch.task = null; w.log('You abandon your task.', 'system'); }
      if (a === 'done') w.completeTask();
      this.close('dialog');
    }));
  }

  // ---------- help and menu ----------

  private helpPanel() {
    const el = this.panel('help', 'How to play', 'center wide-ish');
    el.querySelector('.body')!.innerHTML = `
      <div class="cols"><div>
      <h4>Moving</h4>
      <p><b>W / S</b> forward and back · <b>A / D</b> turn · <b>Q / E</b> strafe · <b>Space</b> jump · <b>Shift</b> sprint · <b>R</b> auto-run<br>
      <b>Right-drag</b> turns you with the camera (A/D then strafe) · <b>Left-drag</b> looks around · <b>Both buttons</b> run · <b>Wheel</b> zoom</p>
      <h4>Fighting</h4>
      <p><b>Click</b> to target · <b>Tab</b> nearest enemy · <b>Esc</b> clear target · <b>Z</b> or right-click an enemy to start attacking<br>
      <b>1–0</b> hotbar · <b>G</b> healing draught · <b>V</b> power draught · <b>F</b> talk / use</p>
      <p><b>Styles</b> (sword icons) replace your next swing. Some only work after a parry or block, from the side, or straight after another style; they glow on the bar when they are open.</p>
      <p><b>Spells and shots</b> take time. Moving, or being hit, ruins them. Root and snare your enemies, or use Focus.</p>
      </div><div>
      <h4>Levelling</h4>
      <p>Monsters are coloured by how tough they are compared to you: <span style="color:#9e9e9e">grey</span> (no reward), <span style="color:#4cd964">green</span>, <span style="color:#4aa3ff">blue</span>, <span style="color:#ffd84a">yellow</span> (even), <span style="color:#ff9f2e">orange</span>, <span style="color:#ff4b3e">red</span>, <span style="color:#c77dff">purple</span> (run). They get tougher the farther you go from town. The Taskmaster pays for culling them.</p>
      <h4>The Frontier</h4>
      <p>The three realms fight over seven keeps in the middle of the world. Warbands march from each realm's gate, gather outside a keep, batter down its gate and kill its lord to take it. Join your realm's fights for realm points and rank. Talk to the Porter in town to reach your gate, and travel between the keeps your realm holds by standing at their banner and pressing <b>F</b>.</p>
      <p>Your hero saves itself to this browser as you play.</p>
      </div></div>`;
  }

  private menuPanel() {
    const el = this.panel('menu', 'Menu', 'center small');
    const s = this.settings;
    el.querySelector('.body')!.innerHTML = `
      <button class="opt" data-m="resume">Resume</button>
      <button class="opt" data-m="help">How to play</button>
      <label class="chk"><input type="checkbox" data-s="muted" ${s.muted ? 'checked' : ''}> Mute sound</label>
      <label class="chk"><input type="checkbox" data-s="shadows" ${s.shadows ? 'checked' : ''}> Shadows</label>
      <button class="opt" data-m="quit">Save and quit to title</button>`;
    el.querySelector('[data-m="resume"]')!.addEventListener('click', () => this.close('menu'));
    el.querySelector('[data-m="help"]')!.addEventListener('click', () => { this.close('menu'); this.show('help'); });
    el.querySelector('[data-m="quit"]')!.addEventListener('click', () => { this.close('menu'); this.onQuit(); });
    el.querySelectorAll<HTMLInputElement>('[data-s]').forEach((i) => i.addEventListener('change', () => {
      (s as Record<string, boolean>)[i.dataset.s!] = i.checked;
      this.onSettings(i.dataset.s!, i.checked);
    }));
  }
}

function crossedSwords(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save();
  g.strokeStyle = '#fff';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7);
  g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7);
  g.stroke();
  g.restore();
}

export function itemTip(it: Item, level: number, compare?: Item) {
  const lines: string[] = [`<b style="color:${RARITY_HEX[it.rarity]}">${it.name}</b>`, `<span class="meta">${RARITY_NAMES[it.rarity]} ${SLOT_NAMES[it.slot].toLowerCase()} · level ${it.level} · quality ${Math.round(it.quality * 100)}%</span>`];
  if (it.dps) lines.push(`${it.dps.toFixed(1)} DPS, ${it.speed?.toFixed(1)}s speed${compare?.dps ? ` <span class="${it.dps >= compare.dps ? 'up' : 'down'}">(${it.dps >= compare.dps ? '+' : ''}${(it.dps - compare.dps).toFixed(1)})</span>` : ''}`);
  if (it.af) lines.push(`${it.af.toFixed(0)} armour factor${compare?.af ? ` <span class="${it.af >= compare.af ? 'up' : 'down'}">(${it.af >= compare.af ? '+' : ''}${(it.af - compare.af).toFixed(0)})</span>` : ''}`);
  for (const [k, v] of Object.entries(it.bonuses)) lines.push(`<span class="up">+${v} ${k === 'hp' ? 'hit points' : STAT_NAMES[k as keyof typeof STAT_NAMES]}</span>`);
  if (it.level > level + 2) lines.push(`<span class="down">Requires level ${it.level - 2}</span>`);
  if (compare && compare !== it) lines.push(`<span class="meta">Equipped: ${compare.name}</span>`);
  lines.push(`<span class="meta">Sells for ${formatMoney(it.value)}</span>`);
  return lines.join('<br>');
}
