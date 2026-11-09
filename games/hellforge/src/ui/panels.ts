import { AREA_BY_ID, DIFFICULTY_LEVELS, QUESTS } from '../game/areas';
import {
  allocStat, canLearn, CLASSES, DIFFICULTIES, INV_COLS, INV_ROWS, learnSkill, requirementError, skillLevel, sortGrid, STASH_COLS,
  STASH_ROWS, type GridEntry,
} from '../game/character';
import { baseOf, buyPrice, displayName, gamblePrice, itemColor, sellPrice, type Item, type Slot } from '../game/items';
import { classSkills, SKILL_BY_ID } from '../game/skills';
import { GAMBLE_KINDS, type World } from '../game/world';
import { itemIconUrl, skillIconUrl } from '../render/icons';
import { h, isTouch } from './dom';
import { compareEquip, defaultSlot } from './compare';
import { itemTooltip } from './tooltip';

export type PanelKind = 'inventory' | 'character' | 'skills' | 'healer' | 'smith' | 'sage' | 'fence' | 'stash' | 'waypoint' | 'caravan' | 'menu' | 'help';

export interface Selection {
  uid: number;
  from: 'inv' | 'equip' | 'stash' | 'vendor';
  slot?: Slot;
}

export interface PanelHost {
  world: World;
  sel: Selection | null;
  select(s: Selection | null): void;
  refresh(): void;
  close(): void;
  open(p: PanelKind): void;
  toast(text: string, color?: string): void;
  quitToMenu(): void;
  settings: { sound: boolean; music: boolean; weather: boolean; screenFx: boolean; labels: boolean; numbers: boolean };
  toggleSetting(k: 'sound' | 'music' | 'weather' | 'screenFx' | 'labels' | 'numbers'): void;
}

const SLOT_LAYOUT: { slot: Slot; label: string; area: string }[] = [
  { slot: 'head', label: 'Helm', area: 'head' },
  { slot: 'amulet', label: 'Amulet', area: 'amu' },
  { slot: 'weapon', label: 'Weapon', area: 'wpn' },
  { slot: 'body', label: 'Armor', area: 'body' },
  { slot: 'offhand', label: 'Shield', area: 'off' },
  { slot: 'ring1', label: 'Ring', area: 'r1' },
  { slot: 'belt', label: 'Belt', area: 'belt' },
  { slot: 'ring2', label: 'Ring', area: 'r2' },
  { slot: 'gloves', label: 'Gloves', area: 'glv' },
  { slot: 'boots', label: 'Boots', area: 'boot' },
];

function header(host: PanelHost, title: string, sub?: string) {
  return h('div', { class: 'p-head' }, h('div', { class: 'p-title' }, title, sub ? h('span', { class: 'p-sub' }, sub) : null), h('button', { class: 'p-close', 'aria-label': 'Close', onclick: () => host.close() }, '✕'));
}

function rarityClass(it: Item) {
  return `r-${it.rarity}${it.rarity === 'normal' && it.sockets ? ' r-sock' : ''}`;
}

function itemTile(host: PanelHost, it: Item, opts: { x?: number; y?: number; from: Selection['from']; slot?: Slot; bad?: boolean }) {
  const b = baseOf(it);
  const selected = host.sel?.uid === it.uid;
  const el = h(
    'button',
    {
      class: `itm ${rarityClass(it)}${selected ? ' sel' : ''}${opts.bad ? ' bad' : ''}${!it.identified ? ' unid' : ''}`,
      title: displayName(it),
      'data-uid': it.uid,
      'data-from': opts.from,
      'data-slot': opts.slot,
      style: opts.x !== undefined ? { left: `calc(var(--cell) * ${opts.x})`, top: `calc(var(--cell) * ${opts.y})`, width: `calc(var(--cell) * ${b.w})`, height: `calc(var(--cell) * ${b.h})` } : undefined,
      onclick: (e: Event) => {
        e.stopPropagation();
        host.select(selected ? null : { uid: it.uid, from: opts.from, slot: opts.slot });
      },
    },
    h('img', { src: itemIconUrl(it), alt: '', draggable: 'false' }),
    it.sockets ? h('span', { class: 'socks' }, '◦'.repeat(it.gems.length) + '·'.repeat(it.sockets - it.gems.length)) : null,
  );
  return el;
}

function grid(host: PanelHost, entries: GridEntry[], cols: number, rows: number, from: Selection['from']) {
  const c = host.world.char;
  const g = h('div', { class: 'grid', style: { width: `calc(var(--cell) * ${cols})`, height: `calc(var(--cell) * ${rows})` } });
  for (const e of entries) {
    const b = baseOf(e.item);
    const bad = b.kind !== 'potion' && b.kind !== 'gem' && b.kind !== 'scroll' && !!requirementError(c, e.item, host.world.stats);
    g.append(itemTile(host, e.item, { x: e.x, y: e.y, from, bad }));
  }
  return g;
}

function paperDoll(host: PanelHost) {
  const c = host.world.char;
  const doll = h('div', { class: 'doll' });
  for (const s of SLOT_LAYOUT) {
    const it = c.equipment[s.slot];
    const cell = h('div', { class: `slot s-${s.area}` }, it ? itemTile(host, it, { from: 'equip', slot: s.slot }) : h('span', { class: 'slot-l' }, s.label));
    doll.append(cell);
  }
  return doll;
}

function detail(host: PanelHost, context: 'inventory' | 'vendor' | 'stash'): HTMLElement {
  const w = host.world;
  const c = w.char;
  const sel = host.sel;
  const box = h('div', { class: 'detail' });
  if (!sel) {
    box.append(h('div', { class: 'hint' }, context === 'vendor' ? 'Tap an item to buy or sell it.' : context === 'stash' ? 'Tap an item to move it between stash and inventory.' : 'Tap an item to see it.'));
    return box;
  }
  const it: Item | undefined = sel.from === 'vendor'
    ? w.vendors.healer.find((x) => x.uid === sel.uid) ?? w.vendors.smith.find((x) => x.uid === sel.uid)
    : w.findItem(sel.uid)?.item;
  if (!it) {
    box.append(h('div', { class: 'hint' }, 'Tap an item to see it.'));
    return box;
  }
  const item = it;
  const b = baseOf(item);
  const price = sel.from === 'vendor' ? `<div class="gold">Cost: ${buyPrice(item)} gold</div>` : context === 'vendor' && sel.from === 'inv' ? `<div class="gold">Sell value: ${sellPrice(item)} gold</div>` : '';
  const tip = h('div', { class: 'tt', html: itemTooltip(item, c, price) });
  const slot = sel.from === 'equip' ? null : defaultSlot(c, item);
  if (slot) box.append(...compareView(host, item, slot, tip));
  else box.append(tip);
  const btns = h('div', { class: 'acts' });
  const keys = !isTouch();
  for (const a of itemActions(host, sel, context)) {
    btns.append(h('button', { class: `btn ${a.cls ?? ''}`, onclick: () => { a.run(); host.refresh(); } }, a.label, keys && a.key ? h('kbd', {}, a.key) : null));
  }
  if (sel.from === 'inv' && b.kind === 'gem' && !w.socketTargets().length) btns.append(h('div', { class: 'dim small' }, 'No socketed item with free sockets.'));
  box.append(btns);
  return box;
}

const SLOT_NAMES: Record<Slot, string> = {
  head: 'helm', body: 'armor', weapon: 'weapon', offhand: 'shield', gloves: 'gloves', belt: 'belt', boots: 'boots', amulet: 'amulet', ring1: 'left ring', ring2: 'right ring',
};

/** The selected item next to what is worn in its slot, and what swapping would change. */
function compareView(host: PanelHost, item: Item, slot: Slot, tip: HTMLElement): HTMLElement[] {
  const w = host.world;
  const c = w.char;
  const cmp = compareEquip(c, item, slot, w.buffTotals());
  const worn = cmp.replaced.length
    ? cmp.replaced.map((r) => h('div', { class: 'tt', html: itemTooltip(r, c) }))
    : [h('div', { class: 'tt empty' }, `No ${SLOT_NAMES[slot]} equipped`)];
  const sides = h('div', { class: 'cmp' },
    h('div', { class: 'cmp-col' }, h('div', { class: 'cmp-h' }, 'Selected'), tip),
    h('div', { class: 'cmp-col' }, h('div', { class: 'cmp-h' }, `Equipped${slot.startsWith('ring') ? ` (${SLOT_NAMES[slot]})` : ''}`), ...worn));
  const err = requirementError(c, item, w.stats);
  const delta = h('div', { class: 'delta' }, h('div', { class: 'cmp-h' }, 'If you equip it'));
  if (err) delta.append(h('div', { class: 'red small' }, `Can't equip yet: ${err}`));
  else if (!item.identified) delta.append(h('div', { class: 'dim small' }, 'Unidentified: magic properties unknown.'));
  if (!cmp.changes.length) delta.append(h('div', { class: 'dim small' }, 'No change to your stats.'));
  for (const ch of cmp.changes) {
    delta.append(h('div', { class: `drow ${ch.better > 0 ? 'up' : ch.better < 0 ? 'down' : ''}` },
      h('span', { class: 'dl' }, ch.label),
      h('span', { class: 'dv' }, `${ch.before} → `, h('b', {}, ch.after), ` ${ch.better > 0 ? '▲' : ch.better < 0 ? '▼' : ''}`)));
  }
  return [sides, delta];
}

export type ItemContext = 'inventory' | 'vendor' | 'stash';

export interface ItemAction {
  label: string;
  /** Keyboard shortcut (a letter) while the item is hovered or selected. */
  key?: string;
  cls?: string;
  /** The right-click action. */
  primary?: boolean;
  run: () => void;
}

/** Which item actions a panel offers: the inventory, a vendor (healer, smith, gambler) or the stash. */
export function panelItemContext(kind: PanelKind | null): ItemContext | null {
  if (kind === 'inventory') return 'inventory';
  if (kind === 'healer' || kind === 'smith' || kind === 'fence') return 'vendor';
  if (kind === 'stash') return 'stash';
  return null;
}

/** Everything that can be done with an item; shared by the buttons, the keyboard and right-click. */
export function itemActions(host: PanelHost, sel: Selection, context: ItemContext): ItemAction[] {
  const w = host.world;
  const out: ItemAction[] = [];
  const act = (label: string, key: string | undefined, run: () => void, cls = '', primary = false) => out.push({ label, key, run, cls, primary });
  if (sel.from === 'vendor') {
    for (const v of ['healer', 'smith'] as const) {
      const item = w.vendors[v].find((x) => x.uid === sel.uid);
      if (!item) continue;
      act('Buy', 'B', () => {
        const err = w.buy(v, item.uid);
        if (err) host.toast(err, '#ff8a6a');
        else if (!['potion', 'scroll'].includes(baseOf(item).kind)) host.select(null);
      }, 'primary', true);
    }
    return out;
  }
  const found = w.findItem(sel.uid);
  if (!found) return out;
  const item = found.item;
  const b = baseOf(item);
  if (sel.from === 'inv') {
    if (['weapon', 'shield', 'armor', 'helm', 'gloves', 'boots', 'belt', 'ring', 'amulet'].includes(b.kind)) {
      const equip = (slot?: Slot) => {
        const err = w.equip(item.uid, slot);
        if (err) host.toast(err, '#ff8a6a');
        else host.select(null);
      };
      if (b.kind === 'ring') {
        act('Equip Left', 'E', () => equip('ring1'), 'primary', context !== 'vendor');
        act('Equip Right', 'R', () => equip('ring2'), 'primary');
      } else act('Equip', 'E', () => equip(), 'primary', context !== 'vendor');
    }
    if (b.kind === 'potion' || b.kind === 'scroll') act(b.kind === 'potion' ? 'Drink' : 'Read', 'U', () => w.useItem(item.uid) && host.select(null), 'primary', context !== 'vendor');
    if (b.kind === 'gem') {
      w.socketTargets().forEach((t, i) => act(`Socket into ${displayName(t)}`, i === 0 ? 'G' : undefined, () => w.socketGem(item.uid, t.uid) && host.select(null), '', i === 0 && context !== 'vendor'));
    }
    if (context === 'vendor') act(`Sell (${sellPrice(item)})`, 'S', () => { w.sell(item.uid); host.select(null); }, 'gold-btn', true);
    if (context === 'stash') act('To Stash', 'X', () => w.toStash(item.uid) && host.select(null), '', true);
    if (context === 'inventory') act('Drop', 'D', () => { w.dropFromInventory(item.uid); host.select(null); }, 'danger');
  } else if (sel.from === 'equip' && sel.slot) {
    act('Unequip', 'E', () => { const err = w.unequip(sel.slot!); if (err) host.toast(err, '#ff8a6a'); else host.select(null); }, '', true);
  } else if (sel.from === 'stash') {
    act('To Inventory', 'X', () => w.fromStash(item.uid) && host.select(null), 'primary', true);
  }
  return out;
}

export function renderPanel(host: PanelHost, kind: PanelKind): HTMLElement {
  switch (kind) {
    case 'inventory':
      return inventoryPanel(host);
    case 'character':
      return characterPanel(host);
    case 'skills':
      return skillsPanel(host);
    case 'healer':
    case 'smith':
      return vendorPanel(host, kind);
    case 'stash':
      return stashPanel(host);
    case 'waypoint':
      return waypointPanel(host);
    case 'caravan':
      return caravanPanel(host);
    case 'sage':
      return sagePanel(host);
    case 'fence':
      return fencePanel(host);
    case 'menu':
      return menuPanel(host);
    case 'help':
      return helpPanel(host);
  }
}

function goldRow(host: PanelHost) {
  const c = host.world.char;
  return h('div', { class: 'goldrow' }, h('span', { class: 'gold' }, `◉ ${c.gold.toLocaleString()} gold`), h('span', { class: 'dim' }, ` · Town Portal ×${c.tpCharges}`));
}

function gridHeading(host: PanelHost, title: string, entries: GridEntry[], cols: number, rows: number) {
  const sort = () => {
    if (!sortGrid(entries, cols, rows)) host.toast("Couldn't sort these items", '#ff8a6a');
    host.refresh();
  };
  return h('div', { class: 'sub sub-row' }, title, h('button', { class: 'btn tiny', onclick: sort }, 'Sort'));
}

function inventoryPanel(host: PanelHost) {
  const c = host.world.char;
  return h(
    'div',
    { class: 'panel inv' },
    header(host, 'Inventory'),
    h('div', { class: 'p-body two' },
      h('div', { class: 'col' },
        h('div', { class: 'equip-box' }, h('div', { class: 'sub' }, 'Equipped'), paperDoll(host)),
        gridHeading(host, 'Backpack', c.inventory, INV_COLS, INV_ROWS),
        grid(host, c.inventory, INV_COLS, INV_ROWS, 'inv'),
        goldRow(host)),
      detail(host, 'inventory')),
  );
}

function vendorPanel(host: PanelHost, kind: 'healer' | 'smith') {
  const w = host.world;
  const c = w.char;
  const info = w.npcInfo(kind);
  const list = h('div', { class: 'vendor' });
  for (const it of w.vendors[kind]) {
    const b = baseOf(it);
    const sel = host.sel?.uid === it.uid;
    list.append(
      h(
        'button',
        { class: `vrow ${sel ? 'sel' : ''}`, 'data-uid': it.uid, 'data-from': 'vendor', onclick: () => host.select(sel ? null : { uid: it.uid, from: 'vendor' }) },
        h('img', { src: itemIconUrl(it), alt: '', style: { aspectRatio: `${b.w}/${b.h}` } }),
        h('span', { class: 'vname', style: { color: itemColor(it) } }, displayName(it)),
        h('span', { class: `vprice ${c.gold < buyPrice(it) ? 'red' : 'gold'}` }, String(buyPrice(it))),
      ),
    );
  }
  const greet = w.act === 2
    ? kind === 'healer' ? 'Drink. The well is clean again, or clean enough.' : 'Sand makes the keenest edge. Mind your fingers.'
    : kind === 'healer' ? 'Your wounds are mended. Rest a while, friend.' : 'Steel for the brave. Gold for the rest of us.';
  return h(
    'div',
    { class: 'panel vend' },
    header(host, info.name, info.title),
    h('div', { class: 'npc-say' }, greet),
    h('div', { class: 'p-body three' }, h('div', { class: 'col' }, h('div', { class: 'sub' }, 'For sale'), list), h('div', { class: 'col' }, h('div', { class: 'sub' }, 'Your inventory'), grid(host, c.inventory, INV_COLS, INV_ROWS, 'inv'), goldRow(host)), detail(host, 'vendor')),
  );
}

function stashPanel(host: PanelHost) {
  const w = host.world;
  const c = w.char;
  return h(
    'div',
    { class: 'panel stash' },
    header(host, 'Stash'),
    h(
      'div',
      { class: 'p-body stash-body' },
      h('div', { class: 'col' }, gridHeading(host, `Stash · ${c.stashGold.toLocaleString()} gold`, c.stash, STASH_COLS, STASH_ROWS), grid(host, c.stash, STASH_COLS, STASH_ROWS, 'stash'),
        h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => { w.depositGold(); host.refresh(); } }, 'Deposit gold'), h('button', { class: 'btn', onclick: () => { w.withdrawGold(); host.refresh(); } }, 'Withdraw gold'))),
      h('div', { class: 'col' }, gridHeading(host, 'Inventory', c.inventory, INV_COLS, INV_ROWS), grid(host, c.inventory, INV_COLS, INV_ROWS, 'inv'), goldRow(host)),
      detail(host, 'stash'),
    ),
  );
}

function characterPanel(host: PanelHost) {
  const w = host.world;
  const c = w.char;
  const s = w.stats;
  const cls = CLASSES[c.classId];
  const statRow = (label: string, key: 'str' | 'dex' | 'vit' | 'ene', val: number) =>
    h(
      'div',
      { class: 'srow' },
      h('span', { class: 'sl' }, label),
      h('span', { class: `sv ${val > cls[key] + c.alloc[key] ? 'blue' : ''}` }, String(val)),
      c.statPoints > 0 ? h('button', { class: 'plus', 'aria-label': `Add ${label}`, onclick: () => { allocStat(c, key); w.refreshStats(); host.refresh(); } }, '+') : null,
    );
  const kv = (k: string, v: string, cls2 = '') => h('div', { class: 'kv' }, h('span', {}, k), h('span', { class: cls2 }, v));
  const res = (n: string, v: number, col: string) => kv(n, `${v}%`, v < 0 ? 'red' : v >= 75 ? 'gold' : col);
  const lo = Math.floor(s.minDmg);
  const hi = Math.floor(s.maxDmg);
  return h(
    'div',
    { class: 'panel char' },
    header(host, c.name, `Level ${c.level} ${cls.name}${c.hardcore ? ' · Hardcore' : ''}`),
    h(
      'div',
      { class: 'p-body two' },
      h(
        'div',
        { class: 'col' },
        kv('Experience', `${c.xp.toLocaleString()}`),
        kv('Next level', `${Math.round(w.xpProgress * 100)}%`),
        kv('Difficulty', DIFFICULTIES[c.difficulty]),
        h('div', { class: 'sub' }, c.statPoints ? `Stat points: ${c.statPoints}` : 'Attributes'),
        statRow('Strength', 'str', s.str),
        statRow('Dexterity', 'dex', s.dex),
        statRow('Vitality', 'vit', s.vit),
        statRow('Energy', 'ene', s.ene),
        h('div', { class: 'dim small' }, 'Strength boosts melee damage, Dexterity boosts bows, attack rating and defense, Vitality adds life, Energy adds mana.'),
      ),
      h(
        'div',
        { class: 'col' },
        kv('Damage', `${lo}-${hi}${s.fireMax ? ` +${s.fireMin}-${s.fireMax} fire` : ''}${s.coldMax ? ` +${s.coldMin}-${s.coldMax} cold` : ''}${s.lightMax ? ` +${s.lightMin}-${s.lightMax} light` : ''}`),
        kv('Attack Rating', String(s.ar)),
        kv('Attacks / sec', s.attackSpeed.toFixed(2)),
        kv('Defense', String(s.def)),
        kv('Chance to Block', `${s.block}%`),
        kv('Life', `${Math.ceil(w.player.life)} / ${s.maxLife}`, 'red'),
        kv('Mana', `${Math.ceil(w.player.mana)} / ${s.maxMana}`, 'blue'),
        res('Fire Resist', s.res.fire, 'fire'),
        res('Cold Resist', s.res.cold, 'cold'),
        res('Lightning Resist', s.res.light, 'light'),
        res('Poison Resist', s.res.poison, 'poison'),
        s.mf ? kv('Magic Find', `${s.mf}%`) : null,
        s.crit ? kv('Deadly Strike', `${s.crit}%`) : null,
        s.lifeSteal ? kv('Life Steal', `${s.lifeSteal}%`) : null,
        s.skillBonus ? kv('+Skills', `+${s.skillBonus}`) : null,
      ),
    ),
  );
}

function skillsPanel(host: PanelHost) {
  const w = host.world;
  const c = w.char;
  const tiers = new Map<number, ReturnType<typeof classSkills>>();
  for (const s of classSkills(c.classId)) tiers.set(s.reqLevel, [...(tiers.get(s.reqLevel) ?? []), s]);
  const body = h('div', { class: 'skills' });
  for (const [lvl, list] of [...tiers.entries()].sort((a, b) => a[0] - b[0])) {
    const cards = h('div', { class: 'tier-cards' });
    const row = h('div', { class: 'tier' }, h('div', { class: 'tier-l' }, `Lv ${lvl}`), cards);
    for (const s of list) {
      const hard = c.skills[s.id] ?? 0;
      const eff = skillLevel(c, s.id);
      const why = canLearn(c, s);
      const cur = eff > 0 ? s.lines(s.params(eff)) : [];
      const next = s.lines(s.params(Math.max(1, eff + 1)));
      const mana = s.mana(Math.max(1, eff));
      const card = h(
        'div',
        { class: `skill ${hard ? 'known' : ''} ${why && !hard ? 'locked' : ''}` },
        h('img', { src: skillIconUrl(s.id), alt: '' }),
        h(
          'div',
          { class: 'sk-info' },
          h('div', { class: 'sk-name' }, s.name, h('span', { class: 'sk-lvl' }, hard ? ` ${hard}${eff > hard ? ` (+${eff - hard})` : ''}` : '')),
          h('div', { class: 'dim small' }, s.desc + (s.prereq ? ` Requires ${s.prereq.map((p) => SKILL_BY_ID[p].name).join(', ')}.` : '')),
          cur.length ? h('div', { class: 'small' }, h('span', { class: 'dim' }, 'Now: '), cur.join(' · ')) : null,
          h('div', { class: 'small blue' }, h('span', { class: 'dim' }, eff ? 'Next: ' : 'Level 1: '), next.join(' · ')),
          s.kind !== 'passive' ? h('div', { class: 'small dim' }, `Mana: ${Number(mana.toFixed(1))}`) : h('div', { class: 'small dim' }, 'Passive'),
          s.synergies ? h('div', { class: 'small green' }, `Synergy: ${s.synergies.map((x) => `+${x.pct}% per ${SKILL_BY_ID[x.skill].name} level`).join(', ')}`) : null,
          hard && s.kind !== 'passive'
            ? h('div', { class: 'assign' }, h('span', { class: 'dim small' }, 'Slot:'), ...[0, 1, 2, 3].map((i) =>
                h('button', { class: `btn tiny ${c.hotbar[i] === s.id ? 'on' : ''}`, onclick: () => { c.hotbar[i] = s.id; host.refresh(); } }, String(i + 1))))
            : null,
        ),
        h('button', { class: 'plus big', disabled: !!why, title: why ?? 'Learn', 'aria-label': `Learn ${s.name}`, onclick: () => { learnSkill(c, s.id); w.refreshStats(); host.refresh(); } }, '+'),
      );
      cards.append(card);
    }
    body.append(row);
  }
  const attackAssign = h('div', { class: 'assign' }, h('span', { class: 'dim small' }, 'Basic Attack slot:'), ...[0, 1, 2, 3].map((i) =>
    h('button', { class: `btn tiny ${c.hotbar[i] === 'attack' ? 'on' : ''}`, onclick: () => { c.hotbar[i] = 'attack'; host.refresh(); } }, String(i + 1))));
  return h('div', { class: 'panel skl' }, header(host, 'Skills', c.skillPoints ? `${c.skillPoints} point${c.skillPoints > 1 ? 's' : ''} to spend` : undefined), h('div', { class: 'p-body' }, attackAssign, body));
}

function waypointPanel(host: PanelHost) {
  const w = host.world;
  const list = h('div', { class: 'wplist' });
  const acts = new Set(w.waypointList().map((wp) => wp.act)).size;
  let shownAct = 0;
  for (const wp of w.waypointList()) {
    const here = wp.id === w.area.def.id;
    if (acts > 1 && wp.act !== shownAct) list.append(h('div', { class: 'wp-act' }, `Act ${wp.act}`));
    shownAct = wp.act;
    list.append(
      h(
        'button',
        { class: `btn wp ${wp.active ? '' : 'off'} ${here ? 'here' : ''}`, disabled: !wp.active || here, onclick: () => { w.useWaypoint(wp.id); host.close(); } },
        wp.name,
        h('span', { class: 'dim small' }, wp.active ? (AREA_BY_ID[wp.id].alvl ? ` · lvl ${AREA_BY_ID[wp.id].alvl + DIFFICULTY_LEVELS[w.char.difficulty]}` : '') : ' · not found'),
      ),
    );
  }
  return h('div', { class: 'panel wpp' }, header(host, 'Waypoints', DIFFICULTIES[w.char.difficulty]), h('div', { class: 'p-body' }, list));
}

function caravanPanel(host: PanelHost) {
  const w = host.world;
  const info = w.npcInfo('caravan');
  const south = w.act === 1;
  return h(
    'div',
    { class: 'panel caravan' },
    header(host, info.name, info.title),
    h('div', { class: 'npc-say' }, south ? 'South, then? The road is ash for a week, and after that it is glass. Bring water.' : 'Back to the cold country? We leave whenever you say.'),
    h('div', { class: 'p-body' },
      h('button', { class: 'btn primary', onclick: () => { host.close(); w.travelCaravan(); } }, south ? 'Travel to Tel Maresh' : 'Travel to Emberwatch Camp')),
  );
}

function sagePanel(host: PanelHost) {
  const w = host.world;
  const unid = [...w.char.inventory, ...w.char.stash].filter((e) => !e.item.identified).length + Object.values(w.char.equipment).filter((i) => i && !i.identified).length;
  const quests = h('div', { class: 'quests' });
  const info = w.npcInfo('sage');
  for (const q of QUESTS.filter((d) => (d.act ?? 1) === w.act)) {
    const st = w.questState(q.id);
    const status = st === 'rewarded' ? 'Complete' : st === 'done' ? `Return to ${info.name}` : st === 'active' ? 'In progress' : 'Not started';
    const text = st === 'done' || st === 'rewarded' ? q.done : q.intro;
    quests.append(h('div', { class: `quest q-${st}` }, h('div', { class: 'q-name' }, q.name, h('span', { class: 'dim small' }, ` · ${status}`)), h('div', { class: 'small' }, text), h('div', { class: 'small gold' }, `Reward: ${q.reward}`)));
  }
  return h(
    'div',
    { class: 'panel sage' },
    header(host, info.name, info.title),
    h('div', { class: 'npc-say' }, w.act === 2 ? 'The archive survived the glass. Most of what it says, you will not like.' : info.name === 'Wren' ? 'He left in the night. Took his staff and none of his books. He has never done that.' : 'Stay a moment, wanderer. Let an old man share what he knows.'),
    h('div', { class: 'p-body' },
      h('button', { class: 'btn primary', disabled: !unid, onclick: () => { const n = w.identifyAll(); host.toast(n ? `Identified ${n} item${n > 1 ? 's' : ''}` : 'Nothing to identify'); host.refresh(); } }, unid ? `Identify all items (${unid})` : 'Nothing to identify'),
      quests),
  );
}

function fencePanel(host: PanelHost) {
  const w = host.world;
  const c = w.char;
  const list = h('div', { class: 'vendor' });
  const names: Record<string, string> = { ring: 'Ring', amulet: 'Amulet', weapon: 'Weapon', armor: 'Body Armor', helm: 'Helm', shield: 'Shield', gloves: 'Gloves', boots: 'Boots', belt: 'Belt' };
  for (const k of GAMBLE_KINDS) {
    const price = gamblePrice(k, c.level);
    list.append(
      h('button', {
        class: 'vrow', onclick: () => {
          const r = w.gambleBuy(k);
          if (typeof r === 'string') host.toast(r, '#ff8a6a');
          else {
            host.toast(`You got: ${displayName(r)}`, itemColor(r));
            host.select({ uid: r.uid, from: 'inv' });
          }
          host.refresh();
        },
      }, h('span', { class: 'vname' }, `Mystery ${names[k]}`), h('span', { class: `vprice ${c.gold < price ? 'red' : 'gold'}` }, String(price))),
    );
  }
  return h(
    'div',
    { class: 'panel vend' },
    header(host, w.npcInfo('fence').name, w.npcInfo('fence').title),
    h('div', { class: 'npc-say' }, w.act === 2 ? 'The bones have opinions about you. Shall we find out what they are?' : 'Care to try your luck? Every one of these could be a treasure... or not.'),
    h('div', { class: 'p-body three' }, h('div', { class: 'col' }, h('div', { class: 'sub' }, 'Gamble'), list), h('div', { class: 'col' }, h('div', { class: 'sub' }, 'Your inventory'), grid(host, c.inventory, INV_COLS, INV_ROWS, 'inv'), goldRow(host)), detail(host, 'vendor')),
  );
}

function menuPanel(host: PanelHost) {
  const s = host.settings;
  const tog = (k: 'sound' | 'music' | 'weather' | 'screenFx' | 'labels' | 'numbers', label: string) => h('button', { class: `btn ${s[k] ? 'on' : ''}`, onclick: () => { host.toggleSetting(k); host.refresh(); } }, `${label}: ${s[k] ? 'On' : 'Off'}`);
  return h(
    'div',
    { class: 'panel menu' },
    header(host, 'Game Menu'),
    h('div', { class: 'p-body menu-list' },
      h('button', { class: 'btn primary', onclick: () => host.close() }, 'Return to Game'),
      tog('sound', 'Sound'),
      tog('music', 'Music'),
      tog('weather', 'Weather effects'),
      tog('screenFx', 'Shake & flashes'),
      tog('labels', 'Item labels'),
      tog('numbers', 'Damage numbers'),
      h('button', { class: 'btn', onclick: () => host.open('help') }, 'How to Play'),
      h('button', { class: 'btn danger', onclick: () => host.quitToMenu() }, 'Save and Exit')),
  );
}

function helpPanel(host: PanelHost) {
  const rows: [string, string, string][] = [
    ['Move', 'Left-side joystick, or tap the ground', 'Left click / hold'],
    ['Attack', 'Big ⚔ button (auto-targets), or tap a monster', 'Left click a monster'],
    ['Skills', 'Skill buttons around ⚔ (hold to repeat)', 'Right click, or Q W E R'],
    ['Pick up / talk', 'Tap the item label or the context button', 'Click it'],
    ['Potions', 'Tap a potion slot (hold for details)', '1 health, 2 mana, 3 rejuvenation'],
    ['Town Portal', 'Portal button', 'T'],
    ['Panels', 'Bottom buttons', 'I inventory · C character · K skills · M/Tab map'],
    ['Items', 'Tap an item, then a button', 'Hover an item: E equip/unequip · U use · S sell · B buy · D drop · X stash/inventory · G socket. Right-click for the main action'],
  ];
  return h(
    'div',
    { class: 'panel help' },
    header(host, 'How to Play'),
    h('div', { class: 'p-body' },
      h('table', { class: 'help-t' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'Touch'), h('th', {}, 'Mouse / keys')), ...rows.map((r) => h('tr', {}, h('td', {}, r[0]), h('td', {}, r[1]), h('td', {}, r[2])))),
      h('div', { class: 'small', html: [
        'Explore the Cinder Fields east of camp, find waypoints, and push down through the Catacombs to the Hellforge.',
        'Gear drops in <span class="blue">magic</span>, <span class="gold2">rare</span>, <span class="green">set</span> and <span class="uniq">unique</span> qualities. Old Corvin identifies items for free. Insert gems into socketed gear.',
        'Each level grants 5 stat points and 1 skill point. Higher difficulties lower your resistances, so collect resist gear.',
        'Necromancers raise skeletons from fresh corpses: cast Raise Skeleton near a body (or tap its button to use the nearest one). Servants follow you between areas.',
      ].map((t) => `<p>${t}</p>`).join('') }),
      h('button', { class: 'btn', onclick: () => host.open('menu') }, 'Back')),
  );
}

