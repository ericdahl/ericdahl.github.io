# Macros: calorie and macro tracker

A phone-first calorie and macro tracker. You log food by typing what you ate as one line of text. It runs in the browser, keeps everything on the device, and exports to JSON Lines so an AI (or anything else) can read the history. "Add to Home Screen" gives it an app icon.

## Using it

**Today** shows a calorie ring and three macro bars, each with its own kind of target:

- **Protein**: a minimum. "140g to go" until you reach it, then "✓ target met".
- **Fat**: a maximum. "58g left", turning red and striped once you go over.
- **Carbs**: whatever calories remain. With the defaults (3000 kcal, ≥200g protein, ≤70g fat) that is (3000 − 800 − 630) ÷ 4 = 393g.

Under the bars, **Still to eat** gives what is left for the rest of the day. It shows the protein you still need, the fat you can still have, and the carbs that fit in the calories left once those two are covered.

**Quick add** is the text box. Type a whole meal, separated by commas, and press Enter:

```
86g oatmeal dry, 100g blueberries, 2 scoops protein powder (optimum nutrition), 3 fish oil soft gels
```

Each item shows up as you type, with its match and macros, and a total at the bottom. Tap an item to pick a different food or change the amount. What it understands:

- Weights and volumes: `g`, `kg`, `oz`, `lb`, `ml`, `cup`, `tbsp`, `tsp`.
- A food's own servings: `2 scoops whey`, `3 eggs`, `1 slice pizza`, `1 bottle core power`.
- Fractions and number words: `1 1/2 cups rice`, `½ tbsp olive oil`, `a banana`.
- Quantities after the food: `oatmeal 40g`.
- Dry, raw and cooked are kept apart, so `80g rice dry` won't match cooked rice.
- A bare number of 20 or more is grams: `150 chicken`.
- Plain macros for restaurant meals: `burrito 900 kcal 45p 35f 100c`.

Items with no match stay in the box after the rest are added, with a link to search for them.

**One-tap buttons** sit under the box:

- **Saved meals.** Three come set up:
  - "Usual breakfast": the four items above.
  - "Protein shake": 2 scoops of whey.
  - "Egg tacos": 4 eggs, 4 mini corn tortillas and 2 tbsp salsa.

  Any logged meal can be saved as a new one with "Save as a meal…" below it. Saved meals can be edited or deleted on the Foods page. A deleted built-in meal doesn't come back.
- **Portions you log often.** Anything logged at least twice in 60 days, with the same amount, gets a button.

Every add has an **Undo**. Tap a logged item to change its amount, meal or date, or to delete it. ‹ › and the date move between days.

**History** has 7/14/30/90-day averages, how many days met the protein and fat targets, one bar chart each for calories, protein, fat and carbs with the target as a dashed line, and a table of days.

**Data** holds the targets, export, import and reset.

## Where the food data comes from

There isn't one free, keyless food database that covers both generic foods and US packaged brands, so the app uses several sources:

1. **Built-in list (~170 foods).** These are the usual staples: grains, fruit, vegetables, meat, fish, dairy, nuts, oils, sauces, drinks, and common supplements such as Optimum Nutrition Gold Standard whey and fish oil softgels. Values are per 100g from USDA FoodData Central, with named servings (cup, slice, scoop, egg…). It works offline and is in [`src/foods.ts`](src/foods.ts).
2. **Open Food Facts**, for packaged foods:
   - Search by name on the Foods page, or scan a barcode from quick add or Foods.
   - Scanning uses the browser's barcode reader on Android and Chrome. On iPhone it falls back to a WebAssembly ZXing build, loaded only when needed.
   - It's free, needs no key and works from a static page, but the data is crowd-sourced. The app warns when a product's calories don't add up from its macros, which usually means per-serving numbers were entered as per-100g.
   - Anything you log from it is saved to your own foods.
3. **Your own foods.** Enter them from a nutrition label, per serving or per 100g. Add aliases so quick add finds them by the words you type.
4. **An AI**, for anything else. "Ask an AI" on the Foods page copies a prompt for ChatGPT, Claude or Gemini (a photo of the label works too), then takes the reply as JSON lines.

Search ranks your own foods and frequently logged foods first, so after one correction quick add keeps choosing the food you meant.

USDA FoodData Central's API was left out because it needs an API key, and the shared demo key is limited to a handful of requests an hour.

## Export format (JSONL)

"Download .jsonl", "Copy" or "Share…" on the Data page, for all data or the last 7/30/90 days. Each line is one object with a `type`. Field names carry their units.

```jsonl
{"type":"meta","app":"macros","format_version":1,"exported_at":"…","time_zone":"America/Los_Angeles","first_date":"2026-11-01","last_date":"2026-11-07","notes":"…"}
{"type":"targets","kcal":3000,"protein_g_min":200,"fat_g_max":70,"carbs_g":393,"carbs_rule":"remainder: (kcal - 4*protein - 9*fat) / 4","fiber_g_min":38}
{"type":"day","date":"2026-11-07","kcal":2844,"protein_g":248,"fat_g":62,"carbs_g":314,"fiber_g":27,"items":11,"kcal_by_meal":{"breakfast":653,"dinner":2191},"protein_target_met":true,"fat_under_max":true,"kcal_vs_target":-156}
{"type":"entry","id":"e:…","date":"2026-11-07","meal":"breakfast","food":"Rolled oats (dry)","food_id":"b:oats-dry","qty":86,"unit":"g","grams":86,"kcal":326,"protein_g":11.4,"fat_g":5.6,"carbs_g":58.2,"fiber_g":8.7,"logged_at":"…"}
{"type":"food","id":"c:…","name":"Kirkland Greek yogurt","brand":null,"per_100g":{"kcal":…},"servings":[{"name":"cup","grams":227}],…}
{"type":"routine","id":"r:morning","name":"Usual breakfast","meal":"breakfast","items":[{"food_id":"b:oats-dry","food":"Rolled oats (dry)","qty":86,"unit":"g"},…]}
```

- **Lines.** `day` lines hold each date's totals, so a reader doesn't have to add up the entries. Each `entry` already has its macros worked out for the amount eaten.
- **Foods.** Built-in foods are left out, since `food_id` and the name identify them.
- **Import.** Import takes the same format, so an export restores cleanly. Ids are kept, so importing twice doesn't duplicate anything.
- **Lines from an AI.** Import also accepts what an AI typically writes:
  - a ```` ``` ```` code fence around the lines
  - plain field names: `protein`, `calories`
  - `per_serving` with a weight in grams, instead of `per_100g`
  - entry lines with only a food and amount (`{"type":"entry","date":"…","food":"eggs","qty":3}`), which are looked up the same way quick add does

## Storage

By default everything is in `localStorage` on this device and browser. Nothing is sent anywhere, except Open Food Facts searches and lookups. Clearing site data deletes the log, so export now and then, or turn on GitHub sync.

## GitHub sync (optional)

On the Data page you can connect a GitHub repository. Each food entry is then also a line in that day's file, `<folder>/YYYY/MM/DD.jsonl`, with `db` as the default folder. That suits a repo that already logs workouts as one JSON line per item in per-day files, and gives an AI one place to read training and diet together.

```jsonl
{"ts": "2026-11-07T07:10:00-08:00", "type": "cardio", "modality": "run", "distance_miles": 3.1, "source": "cli", "raw": "/log run 3.1"}
{"ts": "2026-11-07T08:05:12-08:00", "type": "food", "id": "e:9f2c41d0-7b1", "meal": "breakfast", "food": "Rolled oats (dry)", "food_id": "b:oats-dry", "qty": 86, "unit": "g", "grams": 86, "kcal": 326, "protein_g": 11.4, "fat_g": 5.6, "carbs_g": 58.2, "fiber_g": 8.7, "source": "app", "raw": "86g oatmeal dry"}
```

**Setup:**

- **Token.** Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to that one repository and **Contents: read and write**, then paste it in.
- **Where it's kept.** The token stays in this browser's storage and is sent only to `api.github.com`.
- **Public repos.** The app warns you if the repository is public.

**What the app writes:**

- **Food lines only.** It only writes `"type": "food"` lines. Every other line in a day file is written back byte for byte, and food lines are slotted in by timestamp so the file stays in time order.
- **Lines from other tools.** Food lines written some other way, for example by Claude in that repo, show up in the app. They stay as written unless you edit them in the app.
  - A line with no `id` gets a stable one from its content.
  - A line with no macros has them looked up from the food name.
- **Format.** Lines use the same `ts` (with UTC offset), `source` and `raw` conventions as the workout lines:
  - `source` is `"app"`.
  - `raw` is what you typed, or `saved meal: …` / `tap: …` for one-tap adds.
- **Commits.** There's one commit per day changed, e.g. `food: 2026-11-07 Rolled oats (dry), Blueberries +2 more`.

**When it syncs:**

- After each change (2 s later)
- When the app opens or comes back to the foreground
- When the device comes back online
- When you tap the status line under the date

**How it stays safe:**

- **Downloads.** Each sync reads the repo's file list in one request and downloads only day files whose content changed.
- **Uploads.** It only writes days you changed. Each write carries the file's current hash, so if anything else committed to that file in between, GitHub rejects the write and the app reads and merges again.
- **Merging.** The merge is three-way per entry: what the last sync saw, what the device has now, and what the repo has now.
  - Additions on either side are kept.
  - Deletions on either side are applied, except that an entry you edited here survives a deletion in the repo.
  - An entry changed on both sides takes the device's version.
- **Offline.** Edits wait and are pushed later.
- **Connecting.** Connecting uploads the food already on the device, merged with whatever the repo has.
- **Disconnect and Delete all data.** Disconnect forgets the token and keeps your entries. "Delete all data" also disconnects. Neither changes the repo.

Not synced: your own foods, saved meals and targets. These stay on the device; use Export to back them up.

## Development

```
npm install
npm run dev        # http://localhost:5173
npm test           # parser, targets, JSONL round trip (vitest)
npm run e2e        # Playwright, phone and desktop viewports; Open Food Facts is stubbed
npm run build      # typecheck + static build to dist/
node scripts/icons.mjs   # re-render the PNG icons from public/icon.svg
```

Set `PW_CHROMIUM=/path/to/chrome` to run Playwright with an already-installed Chromium.

It's Vite and TypeScript with no framework, like the other apps under `games/`, and the GitHub Pages workflow builds and publishes it with them. Source:

- `src/parse.ts`: the quick-add parser and food matching
- `src/nutrition.ts`: units and target maths
- `src/jsonl.ts`: export and import
- `src/off.ts`: Open Food Facts
- `src/sync.ts`, `src/github.ts` and `src/repoLines.ts`: GitHub sync, the GitHub API calls, and the line format and merge
- `src/store.ts`: storage
- the `*View.ts` files and `today.ts`: the pages
