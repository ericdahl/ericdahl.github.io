// OCR regression test: draws sudoku boards (various fonts, pencil marks, rotation,
// dark mode) on a canvas in headless Chromium and checks recognize() reads them back.
// Run: node tests/ocr-e2e.mjs   (needs the `playwright` package and Chromium)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const PUZZLE = '008320079702940005010785206000693028296814753800572960100460092080250000020130000';
const MARKS = { 0: [4, 5], 1: [4, 5, 6], 5: [1, 6], 15: [1, 3, 8], 63: [3, 4, 6, 9], 80: [4, 7] };

const CASES = [
  { name: 'sans bold', font: '700 {s}px Arial, Helvetica, sans-serif' },
  { name: 'serif', font: '400 {s}px Georgia, "Times New Roman", serif' },
  { name: 'pencil marks', font: '600 {s}px "Helvetica Neue", Arial, sans-serif', marks: true },
  { name: 'rotated 4°', font: '700 {s}px sans-serif', rotate: 4 },
  { name: 'dark mode', font: '600 {s}px sans-serif', dark: true, marks: true },
  { name: 'small', font: '700 {s}px sans-serif', size: 300 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/tests/blank.html`);
let failed = 0;
for (const c of CASES) {
  const r = await page.evaluate(async ({ c, PUZZLE, MARKS }) => {
    const { recognize } = await import('/js/ocr.js');
    const size = c.size || 600, pad = 60, W = size + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = W + 200; cv.height = W;
    const g = cv.getContext('2d');
    const bg = c.dark ? '#121212' : '#fff', fg = c.dark ? '#eee' : '#111';
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = fg; g.font = '20px sans-serif'; g.fillText('Some page header text', 10, 30);
    g.translate(pad + size / 2, pad + size / 2);
    g.rotate(((c.rotate || 0) * Math.PI) / 180);
    g.translate(-size / 2, -size / 2);
    const cs = size / 9;
    g.strokeStyle = fg;
    for (let k = 0; k <= 9; k++) {
      g.lineWidth = k % 3 === 0 ? 3 : 1;
      g.beginPath(); g.moveTo(k * cs, 0); g.lineTo(k * cs, size); g.stroke();
      g.beginPath(); g.moveTo(0, k * cs); g.lineTo(size, k * cs); g.stroke();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    for (let i = 0; i < 81; i++) {
      const r = (i / 9) | 0, col = i % 9, d = +PUZZLE[i];
      if (d) {
        g.font = c.font.replace('{s}', Math.round(cs * 0.6));
        g.fillText(String(d), col * cs + cs / 2, r * cs + cs / 2 + 1);
      } else if (c.marks && MARKS[i]) {
        g.font = `400 ${Math.round(cs * 0.22)}px sans-serif`;
        for (const m of MARKS[i]) g.fillText(String(m), col * cs + (((m - 1) % 3) + 0.5) * cs / 3, r * cs + ((((m - 1) / 3) | 0) + 0.5) * cs / 3);
      }
    }
    try {
      const res = recognize(cv);
      const marks = {};
      res.marks.forEach((m, i) => { if (m) marks[i] = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & (1 << d)); });
      return { got: res.values.join(''), marks };
    } catch (e) { return { err: e.message }; }
  }, { c, PUZZLE, MARKS });
  let ok = !r.err && r.got === PUZZLE;
  if (ok && c.marks) ok = JSON.stringify(r.marks) === JSON.stringify(MARKS);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}${ok ? '' : '  ' + JSON.stringify(r)}`);
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
