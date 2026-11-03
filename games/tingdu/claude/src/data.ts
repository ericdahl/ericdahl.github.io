import type { Story, StorySummary } from './types';

const base = import.meta.env.BASE_URL;
let index: Promise<StorySummary[]> | null = null;
const stories = new Map<string, Promise<Story>>();

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<StorySummary[]> {
  index ??= getJson<{ stories: StorySummary[] }>('stories/index.json').then((d) => d.stories);
  index.catch(() => (index = null));
  return index;
}

export function loadStory(id: string): Promise<Story> {
  let p = stories.get(id);
  if (!p) {
    p = getJson<Story>(`stories/${encodeURIComponent(id)}.json`);
    p.catch(() => stories.delete(id));
    stories.set(id, p);
  }
  return p;
}

export const assetBase = base;
