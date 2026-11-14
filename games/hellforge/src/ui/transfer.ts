import type { Character, SharedStash } from '../game/character';

/**
 * Save transfer: pack heroes into a portable file or a copy/paste code, and read them back.
 * A code is `HF1.` followed by base64 of the gzipped JSON (or `HF0.` + plain base64 where the
 * browser has no CompressionStream). A file is the same JSON, pretty-printed.
 */

export interface SaveBundle {
  game: 'hellforge';
  format: 1;
  exported: number;
  chars: Character[];
  /** The shared stashes, when there is anything in them. Older saves have none. */
  shared?: { soft: SharedStash; hard: SharedStash };
}

export function bundle(chars: Character[], shared?: SaveBundle['shared']): SaveBundle {
  const b: SaveBundle = { game: 'hellforge', format: 1, exported: Date.now(), chars };
  if (shared && (shared.soft.items.length || shared.soft.gold || shared.hard.items.length || shared.hard.gold)) b.shared = shared;
  return b;
}

export function bundleJson(chars: Character[], shared?: SaveBundle['shared']): string {
  return JSON.stringify(bundle(chars, shared), null, 1);
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeCode(chars: Character[], shared?: SaveBundle['shared']): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(bundle(chars, shared)));
  if (typeof CompressionStream === 'undefined') return `HF0.${toB64(raw)}`;
  return `HF1.${toB64(await pipe(raw, new CompressionStream('gzip')))}`;
}

/** Accepts a save code or the contents of an exported file. Throws with a readable message. */
export async function decodeSave(text: string): Promise<Character[]> {
  return (await decodeBundle(text)).chars;
}

/** As decodeSave, with the shared stashes the save carried, if any. */
export async function decodeBundle(text: string): Promise<{ chars: Character[]; shared?: SaveBundle['shared'] }> {
  const t = text.trim();
  let json: string;
  if (t.startsWith('{')) json = t;
  else {
    const m = /^HF([01])\.([A-Za-z0-9+/=\s]+)$/.exec(t);
    if (!m) throw new Error('That does not look like a Hellforge save.');
    let bytes: Uint8Array;
    try {
      bytes = fromB64(m[2].replace(/\s+/g, ''));
      if (m[1] === '1') {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed save codes.');
        bytes = await pipe(bytes, new DecompressionStream('gzip'));
      }
    } catch (e) {
      throw e instanceof Error && e.message.startsWith('This browser') ? e : new Error('The save code is damaged or incomplete.');
    }
    json = new TextDecoder().decode(bytes);
  }
  let data: Partial<SaveBundle>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The save is damaged or incomplete.');
  }
  if (data?.game !== 'hellforge' || !Array.isArray(data.chars)) throw new Error('That does not look like a Hellforge save.');
  const chars = data.chars.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.classId === 'string');
  if (!chars.length) throw new Error('The save has no heroes in it.');
  const ok = (s?: SharedStash) => !!s && Array.isArray(s.items) && typeof s.gold === 'number';
  const sh = data.shared;
  return { chars, shared: sh && ok(sh.soft) && ok(sh.hard) ? sh : undefined };
}

export function downloadFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
