import { describe, expect, it } from 'vitest';
import type { ClassId } from '../src/game/items';
import { findFlags, median, renderReport, summarize, type Run } from './balance';
import type { AreaReport } from './bot';

const rep = (area: string, o: Partial<AreaReport> = {}): AreaReport => ({
  area, enterLevel: 5, time: 100, deaths: 1, potions: 10, killed: 80, total: 100, bossDead: true, weapon: '-', forged: 0, frozen: 0, braziers: 0, ...o,
});

/** Three areas, one in each act; the last two have bosses. */
const run = (classId: ClassId, seed: number, o: Partial<AreaReport>[] = []): Run => ({
  classId, seed, areas: [rep('cinder_fields', o[0]), rep('noon_vault', o[1]), rep('hellforge_heart', o[2])],
});

const CLASSES: ClassId[] = ['reaver', 'arcanist', 'huntress', 'necromancer', 'forgewright'];
const even = () => CLASSES.flatMap((c) => [run(c, 1), run(c, 2)]);

describe('balance report arithmetic', () => {
  it('takes a median', () => {
    expect(median([])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('averages each class over its runs, area by area', () => {
    const s = summarize([run('reaver', 1, [{ time: 100, deaths: 0, potions: 4, killed: 50 }]), run('reaver', 2, [{ time: 300, deaths: 4, potions: 8, killed: 100 }])]);
    expect(s.classes).toEqual(['reaver']);
    expect(s.seeds).toEqual([1, 2]);
    expect(s.areas).toEqual(['cinder_fields', 'noon_vault', 'hellforge_heart']);
    const c = s.byArea.cinder_fields.reaver!;
    expect(c).toMatchObject({ runs: 2, time: 200, deaths: 2, potions: 6, bossRuns: 0, bossKills: 0 });
    expect(c.ttk).toBeCloseTo(400 / 150);
    // A run that killed nothing does not turn the average into nonsense.
    const stuck = summarize([run('reaver', 1, [{ time: 100, killed: 100 }]), run('reaver', 2, [{ time: 900, killed: 0 }])]);
    expect(stuck.byArea.cinder_fields.reaver!.ttk).toBeCloseTo(10);
    expect(c.cleared).toBeCloseTo(0.75);
  });

  it('totals an act per run, and counts bosses only where there is one', () => {
    const two = (classId: ClassId, seed: number): Run => ({ classId, seed, areas: [rep('cinder_fields'), rep('hollow_cave', { bossDead: seed === 1 }), rep('glass_sea')] });
    const s = summarize([two('huntress', 1), two('huntress', 2)]);
    expect(Object.keys(s.byAct)).toEqual(['1', '2']);
    const a1 = s.byAct[1].huntress!;
    expect(a1).toMatchObject({ runs: 2, time: 200, deaths: 2, potions: 20, bossRuns: 2, bossKills: 1 });
    expect(s.byAct[2].huntress).toMatchObject({ time: 100, bossRuns: 0 });
  });
});

describe('balance flags', () => {
  it('finds nothing wrong with classes that are alike', () => {
    expect(summarize(even()).flags).toEqual([]);
  });

  it('flags a boss the bot could not kill, most important first', () => {
    const runs = even();
    runs.find((r) => r.classId === 'arcanist' && r.seed === 2)!.areas[1].bossDead = false;
    runs.find((r) => r.classId === 'huntress')!.areas[0].time = 400;
    runs.find((r) => r.classId === 'huntress' && r.seed === 2)!.areas[0].time = 400;
    const f = summarize(runs).flags;
    expect(f[0]).toMatchObject({ level: 'high', classId: 'arcanist', where: 'The Noon Vault', text: 'boss survived 1 of 2 runs' });
    expect(f[1]).toMatchObject({ level: 'low', classId: 'huntress', where: 'Cinder Fields' });
    expect(f[1].text).toBe('400s, against a median of 100s');
    expect(f.length).toBe(2);
  });

  it('flags a class that dies or drinks far more than the others, and one that is far safer', () => {
    const runs = CLASSES.map((c) => run(c, 1, [{ deaths: 8, potions: 30 }]));
    runs[1].areas[0].deaths = 40;
    runs[2].areas[0].potions = 90;
    runs[3].areas[0].deaths = 1;
    const f = summarize(runs).flags;
    expect(f.map((x) => `${x.level} ${x.classId} ${x.where}`)).toEqual(['high arcanist Act 1', 'low huntress Act 1', 'low necromancer Act 1']);
    expect(f[0].text).toBe('40 deaths a run, against a median of 8');
    expect(f[1].text).toBe('90 potions a run, against a median of 30');
    expect(f[2].text).toContain('much safer');
  });

  it('does not call a few deaths an imbalance', () => {
    const runs = CLASSES.map((c) => run(c, 1, [{ deaths: 0 }, { deaths: 0 }, { deaths: 0 }]));
    runs[0].areas[0].deaths = 6;
    expect(summarize(runs).flags).toEqual([]);
  });

  it('flags an area left mostly uncleared', () => {
    const runs = even();
    for (const r of runs.filter((x) => x.classId === 'forgewright')) r.areas[2].killed = 30;
    expect(summarize(runs).flags).toEqual([{ level: 'high', classId: 'forgewright', where: "The Hellforge's Heart", text: 'only 30% of the area cleared' }]);
  });

  it('with two classes or fewer there is no median worth comparing against', () => {
    const s = summarize([run('reaver', 1, [{ deaths: 2 }]), run('arcanist', 1, [{ deaths: 90, time: 800 }])]);
    expect(findFlags(s)).toEqual([]);
  });
});

describe('the report', () => {
  it('names the version and seeds, lists the flags, and has a row for every class and area', () => {
    const runs = even();
    runs.find((r) => r.classId === 'arcanist')!.areas[1].bossDead = false;
    const md = renderReport(summarize(runs), '9.9.9');
    expect(md).toContain('version 9.9.9');
    expect(md).toContain('seeds 1, 2');
    expect(md).toContain('- **Arcanist, The Noon Vault**: boss survived 1 of 2 runs');
    for (const act of [1, 2, 3]) expect(md).toContain(`### Act ${act}`);
    expect(md).toContain('| Reaver | 1:40 | 1 | 10 | 1.3s | 80% | 0/0 |');
    expect(md).toContain('| Cinder Fields | 5 | 1:40 / 1 / 10 |');
    expect(md).toMatch(/\| The Noon Vault \| 5 \| 1:40 \/ 1 \/ 10 \| 1:40 \/ 1 \/ 10 † \|/);
    // Every table row has as many cells as its header.
    const tables = md.split('\n').filter((l) => l.startsWith('|'));
    expect(tables.filter((l) => l.split('|').length === 9).length).toBeGreaterThanOrEqual(3 * (CLASSES.length + 2));
  });

  it('says so when nothing stands out', () => {
    expect(renderReport(summarize(even()), '1.0.0')).toContain('Nothing: no class is out of line with the others.');
  });
});
