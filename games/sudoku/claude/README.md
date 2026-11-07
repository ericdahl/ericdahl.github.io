# Sudoku Coach

A hint-giving sudoku helper. Get your puzzle in with a screenshot (or one click from
the NYT page), and when you're stuck it tells you the **next logical step** — first a
nudge (which technique, where to look), then the full explanation with the pattern
highlighted on the board, then it applies it for you.

Static site, no build step, no server: everything (including the OCR) runs in the
browser. Deployed with the other games by `.github/workflows/pages.yml`, at
`https://ericdahl.github.io/games/sudoku/claude/`.

## Getting a puzzle in

- **Paste a screenshot** anywhere on the page (Ctrl/⌘+V), drop an image, or pick one
  (on a phone: from Photos). The board is located, perspective-corrected and read;
  you get a review banner with the cropped image to compare before you start.
  It reads placed digits *and* pencil marks (by their position in the cell), and on
  NYT screenshots tells the puzzle's clues from your own entries by the cell shading.
- **NYT bookmarklet**: drag the button from the Import dialog to the bookmarks bar
  and click it on nytimes.com/puzzles/sudoku. It reads the board from the page
  (clues, your entries, pencil marks) and opens the coach with that exact position.
- **Digits**: paste 81 characters (`0`/`.` for blanks) or type the puzzle on the board.

## Hints

Techniques, in the order they're tried: Full House, Naked/Hidden Single, Locked
Candidates (pointing & claiming), Naked/Hidden Pair, Triple, Quad, X-Wing, Skyscraper /
2-String Kite / Turbot Fish, XY-Wing, XYZ-Wing, W-Wing, Swordfish, Unique Rectangle
(type 1), Jellyfish, BUG+1, X-Chain, XY-Chain and general Alternating Inference Chains
(drawn on the board with strong/weak links). If none applies it says so and reveals
one cell.

Before hinting it checks your grid against the solution: wrong entries and pencil
marks that removed the right digit are reported (and can be fixed) instead of leading
you down a broken path.

## Code

- `js/sudoku.js` — geometry, candidate bitmasks, backtracking solver, parsing
- `js/techniques.js` — the technique finders; each returns a step with nudge,
  explanation, eliminations/placements and highlight data
- `js/coach.js` — game state, mistake checks, hint driver
- `js/ocr.js` — image → grid (adaptive threshold, grid blob + corners, homography
  warp, per-cell glyph analysis, template + same-image digit classification, sudoku
  constraint repair)
- `js/app.js` — UI

## Tests

```bash
node --test tests/*.test.mjs   # solver + hint engine (every step checked against the solution)
node tests/ocr-e2e.mjs         # OCR on synthetic boards in headless Chromium (needs playwright)
```
