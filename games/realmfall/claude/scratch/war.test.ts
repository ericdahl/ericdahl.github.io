import { it } from 'vitest';
import { World } from '../src/game/world';
it('war trace', () => {
  const w = new World(1, { headless: true });
  for (let m = 1; m <= 30; m++) {
    w.run(60);
    if (m % 3) continue;
    const ks = w.keeps.map((k) => { const d = w.get(k.doorId); const l = w.get(k.lordId); return `${k.site.name.slice(0,6)}[${k.owner}] d${d ? Math.round(d.hp) : '-'} l${l ? Math.round(l.hp / l.maxHp * 100) : '-'} g${k.guardIds.length}`; }).join(' | ');
    const modes = w.war.bands.map((b) => `${b.realm}${b.mode[0]}${b.members.length}`).join(' ');
    console.log(`t=${m}m ents=${w.list.length} ${ks}\n   ${modes}`);
  }
  console.log(w.war.history.map((h) => `${Math.round(h.t)}s ${w.keeps[h.keep].site.name} ${h.from}->${h.to}`).join('\n'));
}, 200000);
