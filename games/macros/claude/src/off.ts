import type { Food, Macros } from './types';

/**
 * Open Food Facts: a free, crowd-sourced database of packaged foods (no API key, CORS enabled).
 * Coverage of US brands is decent but data quality varies, so results show a warning when the
 * calories don't add up from the macros.
 */

const FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string | string[];
  nutriments?: Record<string, number | string>;
  serving_size?: string;
  serving_quantity?: number | string;
}

function n(v: unknown): number | undefined {
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}

export function productToFood(p: OffProduct): Food | null {
  const nm = p.nutriments ?? {};
  const kcal = n(nm['energy-kcal_100g']) ?? (n(nm['energy_100g']) != null ? n(nm['energy_100g'])! / 4.184 : undefined);
  const protein = n(nm['proteins_100g']);
  const fat = n(nm['fat_100g']);
  const carbs = n(nm['carbohydrates_100g']);
  if (kcal == null || (protein == null && fat == null && carbs == null)) return null;
  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name) return null;
  const brand = (Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0])?.trim();
  const per100: Macros = { kcal: Math.round(kcal), protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0, fiber: n(nm['fiber_100g']) ?? 0 };
  const sq = n(p.serving_quantity);
  const servings = sq && sq > 0 ? [{ name: servingName(p.serving_size), grams: sq }] : [];
  return {
    id: `off:${p.code ?? name}`,
    name,
    brand: brand || undefined,
    per100,
    servings,
    defaultServing: servings[0]?.name,
    source: 'off',
    barcode: p.code,
  };
}

/** "1 scoop (31 g)" → "scoop"; "2 tbsp (32g)" → "2 tbsp" is kept as "serving". */
function servingName(size?: string): string {
  const m = /^\s*1\s+([a-z][a-z ]{1,20}?)\s*(\(|$)/i.exec(size ?? '');
  return m ? m[1].trim().toLowerCase() : 'serving';
}

/** Calories that don't roughly match 4/4/9 usually mean per-serving numbers were typed as per-100 g. */
export function looksWrong(m: Macros): boolean {
  const est = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  if (m.kcal < 20 && est < 20) return false;
  return Math.abs(est - m.kcal) > Math.max(40, m.kcal * 0.25) || m.protein + m.fat + m.carbs > 101;
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (!data.product) return null;
  return productToFood({ code, ...data.product });
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=24&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts search returned ${res.status}`);
  const data = (await res.json()) as { hits?: OffProduct[] };
  const seen = new Set<string>();
  return (data.hits ?? []).flatMap((h) => {
    const f = productToFood(h);
    if (!f || seen.has(f.id)) return [];
    seen.add(f.id);
    return [f];
  });
}
