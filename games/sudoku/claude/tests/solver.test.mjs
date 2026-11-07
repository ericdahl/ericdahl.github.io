import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrid, solve } from '../js/sudoku.js';
import { createState, getHint, applyStep, isSolved } from '../js/coach.js';

// NYT Hard, 7 Nov 2026 — the position from the screenshot (givens + user entries combined).
export const NYT = [
  '008320079', '702940005', '010785206', '000693028', '296814753',
  '800572960', '100460092', '080250000', '020130000',
].join('');

// Pencil marks shown in the NYT screenshot for the empty cells.
export const NYT_MARKS = {
  0: '45', 1: '456', 5: '16', 6: '14', 10: '36', 14: '16', 15: '138', 16: '138',
  18: '349', 20: '349', 25: '34', 27: '45', 28: '457', 29: '1457', 33: '14',
  46: '34', 47: '134', 53: '14', 55: '357', 56: '357', 59: '78', 60: '358',
  63: '3469', 65: '3479', 68: '79', 69: '1346', 70: '134', 71: '147',
  72: '4569', 74: '4579', 77: '789', 78: '4568', 79: '48', 80: '47',
};

const HARD = [
  // a few well known puzzles of varying difficulty
  '000000010400000000020000000000050407008000300001090000300400200050100000000806000',
  '800000000003600000070090200050007000000045700000100030001000068008500010090000400',
  '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
  '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
];

function solveWithHints(S, maxSteps = 500) {
  const used = new Map();
  for (let k = 0; k < maxSteps && !isSolved(S); k++) {
    const step = getHint(S);
    assert.ok(step, 'expected a hint');
    assert.ok(!step.problem, 'unexpected problem: ' + step.explanation);
    for (const p of step.placements) assert.equal(S.solution[p.cell], p.digit, step.technique);
    for (const e of step.eliminations) assert.notEqual(S.solution[e.cell], e.digit, step.technique);
    assert.ok(step.placements.length + step.eliminations.length > 0, step.technique + ' did nothing');
    used.set(step.technique, (used.get(step.technique) || 0) + 1);
    applyStep(S, step);
  }
  assert.ok(isSolved(S));
  return used;
}

test('solver finds unique solution', () => {
  const g = parseGrid(NYT);
  const r = solve(g, 2);
  assert.equal(r.count, 1);
});

test('NYT position: hint is sound and puzzle solvable by hints', () => {
  const values = parseGrid(NYT);
  const marks = values.map((v, i) => [...(NYT_MARKS[i] || '')].reduce((m, d) => m | (1 << +d), 0));
  const S = createState(values, null, marks);
  const h = getHint(S);
  console.log(h.technique, '|', h.nudge, '|', h.explanation, h.chain || '', h.conclusion || '');
  const used = solveWithHints(S);
  console.log([...used].map(([k, v]) => `${k}×${v}`).join(', '));
});

for (const p of HARD) {
  test('hard puzzle ' + p.slice(0, 12), () => {
    const S = createState(parseGrid(p));
    const used = solveWithHints(S, 2000);
    console.log([...used].map(([k, v]) => `${k}×${v}`).join(', '));
  });
}

test('mistake detection', () => {
  const values = parseGrid(NYT);
  const givens = values.map((v) => v > 0);
  values[0] = 5; // wrong (solution is 4)
  const S = createState(values, givens);
  const h = getHint(S);
  assert.equal(h.problem, 'wrong');
  assert.deepEqual(h.cells, [0]);
});
