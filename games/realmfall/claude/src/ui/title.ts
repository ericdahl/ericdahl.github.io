/** Title screen: saved heroes and hero creation, over a live view of the war. */
import { REALM_DEFS, type RealmId } from '../game/geo';
import { CLASSES, CLASS_IDS, realmName, type ClassId } from '../game/data';
import type { CharSave } from '../game/types';
import { World } from '../game/world';
import { loadChars, deleteChar } from './save';
import { sfx } from './audio';

declare const __APP_VERSION__: string;

export class Title {
  el: HTMLElement;
  onPlay: (c: CharSave) => void = () => {};
  private realm: RealmId = 0;
  private cls: ClassId = 'warden';

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'title';
    parent.appendChild(this.el);
  }

  show() {
    this.el.style.display = 'flex';
    const chars = loadChars();
    if (chars.length) this.list(chars);
    else this.create();
  }

  hide() {
    this.el.style.display = 'none';
  }

  private head() {
    return `<div class="logo"><h1>Realmfall</h1><p>Three realms. Seven keeps. One frontier.</p></div>`;
  }

  private list(chars: CharSave[]) {
    this.el.innerHTML = `${this.head()}<div class="card-panel">
      <h2>Your heroes</h2>
      <div class="chars">${chars.map((c) => `<div class="char" data-id="${c.id}">
        <span class="sw" style="background:${REALM_DEFS[c.realm].color}"></span>
        <div><b>${c.name}</b><br><small>Level ${c.level} ${CLASSES[c.cls].name} of ${REALM_DEFS[c.realm].name}</small></div>
        <button class="play">Play</button><button class="del" title="Delete">✕</button></div>`).join('')}</div>
      <button class="big ghost" data-new>Create a new hero</button>
      </div><div class="ver">v${__APP_VERSION__}</div>`;
    this.el.querySelectorAll<HTMLElement>('.char').forEach((d) => {
      const c = chars.find((x) => x.id === d.dataset.id)!;
      d.querySelector('.play')!.addEventListener('click', () => { sfx.click(); this.onPlay(c); });
      d.querySelector('.del')!.addEventListener('click', () => {
        if (confirm(`Delete ${c.name} for good?`)) {
          deleteChar(c.id);
          this.show();
        }
      });
    });
    this.el.querySelector('[data-new]')!.addEventListener('click', () => { sfx.click(); this.create(); });
  }

  private create() {
    const chars = loadChars();
    const rng = () => Math.random();
    const name = realmName(this.realm, rng);
    this.el.innerHTML = `${this.head()}<div class="card-panel wide">
      <h2>Choose your realm</h2>
      <div class="realms">${REALM_DEFS.map((r) => `<button class="realm ${r.id === this.realm ? 'on' : ''}" data-r="${r.id}" style="--c:${r.color};--d:${r.dark}">
        <span class="crest"></span><b>${r.name}</b><small>${r.blurb}</small></button>`).join('')}</div>
      <h2>Choose your calling</h2>
      <div class="classes">${CLASS_IDS.map((c) => `<button class="cls ${c === this.cls ? 'on' : ''}" data-c="${c}"><b>${CLASSES[c].name}</b><small>${CLASSES[c].role}</small></button>`).join('')}</div>
      <p class="clsdesc">${CLASSES[this.cls].desc}</p>
      <div class="namerow"><input maxlength="14" value="${name}" aria-label="Name"><button class="dice" title="Another name">⟳</button></div>
      <div class="row">${chars.length ? '<button class="big ghost" data-back>Back</button>' : ''}<button class="big" data-go>Enter ${REALM_DEFS[this.realm].name}</button></div>
      </div><div class="ver">v${__APP_VERSION__}</div>`;
    const input = this.el.querySelector('input')!;
    this.el.querySelectorAll<HTMLButtonElement>('.realm').forEach((b) => b.addEventListener('click', () => {
      sfx.click();
      this.realm = +b.dataset.r! as RealmId;
      this.create();
    }));
    this.el.querySelectorAll<HTMLButtonElement>('.cls').forEach((b) => b.addEventListener('click', () => {
      sfx.click();
      this.cls = b.dataset.c as ClassId;
      const keep = input.value;
      this.create();
      this.el.querySelector('input')!.value = keep;
    }));
    this.el.querySelector('.dice')!.addEventListener('click', () => { input.value = realmName(this.realm, rng); });
    this.el.querySelector('[data-back]')?.addEventListener('click', () => this.show());
    const go = () => {
      const n = input.value.trim().replace(/[^A-Za-z' -]/g, '').slice(0, 14);
      if (!n) { input.focus(); return; }
      sfx.click();
      this.onPlay(World.newChar(n[0].toUpperCase() + n.slice(1), this.realm, this.cls));
    };
    this.el.querySelector('[data-go]')!.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }
}
