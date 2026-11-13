import { ESSENCE_TYPES, INV_COLS, INV_ROWS, type EssenceType } from '../game/character';
import {
  costText, ESSENCE_COLORS, ESSENCE_NAMES, forgePreview, forgeRank, hasEmber, isJunk, itemAffixes, MASTERY_RANKS, masteryProgress,
  materialsText, salvageNeedsConfirm, STRIKE_BONUS,
  type ForgeAction, type ForgePreview,
} from '../game/forge';
import { baseOf, displayName, forgeLevel, isEquipment, itemColor, type Item } from '../game/items';
import { itemIconUrl } from '../render/icons';
import { h, isTouch } from './dom';
import { goldRow, grid, gridHeading, header, paperDoll, type ItemAction, type PanelHost, type Selection } from './panels';
import { itemTooltip } from './tooltip';

/** A forge job as a button: what it costs, and why it can't be done if it can't. */
export interface ForgeUiAction extends ItemAction {
  sub?: string;
  /** Shown instead of the cost; the button still answers with this reason. */
  blocked?: string | null;
}

type Mode = 'temper' | 'quench' | 'seal';

const ui = {
  /** The item the state below belongs to. */
  forUid: 0,
  mode: null as Mode | null,
  /** A risky job waiting for a second press. */
  confirm: '',
  crucible: [] as number[],
  /** The hammer-timing game, while it runs. */
  strike: null as { uid: number; start: number } | null,
  last: null as { text: string; tone: string; say?: { who: 'smith' | 'ember'; text: string } } | null,
  /** The last result has not been shown yet, so a change of selection must not clear it. */
  fresh: false,
};

/** Clears everything left over from the last visit. */
export function resetForgeUi() {
  ui.forUid = 0;
  ui.mode = null;
  ui.confirm = '';
  ui.crucible = [];
  ui.strike = null;
  ui.last = null;
}

// ---------------------------------------------------------------- doing the work

function run(host: PanelHost, a: ForgeAction, prefix = ''): boolean {
  const w = host.world;
  const r = w.forge(a);
  ui.confirm = '';
  if (!r.ok) {
    host.toast(r.error, '#ff8a6a');
    return false;
  }
  ui.last = { text: prefix + r.text, tone: r.tone, say: r.say };
  ui.fresh = true;
  if (a.type === 'smelt') {
    ui.crucible = [];
    if (r.item) host.sel = { uid: r.item.uid, from: 'inv' };
  }
  // Whatever was destroyed can't stay selected.
  if (host.sel && !w.findItem(host.sel.uid)) host.sel = null;
  ui.crucible = ui.crucible.filter((uid) => w.char.inventory.some((e) => e.item.uid === uid));
  return true;
}

/** Runs a job on the second press; the first only arms it. */
function confirmed(host: PanelHost, key: string): boolean {
  if (ui.confirm === key) return true;
  ui.confirm = key;
  host.refresh();
  return false;
}

// ---------------------------------------------------------------- strike timing

/** Seconds for the gauge to cross from one end to the other. */
const SWEEP = 1.6;
const PERFECT = 0.09;
const GOOD = 0.22;

function strikePos(now: number, start: number): number {
  const k = ((now - start) / 1000 / SWEEP) % 2;
  return k < 1 ? k : 2 - k;
}

function strikeQuality(pos: number): number {
  const d = Math.abs(pos - 0.5);
  return d <= PERFECT ? 1 : d <= GOOD ? 0.5 : 0;
}

function finishStrike(host: PanelHost, quality: number, skipped = false) {
  const st = ui.strike;
  if (!st) return;
  ui.strike = null;
  run(host, { type: 'heat', uid: st.uid, strike: quality }, skipped ? '' : quality >= 1 ? 'A perfect strike! ' : quality > 0 ? 'A good strike. ' : 'A cold strike, no bonus. ');
  host.refresh();
}

function strikeView(host: PanelHost): HTMLElement {
  const st = ui.strike!;
  const marker = h('div', { class: 'strike-marker' });
  const ingot = h('div', { class: 'strike-ingot' });
  const status = h('div', { class: 'strike-status' }, 'Heating...');
  const bar = h('div', { class: 'strike-bar', role: 'img', 'aria-label': 'Heat gauge. Strike while the marker is inside the white band in the middle.' },
    h('div', { class: 'strike-zone good' }), h('div', { class: 'strike-zone perfect' }), marker);
  const hit = (e: Event) => {
    e.preventDefault();
    finishStrike(host, strikeQuality(strikePos(performance.now(), st.start)));
  };
  let zone = '';
  const tick = () => {
    if (!bar.isConnected || ui.strike !== st) return;
    const pos = strikePos(performance.now(), st.start);
    const q = strikeQuality(pos);
    const heat = 1 - Math.abs(pos - 0.5) * 2;
    marker.style.left = `${pos * 100}%`;
    ingot.style.background = `rgb(${Math.round(90 + 165 * heat)},${Math.round(20 + 225 * heat * heat)},${Math.round(10 + 215 * heat ** 4)})`;
    ingot.style.boxShadow = `0 0 ${Math.round(22 * heat)}px rgba(255,${Math.round(120 + 120 * heat)},80,${heat.toFixed(2)})`;
    const z = q >= 1 ? 'white' : q > 0 ? 'bright' : 'dull';
    if (z !== zone) {
      zone = z;
      bar.dataset.zone = z;
      status.textContent = z === 'white' ? 'WHITE-HOT: strike now!' : z === 'bright' ? 'Glowing yellow...' : 'Dull red...';
      status.className = `strike-status z-${z}`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return h('div', { class: 'strike' },
    h('div', { class: 'small' }, `Strike while the metal glows white: up to +${STRIKE_BONUS}% to the chance. A poor strike costs nothing.`),
    ingot, bar, h('div', { class: 'strike-labels small dim', 'aria-hidden': 'true' }, h('span', {}, 'dull'), h('span', {}, 'white-hot'), h('span', {}, 'dull')),
    status,
    h('div', { class: 'acts' },
      h('button', { class: 'btn primary big strike-btn', onpointerdown: hit, onclick: hit }, 'Strike!', isTouch() ? null : h('kbd', {}, 'Space')),
      h('button', { class: 'btn', onclick: () => finishStrike(host, 0, true) }, 'Skip (no bonus)')));
}

// ---------------------------------------------------------------- actions

function oddsText(p: ForgePreview, hardcore: boolean): string {
  const o = p.odds!;
  if (o.success >= 100) return 'cannot fail';
  return `${o.success}% success, ${o.crack}% crack (-1 level)${hardcore && o.shatter ? `, ${o.shatter}% SHATTER` : ''}`;
}

/** Everything the forge can do with the selected item; shared by the buttons and the keyboard. */
export function forgeActions(host: PanelHost, sel: Selection): ForgeUiAction[] {
  const w = host.world;
  const c = w.char;
  const found = w.findItem(sel.uid);
  const out: ForgeUiAction[] = [];
  if (!found || found.where === 'stash' || ui.strike) return out;
  const item = found.item;
  const b = baseOf(item);
  if (!isEquipment(b)) return out;
  const uid = item.uid;
  const add = (label: string, key: string, p: ForgePreview, go: () => void, extra: Partial<ForgeUiAction> = {}) =>
    out.push({
      label, key, sub: p.error ? undefined : costText(p.cost), blocked: p.error,
      run: () => {
        // A shortcut pressed over an item that isn't selected works on that item, so select it.
        if (host.sel?.uid !== uid) host.sel = sel;
        if (ui.forUid !== uid) {
          ui.forUid = uid;
          ui.mode = null;
          ui.confirm = '';
        }
        if (p.error) return host.toast(p.error, '#ff8a6a');
        go();
      },
      ...extra,
    });
  const setMode = (m: Mode) => () => {
    ui.mode = m;
    ui.confirm = '';
  };
  const affixes = itemAffixes(item);

  if (b.minDmg !== undefined || b.defMin !== undefined) {
    const p = forgePreview(c, { type: 'heat', uid });
    const risky = !!p.odds && p.odds.shatter > 0;
    const armed = ui.confirm === `heat:${uid}`;
    add(armed ? 'Heat: it may SHATTER. Sure?' : `Heat${p.odds ? ` to +${p.odds.target}` : ''}`, 'H', p, () => {
      if (risky && !confirmed(host, `heat:${uid}`)) return;
      run(host, { type: 'heat', uid });
    }, { cls: armed ? 'danger' : 'primary', sub: p.error ? undefined : `${costText(p.cost)} · ${oddsText(p, c.hardcore)}` });
    if (!p.error && p.odds!.success < 100) {
      const best = forgePreview(c, { type: 'heat', uid, strike: 1 }).odds!;
      add('Strike by hand', 'J', p, () => {
        if (risky && !confirmed(host, `strike:${uid}`)) return;
        ui.strike = { uid, start: performance.now() };
      }, { sub: ui.confirm === `strike:${uid}` ? 'It may SHATTER. Press again to go on' : `Time the hammer blow: up to ${best.success}% success` });
    }
  }
  if (affixes.length) {
    add('Temper', 'T', { cost: { gold: 0, cinders: 0, essences: {} }, error: null }, setMode('temper'), { sub: 'Re-roll one affix of your choice' });
  }
  add('Quench', 'Q', { cost: { gold: 0, cinders: 0, essences: {} }, error: null }, setMode('quench'), { sub: b.kind === 'weapon' ? 'Add or convert elemental damage' : 'Add or convert an elemental resistance' });
  if (affixes.length) {
    const p = forgePreview(c, { type: 'seal', uid, affix: affixes.findIndex((g) => !g.quenched && !g.sealed) });
    const locked = p.error?.startsWith('Requires') || p.error?.startsWith('An item') ? p.error : null;
    add('Ember-Seal', 'L', { cost: p.cost, error: locked }, setMode('seal'), { sub: locked ? undefined : `Lock one affix against tempering · ${costText(p.cost)}` });
  }
  if (b.maxSockets) add('Punch a socket', 'P', forgePreview(c, { type: 'punch', uid }), () => run(host, { type: 'punch', uid }));
  if (found.where === 'inventory') {
    const inCru = ui.crucible.includes(uid);
    add(inCru ? 'Take out of crucible' : 'Add to crucible', 'M', { cost: { gold: 0, cinders: 0, essences: {} }, error: !inCru && ui.crucible.length >= 3 ? 'The crucible holds three items' : null }, () => {
      ui.crucible = inCru ? ui.crucible.filter((x) => x !== uid) : [...ui.crucible, uid];
    }, { sub: 'Smelt 3 of one type and rarity into a better one' });
    const p = forgePreview(c, { type: 'salvage', uid });
    const armed = ui.confirm === `salvage:${uid}`;
    add(armed ? 'Really salvage it?' : 'Salvage', 'S', p, () => {
      if (salvageNeedsConfirm(item) && !confirmed(host, `salvage:${uid}`)) return;
      ui.crucible = ui.crucible.filter((x) => x !== uid);
      run(host, { type: 'salvage', uid });
    }, { cls: 'danger', sub: p.yield ? `Destroys it for ${materialsText(p.yield)}${item.rarity !== 'normal' ? ' and maybe more Essence' : ''}` : undefined });
  }
  return out;
}

interface Option {
  label: string;
  color?: string;
  preview: ForgePreview;
  go: () => void;
}

/** The choices of the open sub-menu: which affix to temper or seal, which essence to quench in. */
function modeOptions(host: PanelHost, item: Item): Option[] {
  const c = host.world.char;
  const uid = item.uid;
  if (ui.mode === 'quench') {
    return ESSENCE_TYPES.map((e) => {
      const preview = forgePreview(c, { type: 'quench', uid, element: e });
      return { label: `${ESSENCE_NAMES[e]} Essence (you have ${c.forge.essences[e]})`, color: ESSENCE_COLORS[e], preview, go: () => run(host, { type: 'quench', uid, element: e }) };
    });
  }
  const type = ui.mode === 'seal' ? 'seal' : 'temper';
  return itemAffixes(item).map((g, i) => {
    const preview = forgePreview(c, { type, uid, affix: i });
    return {
      label: `${g.sealed ? '❂ ' : ''}${g.text}`, preview,
      go: () => {
        if (type === 'seal' && !confirmed(host, `seal:${uid}:${i}`)) return;
        if (run(host, { type, uid, affix: i }) && type === 'seal') ui.mode = null;
      },
    };
  });
}

function runOption(host: PanelHost, o: Option) {
  if (o.preview.error) host.toast(o.preview.error, '#ff8a6a');
  else o.go();
  host.refresh();
}

const MODE_TITLES: Record<Mode, string> = {
  temper: 'Temper: choose the affix to re-roll',
  quench: 'Quench: choose an essence',
  seal: 'Ember-Seal: choose the affix to lock',
};

function modeView(host: PanelHost, item: Item): HTMLElement {
  const keys = !isTouch();
  const list = h('div', { class: 'forge-opts' });
  modeOptions(host, item).forEach((o, i) => {
    const armed = ui.confirm === `seal:${item.uid}:${i}`;
    list.append(h('button', { class: `btn fact${o.preview.error ? ' off' : ''}${armed ? ' danger' : ''}`, 'aria-disabled': o.preview.error ? 'true' : undefined, onclick: () => runOption(host, o) },
      h('span', { class: 'fa-name', style: o.color ? { color: o.color } : undefined }, armed ? `Seal "${o.label}" for good?` : o.label, keys ? h('kbd', {}, String(i + 1)) : null),
      o.preview.note ? h('span', { class: 'fa-sub' }, o.preview.note) : null,
      h('span', { class: `fa-sub ${o.preview.error ? 'red' : 'gold'}` }, o.preview.error ?? costText(o.preview.cost))));
  });
  return h('div', { class: 'forge-mode' },
    h('div', { class: 'sub' }, MODE_TITLES[ui.mode!]),
    list,
    h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => { ui.mode = null; ui.confirm = ''; host.refresh(); } }, 'Back', keys ? h('kbd', {}, 'Esc') : null)));
}

/** Keys the forge takes before the rest of the game sees them. Returns whether the key was used. */
export function forgeKey(host: PanelHost, e: KeyboardEvent): boolean {
  if (ui.strike) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!e.repeat) finishStrike(host, strikeQuality(strikePos(performance.now(), ui.strike.start)));
      return true;
    }
    if (e.code === 'Escape') {
      ui.strike = null;
      host.refresh();
      return true;
    }
    // Nothing else should happen mid-swing.
    return /^(Key|Digit)/.test(e.code);
  }
  if (!ui.mode) return false;
  if (e.code === 'Escape') {
    ui.mode = null;
    ui.confirm = '';
    host.refresh();
    return true;
  }
  const n = /^Digit([1-9])$/.exec(e.code);
  const item = host.sel && host.world.findItem(host.sel.uid)?.item;
  if (!n || !item) return false;
  const o = modeOptions(host, item)[Number(n[1]) - 1];
  if (o && !e.repeat) runOption(host, o);
  return true;
}

// ---------------------------------------------------------------- the panel

function resultBox(): HTMLElement | null {
  const l = ui.last;
  if (!l) return null;
  return h('div', { class: `forge-result t-${l.tone}`, role: 'status', 'aria-live': 'polite' },
    h('div', {}, l.text),
    l.say ? h('div', { class: `forge-say by-${l.say.who}` }, `"${l.say.text}"`, h('span', { class: 'dim' }, l.say.who === 'ember' ? " - Vhorza's ember" : ' - the smith')) : null);
}

function forgeDetail(host: PanelHost): HTMLElement {
  const w = host.world;
  const c = w.char;
  const box = h('div', { class: 'detail forge-detail' });
  const res = resultBox();
  if (res) box.append(res);
  const found = host.sel ? w.findItem(host.sel.uid) : null;
  if (!found) {
    box.append(h('div', { class: 'hint' }, 'Tap an item you wear or carry to work on it.'),
      h('div', { class: 'small forge-help', html: [
        '<b>Salvage</b> breaks an item into Cinders. Magic and better items also give Essences, by their element.',
        '<b>Heat</b> adds a forge level (to +10): each is +4% base damage or defense. From +6 it can fail and crack the item back a level.',
        '<b>Temper</b> re-rolls one affix you choose. <b>Quench</b> adds or converts an elemental affix. <b>Ember-Seal</b> locks an affix against tempering.',
        '<b>Smelt</b> turns three items of one type and rarity into one of the next rarity.',
      ].map((t) => `<p>${t}</p>`).join('') }));
    return box;
  }
  const item = found.item;
  box.append(h('div', { class: 'tt', html: itemTooltip(item, c) }));
  if (!isEquipment(baseOf(item))) {
    box.append(h('div', { class: 'hint' }, 'The forge works weapons, armor and jewelry.'));
    return box;
  }
  if (!item.identified) box.append(h('div', { class: 'dim small', style: { textAlign: 'center' } }, 'Unidentified: it can only be salvaged until the sage has seen it.'));
  if (ui.strike) {
    box.append(strikeView(host));
    return box;
  }
  if (ui.mode) {
    box.append(modeView(host, item));
    return box;
  }
  const keys = !isTouch();
  const acts = h('div', { class: 'acts forge-acts' });
  for (const a of forgeActions(host, host.sel!)) {
    acts.append(h('button', { class: `btn fact ${a.cls ?? ''}${a.blocked ? ' off' : ''}`, 'aria-disabled': a.blocked ? 'true' : undefined, onclick: () => { a.run(); host.refresh(); } },
      h('span', { class: 'fa-name' }, a.label, keys && a.key ? h('kbd', {}, a.key) : null),
      a.blocked ? h('span', { class: 'fa-sub red' }, a.blocked) : a.sub ? h('span', { class: 'fa-sub' }, a.sub) : null));
  }
  box.append(acts);
  return box;
}

function materials(host: PanelHost): HTMLElement {
  const c = host.world.char;
  const rank = forgeRank(c);
  const next = MASTERY_RANKS[rank + 1];
  const teaches = MASTERY_RANKS.slice(rank + 1).find((r) => r.unlock);
  return h('div', { class: 'forge-mats' },
    h('div', { class: 'mats' },
      h('span', { class: 'mat cinders', title: 'Cinders: from salvaging any item' }, h('i', {}), `${c.forge.cinders} Cinders`),
      ...ESSENCE_TYPES.map((e: EssenceType) => h('span', { class: 'mat', title: `${ESSENCE_NAMES[e]} Essence: from salvaging magic items`, style: { color: ESSENCE_COLORS[e] } }, h('i', { style: { background: ESSENCE_COLORS[e] } }), `${c.forge.essences[e]} ${ESSENCE_NAMES[e]}`))),
    h('div', { class: 'mastery small' },
      h('span', {}, 'Forge mastery: ', h('b', { class: 'gold' }, MASTERY_RANKS[rank].name)),
      h('span', { class: 'mbar', role: 'progressbar', 'aria-valuenow': Math.round(masteryProgress(c) * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: { width: `${masteryProgress(c) * 100}%` } })),
      h('span', { class: 'dim' }, next ? `${c.forge.xp}/${next.xp}${teaches ? ` · ${teaches.name}: ${teaches.unlock}` : ''}` : 'the fire has nothing left to teach')));
}

function crucible(host: PanelHost): HTMLElement {
  const w = host.world;
  const c = w.char;
  const slots = h('div', { class: 'cru-slots' });
  for (let i = 0; i < 3; i++) {
    const it = c.inventory.find((e) => e.item.uid === ui.crucible[i])?.item;
    slots.append(it
      ? h('button', { class: 'cru-slot full', title: `${displayName(it)} (tap to take out)`, 'aria-label': `Take ${displayName(it)} out of the crucible`, style: { borderColor: itemColor(it) }, onclick: () => { ui.crucible = ui.crucible.filter((x) => x !== it.uid); host.refresh(); } }, h('img', { src: itemIconUrl(it), alt: '' }))
      : h('div', { class: 'cru-slot' }));
  }
  const p = forgePreview(c, { type: 'smelt', uids: ui.crucible });
  const full = ui.crucible.length === 3;
  const junk = c.inventory.filter((e) => isJunk(e.item)).length;
  return h('div', { class: 'crucible' },
    h('div', { class: 'cru-row' },
      slots,
      h('div', { class: 'cru-info small' },
        h('div', { class: full && p.error ? 'red' : 'dim' }, full ? p.error ?? `${p.note}. ${costText(p.cost)}` : 'Crucible: add three items of one type and rarity.'),
        h('button', { class: 'btn primary', disabled: !full || !!p.error, onclick: () => { run(host, { type: 'smelt', uids: ui.crucible }); host.refresh(); } }, 'Smelt'))),
    h('button', { class: 'btn', disabled: !junk, onclick: () => { run(host, { type: 'salvageJunk' }); host.refresh(); } }, junk ? `Salvage all ${junk} plain item${junk > 1 ? 's' : ''}` : 'No plain items to salvage'));
}

export function forgePanel(host: PanelHost): HTMLElement {
  const w = host.world;
  const c = w.char;
  const uid = host.sel?.uid ?? 0;
  if (ui.forUid !== uid) {
    ui.forUid = uid;
    ui.mode = null;
    ui.confirm = '';
    ui.strike = null;
    // A result belongs to the item it happened to: picking another one clears it.
    if (!ui.fresh) ui.last = null;
  }
  ui.fresh = false;
  ui.crucible = ui.crucible.filter((x) => c.inventory.some((e) => e.item.uid === x));
  const info = w.npcInfo('smith');
  const ember = hasEmber(c);
  const greet = ember
    ? 'The ember in your hand leans toward the coals, and they burn white. She is watching the work.'
    : w.act === 3 ? '"It is the one warm corner left in Emberwatch. Use it."' : w.act === 2 ? '"Glass or steel, it all wants the same thing: heat, and a steady hand."' : '"The forge is yours. Break what you do not need. Feed the rest to the fire."';
  const backpack = grid(host, c.inventory, INV_COLS, INV_ROWS, 'inv');
  const doll = paperDoll(host);
  for (const root of [backpack, doll]) {
    root.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => {
      if (ui.crucible.includes(Number(el.dataset.uid))) el.classList.add('in-cru');
    });
  }
  const panel = h('div', { class: `panel forge${ember ? ' lit' : ''}` },
    header(host, 'The Forge', `${info.name} · ${info.title}`),
    h('div', { class: 'npc-say' }, greet),
    h('div', { class: 'p-body two' },
      h('div', { class: 'col' },
        materials(host),
        h('div', { class: 'equip-box' }, h('div', { class: 'sub' }, 'Equipped'), doll),
        gridHeading(host, 'Backpack', c.inventory, INV_COLS, INV_ROWS),
        backpack,
        crucible(host),
        goldRow(host)),
      forgeDetail(host)));
  // On a phone the whole panel scrolls as one: keep an open sub-menu or the timing game in view.
  if (ui.mode || ui.strike) queueMicrotask(() => panel.querySelector('.forge-mode, .strike')?.scrollIntoView({ block: 'nearest' }));
  return panel;
}

/** A "+7" badge for an item tile, with sparks from +7 up. */
export function forgeBadge(item: Item): HTMLElement | null {
  const lvl = forgeLevel(item);
  if (!lvl) return null;
  return h('span', { class: `fplus${lvl >= 7 ? ' hot' : lvl >= 4 ? ' warm' : ''}` }, `+${lvl}`);
}
