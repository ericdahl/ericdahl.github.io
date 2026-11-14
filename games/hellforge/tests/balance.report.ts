import { it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import type { ClassId } from '../src/game/items';
import { renderReport, summarize, type Run } from './balance';
import { ACT, ACT2, ACT3, playAct } from './bot';

// The project has no Node type definitions (the game itself never touches Node), so the two things needed are declared here.
declare const process: { env: Record<string, string | undefined> };
const nodeFs = 'node:fs';

// Not part of `npm test`: run it with `npm run balance`. It plays every class through the whole game on each seed
// (a few minutes) and writes BALANCE.md. BALANCE_SEEDS and BALANCE_CLASSES narrow it, e.g. BALANCE_SEEDS=99 for a quick look.
const SEEDS = (process.env.BALANCE_SEEDS ?? '99,7,77').split(',').map(Number);
const CLASSES = (process.env.BALANCE_CLASSES ?? 'reaver,arcanist,huntress,necromancer,forgewright').split(',') as ClassId[];

it('writes the balance report', async () => {
  const { writeFileSync } = (await import(/* @vite-ignore */ nodeFs)) as { writeFileSync(path: string, text: string): void };
  const runs: Run[] = [];
  for (const classId of CLASSES) {
    for (const seed of SEEDS) {
      const t0 = Date.now();
      runs.push({ classId, seed, areas: playAct(classId, seed, 900, [...ACT, ...ACT2, ...ACT3]) });
      console.log(`${classId} seed ${seed}: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  const summary = summarize(runs);
  const out = process.env.BALANCE_OUT ?? 'BALANCE.md';
  writeFileSync(out, renderReport(summary, pkg.version));
  console.log(`\n${summary.flags.length} flag(s). Report written to ${out}\n`);
  for (const f of summary.flags) console.log(`  [${f.level}] ${f.classId}, ${f.where}: ${f.text}`);
}, 3_600_000);
