/** The few GitHub REST calls the sync needs, with a fine-grained personal access token. */

export interface RepoConfig {
  /** "owner/name" */
  repo: string;
  /** Empty means the repository's default branch. */
  branch: string;
  /** Folder holding YYYY/MM/DD.jsonl, e.g. "db". */
  folder: string;
  token: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const API = 'https://api.github.com';

async function call<T>(cfg: RepoConfig, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GitHubError('Offline or GitHub unreachable', 0);
  }
  if (res.ok) return (res.status === 204 ? null : await res.json()) as T;
  let detail = '';
  try {
    detail = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    /* no body */
  }
  const msg =
    res.status === 401
      ? 'The token was rejected (expired or revoked?)'
      : res.status === 404
        ? `Not found: ${cfg.repo}. Check the name and branch, and that the token was given access to this repository.`
        : res.status === 403 && /rate limit/i.test(detail)
          ? 'GitHub rate limit reached; try again later'
          : res.status === 403
            ? 'The token lacks permission. It needs Contents: read and write.'
            : `GitHub ${res.status}${detail ? `: ${detail}` : ''}`;
  throw new GitHubError(msg, res.status);
}

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

export function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function b64decode(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export interface RepoInfo {
  defaultBranch: string;
  canPush: boolean;
  isPrivate: boolean;
}

export async function repoInfo(cfg: RepoConfig): Promise<RepoInfo> {
  const r = await call<{ default_branch: string; private: boolean; permissions?: { push?: boolean } }>(cfg, `/repos/${cfg.repo}`);
  return { defaultBranch: r.default_branch, canPush: r.permissions?.push ?? false, isPrivate: r.private };
}

/** Every file under the folder, path → blob sha, in one request. */
export async function listFiles(cfg: RepoConfig, branch: string): Promise<Map<string, string>> {
  const t = await call<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
    cfg,
    `/repos/${cfg.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  const prefix = cfg.folder ? cfg.folder.replace(/\/+$/, '') + '/' : '';
  const out = new Map<string, string>();
  for (const f of t.tree) if (f.type === 'blob' && f.path.startsWith(prefix)) out.set(f.path, f.sha);
  return out;
}

export async function readBlob(cfg: RepoConfig, sha: string): Promise<string> {
  const b = await call<{ content: string; encoding: string }>(cfg, `/repos/${cfg.repo}/git/blobs/${sha}`);
  return b.encoding === 'base64' ? b64decode(b.content) : b.content;
}

/** A file's text and blob sha, or null if it doesn't exist. */
export async function readFile(cfg: RepoConfig, path: string, branch: string): Promise<{ text: string; sha: string } | null> {
  try {
    const f = await call<{ content: string; sha: string; encoding: string }>(cfg, `/repos/${cfg.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
    // the contents API omits content for files over 1 MB; day files are far smaller
    return { text: f.encoding === 'base64' ? b64decode(f.content) : f.content, sha: f.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/** Create or replace a file. `sha` must be the current blob sha (null to create); a mismatch throws 409. Returns the new sha. */
export async function writeFile(cfg: RepoConfig, path: string, branch: string, text: string, sha: string | null, message: string): Promise<string> {
  const r = await call<{ content: { sha: string } }>(cfg, `/repos/${cfg.repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: b64encode(text), branch, ...(sha ? { sha } : {}) }),
  });
  return r.content.sha;
}

export async function deleteFile(cfg: RepoConfig, path: string, branch: string, sha: string, message: string): Promise<void> {
  await call(cfg, `/repos/${cfg.repo}/contents/${encodePath(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  });
}

/** True for the errors a retry after re-reading the file can fix: the file changed underneath us. */
export function isConflict(e: unknown): boolean {
  return e instanceof GitHubError && (e.status === 409 || e.status === 422);
}
