// Screenshot / photo -> sudoku grid, entirely in the browser.
//  1. adaptive threshold, find the biggest square-ish connected blob (the grid lines)
//  2. take its four outer corners and perspective-warp the grid to a square
//  3. per cell: big glyph => a placed digit, small glyphs => pencil marks (by position)
//  4. digits are classified against templates rendered from common fonts, then
//     re-classified against confident digits from the same image, then fixed up so
//     no row/column/box repeats a digit.
//  5. clues vs. entered digits are told apart by cell background colour (NYT shades clues).

import { PEERS, solve } from './sudoku.js';

const S = 64; // warped cell size in px
const N = S * 9;
const FW = 10, FH = 14; // feature grid

// ------------------------------------------------------------------ image helpers

export async function loadImage(src) {
  if (src instanceof Blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(src); } catch { /* fall through */ }
    }
    src = URL.createObjectURL(src);
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toRGBA(img, maxDim = 2000) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const k = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

function grayOf({ w, h, data }) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000;
  return g;
}

function median(arr) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < arr.length; i += 7) hist[arr[i]]++;
  let total = 0;
  for (const v of hist) total += v;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc * 2 >= total) return v; }
  return 255;
}

function adaptiveDark(gray, w, h, radius, C) {
  // integral image
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
      const sum = ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * w + x] = gray[y * w + x] < mean - C ? 1 : 0;
    }
  }
  return out;
}

/** Connected components (8-connectivity). Returns label array and per-component stats. */
function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const comps = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = comps.length + 1;
    let sp = 0, count = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    stack[sp++] = start; labels[start] = id;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      count++;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] && !labels[q]) { labels[q] = id; stack[sp++] = q; }
        }
      }
    }
    comps.push({ id, count, minx, maxx, miny, maxy, w: maxx - minx + 1, h: maxy - miny + 1 });
  }
  return { labels, comps };
}

// ------------------------------------------------------------------ grid location

function findGrid(gray, w, h) {
  const radius = Math.max(6, Math.round(Math.min(w, h) / 50));
  const mask = adaptiveDark(gray, w, h, radius, 18);
  const { labels, comps } = components(mask, w, h);
  const minSide = Math.min(w, h) * 0.2;
  let best = null;
  for (const c of comps) {
    if (c.w < minSide || c.h < minSide) continue;
    const aspect = c.w / c.h;
    if (aspect < 0.7 || aspect > 1.43) continue;
    if (c.count / (c.w * c.h) > 0.5) continue;
    if (!best || c.w * c.h > best.w * best.h) best = c;
  }
  if (!best) return null;
  // outer corners from extreme points of the blob
  let tl = null, tr = null, br = null, bl = null;
  let vtl = Infinity, vtr = -Infinity, vbr = -Infinity, vbl = -Infinity;
  for (let y = best.miny; y <= best.maxy; y++) for (let x = best.minx; x <= best.maxx; x++) {
    if (labels[y * w + x] !== best.id) continue;
    if (x + y < vtl) { vtl = x + y; tl = [x, y]; }
    if (x + y > vbr) { vbr = x + y; br = [x, y]; }
    if (x - y > vtr) { vtr = x - y; tr = [x, y]; }
    if (y - x > vbl) { vbl = y - x; bl = [x, y]; }
  }
  // nudge to pixel outer edges
  return { corners: [tl, [tr[0] + 1, tr[1]], [br[0] + 1, br[1] + 1], [bl[0], bl[1] + 1]], bbox: best };
}

/** Homography mapping unit square corners (0,0),(1,0),(1,1),(0,1) to the 4 given points. */
function homography(pts) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = pts;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, hh = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  return (u, v) => {
    const z = g * u + hh * v + 1;
    return [(a * u + b * v + c) / z, (d * u + e * v + f) / z];
  };
}

function warp(rgba, corners) {
  const { w, h, data } = rgba;
  const H = homography(corners);
  const out = new Uint8ClampedArray(N * N * 4);
  for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
    const [x, y] = H((u + 0.5) / N, (v + 0.5) / N);
    const fx = Math.min(w - 1.001, Math.max(0, x - 0.5)), fy = Math.min(h - 1.001, Math.max(0, y - 0.5));
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
    const o = (v * N + u) * 4;
    for (let ch = 0; ch < 3; ch++) {
      const p00 = data[(iy * w + ix) * 4 + ch], p10 = data[(iy * w + ix + 1) * 4 + ch];
      const p01 = data[((iy + 1) * w + ix) * 4 + ch], p11 = data[((iy + 1) * w + ix + 1) * 4 + ch];
      out[o + ch] = (p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay;
    }
    out[o + 3] = 255;
  }
  return out;
}

// ------------------------------------------------------------------ features & templates

/** Coverage features of a binary glyph (mask over a bbox). */
function featureOf(mask, mw, x0, y0, bw, bh) {
  const f = new Float32Array(FW * FH + 1);
  for (let gy = 0; gy < FH; gy++) for (let gx = 0; gx < FW; gx++) {
    const sx0 = x0 + (gx * bw) / FW, sx1 = x0 + ((gx + 1) * bw) / FW;
    const sy0 = y0 + (gy * bh) / FH, sy1 = y0 + ((gy + 1) * bh) / FH;
    let sum = 0, area = 0;
    for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
      const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
      if (wy <= 0) continue;
      for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
        const wx = Math.min(x + 1, sx1) - Math.max(x, sx0);
        if (wx <= 0) continue;
        sum += mask[y * mw + x] * wx * wy;
        area += wx * wy;
      }
    }
    f[gy * FW + gx] = area ? sum / area : 0;
  }
  f[FW * FH] = Math.min(1.2, bw / bh) * 3; // aspect ratio, weighted
  return f;
}

function dist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return s;
}

const FONTS = [
  'Arial', 'Helvetica', 'Helvetica Neue', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Roboto',
  'Franklin Gothic Medium', 'Libre Franklin', 'Avenir', 'Futura', 'Gill Sans', 'Georgia', 'Times New Roman',
  'Courier New', 'Menlo', 'DejaVu Sans', 'Liberation Sans', 'system-ui', 'sans-serif', 'serif', 'monospace',
];
let TEMPLATES = null;

function templates() {
  if (TEMPLATES) return TEMPLATES;
  const size = 96;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const list = [];
  const seen = new Set();
  for (const font of FONTS) for (const weight of [400, 700, 900]) for (let d = 1; d <= 9; d++) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    ctx.font = `${weight} 72px "${font}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(d), size / 2, size / 2);
    const px = ctx.getImageData(0, 0, size, size).data;
    const m = new Uint8Array(size * size);
    let minx = size, maxx = -1, miny = size, maxy = -1;
    for (let i = 0; i < m.length; i++) if (px[i * 4] < 128) {
      m[i] = 1;
      const x = i % size, y = (i / size) | 0;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    if (maxx < 0) continue;
    const f = featureOf(m, size, minx, miny, maxx - minx + 1, maxy - miny + 1);
    const key = d + ':' + Array.from(f, (v) => Math.round(v * 20)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ d, f });
  }
  TEMPLATES = list;
  return list;
}

/** Score each digit 1..9 (lower = better) against a set of {d,f} prototypes. */
function scores(f, protos) {
  const best = new Array(10).fill(Infinity);
  for (const p of protos) {
    const s = dist(f, p.f);
    if (s < best[p.d]) best[p.d] = s;
  }
  return best;
}
const ranking = (sc) => [1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => sc[a] - sc[b]);

// ------------------------------------------------------------------ cell analysis

function analyseCells(rgb) {
  const gray = new Uint8ClampedArray(N * N);
  for (let i = 0; i < gray.length; i++) gray[i] = (rgb[i * 4] * 299 + rgb[i * 4 + 1] * 587 + rgb[i * 4 + 2] * 114) / 1000;
  const cells = [];
  const m = Math.round(S * 0.06);
  const R = S - 2 * m;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const ox = c * S + m, oy = r * S + m;
    // background = bright percentile, ink threshold halfway to the darkest pixels
    const vals = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) vals.push(gray[(oy + y) * N + ox + x]);
    const sorted = Float32Array.from(vals).sort();
    const bg = sorted[Math.floor(sorted.length * 0.7)];
    const dark = sorted[Math.floor(sorted.length * 0.003)];
    const cell = { r, c, bg, digitFeature: null, marks: 0, bgColor: null };
    const mask = new Uint8Array(R * R);
    if (bg - dark > 45) {
      const thr = bg - (bg - dark) * 0.5;
      for (let i = 0; i < vals.length; i++) mask[i] = vals[i] < thr ? 1 : 0;
      // wipe grid-line remnants: rows/columns that are mostly ink
      for (let y = 0; y < R; y++) {
        let k = 0;
        for (let x = 0; x < R; x++) k += mask[y * R + x];
        if (k > R * 0.7) for (let x = 0; x < R; x++) mask[y * R + x] = 0;
      }
      for (let x = 0; x < R; x++) {
        let k = 0;
        for (let y = 0; y < R; y++) k += mask[y * R + x];
        if (k > R * 0.7) for (let y = 0; y < R; y++) mask[y * R + x] = 0;
      }
    }
    let { labels, comps } = components(mask, R, R);
    // drop specks and grid-line remnants along the edges
    comps = comps.filter((k) => {
      if (k.count < 4) return false;
      const touches = k.minx === 0 || k.miny === 0 || k.maxx === R - 1 || k.maxy === R - 1;
      if (touches && (k.w > R * 0.6 || k.h > R * 0.6 || k.w <= 2 || k.h <= 2)) return false;
      return true;
    });
    const big = comps.filter((k) => k.h >= S * 0.27 && k.h <= S * 0.95 && k.w <= S * 0.8);
    if (big.length) {
      const main = big.reduce((a, b) => (a.count > b.count ? a : b));
      // include fragments overlapping the main glyph's box (broken strokes)
      const parts = comps.filter((k) => k === main || (k.minx <= main.maxx + 2 && k.maxx >= main.minx - 2 && k.miny <= main.maxy + 2 && k.maxy >= main.miny - 2));
      const ids = new Set(parts.map((k) => k.id));
      const gm = new Uint8Array(R * R);
      let minx = R, maxx = 0, miny = R, maxy = 0;
      for (let i = 0; i < gm.length; i++) if (ids.has(labels[i])) {
        gm[i] = 1;
        const x = i % R, y = (i / R) | 0;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      cell.digitFeature = featureOf(gm, R, minx, miny, maxx - minx + 1, maxy - miny + 1);
    } else {
      for (const k of comps) {
        if (k.h < S * 0.07 || k.h > S * 0.25 || k.w > S * 0.3) continue;
        const cx = (k.minx + k.maxx) / 2 + m, cy = (k.miny + k.maxy) / 2 + m;
        const sx = Math.min(2, Math.floor(cx / (S / 3))), sy = Math.min(2, Math.floor(cy / (S / 3)));
        cell.marks |= 1 << (sy * 3 + sx + 1);
      }
    }
    // background colour = mean of non-ink pixels
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      if (mask[y * R + x]) continue;
      const g = gray[(oy + y) * N + ox + x];
      if (g < bg - 25) continue;
      const o = ((oy + y) * N + ox + x) * 4;
      rs += rgb[o]; gs += rgb[o + 1]; bs += rgb[o + 2]; n++;
    }
    cell.bgColor = n ? [rs / n, gs / n, bs / n] : [255, 255, 255];
    cells.push(cell);
  }
  return cells;
}

// ------------------------------------------------------------------ classification

function classify(cells) {
  const T = templates();
  const filled = cells.filter((c) => c.digitFeature);
  for (const c of filled) {
    c.sc = scores(c.digitFeature, T);
    c.rank = ranking(c.sc);
  }
  // second pass: confident digits from this very image become prototypes (same font!)
  const own = [];
  for (const c of filled) {
    const [a, b] = c.rank;
    if (c.sc[b] > c.sc[a] * 1.5) own.push({ d: a, f: c.digitFeature });
  }
  const ownDigits = new Set(own.map((p) => p.d));
  for (const c of filled) {
    const sc2 = scores(c.digitFeature, own.filter((p) => p.f !== c.digitFeature));
    const comb = new Array(10).fill(Infinity);
    for (let d = 1; d <= 9; d++) {
      comb[d] = ownDigits.has(d) && sc2[d] < Infinity ? Math.min(c.sc[d], sc2[d] * 0.8) : c.sc[d];
    }
    c.sc = comb;
    c.rank = ranking(comb);
    c.digit = c.rank[0];
    c.conf = 1 - comb[c.rank[0]] / Math.max(1e-6, comb[c.rank[1]]);
  }
  // constraint repair: no digit twice in a unit
  for (let iter = 0; iter < 30; iter++) {
    let changed = false;
    for (const c of filled) {
      const i = c.r * 9 + c.c;
      const clash = PEERS[i].map((p) => cells[p]).filter((o) => o.digitFeature && o.digit === c.digit);
      if (!clash.length) continue;
      const weakest = [c, ...clash].reduce((a, b) => (a.conf <= b.conf ? a : b));
      const wi = weakest.r * 9 + weakest.c;
      const used = new Set(PEERS[wi].map((p) => cells[p]).filter((o) => o.digitFeature).map((o) => o.digit));
      const alt = weakest.rank.find((d) => d !== weakest.digit && !used.has(d));
      if (alt) { weakest.digit = alt; weakest.conf = 0; weakest.repaired = true; changed = true; }
    }
    if (!changed) break;
  }
}

function guessGivens(cells, values) {
  const emptyColors = cells.filter((c) => !c.digitFeature).map((c) => c.bgColor);
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 14;
  const givens = cells.map((c) => !!c.digitFeature && !emptyColors.some((e) => near(e, c.bgColor)));
  const nGiven = givens.filter(Boolean).length;
  const nFilled = values.filter(Boolean).length;
  if (nGiven === nFilled || nGiven < 17) return values.map((v) => v > 0);
  const clues = values.map((v, i) => (givens[i] ? v : 0));
  if (solve(clues, 1).count === 0) return values.map((v) => v > 0);
  return givens;
}

/**
 * Recognise a sudoku in an image (HTMLImageElement / ImageBitmap / canvas).
 * Returns { values, givens, marks, confidence, uncertain, preview } or throws.
 */
export function recognize(img) {
  const rgba = toRGBA(img);
  let gray = grayOf(rgba);
  const dark = median(gray) < 100;
  if (dark) {
    for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];
    const d = rgba.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
  }
  const grid = findGrid(gray, rgba.w, rgba.h);
  if (!grid) throw new Error("Couldn't find a sudoku grid in that image.");
  const rgb = warp(rgba, grid.corners);
  const cells = analyseCells(rgb);
  classify(cells);
  const values = cells.map((c) => (c.digitFeature ? c.digit : 0));
  if (values.filter(Boolean).length < 8) throw new Error("Found a grid, but couldn't read enough digits from it.");
  const givens = guessGivens(cells, values);
  const marks = cells.map((c) => (c.digitFeature ? 0 : c.marks));
  const confidence = cells.map((c) => (c.digitFeature ? c.conf : 1));
  const uncertain = cells.map((c, i) => (c.digitFeature && (c.conf < 0.12 || c.repaired) ? i : -1)).filter((i) => i >= 0);
  // preview image of the warped grid
  let preview = null;
  if (typeof document !== 'undefined') {
    const pc = document.createElement('canvas');
    pc.width = N; pc.height = N;
    const pctx = pc.getContext('2d');
    const id = pctx.createImageData(N, N);
    id.data.set(rgb);
    pctx.putImageData(id, 0, 0);
    if (dark) { pctx.globalCompositeOperation = 'difference'; pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, N, N); }
    preview = pc.toDataURL('image/jpeg', 0.85);
  }
  return { values, givens, marks, confidence, uncertain, preview, corners: grid.corners };
}
