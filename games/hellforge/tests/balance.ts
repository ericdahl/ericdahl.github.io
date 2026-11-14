import { AREA_BY_ID, areaAct } from '../src/game/areas';
import type { ClassId } from '../src/game/items';
import type { AreaReport } from './bot';

/**
 * Balance report: what the playthrough bot's runs say about how the classes compare.
 * `npm run balance` plays every class through all three acts on a few seeds and writes BALANCE.md.
 * Everything here is arithmetic on the bot's per-area reports, so it can be tested without playing.
 */

export interface Run {
  classId: ClassId;
  seed: number;
  areas: AreaReport[];
}

/** One class in one area (or one act), averaged over its runs. */
export interface Cell {
  runs: number;
  /** Seconds in the area. */
  time: number;
  deaths: number;
  potions: number;
  /** Seconds per monster killed: the bot's time-to-kill. */
  ttk: number;
  /** Share of the area's monsters killed, 0 to 1. */
  cleared: number;
  /** Hero level on the way in. */
  level: number;
  /** Runs in which the area's boss died, and runs in which there was one. */
  bossKills: number;
  bossRuns: number;
}

export interface Flag {
  /** How much it matters: a boss the bot cannot kill is worse than a slow area. */
  level: 'high' | 'low';
  classId: ClassId;
  where: string;
  text: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const hasBoss = (area: string) => !!AREA_BY_ID[area]?.superUnique;

function cell(reports: AreaReport[]): Cell {
  const boss = reports.filter((r) => hasBoss(r.area));
  return {
    runs: reports.length,
    time: mean(reports.map((r) => r.time)),
    deaths: mean(reports.map((r) => r.deaths)),
    potions: mean(reports.map((r) => r.potions)),
    // All the time over all the kills: one run where the bot got stuck and killed almost nothing must not swamp the rest.
    ttk: reports.reduce((n, r) => n + r.time, 0) / Math.max(1, reports.reduce((n, r) => n + r.killed, 0)),
    cleared: mean(reports.map((r) => r.killed / Math.max(1, r.total))),
    level: mean(reports.map((r) => r.enterLevel)),
    bossKills: boss.filter((r) => r.bossDead).length,
    bossRuns: boss.length,
  };
}

export interface Summary {
  classes: ClassId[];
  areas: string[];
  seeds: number[];
  /** byArea[area][class] */
  byArea: Record<string, Partial<Record<ClassId, Cell>>>;
  /** byAct[act][class]: time, deaths and potions are totals for the act; the rest are averages. */
  byAct: Record<number, Partial<Record<ClassId, Cell>>>;
  flags: Flag[];
}

export function summarize(runs: Run[]): Summary {
  const classes = [...new Set(runs.map((r) => r.classId))];
  const areas = [...new Set(runs.flatMap((r) => r.areas.map((a) => a.area)))];
  const seeds = [...new Set(runs.map((r) => r.seed))];
  const byArea: Summary['byArea'] = {};
  const byAct: Summary['byAct'] = {};
  for (const area of areas) {
    byArea[area] = {};
    for (const c of classes) {
      const reps = runs.filter((r) => r.classId === c).flatMap((r) => r.areas.filter((a) => a.area === area));
      if (reps.length) byArea[area][c] = cell(reps);
    }
  }
  for (const act of [1, 2, 3]) {
    const inAct = areas.filter((a) => areaAct(AREA_BY_ID[a]) === act);
    if (!inAct.length) continue;
    byAct[act] = {};
    for (const c of classes) {
      const mine = runs.filter((r) => r.classId === c);
      const reps = mine.flatMap((r) => r.areas.filter((a) => inAct.includes(a.area)));
      if (!reps.length) continue;
      const avg = cell(reps);
      const perRun = (f: (r: AreaReport) => number) => mean(mine.map((r) => r.areas.filter((a) => inAct.includes(a.area)).reduce((n, a) => n + f(a), 0)));
      byAct[act][c] = { ...avg, runs: mine.length, time: perRun((r) => r.time), deaths: perRun((r) => r.deaths), potions: perRun((r) => r.potions) };
    }
  }
  return { classes, areas, seeds, byArea, byAct, flags: findFlags({ classes, areas, byArea, byAct }) };
}

/**
 * What stands out. A class is flagged against the median of the classes, so the report says
 * who is out of line with the others, not whether the game as a whole is hard.
 */
export function findFlags(s: Pick<Summary, 'classes' | 'areas' | 'byArea' | 'byAct'>): Flag[] {
  const flags: Flag[] = [];
  for (const area of s.areas) {
    const name = AREA_BY_ID[area]?.name ?? area;
    const cells = s.byArea[area];
    const medTime = median(s.classes.map((c) => cells[c]?.time ?? 0).filter(Boolean));
    for (const c of s.classes) {
      const x = cells[c];
      if (!x) continue;
      if (x.bossRuns && x.bossKills < x.bossRuns) {
        flags.push({ level: 'high', classId: c, where: name, text: `boss survived ${x.bossRuns - x.bossKills} of ${x.bossRuns} runs` });
      }
      if (x.cleared < 0.6) flags.push({ level: 'high', classId: c, where: name, text: `only ${Math.round(x.cleared * 100)}% of the area cleared` });
      if (s.classes.length > 2 && medTime > 0 && x.time > medTime * 1.75 && x.time - medTime > 60) {
        flags.push({ level: 'low', classId: c, where: name, text: `${Math.round(x.time)}s, against a median of ${Math.round(medTime)}s` });
      }
    }
  }
  for (const [act, cells] of Object.entries(s.byAct)) {
    const medDeaths = median(s.classes.map((c) => cells[c]?.deaths ?? 0));
    const medPots = median(s.classes.map((c) => cells[c]?.potions ?? 0));
    for (const c of s.classes) {
      const x = cells[c];
      if (!x || s.classes.length < 3) continue;
      if (x.deaths > Math.max(10, medDeaths * 2)) {
        flags.push({ level: 'high', classId: c, where: `Act ${act}`, text: `${Math.round(x.deaths)} deaths a run, against a median of ${Math.round(medDeaths)}` });
      } else if (medDeaths >= 6 && x.deaths < medDeaths / 3) {
        flags.push({ level: 'low', classId: c, where: `Act ${act}`, text: `${Math.round(x.deaths)} deaths a run, against a median of ${Math.round(medDeaths)}: much safer than the rest` });
      }
      if (x.potions > Math.max(40, medPots * 2)) {
        flags.push({ level: 'low', classId: c, where: `Act ${act}`, text: `${Math.round(x.potions)} potions a run, against a median of ${Math.round(medPots)}` });
      }
    }
  }
  return flags.sort((a, b) => (a.level === b.level ? 0 : a.level === 'high' ? -1 : 1));
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const n1 = (x: number) => (x >= 10 || Number.isInteger(x) ? String(Math.round(x)) : x.toFixed(1));

/** The report as Markdown. `version` is the game version it was made from. */
export function renderReport(s: Summary, version: string): string {
  const out: string[] = [];
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
  out.push('# Hellforge balance report', '');
  out.push(`Made by \`npm run balance\` from version ${version}: the playthrough bot (\`tests/bot.ts\`) plays every class through all three acts on Normal, on seeds ${s.seeds.join(', ')}, and the numbers below are averages over those runs.`, '');
  out.push('The bot does not kite, never goes to town, hires no one and drinks a potion whenever it is hurt, so its numbers are not a player\'s. What they are good for is comparing the classes with each other, and comparing a change with the report before it. A class is flagged when it is out of line with the median of the classes.', '');
  out.push('To see what a change did, run it again and read the diff of this file.', '');
  out.push('## What stands out', '');
  if (!s.flags.length) out.push('Nothing: no class is out of line with the others.', '');
  for (const [level, title] of [['high', 'Likely problems'], ['low', 'Worth a look']] as const) {
    const fs = s.flags.filter((f) => f.level === level);
    if (!fs.length) continue;
    out.push(`### ${title}`, '');
    for (const f of fs) out.push(`- ${level === 'high' ? '**' : ''}${cap(f.classId)}, ${f.where}${level === 'high' ? '**' : ''}: ${f.text}`);
    out.push('');
  }
  if (s.flags.some((f) => f.text.includes('cleared'))) out.push('An area left mostly uncleared can mean the bot got stuck there rather than that the class is weak: check the time it spent.', '');
  out.push('## By act', '', 'Time, deaths and potions are totals for the act. Time to kill is seconds per monster killed.', '');
  for (const [act, cells] of Object.entries(s.byAct)) {
    out.push(`### Act ${act}`, '', row(['Class', 'Time', 'Deaths', 'Potions', 'Time to kill', 'Cleared', 'Bosses killed']), row(['---', '---:', '---:', '---:', '---:', '---:', '---:']));
    for (const c of s.classes) {
      const x = cells[c];
      if (x) out.push(row([cap(c), mmss(x.time), n1(x.deaths), n1(x.potions), `${x.ttk.toFixed(1)}s`, `${Math.round(x.cleared * 100)}%`, `${x.bossKills}/${x.bossRuns}`]));
    }
    out.push('');
  }
  out.push('## By area', '', 'Each cell is time in the area / deaths / potions. A dagger marks a boss that survived at least one run.', '');
  out.push(row(['Area', 'Level in', ...s.classes.map(cap)]), row(['---', '---:', ...s.classes.map(() => '---:')]));
  for (const area of s.areas) {
    const cells = s.byArea[area];
    const lvl = mean(s.classes.map((c) => cells[c]?.level ?? 0).filter(Boolean));
    out.push(row([AREA_BY_ID[area]?.name ?? area, n1(lvl), ...s.classes.map((c) => {
      const x = cells[c];
      return x ? `${mmss(x.time)} / ${n1(x.deaths)} / ${n1(x.potions)}${x.bossRuns && x.bossKills < x.bossRuns ? ' †' : ''}` : '';
    })]));
  }
  out.push('');
  return out.join('\n');
}
