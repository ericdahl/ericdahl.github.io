// Game state + hint driver: builds the state, checks for mistakes, finds and applies steps.
import { PEERS, BIT, ALL, basicCandidates, conflicts, solve, digits, popcount, cellName, joinAnd } from './sudoku.js';
import { findTechniqueStep, describeEliminations } from './techniques.js';

/**
 * values: 81 numbers (0 = empty); givens: 81 booleans (clues from the puzzle);
 * marks: optional 81 candidate masks from the user's pencil marks (0 = none known).
 */
export function createState(values, givens, marks, opts = {}) {
  values = values.map((v) => v | 0);
  givens = givens ? givens.map(Boolean) : values.map((v) => v > 0);
  const S = { values, givens, cands: basicCandidates(values), solution: null, unique: false, solvable: false };
  analyse(S);
  if (marks && marks.some((m, i) => !values[i] && m)) applyMarks(S, marks, opts.lenient);
  return S;
}

/**
 * Intersect candidates with the user's pencil marks. Cells without marks keep all candidates.
 * lenient: ignore marks that exclude the correct digit (OCR may have misread them).
 * Returns the number of cells whose marks were ignored.
 */
export function applyMarks(S, marks, lenient) {
  const basic = basicCandidates(S.values);
  let ignored = 0;
  for (let i = 0; i < 81; i++) {
    if (S.values[i]) { S.cands[i] = 0; continue; }
    let m = marks[i] ? basic[i] & marks[i] : basic[i];
    if (lenient && S.solution && !(m & BIT(S.solution[i]))) { m = basic[i]; ignored++; }
    S.cands[i] = m;
  }
  return ignored;
}

/** (Re)compute the solution from the givens (falling back to all placed digits). */
export function analyse(S) {
  const clues = S.values.map((v, i) => (S.givens[i] ? v : 0));
  let r = solve(clues, 2);
  if (r.count === 0) r = solve(S.values, 2);
  S.solution = r.solution;
  S.unique = r.count === 1;
  S.solvable = r.count > 0;
  S.clueCount = clues.filter(Boolean).length;
  return S;
}

export const cloneState = (S) => ({ ...S, values: S.values.slice(), givens: S.givens.slice(), cands: S.cands.slice() });

export function placeDigit(S, cell, d) {
  S.values[cell] = d;
  S.cands[cell] = 0;
  for (const p of PEERS[cell]) S.cands[p] &= ~BIT(d);
}

export function eraseCell(S, cell) {
  const d = S.values[cell];
  if (!d || S.givens[cell]) return;
  S.values[cell] = 0;
  const basic = basicCandidates(S.values);
  S.cands[cell] = basic[cell];
  for (const p of PEERS[cell]) if (!S.values[p] && basic[p] & BIT(d)) S.cands[p] |= BIT(d);
}

export function resetCandidates(S) {
  S.cands = basicCandidates(S.values);
}

export function applyStep(S, step) {
  for (const { cell, digit } of step.eliminations) S.cands[cell] &= ~BIT(digit);
  for (const { cell, digit } of step.placements) placeDigit(S, cell, digit);
}

export const isSolved = (S) => S.values.every((v) => v) && conflicts(S.values).size === 0;

/** Problems with the current grid, most serious first. */
export function findProblems(S) {
  const bad = conflicts(S.values);
  if (bad.size) return { kind: 'conflict', cells: [...bad] };
  if (!S.solvable) return { kind: 'unsolvable', cells: [] };
  const wrong = [];
  for (let i = 0; i < 81; i++) if (S.values[i] && !S.givens[i] && S.solution && S.values[i] !== S.solution[i]) wrong.push(i);
  if (wrong.length) return { kind: 'wrong', cells: wrong };
  const empty = [];
  for (let i = 0; i < 81; i++) if (!S.values[i] && !S.cands[i]) empty.push(i);
  if (empty.length) return { kind: 'nocands', cells: empty };
  const missing = [];
  for (let i = 0; i < 81; i++) if (!S.values[i] && S.solution && !(S.cands[i] & BIT(S.solution[i]))) missing.push(i);
  if (missing.length) return { kind: 'missing', cells: missing };
  return null;
}

function problemStep(S, pr) {
  const base = { technique: 'Check your grid', level: 0, placements: [], eliminations: [], units: [], marks: [], links: [], problem: pr.kind };
  switch (pr.kind) {
    case 'conflict':
      return { ...base, cells: pr.cells, nudge: 'The same digit appears twice in a row, column or box.', explanation: `These cells clash with each other: ${joinAnd(pr.cells.map(cellName))}. Fix one of them before going on.` };
    case 'unsolvable':
      return { ...base, cells: [], nudge: 'This grid has no solution.', explanation: 'No solution exists for the digits on the board. Most likely a digit was entered (or read from the screenshot) wrongly — compare the board with your puzzle.' };
    case 'wrong':
      return { ...base, cells: pr.cells, nudge: `${pr.cells.length === 1 ? 'One of your entries is' : `${pr.cells.length} of your entries are`} wrong.`, explanation: `${joinAnd(pr.cells.map(cellName))} ${pr.cells.length === 1 ? 'does' : 'do'} not match the solution. Clear ${pr.cells.length === 1 ? 'it' : 'them'} and ask for a hint again.`, fix: 'clearWrong' };
    case 'nocands':
      return { ...base, cells: pr.cells, nudge: 'A cell has run out of candidates.', explanation: `${joinAnd(pr.cells.map(cellName))} ${pr.cells.length === 1 ? 'has' : 'have'} no candidates left, so a pencil mark was removed by mistake.`, fix: 'resetCands' };
    case 'missing':
      return { ...base, cells: pr.cells, nudge: 'A pencil mark was removed that is actually needed.', explanation: `The correct digit is missing from the pencil marks of ${joinAnd(pr.cells.map(cellName))}. Reset the candidates (or add it back) to continue.`, fix: 'resetCands' };
  }
}

/** The next hint for this state: a problem report, a logical step, or a last-resort reveal. */
export function getHint(S) {
  const pr = findProblems(S);
  if (pr) return problemStep(S, pr);
  if (isSolved(S)) return null;
  const step = findTechniqueStep(S);
  if (step) return step;
  // Nothing in our toolbox applies: reveal the most constrained cell.
  let best = -1;
  for (let i = 0; i < 81; i++) if (!S.values[i] && (best < 0 || popcount(S.cands[i]) < popcount(S.cands[best]))) best = i;
  const d = S.solution[best];
  return {
    technique: 'Beyond the known techniques', level: 6, placements: [{ cell: best, digit: d }], eliminations: [],
    cells: [best], units: [], marks: [{ cell: best, digit: d, role: 'place' }], links: [],
    nudge: 'None of the techniques I know apply here (it needs something like forcing chains).',
    explanation: `This position needs a technique beyond the ones implemented. From the solution, ${cellName(best)} = ${d}.`,
  };
}

/** Apply hints until the next placement (or until stuck); returns the steps taken. */
export function stepsUntilPlacement(S, max = 50) {
  const out = [];
  for (let k = 0; k < max; k++) {
    const step = getHint(S);
    if (!step || step.problem) break;
    out.push(step);
    applyStep(S, step);
    if (step.placements.length) break;
  }
  return out;
}

export { describeEliminations, digits };
