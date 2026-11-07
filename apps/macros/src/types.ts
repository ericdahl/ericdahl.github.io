/** Macros for some amount of food. Energy in kcal, the rest in grams. */
export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

/** A named portion of a food, such as "scoop" = 31 g or "softgel" = 1.2 g. */
export interface Serving {
  name: string;
  grams: number;
}

export type FoodSource = 'builtin' | 'custom' | 'off' | 'import';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** Extra words the quick-add box should match, e.g. "oats", "whey". */
  aliases?: string[];
  /** Nutrition per 100 g (or 100 ml for drinks, treated as grams). */
  per100: Macros;
  servings: Serving[];
  /** The serving used when a quantity has no unit ("3 fish oil" → 3 softgels). */
  defaultServing?: string;
  source: FoodSource;
  barcode?: string;
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/** One logged item. Macros are a snapshot, so later edits to the food don't rewrite history. */
export interface Entry extends Macros {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodId?: string;
  name: string;
  qty: number;
  unit: string;
  grams?: number;
  /** When it was logged, ISO 8601. */
  at: string;
}

/** A saved group of items added with one tap, e.g. "Usual breakfast". */
export interface Routine {
  id: string;
  name: string;
  meal?: Meal;
  items: { foodId: string; qty: number; unit: string }[];
}

export interface Targets {
  kcal: number;
  /** Minimum protein, g. */
  protein: number;
  /** Maximum fat, g. */
  fat: number;
  /** Carbs target, g; null means "whatever calories remain". */
  carbs: number | null;
  fiber: number | null;
}

export const DEFAULT_TARGETS: Targets = { kcal: 3000, protein: 200, fat: 70, carbs: null, fiber: 38 };

export const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
