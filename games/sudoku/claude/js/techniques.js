// Human-style solving techniques. Each finder looks at the current state
// ({ values, cands, unique }) and returns a "step" describing one deduction,
// with a short nudge, a full explanation and what to highlight on the board.

import {
  UNITS, ROWS, COLS, BOXES, CELL_UNITS, PEERS, ROW, COL, BOX, BIT, ALL,
  popcount, digits, sees, cellName, unitName, joinAnd, joinOr,
} from './sudoku.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function* combos(arr, n, start = 0, acc = []) {
  if (acc.length === n) { yield acc.slice(); return; }
  for (let i = start; i <= arr.length - (n - acc.length); i++) {
    acc.push(arr[i]);
    yield* combos(arr, n, i + 1, acc);
    acc.pop();
  }
}

function makeStep(technique, level, o) {
  return {
    technique, level,
    placements: [], eliminations: [], cells: [], units: [], marks: [], links: [],
    nudge: '', explanation: '',
    ...o,
  };
}

/** "remove 4 from R1C1 and R1C2; remove 6 from R1C1" */
export function describeEliminations(elims) {
  const byDigit = new Map();
  for (const { cell, digit } of elims) {
    if (!byDigit.has(digit)) byDigit.set(digit, []);
    byDigit.get(digit).push(cell);
  }
  const parts = [];
  for (const [d, cells] of [...byDigit].sort((a, b) => a[0] - b[0])) {
    parts.push(`${d} from ${joinAnd(cells.sort((a, b) => a - b).map(cellName))}`);
  }
  return parts.join('; ');
}

function describeCellElims(elims) {
  // group by cell: "R3C3 loses 4 and 9"
  const byCell = new Map();
  for (const { cell, digit } of elims) {
    if (!byCell.has(cell)) byCell.set(cell, []);
    byCell.get(cell).push(digit);
  }
  return joinAnd([...byCell].map(([c, ds]) => `${joinAnd(ds.sort())} from ${cellName(c)}`));
}

const unitsOfType = (type) => (type === 'row' ? ROWS : type === 'col' ? COLS : BOXES);
const placedMask = (S, u) => u.cells.reduce((m, i) => (S.values[i] ? m | BIT(S.values[i]) : m), 0);
const cellsWith = (S, u, d) => u.cells.filter((i) => !S.values[i] && S.cands[i] & BIT(d));

// ---------------------------------------------------------------- singles

function fullHouse(S) {
  for (const u of [...BOXES, ...ROWS, ...COLS]) {
    const empty = u.cells.filter((i) => !S.values[i]);
    if (empty.length !== 1) continue;
    const i = empty[0];
    const m = ALL & ~placedMask(S, u);
    if (popcount(m) !== 1 || !(S.cands[i] & m)) continue;
    const d = digits(m)[0];
    return makeStep('Full House', 1, {
      placements: [{ cell: i, digit: d }], units: [u.id], cells: [i],
      marks: [{ cell: i, digit: d, role: 'place' }],
      nudge: `${cap(unitName(u))} has only one empty cell left.`,
      explanation: `${cellName(i)} is the last empty cell in ${unitName(u)}, and ${d} is the only digit that ${unitName(u)} is still missing. So ${cellName(i)} = ${d}.`,
    });
  }
  return null;
}

/** Why can't `cell` be `d`? Returns a short reason or null if only removed by an earlier deduction. */
function blocker(S, cell, d) {
  for (const u of CELL_UNITS[cell]) {
    const j = u.cells.find((k) => S.values[k] === d);
    if (j !== undefined) return { unit: u, cell: j };
  }
  return null;
}

function nakedSingle(S) {
  for (let i = 0; i < 81; i++) {
    if (S.values[i] || popcount(S.cands[i]) !== 1) continue;
    const d = digits(S.cands[i])[0];
    const reasons = [];
    const byUnit = new Map();
    let earlier = [];
    for (let e = 1; e <= 9; e++) {
      if (e === d) continue;
      const b = blocker(S, i, e);
      if (!b) { earlier.push(e); continue; }
      const k = unitName(b.unit);
      if (!byUnit.has(k)) byUnit.set(k, []);
      byUnit.get(k).push(e);
    }
    for (const [k, ds] of byUnit) reasons.push(`${joinAnd(ds)} ${ds.length > 1 ? 'are' : 'is'} already in ${k}`);
    if (earlier.length) reasons.push(`${joinAnd(earlier)} ${earlier.length > 1 ? 'were' : 'was'} eliminated earlier`);
    return makeStep('Naked Single', 1, {
      placements: [{ cell: i, digit: d }], cells: [i],
      units: CELL_UNITS[i].map((u) => u.id),
      marks: [{ cell: i, digit: d, role: 'place' }],
      nudge: `There's a cell in ${unitName(ROWS[ROW(i)])} with only one candidate left.`,
      explanation: `${cellName(i)} can only be ${d}: ${reasons.join('; ')}. So ${cellName(i)} = ${d}.`,
    });
  }
  return null;
}

function hiddenSingle(S) {
  for (const u of [...BOXES, ...ROWS, ...COLS]) {
    const placed = placedMask(S, u);
    for (let d = 1; d <= 9; d++) {
      if (placed & BIT(d)) continue;
      const pos = cellsWith(S, u, d);
      if (pos.length !== 1) continue;
      const i = pos[0];
      if (popcount(S.cands[i]) === 1) continue; // naked single, reported elsewhere
      const others = u.cells.filter((k) => k !== i && !S.values[k]);
      const blockers = new Map();
      let earlier = 0;
      for (const k of others) {
        const b = blocker(S, k, d);
        if (b) blockers.set(b.unit.id, b); else earlier++;
      }
      const why = [...blockers.values()].map((b) => `the ${d} in ${cellName(b.cell)} covers ${unitName(b.unit)}`);
      if (earlier) why.push(`${earlier} other cell${earlier > 1 ? 's' : ''} had ${d} eliminated earlier`);
      return makeStep('Hidden Single', 1, {
        placements: [{ cell: i, digit: d }], units: [u.id], cells: [i, ...[...blockers.values()].map((b) => b.cell)],
        marks: [{ cell: i, digit: d, role: 'place' }],
        nudge: `Look at ${unitName(u)}: there's a digit with only one possible spot.`,
        explanation: `In ${unitName(u)}, the only cell that can hold ${d} is ${cellName(i)}${why.length ? ' (' + why.join('; ') + ')' : ''}. So ${cellName(i)} = ${d}.`,
      });
    }
  }
  return null;
}

// ---------------------------------------------------------------- intersections

function lockedCandidates(S) {
  // Pointing: digit confined to one line inside a box.
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      const pos = cellsWith(S, box, d);
      if (pos.length < 2) continue;
      for (const type of ['row', 'col']) {
        const idx = new Set(pos.map(type === 'row' ? ROW : COL));
        if (idx.size !== 1) continue;
        const line = unitsOfType(type)[[...idx][0]];
        const elims = line.cells.filter((i) => BOX(i) !== box.index && !S.values[i] && S.cands[i] & BIT(d))
          .map((cell) => ({ cell, digit: d }));
        if (!elims.length) continue;
        return makeStep('Locked Candidates (Pointing)', 2, {
          eliminations: elims, units: [box.id, line.id], cells: pos,
          marks: [...pos.map((cell) => ({ cell, digit: d, role: 'key' })), ...elims.map((e) => ({ ...e, role: 'elim' }))],
          nudge: `Look at where ${d} can go in ${unitName(box)}.`,
          explanation: `In ${unitName(box)}, ${d} can only go in ${joinAnd(pos.map(cellName))}, which all lie in ${unitName(line)}. Whichever of them gets the ${d}, ${unitName(line)}'s ${d} is used up inside ${unitName(box)}, so the rest of ${unitName(line)} can't be ${d}. Remove ${describeEliminations(elims)}.`,
        });
      }
    }
  }
  // Claiming / box-line reduction: digit in a line confined to one box.
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      const pos = cellsWith(S, line, d);
      if (pos.length < 2) continue;
      const boxes = new Set(pos.map(BOX));
      if (boxes.size !== 1) continue;
      const box = BOXES[[...boxes][0]];
      const elims = box.cells.filter((i) => !line.cells.includes(i) && !S.values[i] && S.cands[i] & BIT(d))
        .map((cell) => ({ cell, digit: d }));
      if (!elims.length) continue;
      return makeStep('Locked Candidates (Claiming)', 2, {
        eliminations: elims, units: [line.id, box.id], cells: pos,
        marks: [...pos.map((cell) => ({ cell, digit: d, role: 'key' })), ...elims.map((e) => ({ ...e, role: 'elim' }))],
        nudge: `Look at where ${d} can go in ${unitName(line)}.`,
        explanation: `In ${unitName(line)}, ${d} can only go in ${joinAnd(pos.map(cellName))}, all inside ${unitName(box)}. So ${unitName(box)}'s ${d} must be in ${unitName(line)}, and no other cell of ${unitName(box)} can be ${d}. Remove ${describeEliminations(elims)}.`,
      });
    }
  }
  return null;
}

// ---------------------------------------------------------------- subsets

const SUBSET_NAMES = { 2: 'Pair', 3: 'Triple', 4: 'Quad' };

function nakedSubset(n) {
  return function (S) {
    for (const u of UNITS) {
      const cells = u.cells.filter((i) => !S.values[i] && popcount(S.cands[i]) >= 2 && popcount(S.cands[i]) <= n);
      if (cells.length < n) continue;
      for (const combo of combos(cells, n)) {
        const union = combo.reduce((m, i) => m | S.cands[i], 0);
        if (popcount(union) !== n) continue;
        // every unit shared by all the subset cells loses those digits
        const shared = UNITS.filter((v) => combo.every((i) => v.cells.includes(i)));
        const elims = [];
        const seen = new Set();
        for (const v of shared) for (const i of v.cells) {
          if (combo.includes(i) || S.values[i] || seen.has(i)) continue;
          seen.add(i);
          for (const d of digits(S.cands[i] & union)) elims.push({ cell: i, digit: d });
        }
        if (!elims.length) continue;
        const ds = digits(union);
        const where = joinAnd(shared.map(unitName));
        return makeStep(`Naked ${SUBSET_NAMES[n]}`, n === 2 ? 2 : n === 3 ? 3 : 4, {
          eliminations: elims, units: shared.map((v) => v.id), cells: combo,
          marks: [...combo.flatMap((cell) => digits(S.cands[cell]).map((digit) => ({ cell, digit, role: 'key' }))), ...elims.map((e) => ({ ...e, role: 'elim' }))],
          nudge: `Look for ${n} cells in ${unitName(u)} that share the same ${n} candidates.`,
          explanation: `${joinAnd(combo.map(cellName))} together contain only the candidates ${joinAnd(ds)}. ${n} cells, ${n} digits: those digits must fill exactly these cells, so no other cell in ${where} can hold them. Remove ${describeEliminations(elims)}.`,
        });
      }
    }
    return null;
  };
}

function hiddenSubset(n) {
  return function (S) {
    for (const u of UNITS) {
      const placed = placedMask(S, u);
      const ds = [];
      for (let d = 1; d <= 9; d++) {
        if (placed & BIT(d)) continue;
        const k = cellsWith(S, u, d).length;
        if (k >= 2 && k <= n) ds.push(d);
      }
      if (ds.length < n) continue;
      for (const combo of combos(ds, n)) {
        const cells = [...new Set(combo.flatMap((d) => cellsWith(S, u, d)))];
        if (cells.length !== n) continue;
        const keep = combo.reduce((m, d) => m | BIT(d), 0);
        const elims = [];
        for (const i of cells) for (const d of digits(S.cands[i] & ~keep)) elims.push({ cell: i, digit: d });
        if (!elims.length) continue;
        return makeStep(`Hidden ${SUBSET_NAMES[n]}`, n === 2 ? 2 : n === 3 ? 3 : 4, {
          eliminations: elims, units: [u.id], cells,
          marks: [...cells.flatMap((cell) => combo.filter((d) => S.cands[cell] & BIT(d)).map((digit) => ({ cell, digit, role: 'key' }))), ...elims.map((e) => ({ ...e, role: 'elim' }))],
          nudge: `In ${unitName(u)}, ${n} digits are confined to the same ${n} cells.`,
          explanation: `In ${unitName(u)}, the digits ${joinAnd(combo)} can only go in ${joinAnd(cells.map(cellName))}. ${n} digits need ${n} cells, so these cells must hold exactly those digits and their other candidates can go. Remove ${describeCellElims(elims)}.`,
        });
      }
    }
    return null;
  };
}

// ---------------------------------------------------------------- fish

const FISH_NAMES = { 2: 'X-Wing', 3: 'Swordfish', 4: 'Jellyfish' };

function fish(n) {
  return function (S) {
    for (let d = 1; d <= 9; d++) {
      for (const [baseType, coverType] of [['row', 'col'], ['col', 'row']]) {
        const at = (base, cover) => (baseType === 'row' ? base * 9 + cover : cover * 9 + base);
        const lines = [];
        for (let k = 0; k < 9; k++) {
          const covers = [];
          for (let c = 0; c < 9; c++) {
            const i = at(k, c);
            if (!S.values[i] && S.cands[i] & BIT(d)) covers.push(c);
          }
          if (covers.length >= 2 && covers.length <= n) lines.push({ k, covers });
        }
        if (lines.length < n) continue;
        for (const combo of combos(lines, n)) {
          const coverSet = [...new Set(combo.flatMap((l) => l.covers))].sort((a, b) => a - b);
          if (coverSet.length !== n) continue;
          const baseSet = combo.map((l) => l.k);
          const elims = [];
          for (const c of coverSet) for (let k = 0; k < 9; k++) {
            if (baseSet.includes(k)) continue;
            const i = at(k, c);
            if (!S.values[i] && S.cands[i] & BIT(d)) elims.push({ cell: i, digit: d });
          }
          if (!elims.length) continue;
          const bases = baseSet.map((k) => unitsOfType(baseType)[k]);
          const covers = coverSet.map((c) => unitsOfType(coverType)[c]);
          const pattern = combo.flatMap((l) => l.covers.map((c) => at(l.k, c)));
          const bWord = baseType === 'row' ? 'rows' : 'columns', cWord = coverType === 'row' ? 'rows' : 'columns';
          return makeStep(FISH_NAMES[n], n === 2 ? 3 : n === 3 ? 4 : 5, {
            eliminations: elims, units: [...bases, ...covers].map((u) => u.id), cells: pattern,
            marks: [...pattern.map((cell) => ({ cell, digit: d, role: 'key' })), ...elims.map((e) => ({ ...e, role: 'elim' }))],
            nudge: `Look at digit ${d} in ${bWord} ${joinAnd(baseSet.map((k) => k + 1))}.`,
            explanation: `In ${bWord} ${joinAnd(baseSet.map((k) => k + 1))}, ${d} can only go in ${cWord} ${joinAnd(coverSet.map((c) => c + 1))}. Those ${n} ${bWord} each need a ${d}, and they can only find it in these ${n} ${cWord} — so the ${d}s of ${cWord} ${joinAnd(coverSet.map((c) => c + 1))} are all used up by them. No other cell in those ${cWord} can be ${d}. Remove ${describeEliminations(elims)}.`,
          });
        }
      }
    }
    return null;
  };
}

// ---------------------------------------------------------------- wings & uniqueness

function xyzWing(S) {
  for (let p = 0; p < 81; p++) {
    if (S.values[p] || popcount(S.cands[p]) !== 3) continue;
    const pm = S.cands[p];
    const wings = PEERS[p].filter((i) => !S.values[i] && popcount(S.cands[i]) === 2 && (S.cands[i] & ~pm) === 0);
    for (const [a, b] of combos(wings, 2)) {
      if (S.cands[a] === S.cands[b] || (S.cands[a] | S.cands[b]) !== pm) continue;
      const z = digits(S.cands[a] & S.cands[b])[0];
      const elims = [];
      for (let i = 0; i < 81; i++) {
        if (i === p || i === a || i === b || S.values[i] || !(S.cands[i] & BIT(z))) continue;
        if (sees(i, p) && sees(i, a) && sees(i, b)) elims.push({ cell: i, digit: z });
      }
      if (!elims.length) continue;
      return makeStep('XYZ-Wing', 4, {
        eliminations: elims, cells: [p, a, b],
        marks: [...[p, a, b].flatMap((cell) => digits(S.cands[cell]).map((digit) => ({ cell, digit, role: digit === z ? 'on' : 'key' }))), ...elims.map((e) => ({ ...e, role: 'elim' }))],
        nudge: `Look at the three-candidate cell ${cellName(p)} and two-candidate cells it sees.`,
        explanation: `${cellName(p)} has candidates ${joinAnd(digits(pm))}. It sees ${cellName(a)} (${joinAnd(digits(S.cands[a]))}) and ${cellName(b)} (${joinAnd(digits(S.cands[b]))}). Whatever ${cellName(p)} turns out to be, one of these three cells must be ${z}: if ${cellName(p)} isn't ${z}, it's one of the other digits, which forces the matching wing to be ${z}. So any cell that sees all three can't be ${z}. Remove ${describeEliminations(elims)}.`,
      });
    }
  }
  return null;
}

function uniqueRectangle(S) {
  if (!S.unique) return null;
  for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++)
    for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
      const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (new Set(cells.map(BOX)).size !== 2) continue;
      if (cells.some((i) => S.values[i])) continue;
      const pairs = cells.filter((i) => popcount(S.cands[i]) === 2);
      if (pairs.length !== 3) continue;
      const m = S.cands[pairs[0]];
      if (!pairs.every((i) => S.cands[i] === m)) continue;
      const extra = cells.find((i) => !pairs.includes(i));
      if ((S.cands[extra] & m) !== m) continue;
      const ds = digits(m);
      const elims = ds.map((digit) => ({ cell: extra, digit }));
      return makeStep('Unique Rectangle (Type 1)', 4, {
        eliminations: elims, cells,
        marks: [...pairs.flatMap((cell) => ds.map((digit) => ({ cell, digit, role: 'key' }))), ...elims.map((e) => ({ ...e, role: 'elim' }))],
        nudge: `Four cells forming a rectangle across two boxes almost share the same two candidates.`,
        explanation: `${joinAnd(cells.map(cellName))} form a rectangle in two boxes. Three of them are exactly {${ds.join(',')}}. If ${cellName(extra)} were also ${ds[0]} or ${ds[1]}, the ${ds[0]}s and ${ds[1]}s could be swapped around the rectangle and the puzzle would have two solutions. A proper puzzle has only one, so ${cellName(extra)} can't be ${ds[0]} or ${ds[1]}. Remove ${describeEliminations(elims)}.`,
      });
    }
  return null;
}

function bugPlusOne(S) {
  if (!S.unique) return null;
  let three = -1;
  for (let i = 0; i < 81; i++) {
    if (S.values[i]) continue;
    const k = popcount(S.cands[i]);
    if (k === 2) continue;
    if (k === 3 && three < 0) { three = i; continue; }
    return null;
  }
  if (three < 0) return null;
  for (const d of digits(S.cands[three])) {
    const u = CELL_UNITS[three].find((v) => cellsWith(S, v, d).length === 3);
    if (!u) continue;
    return makeStep('BUG+1', 4, {
      placements: [{ cell: three, digit: d }], cells: [three], units: [u.id],
      marks: [{ cell: three, digit: d, role: 'place' }],
      nudge: `Every unsolved cell has two candidates — except one.`,
      explanation: `Every unsolved cell has exactly two candidates except ${cellName(three)}. If ${cellName(three)} lost its extra candidate, every digit would appear exactly twice in every unit — a "bivalue universal grave", which always has two solutions. ${d} is the digit that appears three times in ${unitName(u)}, so it is the one that breaks the deadlock: ${cellName(three)} = ${d}.`,
    });
  }
  return null;
}

// ---------------------------------------------------------------- chains (AIC)

const node = (cell, d) => cell * 9 + d - 1;
const nCell = (n) => (n / 9) | 0;
const nDigit = (n) => (n % 9) + 1;
const nName = (n) => `${cellName(nCell(n))}`;

function strongLinks(S, opt) {
  const adj = new Map();
  const add = (a, b, via) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, via });
  };
  if (opt.cell) for (let i = 0; i < 81; i++) {
    if (S.values[i] || popcount(S.cands[i]) !== 2) continue;
    const [a, b] = digits(S.cands[i]);
    if (opt.digit && (a !== opt.digit || b !== opt.digit)) continue;
    add(node(i, a), node(i, b), null); add(node(i, b), node(i, a), null);
  }
  if (opt.unit) for (const u of UNITS) for (let d = 1; d <= 9; d++) {
    if (opt.digit && d !== opt.digit) continue;
    const pos = cellsWith(S, u, d);
    if (pos.length !== 2) continue;
    add(node(pos[0], d), node(pos[1], d), u); add(node(pos[1], d), node(pos[0], d), u);
  }
  return adj;
}

function weakNeighbors(S, n, digitOnly) {
  const c = nCell(n), d = nDigit(n), out = [];
  if (!digitOnly) for (const e of digits(S.cands[c])) if (e !== d) out.push(node(c, e));
  for (const p of PEERS[c]) if (!S.values[p] && S.cands[p] & BIT(d)) out.push(node(p, d));
  return out;
}
const isWeak = (a, b) => a !== b && (nCell(a) === nCell(b) || (nDigit(a) === nDigit(b) && sees(nCell(a), nCell(b))));
const sharedUnit = (a, b) => CELL_UNITS[a].find((u) => u.cells.includes(b));

function chainEliminations(S, path) {
  const A = path[0], Z = path[path.length - 1];
  if (A === Z) return { placements: [{ cell: nCell(A), digit: nDigit(A) }], eliminations: [] };
  const elims = [];
  for (const x of weakNeighbors(S, A, false)) {
    if (x === Z || !isWeak(x, Z)) continue;
    elims.push({ cell: nCell(x), digit: nDigit(x) });
  }
  return { placements: [], eliminations: elims };
}

/**
 * Breadth-first search for the shortest alternating inference chain.
 * Chain: A(off) =strong=> B(on) -weak-> C(off) =strong=> D(on) ...  ends on an "on" node Z.
 * Conclusion: A or Z is true.
 */
function findChain(S, opt) {
  const strong = strongLinks(S, opt);
  let best = null;
  const starts = [...strong.keys()].sort((a, b) => a - b);
  for (const A of starts) {
    const parent = new Map(); // state -> {prev, via}
    const startState = A * 2; // off
    parent.set(startState, null);
    let frontier = [startState];
    for (let depth = 1; depth <= opt.maxStrong; depth++) {
      if (best && depth > best.strongs) break;
      // strong step: off -> on
      const onStates = [];
      for (const s of frontier) {
        for (const { to, via } of strong.get(s >> 1) || []) {
          const t = to * 2 + 1;
          if (parent.has(t)) continue;
          parent.set(t, { prev: s, via, strong: true });
          onStates.push(t);
        }
      }
      // evaluate endpoints
      if (depth >= (opt.minStrong || 2)) for (const t of onStates) {
        const path = [], vias = [];
        for (let s = t; s !== undefined && s !== null; ) {
          path.unshift(s >> 1);
          const p = parent.get(s);
          if (!p) break;
          vias.unshift(p);
          s = p.prev;
        }
        const Z = t >> 1;
        const interior = path.slice(0, -1);
        if (new Set(interior).size !== interior.length) continue;
        if (Z !== A && interior.includes(Z)) continue;
        const res = chainEliminations(S, path);
        if (!res.placements.length && !res.eliminations.length) continue;
        if (opt.accept && !opt.accept(S, path, vias)) continue;
        const score = depth * 100 - res.eliminations.length - (res.placements.length ? 50 : 0);
        if (!best || score < best.score) best = { path, vias, strongs: depth, score, ...res };
      }
      // weak step: on -> off
      const next = [];
      for (const t of onStates) {
        for (const y of weakNeighbors(S, t >> 1, !!opt.digit)) {
          const s = y * 2;
          if (parent.has(s)) continue;
          parent.set(s, { prev: t, via: null, strong: false });
          next.push(s);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
  }
  return best;
}

function chainText(path, vias) {
  // one line per strong link: "[a = x ⇒ b is not y (unit) ⇒] b = y (reason)"
  const lines = [];
  let line = `${nName(path[0])} is not ${nDigit(path[0])}`;
  for (let k = 0; k < vias.length; k++) {
    const a = path[k], b = path[k + 1], v = vias[k];
    if (v.strong) {
      const why = v.via ? `the only other place for ${nDigit(b)} in ${unitName(v.via)}` : `the only other candidate in ${nName(b)}`;
      lines.push(`${line} ⇒ ${nName(b)} = ${nDigit(b)} (${why})`);
      line = `${nName(b)} = ${nDigit(b)}`;
    } else {
      const why = nCell(a) === nCell(b) ? 'same cell' : unitName(sharedUnit(nCell(a), nCell(b)));
      line += ` ⇒ ${nName(b)} is not ${nDigit(b)} (${why})`;
    }
  }
  return lines;
}

function chainStep(S, found, name, level, nudge) {
  const { path, vias } = found;
  const A = path[0], Z = path[path.length - 1];
  const links = [];
  for (let k = 0; k < vias.length; k++) links.push({ a: { cell: nCell(path[k]), digit: nDigit(path[k]) }, b: { cell: nCell(path[k + 1]), digit: nDigit(path[k + 1]) }, strong: vias[k].strong });
  const marks = path.map((n, k) => ({ cell: nCell(n), digit: nDigit(n), role: k % 2 === 0 ? 'off' : 'on' }));
  marks[0].role = 'end';
  if (A !== Z) marks[marks.length - 1].role = 'end';
  const steps = chainText(path, vias);
  let conclusion;
  if (A === Z) {
    conclusion = `Assuming ${nName(A)} is not ${nDigit(A)} leads straight back to ${nName(A)} = ${nDigit(A)} — a contradiction. So ${nName(A)} = ${nDigit(A)}.`;
    marks.push({ cell: nCell(A), digit: nDigit(A), role: 'place' });
  } else {
    const what = `${nName(A)} = ${nDigit(A)} or ${nName(Z)} = ${nDigit(Z)}`;
    conclusion = `So at least one of these is true: ${what}. Any candidate that would be ruled out by both can go. Remove ${describeEliminations(found.eliminations)}.`;
    for (const e of found.eliminations) marks.push({ ...e, role: 'elim' });
  }
  const cells = [...new Set(path.map(nCell))];
  return makeStep(name, level, {
    placements: found.placements, eliminations: found.eliminations, cells, marks, links,
    nudge,
    explanation: `Follow the chain — if ${nName(A)} is not ${nDigit(A)}:`,
    chain: steps,
    conclusion,
  });
}

function classifyX(path, vias) {
  const strongs = vias.filter((v) => v.strong);
  if (strongs.length !== 2) return 'X-Chain';
  const types = strongs.map((v) => v.via.type).sort().join('+');
  if (types === 'row+row' || types === 'col+col') return 'Skyscraper';
  if (types === 'col+row') return '2-String Kite';
  return 'Turbot Fish';
}

function xChainShort(S) {
  for (let d = 1; d <= 9; d++) {
    const f = findChain(S, { digit: d, unit: true, cell: false, maxStrong: 2 });
    if (f) {
      const name = classifyX(f.path, f.vias);
      return chainStep(S, f, name, 3, `Look at digit ${d}: two places where ${d} has exactly two spots are linked.`);
    }
  }
  return null;
}

function xyWing(S) {
  const f = findChain(S, { cell: true, unit: false, maxStrong: 3, minStrong: 3, accept: (S2, path) => new Set(path.map(nCell)).size === 3 });
  if (!f) return null;
  const pivot = nCell(f.path[2]);
  const step = chainStep(S, f, 'XY-Wing', 3, `Look for a two-candidate cell (around ${cellName(pivot)}) that sees two other two-candidate cells.`);
  const [p1, p2] = [nCell(f.path[0]), nCell(f.path[f.path.length - 1])];
  const z = nDigit(f.path[0]);
  step.explanation = `${cellName(pivot)} is {${digits(S.cands[pivot]).join(',')}} and sees ${cellName(p1)} {${digits(S.cands[p1]).join(',')}} and ${cellName(p2)} {${digits(S.cands[p2]).join(',')}}. Whichever digit ${cellName(pivot)} takes, one of the two wings is forced to be ${z}. Step by step — if ${cellName(p1)} is not ${z}:`;
  return step;
}

function wWing(S) {
  const f = findChain(S, {
    cell: true, unit: true, maxStrong: 3, minStrong: 3,
    accept: (S2, path, vias) => {
      const s = vias.filter((v) => v.strong);
      if (s.length !== 3 || s[0].via || !s[1].via || s[2].via) return false;
      return S2.cands[nCell(path[0])] === S2.cands[nCell(path[path.length - 1])];
    },
  });
  if (!f) return null;
  return chainStep(S, f, 'W-Wing', 4, `Two identical two-candidate cells are connected by a digit with only two spots in a unit.`);
}

function xChainLong(S) {
  let best = null;
  for (let d = 1; d <= 9; d++) {
    const f = findChain(S, { digit: d, unit: true, cell: false, maxStrong: 6 });
    if (f && (!best || f.score < best.score)) best = { ...f, d };
  }
  if (!best) return null;
  return chainStep(S, best, best.strongs === 2 ? classifyX(best.path, best.vias) : 'X-Chain', 5, `Follow a chain of strong links on digit ${best.d}.`);
}

function xyChain(S) {
  const f = findChain(S, { cell: true, unit: false, maxStrong: 7 });
  if (!f) return null;
  return chainStep(S, f, 'XY-Chain', 5, `Follow a chain of two-candidate cells starting at ${nName(f.path[0])}.`);
}

function aic(S) {
  const f = findChain(S, { cell: true, unit: true, maxStrong: 8 });
  if (!f) return null;
  return chainStep(S, f, 'Alternating Inference Chain', 5, `There's a chain of forced deductions starting from ${nName(f.path[0])}.`);
}

// ---------------------------------------------------------------- driver

export const TECHNIQUES = [
  { name: 'Full House', fn: fullHouse },
  { name: 'Naked Single', fn: nakedSingle },
  { name: 'Hidden Single', fn: hiddenSingle },
  { name: 'Locked Candidates', fn: lockedCandidates },
  { name: 'Naked Pair', fn: nakedSubset(2) },
  { name: 'Hidden Pair', fn: hiddenSubset(2) },
  { name: 'Naked Triple', fn: nakedSubset(3) },
  { name: 'Hidden Triple', fn: hiddenSubset(3) },
  { name: 'X-Wing', fn: fish(2) },
  { name: 'Skyscraper / 2-String Kite', fn: xChainShort },
  { name: 'XY-Wing', fn: xyWing },
  { name: 'XYZ-Wing', fn: xyzWing },
  { name: 'W-Wing', fn: wWing },
  { name: 'Naked Quad', fn: nakedSubset(4) },
  { name: 'Hidden Quad', fn: hiddenSubset(4) },
  { name: 'Swordfish', fn: fish(3) },
  { name: 'Unique Rectangle', fn: uniqueRectangle },
  { name: 'Jellyfish', fn: fish(4) },
  { name: 'BUG+1', fn: bugPlusOne },
  { name: 'X-Chain', fn: xChainLong },
  { name: 'XY-Chain', fn: xyChain },
  { name: 'AIC', fn: aic },
];

/** True when a step is consistent with the known solution. */
export function stepIsSound(step, solution) {
  if (!solution) return true;
  return step.placements.every((p) => solution[p.cell] === p.digit)
    && step.eliminations.every((e) => solution[e.cell] !== e.digit);
}

/** Find the next logical step (or null if none of the techniques apply). */
export function findTechniqueStep(S, opts = {}) {
  for (const t of TECHNIQUES) {
    if (opts.skip && opts.skip.has(t.name)) continue;
    const step = t.fn(S);
    if (!step) continue;
    if (!stepIsSound(step, S.solution)) {
      // Should never happen with correct candidates; don't mislead the user.
      console.warn('unsound step skipped', step);
      continue;
    }
    return step;
  }
  return null;
}

export { cap };
