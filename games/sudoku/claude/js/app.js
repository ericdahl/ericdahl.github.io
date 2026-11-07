import {
  PEERS, ROW, COL, BOX, BIT, digits, parseGrid, parseCandidates, gridToString, candidatesToString,
  basicCandidates, cellName,
} from './sudoku.js';
import {
  createState, analyse, applyMarks, placeDigit, eraseCell, resetCandidates, applyStep, getHint,
  findProblems, isSolved,
} from './coach.js';
import { describeEliminations } from './techniques.js';

const $ = (s) => document.querySelector(s);
const STORE = 'sudoku-coach-v1';

// ------------------------------------------------------------------ state

let S = createState(new Array(81).fill(0));
let selected = 40;
let pencil = false;
let hint = null;       // current step
let hintLevel = 0;     // 1 = nudge, 2 = full explanation
let setup = null;      // { kind: 'review'|'enter', marks, preview, uncertain:Set }
let history = [];
let undoStack = [], redoStack = [];
let showMarks = true;

const snapshot = () => JSON.stringify({ values: S.values, givens: S.givens, cands: S.cands, history, setup: setup && { ...setup, uncertain: [...setup.uncertain] } });
function restoreSnap(json) {
  const o = JSON.parse(json);
  S = { ...S, values: o.values, givens: o.givens, cands: o.cands };
  analyse(S);
  history = o.history || [];
  setup = o.setup ? { ...o.setup, uncertain: new Set(o.setup.uncertain) } : null;
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 300) undoStack.shift();
  redoStack = [];
}
function changed() {
  hint = null; hintLevel = 0;
  save();
  render();
}
function save() {
  try { localStorage.setItem(STORE, snapshot()); } catch { /* storage unavailable */ }
}
function load() {
  try {
    const j = localStorage.getItem(STORE);
    if (j) restoreSnap(j);
  } catch { /* ignore */ }
}

// ------------------------------------------------------------------ board DOM

const board = $('#board');
const cellEls = [];
for (let i = 0; i < 81; i++) {
  const el = document.createElement('div');
  el.className = `cell r${ROW(i)} c${COL(i)}`;
  el.setAttribute('role', 'gridcell');
  el.dataset.i = i;
  const val = document.createElement('span');
  val.className = 'val';
  const cands = document.createElement('div');
  cands.className = 'cands';
  for (let d = 1; d <= 9; d++) cands.appendChild(document.createElement('span'));
  el.append(val, cands);
  board.appendChild(el);
  cellEls.push(el);
}
board.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.cell');
  if (!el) return;
  selected = +el.dataset.i;
  render();
});

const numpad = $('#numpad');
for (let d = 1; d <= 9; d++) {
  const b = document.createElement('button');
  b.dataset.d = d;
  b.innerHTML = `${d}<span class="left"></span>`;
  numpad.appendChild(b);
}
const eraseBtn = document.createElement('button');
eraseBtn.textContent = '⌫';
eraseBtn.title = 'Erase';
eraseBtn.dataset.d = 0;
numpad.appendChild(eraseBtn);
numpad.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  input(+b.dataset.d, pencil);
});

// ------------------------------------------------------------------ rendering

function render() {
  const sel = selected;
  const selVal = S.values[sel];
  const marksByCell = new Map();
  const hl = hint && hintLevel >= 2 ? hint : null;
  if (hl) for (const m of hl.marks) {
    if (!marksByCell.has(m.cell)) marksByCell.set(m.cell, new Map());
    const prev = marksByCell.get(m.cell).get(m.digit);
    if (prev !== 'elim' && prev !== 'place') marksByCell.get(m.cell).set(m.digit, m.role);
  }
  const unitCells = new Set();
  if (hl) for (const uid of hl.units) for (const i of unitCellsOf(uid)) unitCells.add(i);
  const patternCells = new Set(hl ? hl.cells : []);
  const bad = new Set();
  if (hint && hint.problem && hintLevel >= 2) for (const i of hint.cells) bad.add(i);
  for (const i of conflictsNow()) bad.add(i);

  for (let i = 0; i < 81; i++) {
    const el = cellEls[i];
    const v = S.values[i];
    el.classList.toggle('given', !!v && S.givens[i]);
    el.classList.toggle('sel', i === sel);
    el.classList.toggle('peer', !hl && i !== sel && PEERS[sel].includes(i));
    el.classList.toggle('same', !hl && i !== sel && !!selVal && v === selVal);
    el.classList.toggle('h-unit', unitCells.has(i) && !patternCells.has(i));
    el.classList.toggle('h-cell', patternCells.has(i));
    el.classList.toggle('bad', bad.has(i));
    el.classList.toggle('uncertain', !!setup && setup.uncertain.has(i));
    el.querySelector('.val').textContent = v || '';
    const cands = el.querySelector('.cands');
    cands.style.display = v ? 'none' : '';
    const roles = marksByCell.get(i);
    const spans = cands.children;
    for (let d = 1; d <= 9; d++) {
      const has = !v && (S.cands[i] & BIT(d));
      const role = roles && roles.get(d);
      const sp = spans[d - 1];
      sp.textContent = has || role ? d : '';
      sp.className = role ? 'm-' + role : '';
    }
    el.setAttribute('aria-label', `${cellName(i)} ${v || 'empty'}`);
  }
  board.classList.toggle('hide-marks', !showMarks);
  drawLinks(hl ? hl.links : []);

  // numpad: digits left
  const count = new Array(10).fill(0);
  for (const v of S.values) count[v]++;
  for (const b of numpad.querySelectorAll('button[data-d]')) {
    const d = +b.dataset.d;
    if (!d) continue;
    b.classList.toggle('done', count[d] >= 9);
    b.querySelector('.left').textContent = count[d] < 9 ? 9 - count[d] : '';
  }
  document.body.classList.toggle('pencil-on', pencil);
  $('#mode-normal').classList.toggle('on', !pencil);
  $('#mode-pencil').classList.toggle('on', pencil);
  $('#btn-undo').disabled = !undoStack.length;
  $('#btn-redo').disabled = !redoStack.length;
  renderHint();
  renderBanner();
  renderHistory();
}

function unitCellsOf(uid) {
  if (uid < 9) return [...Array(9)].map((_, c) => uid * 9 + c);
  if (uid < 18) return [...Array(9)].map((_, r) => r * 9 + (uid - 9));
  const b = uid - 18, r0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3;
  const out = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push((r0 + r) * 9 + c0 + c);
  return out;
}

function conflictsNow() {
  const out = [];
  for (let i = 0; i < 81; i++) if (S.values[i] && PEERS[i].some((p) => S.values[p] === S.values[i])) out.push(i);
  return out;
}

function candCenter(cell, d) {
  const x = COL(cell) * 100 + (((d - 1) % 3) + 0.5) * (94 / 3) + 3;
  const y = ROW(cell) * 100 + ((((d - 1) / 3) | 0) + 0.5) * (94 / 3) + 3;
  return [x, y];
}

function drawLinks(links) {
  const svg = $('#links');
  svg.innerHTML = '';
  for (const l of links) {
    const [x1, y1] = candCenter(l.a.cell, l.a.digit);
    const [x2, y2] = candCenter(l.b.cell, l.b.digit);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(40, len * 0.15);
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    // shorten so the line doesn't cover the digits
    const sh = 11;
    const t1 = [x1 + ((cx - x1) / Math.hypot(cx - x1, cy - y1)) * sh, y1 + ((cy - y1) / Math.hypot(cx - x1, cy - y1)) * sh];
    const t2 = [x2 + ((cx - x2) / Math.hypot(cx - x2, cy - y2)) * sh, y2 + ((cy - y2) / Math.hypot(cx - x2, cy - y2)) * sh];
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M${t1[0]},${t1[1]} Q${cx},${cy} ${t2[0]},${t2[1]}`);
    p.setAttribute('class', l.strong ? 'strong' : 'weak');
    svg.appendChild(p);
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rich = (s) => esc(s).replace(/R\dC\d/g, (m) => `<b class="cellref">${m}</b>`);
const LEVELS = ['Fix first', 'Easy', 'Medium', 'Hard', 'Harder', 'Expert', 'Reveal'];

function renderHint() {
  const box = $('#hint');
  $('#empty-hint').hidden = !!hint || history.length > 0;
  if (!hint) { box.hidden = true; return; }
  box.hidden = false;
  const lvl = hint.level ?? 3;
  let html = `<h2>${esc(hint.technique)} <span class="pill l${lvl}">${LEVELS[lvl] || ''}</span></h2>`;
  html += `<p class="nudge">${rich(hint.nudge)}</p>`;
  if (hintLevel >= 2) {
    html += `<p class="explain">${rich(hint.explanation)}</p>`;
    if (hint.chain) html += `<ol class="chain">${hint.chain.map((l) => `<li>${rich(l)}</li>`).join('')}</ol>`;
    if (hint.conclusion) html += `<p class="explain">${rich(hint.conclusion)}</p>`;
    if (!hint.problem) {
      html += '<div class="legend">';
      if (hint.marks.some((m) => m.role === 'key')) html += '<span><i style="background:var(--key-bg)"></i>pattern</span>';
      if (hint.links.length) html += '<span><i style="background:var(--on-bg);box-shadow:0 0 0 2px #a855f7"></i>chain ends</span><span><i style="background:var(--on-bg)"></i>true</span><span><i style="background:var(--off-bg)"></i>false</span><span>━ strong link</span><span>┅ weak link</span>';
      if (hint.eliminations.length) html += '<span><i style="background:var(--elim-bg)"></i>remove</span>';
      if (hint.placements.length) html += '<span><i style="background:var(--key-fg)"></i>place</span>';
      html += '</div>';
    }
  }
  html += '<div class="btns">';
  if (hint.problem) {
    if (hintLevel < 2) html += '<button class="primary" data-h="show">Show where</button>';
    if (hint.fix === 'clearWrong') html += '<button data-h="clearWrong">Clear wrong entries</button>';
    if (hint.fix === 'resetCands') html += '<button data-h="resetCands">Reset pencil marks</button>';
  } else {
    if (hintLevel < 2) html += '<button class="primary" data-h="show">Show me</button>';
    html += `<button ${hintLevel >= 2 ? 'class="primary"' : ''} data-h="apply">Apply${hint.placements.length ? ' (place ' + hint.placements.map((p) => p.digit).join(',') + ')' : ''}</button>`;
  }
  html += '<button data-h="close">Close</button></div>';
  box.innerHTML = html;
}

$('#hint').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-h]');
  if (!b) return;
  const act = b.dataset.h;
  if (act === 'show') { hintLevel = 2; render(); }
  else if (act === 'apply') doApply();
  else if (act === 'close') { hint = null; hintLevel = 0; render(); }
  else if (act === 'clearWrong') {
    pushUndo();
    for (const i of hint.cells) eraseCell(S, i);
    changed();
    toast('Cleared.');
  } else if (act === 'resetCands') {
    pushUndo();
    resetCandidates(S);
    changed();
    toast('Pencil marks recalculated.');
  }
});

function renderHistory() {
  $('#history-count').textContent = history.length ? `(${history.length})` : '';
  $('#history-box').hidden = !history.length;
  $('#history').innerHTML = history.map((h) => `<li><b>${esc(h.t)}</b> — ${rich(h.s)}</li>`).join('');
}

function renderBanner() {
  const el = $('#banner');
  if (setup && setup.kind === 'review') {
    const n = S.values.filter(Boolean).length;
    const nm = setup.marks ? setup.marks.filter(Boolean).length : 0;
    const status = statusLine();
    el.className = 'banner ' + (status.ok ? 'ok' : 'warn');
    el.innerHTML = `${setup.preview ? `<img src="${setup.preview}" alt="What was read from the image" title="Click to enlarge">` : ''}
      <div class="b-body"><p><b>Check the board against your screenshot.</b> Read ${n} digits${nm ? ` and pencil marks in ${nm} cells` : ''}.
      ${setup.uncertain.size ? 'Cells with a dashed outline were hard to read. ' : ''}Tap a cell and type to fix it.</p>
      <p class="small">${status.text}</p>
      <div class="row-btns"><button class="primary" data-b="done">Looks right</button><button data-b="cancel">Discard</button></div></div>`;
    el.hidden = false;
  } else if (setup && setup.kind === 'enter') {
    const status = statusLine();
    el.className = 'banner ' + (status.ok ? 'ok' : 'warn');
    el.innerHTML = `<div class="b-body"><p><b>Entering a puzzle.</b> Type the clues (arrow keys move, ⌫ clears).</p><p class="small">${status.text}</p>
      <div class="row-btns"><button class="primary" data-b="done">Start solving</button><button data-b="cancel">Cancel</button></div></div>`;
    el.hidden = false;
  } else if (isSolved(S) && S.values.some((v, i) => !S.givens[i])) {
    el.className = 'banner ok';
    el.innerHTML = `<div class="b-body"><p><b>🎉 Solved!</b> ${history.length ? `Used ${history.length} hint step${history.length > 1 ? 's' : ''}.` : ''}</p></div>`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function statusLine() {
  const clues = S.values.filter(Boolean).length;
  if (conflictsNow().length) return { ok: false, text: '⚠️ Some digits repeat in a row, column or box (shown in red).' };
  if (clues < 17) return { ok: false, text: `${clues} digits so far — a valid puzzle needs at least 17.` };
  if (!S.solvable) return { ok: false, text: '⚠️ This grid has no solution — probably a digit is wrong.' };
  if (!S.unique) return { ok: false, text: '⚠️ This grid has more than one solution — a clue may be missing or misread.' };
  return { ok: true, text: '✓ Valid puzzle with a unique solution.' };
}

$('#banner').addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG') { e.target.classList.toggle('zoom'); return; }
  const b = e.target.closest('button[data-b]');
  if (!b) return;
  if (b.dataset.b === 'done') finishSetup();
  else {
    if (undoStack.length) { redoStack = []; restoreSnap(undoStack.pop()); }
    setup = null;
    changed();
  }
});

function finishSetup() {
  $('#toast').classList.remove('show');
  if (setup.kind === 'enter') {
    S = createState(S.values.slice());
    history = [];
  } else {
    analyse(S);
    if (setup.marks) {
      const ignored = applyMarks(S, setup.marks, true);
      if (ignored) toast(`Ignored pencil marks in ${ignored} cell${ignored > 1 ? 's' : ''} that looked misread.`);
    } else resetCandidates(S);
  }
  setup = null;
  if (!S.solvable) toast('Heads up: this grid has no solution.');
  changed();
}

// ------------------------------------------------------------------ input

function input(d, asMark) {
  const i = selected;
  if (setup) {
    pushUndo();
    const had = S.values[i] > 0;
    if (!d) { S.values[i] = 0; S.givens[i] = false; }
    else {
      S.values[i] = S.values[i] === d && setup.kind === 'enter' ? 0 : d;
      // a digit typed into an empty cell during setup is a clue
      if (setup.kind === 'enter' || !had) S.givens[i] = !!S.values[i];
    }
    setup.uncertain.delete(i);
    const marks = setup.marks;
    S.cands = basicCandidates(S.values);
    if (marks) for (let k = 0; k < 81; k++) if (!S.values[k] && marks[k]) S.cands[k] &= marks[k] | 0;
    analyse(S);
    changed();
    return;
  }
  if (S.givens[i] && S.values[i]) return;
  if (!d) {
    if (!S.values[i]) return;
    pushUndo();
    eraseCell(S, i);
    changed();
    return;
  }
  if (asMark) {
    if (S.values[i]) return;
    pushUndo();
    S.cands[i] ^= BIT(d);
    changed();
    return;
  }
  pushUndo();
  if (S.values[i] === d) eraseCell(S, i);
  else {
    if (S.values[i]) eraseCell(S, i);
    placeDigit(S, i, d);
  }
  changed();
  if (isSolved(S)) toast('🎉 Solved!');
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restoreSnap(undoStack.pop());
  changed();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restoreSnap(redoStack.pop());
  changed();
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input, dialog[open]')) return;
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const m = e.code && e.code.match(/^(?:Digit|Numpad)([0-9])$/);
  if (m) { e.preventDefault(); input(+m[1], pencil !== e.shiftKey); return; }
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (k in moves) {
    e.preventDefault();
    const r = ROW(selected), c = COL(selected);
    if (k === 'ArrowUp') selected = ((r + 8) % 9) * 9 + c;
    if (k === 'ArrowDown') selected = ((r + 1) % 9) * 9 + c;
    if (k === 'ArrowLeft') selected = r * 9 + (c + 8) % 9;
    if (k === 'ArrowRight') selected = r * 9 + (c + 1) % 9;
    render();
    return;
  }
  if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); input(0); return; }
  if (k === ' ' || k.toLowerCase() === 'p') { e.preventDefault(); pencil = !pencil; render(); return; }
  if (k.toLowerCase() === 'h') { e.preventDefault(); doHint(); return; }
  if (k.toLowerCase() === 'a' && hint && !hint.problem) { e.preventDefault(); doApply(); return; }
  if (k === 'Escape' && hint) { hint = null; hintLevel = 0; render(); }
});

$('#mode-normal').onclick = () => { pencil = false; render(); };
$('#mode-pencil').onclick = () => { pencil = true; render(); };
$('#btn-undo').onclick = undo;
$('#btn-redo').onclick = redo;

// ------------------------------------------------------------------ hints

function doHint() {
  if (setup) { toast(setup.kind === 'review' ? 'Confirm the board first ("Looks right").' : 'Press "Start solving" first.'); return; }
  if (!S.values.some(Boolean)) { openImport(); return; }
  if (hint) { if (hintLevel < 2) { hintLevel = 2; render(); } return; }
  const h = getHint(S);
  if (!h) { toast('Already solved!'); return; }
  hint = h;
  hintLevel = 1;
  render();
}

function summary(step) {
  const parts = [];
  if (step.placements.length) parts.push(step.placements.map((p) => `${cellName(p.cell)} = ${p.digit}`).join(', '));
  if (step.eliminations.length) parts.push('remove ' + describeEliminations(step.eliminations));
  return parts.join('; ');
}

function doApply() {
  if (!hint || hint.problem) return;
  pushUndo();
  applyStep(S, hint);
  history.push({ t: hint.technique, s: summary(hint) });
  const placed = hint.placements[0];
  if (placed) selected = placed.cell;
  changed();
  if (isSolved(S)) toast('🎉 Solved!');
}

$('#btn-hint').onclick = doHint;
$('#btn-singles').onclick = () => {
  if (setup) return doHint();
  if (findProblems(S)) { doHint(); return; }
  pushUndo();
  let n = 0;
  for (;;) {
    const h = getHint(S);
    if (!h || h.problem || !/Single|Full House/.test(h.technique)) break;
    applyStep(S, h);
    history.push({ t: h.technique, s: summary(h) });
    n++;
  }
  if (!n) { undoStack.pop(); toast('No singles right now — try a hint.'); return; }
  changed();
  toast(`Filled ${n} single${n > 1 ? 's' : ''}.`);
};

// ------------------------------------------------------------------ menu

const menu = $('#menu');
$('#btn-menu').onclick = (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  $('#btn-menu').setAttribute('aria-expanded', String(!menu.hidden));
};
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#menu')) menu.hidden = true; });
$('#opt-marks').onchange = (e) => { showMarks = e.target.checked; render(); };
menu.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  menu.hidden = true;
  const act = b.dataset.act;
  if (act === 'enter') startEntering();
  if (act === 'copy') copy(gridToString(S.values.map((v, i) => (S.givens[i] ? v : 0))), 'Puzzle copied.');
  if (act === 'link') copy(location.origin + location.pathname + '#' + encodePosition(), 'Link copied.');
  if (act === 'reset-cands') { pushUndo(); resetCandidates(S); changed(); toast('Pencil marks recalculated.'); }
  if (act === 'check') {
    const pr = findProblems(S);
    if (!pr) toast('No mistakes so far 👍');
    else { hint = getHint(S); hintLevel = 2; render(); }
  }
  if (act === 'restart') {
    pushUndo();
    const v = S.values.map((x, i) => (S.givens[i] ? x : 0));
    S = createState(v);
    history = [];
    changed();
  }
});

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copy this:', text); }
}

function encodePosition() {
  const g = S.values.map((v, i) => (S.givens[i] ? v : 0)).join('');
  const u = S.values.map((v, i) => (S.givens[i] ? 0 : v)).join('');
  return `g=${g}&u=${u}&c=${candidatesToString(S.cands)}`;
}

function startEntering() {
  pushUndo();
  S = createState(new Array(81).fill(0));
  history = [];
  setup = { kind: 'enter', marks: null, preview: null, uncertain: new Set() };
  selected = 0;
  closeImport();
  changed();
}

// ------------------------------------------------------------------ import

const dlg = $('#import-dlg');
function openImport() {
  if (!dlg.open) dlg.showModal();
  $('#drop').focus();
}
function closeImport() { if (dlg.open) dlg.close(); }
$('#btn-import').onclick = openImport;
$('#link-import').onclick = (e) => { e.preventDefault(); openImport(); };
$('#btn-enter').onclick = startEntering;
$('#btn-load-digits').onclick = () => {
  const txt = $('#digits').value;
  if (!importText(txt)) toast('Need exactly 81 digits (use 0 or . for blanks).');
};
$('#file').onchange = (e) => {
  const f = e.target.files[0];
  if (f) importImage(f);
  e.target.value = '';
};

function importText(txt) {
  txt = txt.trim();
  const hashIdx = txt.indexOf('#');
  if (hashIdx >= 0 && /[#&]g=/.test(txt)) return importHash(txt.slice(hashIdx + 1));
  const g = parseGrid(txt);
  if (!g) return false;
  pushUndo();
  S = createState(g);
  history = [];
  setup = null;
  closeImport();
  changed();
  reportPuzzle();
  return true;
}

function importHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const g = parseGrid(p.get('g') || p.get('p') || '');
  if (!g) return false;
  const u = parseGrid(p.get('u') || '') || new Array(81).fill(0);
  const values = g.map((v, i) => v || u[i]);
  const givens = g.map((v) => v > 0);
  const marks = parseCandidates(p.get('c') || '');
  pushUndo();
  S = createState(values, givens, marks);
  history = [];
  setup = null;
  closeImport();
  changed();
  reportPuzzle();
  return true;
}

function reportPuzzle() {
  const st = statusLine();
  if (!st.ok) toast(st.text.replace(/^⚠️ /, ''));
  else toast('Puzzle loaded. Press Hint when you\'re stuck.');
}

let ocrMod = null;
async function importImage(blob) {
  closeImport();
  document.body.classList.add('busy');
  toast('Reading image…', 10000);
  try {
    ocrMod = ocrMod || (await import('./ocr.js'));
    const img = await ocrMod.loadImage(blob);
    await new Promise((r) => setTimeout(r, 20));
    const res = ocrMod.recognize(img);
    pushUndo();
    S = createState(res.values, res.givens);
    const hasMarks = res.marks.some(Boolean);
    if (hasMarks) applyMarks(S, res.marks, true);
    history = [];
    setup = { kind: 'review', marks: hasMarks ? res.marks : null, preview: res.preview, uncertain: new Set(res.uncertain) };
    selected = res.uncertain[0] ?? 40;
    changed();
    toast('Check the board, then press "Looks right".');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Could not read that image.', 5000);
  } finally {
    document.body.classList.remove('busy');
  }
}

document.addEventListener('paste', (e) => {
  if (e.target.closest && e.target.closest('textarea')) return;
  const items = [...(e.clipboardData?.items || [])];
  const imgItem = items.find((it) => it.type.startsWith('image/'));
  if (imgItem) {
    e.preventDefault();
    importImage(imgItem.getAsFile());
    return;
  }
  const text = e.clipboardData?.getData('text');
  if (text && importText(text)) e.preventDefault();
});

const drop = $('#drop');
for (const target of [document.body]) {
  target.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  target.addEventListener('dragleave', () => drop.classList.remove('over'));
  target.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) importImage(f);
  });
}

// NYT bookmarklet: reads clues, entries and pencil marks from the page's DOM.
function bookmarkletHref() {
  const app = location.origin + location.pathname;
  const code = `(()=>{const C=[...document.querySelectorAll('[data-cell]')].sort((a,b)=>a.dataset.cell-b.dataset.cell);if(C.length!==81){alert('Sudoku Coach: open the NYT Sudoku page first (no grid found).');return}const R=C.map(e=>e.getBoundingClientRect());let g='',u='';const k=C.map(()=>new Set());C.forEach(e=>{const l=e.getAttribute('aria-label')||'';const m=l.match(/(prefilled\\s+)?([1-9])\\s*$/);const s=e.querySelector('.su-cell__value');const v=m?m[2]:s&&s.dataset.number;const p=m?!!m[1]:/prefilled/.test(e.className);g+=v&&p?v:'0';u+=v&&!p?v:'0'});document.querySelectorAll('.su-candidate').forEach(s=>{const r=s.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;const i=R.findIndex(q=>x>=q.left&&x<q.right&&y>=q.top&&y<q.bottom);const d=s.dataset.candidate||s.dataset.number;if(i>=0&&d)k[i].add(d)});const c=k.map(s=>[...s].sort().join('')).join('.');window.open(${JSON.stringify(app)}+'#g='+g+'&u='+u+'&c='+c,'_blank')})()`;
  return 'javascript:' + encodeURIComponent(code);
}
$('#bookmarklet').href = bookmarkletHref();
$('#bookmarklet').addEventListener('click', (e) => {
  e.preventDefault();
  toast('Drag this button to your bookmarks bar, then click it on the NYT page.');
});

// ------------------------------------------------------------------ toast

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ boot

load();
if (location.hash.length > 5) {
  const ok = importHash(location.hash.slice(1));
  window.history.replaceState(null, '', location.pathname + location.search);
  if (!ok) toast('That link did not contain a puzzle.');
}
window.addEventListener('hashchange', () => {
  if (location.hash.length > 5 && importHash(location.hash.slice(1))) window.history.replaceState(null, '', location.pathname + location.search);
});
render();
if (!S.values.some(Boolean) && !setup) $('#empty-hint').hidden = false;

window.__coach = { get state() { return S; }, importText, importImage };
