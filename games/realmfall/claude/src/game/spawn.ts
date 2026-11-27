/** Fills a new world: towns and their people, monster camps, adventurers and the realm war. */
import { REALM_DEFS, siteById, FRONTIER_R, WORLD_R, GATE_R, homeLevel, roadDist } from './geo';
import { MOBS, NAMED, CLASS_IDS, realmName, type MobDef } from './data';
import { Rng } from './rng';
import type { World } from './world';
import type { NpcRole } from './types';

export function populate(w: World) {
  const rng = new Rng(w.seed * 104729 + 7);
  for (const r of REALM_DEFS) {
    const town = siteById(`town${r.id}`);
    // townsfolk
    const roles: [NpcRole, string][] = [
      ['merchant', 'Merchant'],
      ['teleporter', 'Porter'],
      ['healer', 'Healer'],
      ['taskmaster', 'Taskmaster'],
    ];
    roles.forEach(([role, title], i) => {
      const a = town.facing + (i - 1.5) * 0.55;
      const x = town.x + Math.cos(a) * 14, z = town.z + Math.sin(a) * 14;
      const nm = `${realmName(r.id, () => rng.next())} the ${title}`;
      w.add(w.makeNpc(role, nm, r.id, x, z, a + Math.PI));
    });
    for (let i = 0; i < 4; i++) {
      const a = town.facing + Math.PI / 4 + (i * Math.PI) / 2;
      const x = town.x + Math.cos(a) * 52, z = town.z + Math.sin(a) * 52;
      const g = w.makeCombatant('guard', i % 2 ? 'ranger' : 'warden', r.id, 25, x, z, `${r.adjective} Town Guard`, 2.5, 1.8);
      g.ai.post = { x, z, facing: a };
      g.facing = a;
      w.add(g);
    }
    const gate = siteById(`gate${r.id}`);
    w.add(w.makeNpc('gatekeeper', `${realmName(r.id, () => rng.next())} the Gatekeeper`, r.id, gate.x - Math.cos(gate.facing) * 4, gate.z - Math.sin(gate.facing) * 4, gate.facing));

    // monster camps
    const camps: { x: number; z: number }[] = [];
    let tries = 0;
    while (camps.length < 78 && tries++ < 6000) {
      const a = r.angle + rng.range(-1.0, 1.0);
      const rad = rng.range(FRONTIER_R + 60, WORLD_R - 130);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (w.geo.ridge(x, z) > 0.12) continue;
      if (w.geo.height(x, z) < 0.6) continue;
      const dt = Math.hypot(x - town.x, z - town.z);
      if (dt < 85) continue;
      if (Math.hypot(x - gate.x, z - gate.z) < 80) continue;
      if (Math.abs(Math.hypot(x, z) - GATE_R) < 40 && dt > 300) continue;
      if (roadDist(x, z) < 10) continue;
      if (camps.some((c) => Math.hypot(c.x - x, c.z - z) < 40)) continue;
      camps.push({ x, z });
      const lvl = Math.max(1, Math.min(19, homeLevel(dt) + rng.int(-1, 1)));
      const opts = MOBS.filter((m) => m.levels[0] <= lvl && m.levels[1] >= lvl && (!m.realms || m.realms.includes(r.id)));
      if (!opts.length) continue;
      const def: MobDef = rng.weighted(opts, (m) => (m.realms ? 2.2 : 1));
      const named = NAMED.filter((n) => n.mob === def.id && (n.realm === undefined || n.realm === r.id));
      if (named.length && rng.chance(0.07)) {
        const nmd = rng.pick(named);
        if (!w.list.some((e) => e.name === nmd.name)) {
          const m = w.makeMob(def, Math.min(21, lvl + 2), x, z, nmd.name);
          m.respawn = 600;
          w.add(m);
          continue;
        }
      }
      const n = def.social ? rng.int(2, 3) : rng.int(1, 2);
      for (let i = 0; i < n; i++) {
        const mx = x + rng.range(-6, 6), mz = z + rng.range(-6, 6);
        const m = w.makeMob(def, Math.max(def.levels[0], Math.min(def.levels[1], lvl + rng.int(-1, 0))), mx, mz);
        m.respawn = rng.range(45, 90);
        w.add(m);
      }
    }

    // other adventurers of the realm, out levelling
    for (let i = 0; i < 9; i++) {
      const level = 1 + Math.floor((i / 9) * 18) + rng.int(0, 1);
      const cls = rng.pick(CLASS_IDS);
      const a = town.facing + rng.range(-1, 1);
      const d = 60 + (level - 1) * 27;
      const x = town.x + Math.cos(a) * d, z = town.z + Math.sin(a) * d;
      const e = w.makeCombatant('adventurer', cls, r.id, level, x, z, realmName(r.id, () => rng.next()));
      e.ai.mode = 'hunt';
      w.add(e);
    }
  }
  w.war.setup();
}
