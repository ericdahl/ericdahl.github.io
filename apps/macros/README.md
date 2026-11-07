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

Everything is in `localStorage` on this device and browser. Nothing is sent anywhere, except Open Food Facts searches and lookups. Clearing site data deletes the log, so export now and then.

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

It's Vite and TypeScript with no framework, like the other apps and games here, and the GitHub Pages workflow builds and publishes it with them. Source:

- `src/parse.ts`: the quick-add parser and food matching
- `src/nutrition.ts`: units and target maths
- `src/jsonl.ts`: export and import
- `src/off.ts`: Open Food Facts
- `src/store.ts`: storage
- the `*View.ts` files and `today.ts`: the pages
