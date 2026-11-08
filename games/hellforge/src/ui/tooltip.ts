import { computeStats, equippedItems, requirementError, type Character } from '../game/character';
import {
  baseOf, describeMods, displayName, gemMods, itemColor, itemDefense, modTotal, SET_BY_ID, type Item, type Mod,
} from '../game/items';
import { esc } from './dom';

/** HTML description of an item, in the classic tooltip style. */
export function itemTooltip(item: Item, c: Character, extra?: string): string {
  const b = baseOf(item);
  const lines: string[] = [];
  const col = itemColor(item);
  lines.push(`<div class="tt-name" style="color:${col}">${esc(displayName(item))}</div>`);
  if (item.identified && (item.rarity === 'unique' || item.rarity === 'set' || item.rarity === 'rare'))
    lines.push(`<div style="color:${col}">${esc(b.name)}</div>`);
  if (b.kind === 'weapon') {
    const ed = item.identified ? modTotal(item, 'edPct') : 0;
    const mn = Math.floor(b.minDmg! * (1 + ed / 100)) + (item.identified ? modTotal(item, 'minDmg') : 0);
    const mx = Math.floor(b.maxDmg! * (1 + ed / 100)) + (item.identified ? modTotal(item, 'maxDmg') : 0);
    lines.push(`<div>${b.twoHanded ? 'Two-Hand' : 'One-Hand'} Damage: <span class="${ed ? 'blue' : ''}">${mn} to ${mx}</span></div>`);
    lines.push(`<div class="dim">${speedName(b.speed!)} attack speed${b.cat === 'bow' ? ' · ranged' : ''}</div>`);
  }
  if (b.defMin !== undefined) {
    const d = itemDefense(item);
    lines.push(`<div>Defense: <span class="${d !== item.def ? 'blue' : ''}">${d}</span></div>`);
  }
  if (b.block) lines.push(`<div>Chance to Block: ${b.block}%</div>`);
  if (b.potionCap) lines.push(`<div class="dim">Potions carried per type: ${b.potionCap}</div>`);
  if (b.potion) {
    const p = b.potion;
    lines.push(`<div>${p.type === 'rejuv' ? `Restores ${p.amount}% of Life and Mana` : `Restores ${p.amount} ${p.type === 'hp' ? 'Life' : 'Mana'}`}</div>`);
  }
  if (b.gem) {
    lines.push(`<div class="dim">Can be inserted into socketed items</div>`);
    for (const host of [['weapon', 'Weapons'], ['helm', 'Armor/Helms'], ['shield', 'Shields']] as const)
      lines.push(`<div><span class="dim">${host[1]}:</span> ${describeMods(gemMods(b.id, host[0])).map(esc).join(', ')}</div>`);
  }
  if (b.kind === 'scroll') lines.push('<div>Adds a Town Portal charge</div>');
  const stats = computeStats(c);
  const req = (ok: boolean, t: string) => `<div class="${ok ? '' : 'red'}">${t}</div>`;
  if (b.reqStr) lines.push(req(stats.str >= b.reqStr, `Required Strength: ${b.reqStr}`));
  if (b.reqDex) lines.push(req(stats.dex >= b.reqDex, `Required Dexterity: ${b.reqDex}`));
  if (item.reqLvl > 1) lines.push(req(c.level >= item.reqLvl, `Required Level: ${item.reqLvl}`));
  if (!item.identified) lines.push('<div class="red">Unidentified</div>');
  else {
    for (const m of modLines(item.mods, c)) lines.push(`<div class="${m.wasted ? 'dim' : 'blue'}">${esc(m.text)}</div>`);
    for (const g of item.gems) lines.push(`<div class="blue">${esc(describeMods(gemMods(g, b.kind)).join(', '))} <span class="dim">(${esc(baseOf(g).name)})</span></div>`);
  }
  if (item.sockets) lines.push(`<div class="gray">Socketed (${item.gems.length}/${item.sockets})</div>`);
  if (item.setId && item.identified) {
    const set = SET_BY_ID[item.setId];
    const worn = new Set(equippedItems(c).filter((i) => i.setId === item.setId && i.identified).map((i) => i.uniqueId));
    lines.push(`<div class="set-title">${esc(set.name)}</div>`);
    for (const p of set.pieces) lines.push(`<div class="${worn.has(p.id) ? 'green' : 'dim'}">${esc(p.name)}</div>`);
    for (const [n, mods] of Object.entries(set.bonuses))
      lines.push(`<div class="${worn.size >= Number(n) ? 'green' : 'dim'}">(${n} items) ${esc(modLines(mods, c).map((m) => m.text).join(', '))}</div>`);
  }
  const err = b.kind !== 'potion' && b.kind !== 'gem' && b.kind !== 'scroll' ? requirementError(c, item) : null;
  if (err) lines.push(`<div class="red small">${esc(err)}</div>`);
  if (extra) lines.push(extra);
  return lines.join('');
}

/** Mod text for this hero, flagging another class's skill bonus, which does nothing for them. */
function modLines(mods: Mod[], c: Character): { text: string; wasted: boolean }[] {
  const wasted = new Set(describeMods(mods.filter((md) => md.stat.startsWith('skills_') && md.stat !== `skills_${c.classId}`)));
  return describeMods(mods).map((text) => (wasted.has(text) ? { text: `${text} (no effect)`, wasted: true } : { text, wasted: false }));
}

function speedName(s: number): string {
  if (s >= 1.7) return 'Very fast';
  if (s >= 1.45) return 'Fast';
  if (s >= 1.25) return 'Normal';
  return 'Slow';
}
