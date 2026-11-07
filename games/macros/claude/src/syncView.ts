import * as sync from './sync';
import { h, icon } from './ui';

export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function statusText(s: sync.Status): string {
  if (s.kind === 'syncing') return s.message || 'Syncing…';
  if (s.kind === 'error') return s.message + (s.pending ? ` (${s.pending} day${s.pending === 1 ? '' : 's'} waiting)` : '');
  if (s.pending) return `${s.pending} day${s.pending === 1 ? '' : 's'} waiting to sync`;
  return `Synced ${ago(s.lastSync)}`;
}

/** Small status line under the Today header while sync is connected. Tap to sync now. */
export function syncPill(): { el: HTMLElement; dispose: () => void } {
  const el = h('button', { class: 'sync-pill', type: 'button', onclick: () => void sync.syncNow(), title: 'Sync with GitHub now' });
  const draw = () => {
    const s = sync.getStatus();
    el.hidden = s.kind === 'off';
    el.className = `sync-pill ${s.kind}${s.pending && s.kind !== 'syncing' ? ' pending' : ''}`;
    el.replaceChildren(icon('cloud'), h('span', {}, statusText(s)));
  };
  draw();
  const off = sync.onStatus(draw);
  const tick = window.setInterval(draw, 30_000);
  return { el, dispose: () => (off(), clearInterval(tick)) };
}

export function syncCard(): { el: HTMLElement; dispose: () => void } {
  const el = h('section', { class: 'card stack sync-card' });
  let off = () => {};

  const connected = () => {
    const c = sync.getConfig()!;
    const status = h('p', { class: 'small' });
    const draw = () => {
      const s = sync.getStatus();
      status.className = `small${s.kind === 'error' ? ' warn' : ''}`;
      status.textContent = statusText(s);
    };
    off();
    off = sync.onStatus(draw);
    draw();
    el.replaceChildren(
      h('h3', { class: 'section' }, 'GitHub sync'),
      h('p', { class: 'small' }, 'Food entries sync to ', h('b', {}, c.repo), c.branch ? ` (${c.branch})` : '', ' as ', h('code', {}, '"type": "food"'), ' lines in ', h('code', {}, `${c.folder ? c.folder + '/' : ''}YYYY/MM/DD.jsonl`), '. Other lines in those files are left untouched.'),
      status,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => void sync.syncNow() }, icon('cloud'), 'Sync now'),
        h('button', {
          class: 'btn danger',
          onclick: () => {
            if (!confirm('Disconnect? The token is removed from this device. Your entries stay here and in the repo.')) return;
            sync.disconnect();
            form();
          },
        }, 'Disconnect'),
      ),
    );
  };

  const form = () => {
    off();
    const prev = sync.getConfig();
    const repo = h('input', { type: 'text', value: prev?.repo ?? '', placeholder: 'owner/repo', 'aria-label': 'Repository', autocapitalize: 'off', spellcheck: false });
    const branch = h('input', { type: 'text', value: prev?.branch ?? '', placeholder: 'branch (blank = default)', 'aria-label': 'Branch', autocapitalize: 'off', spellcheck: false });
    const folder = h('input', { type: 'text', value: prev?.folder ?? 'db', placeholder: 'folder', 'aria-label': 'Folder', autocapitalize: 'off', spellcheck: false });
    const token = h('input', { type: 'password', placeholder: 'github_pat_…', 'aria-label': 'Token', autocomplete: 'off', spellcheck: false });
    const msg = h('p', { class: 'small warn', hidden: true });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Connect');
    const submit = async (e: Event) => {
      e.preventDefault();
      const r = repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
      if (!/^[\w.-]+\/[\w.-]+$/.test(r)) return showErr('Repository should look like owner/repo.');
      if (!token.value.trim()) return showErr('Paste a token first.');
      btn.disabled = true;
      btn.textContent = 'Checking…';
      try {
        const info = await sync.connect({ repo: r, branch: branch.value.trim(), folder: folder.value.trim().replace(/^\/+|\/+$/g, '') }, token.value.trim());
        connected();
        if (!info.isPrivate) alert(`Heads up: ${r} is public, so your food log will be visible to anyone.`);
      } catch (err) {
        showErr((err as Error).message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    };
    const showErr = (t: string) => {
      msg.hidden = false;
      msg.textContent = t;
    };
    el.replaceChildren(
      h('h3', { class: 'section' }, 'GitHub sync (optional)'),
      h('p', { class: 'muted small' }, 'Without this, everything stays in this browser. Connect a repository to keep your food log in it, one ', h('code', {}, '"type": "food"'), ' line per item in each day’s ', h('code', {}, 'YYYY/MM/DD.jsonl'), ' file. That gives you a backup, the same log on every device, and something an AI can read alongside the rest of the repo. Lines other tools write to those files are kept as they are.'),
      h('details', { class: 'small' },
        h('summary', {}, 'How to make a token'),
        h('ol', {},
          h('li', {}, 'Open ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'GitHub → Settings → Fine-grained tokens → Generate new token'), '.'),
          h('li', {}, 'Repository access: ', h('b', {}, 'Only select repositories'), ', and pick this one repository.'),
          h('li', {}, 'Permissions → Repository → ', h('b', {}, 'Contents: Read and write'), '. Nothing else.'),
          h('li', {}, 'Pick an expiration, generate it, and paste it below. It is stored only in this browser.'),
        ),
      ),
      h('form', { class: 'stack', onsubmit: submit },
        repo,
        h('div', { class: 'row' }, branch, folder),
        token,
        msg,
        h('div', { class: 'row end' }, btn),
      ),
    );
  };

  if (sync.isConnected()) connected();
  else form();
  return { el, dispose: () => off() };
}
