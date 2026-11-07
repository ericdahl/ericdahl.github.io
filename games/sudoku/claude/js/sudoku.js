// Core sudoku model: geometry, candidate bitmasks, a fast solver and parsing.
// Candidates are stored as 9-bit masks where bit d (1..9) means "d is possible".

export const ROW = (i) => (i / 9) | 0;
export const COL = (i) => i % 9;
export const BOX = (i) => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
export const BIT = (d) => 1 << d;
export const ALL = 0b1111111110;

export const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push({ type: 'row', index: r, cells: [...Array(9)].map((_, c) => r * 9 + c) });
for (let c = 0; c < 9; c++) UNITS.push({ type: 'col', index: c, cells: [...Array(9)].map((_, r) => r * 9 + c) });
for (let b = 0; b < 9; b++) {
  const r0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3;
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c);
  UNITS.push({ type: 'box', index: b, cells });
}
UNITS.forEach((u, i) => (u.id = i));
export const ROWS = UNITS.slice(0, 9), COLS = UNITS.slice(9, 18), BOXES = UNITS.slice(18);
export const CELL_UNITS = [...Array(81)].map((_, i) => [ROWS[ROW(i)], COLS[COL(i)], BOXES[BOX(i)]]);
export const PEERS = [...Array(81)].map((_, i) => {
  const s = new Set();
  for (const u of CELL_UNITS[i]) for (const j of u.cells) if (j !== i) s.add(j);
  return [...s];
});
const PEER_SET = PEERS.map((p) => new Set(p));
export const sees = (a, b) => a !== b && PEER_SET[a].has(b);

export function popcount(m) {
  let n = 0;
  while (m) { m &= m - 1; n++; }
  return n;
}
export function digits(m) {
  const out = [];
  for (let d = 1; d <= 9; d++) if (m & BIT(d)) out.push(d);
  return out;
}
export const maskOf = (ds) => ds.reduce((m, d) => m | BIT(d), 0);

export const cellName = (i) => `R${ROW(i) + 1}C${COL(i) + 1}`;
export const unitName = (u) => (u.type === 'row' ? 'row' : u.type === 'col' ? 'column' : 'box') + ' ' + (u.index + 1);
export function listCells(cells) {
  return cells.map(cellName).join(', ');
}
export function joinAnd(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}
export function joinOr(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1];
}

/** Candidates implied only by placed values. */
export function basicCandidates(values) {
  const cands = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (values[p]) m &= ~BIT(values[p]);
    cands[i] = m;
  }
  return cands;
}

/** Cells whose value repeats a peer's value. */
export function conflicts(values) {
  const bad = new Set();
  for (let i = 0; i < 81; i++) {
    if (!values[i]) continue;
    for (const p of PEERS[i]) if (values[p] === values[i]) { bad.add(i); bad.add(p); }
  }
  return bad;
}

/**
 * Backtracking solver. Returns { count, solution } where count is capped at `limit`.
 * solution is the first solution found (or null).
 */
export function solve(values, limit = 2) {
  const v = values.slice();
  if (conflicts(v).size) return { count: 0, solution: null };
  const rowM = new Array(9).fill(0), colM = new Array(9).fill(0), boxM = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (v[i]) {
    const b = BIT(v[i]);
    rowM[ROW(i)] |= b; colM[COL(i)] |= b; boxM[BOX(i)] |= b;
  }
  let count = 0, solution = null;
  const empties = [];
  for (let i = 0; i < 81; i++) if (!v[i]) empties.push(i);

  function rec(n) {
    if (n === empties.length) {
      count++;
      if (!solution) solution = v.slice();
      return count >= limit;
    }
    // pick the most constrained remaining cell
    let best = -1, bestMask = 0, bestCount = 10;
    for (let k = n; k < empties.length; k++) {
      const i = empties[k];
      const m = ALL & ~(rowM[ROW(i)] | colM[COL(i)] | boxM[BOX(i)]);
      const c = popcount(m);
      if (c < bestCount) { best = k; bestMask = m; bestCount = c; if (c <= 1) break; }
    }
    if (bestCount === 0) return false;
    [empties[n], empties[best]] = [empties[best], empties[n]];
    const i = empties[n];
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & BIT(d))) continue;
      const b = BIT(d);
      v[i] = d; rowM[ROW(i)] |= b; colM[COL(i)] |= b; boxM[BOX(i)] |= b;
      const stop = rec(n + 1);
      v[i] = 0; rowM[ROW(i)] &= ~b; colM[COL(i)] &= ~b; boxM[BOX(i)] &= ~b;
      if (stop) return true;
    }
    [empties[n], empties[best]] = [empties[best], empties[n]];
    return false;
  }
  rec(0);
  return { count, solution };
}

/** Parse 81 cells from free text: digits 1-9, and 0 . - _ * x for blanks. Whitespace/pipes ignored. */
export function parseGrid(text) {
  const chars = String(text).replace(/[^0-9.\-_*xX]/g, '');
  if (chars.length !== 81) return null;
  return [...chars].map((ch) => (/[1-9]/.test(ch) ? +ch : 0));
}

export const gridToString = (values) => values.map((v) => v || 0).join('');

/**
 * Candidate list encoding used in URLs: 81 entries separated by '.', each the digits of that cell.
 * Empty entry means "no marks known" for that cell.
 */
export function parseCandidates(s) {
  if (!s) return null;
  const parts = s.split(/[.,;]/);
  if (parts.length !== 81) return null;
  return parts.map((p) => maskOf([...p].filter((ch) => /[1-9]/.test(ch)).map(Number)));
}
export const candidatesToString = (cands) => cands.map((m) => digits(m).join('')).join('.');
