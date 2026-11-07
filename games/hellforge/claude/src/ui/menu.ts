import { CLASSES, createCharacter, DIFFICULTIES, type Character } from '../game/character';
import type { ClassId } from '../game/items';
import { CHANGELOG } from '../changelog';
import { h } from './dom';
import { deleteCharacter, importCharacters, loadCharacters, saveCharacter } from './save';
import { bundleJson, decodeSave, downloadFile, encodeCode } from './transfer';

/** Title screen: pick, create or delete a hero. Calls `play` with the chosen character. */
export function showMenu(root: HTMLElement, play: (c: Character) => void) {
  root.innerHTML = '';
  const chars = loadCharacters();
  let selected: Character | null = chars.find((c) => !c.dead) ?? chars[0] ?? null;
  const screen = h('div', { class: 'menu-screen' });
  root.append(screen);

  const renderList = () => {
    screen.innerHTML = '';
    const list = h('div', { class: 'char-list' });
    for (const c of chars) {
      const cls = CLASSES[c.classId];
      list.append(
        h(
          'button',
          { class: `char-card ${selected?.id === c.id ? 'sel' : ''} ${c.dead ? 'dead' : ''}`, onclick: () => { selected = c; renderList(); }, ondblclick: () => !c.dead && play(c) },
          h('div', { class: 'cc-portrait', style: { background: cls.color } }, cls.name[0]),
          h('div', { class: 'cc-info' },
            h('div', { class: 'cc-name' }, c.name, c.hardcore ? h('span', { class: 'hc' }, ' HC') : null),
            h('div', { class: 'cc-sub' }, `Level ${c.level} ${cls.name}`),
            h('div', { class: 'cc-sub dim' }, c.dead ? 'Deceased' : DIFFICULTIES[c.difficulty])),
        ),
      );
    }
    if (!chars.length) list.append(h('div', { class: 'dim center' }, 'No heroes yet. Create one to begin.'));
    const diff = selected && !selected.dead && selected.maxDifficulty > 0
      ? h('div', { class: 'diff-row' }, ...DIFFICULTIES.slice(0, selected.maxDifficulty + 1).map((d, i) =>
          h('button', { class: `btn ${selected!.difficulty === i ? 'on' : ''}`, onclick: () => { selected!.difficulty = i; saveCharacter(selected!); renderList(); } }, d)))
      : null;
    screen.append(
      h('div', { class: 'logo' }, h('div', { class: 'logo-main' }, 'HELLFORGE'), h('div', { class: 'logo-sub' }, 'A tale of fire and ruin')),
      list,
      diff ?? "",
      h(
        'div',
        { class: 'menu-actions' },
        h('button', { class: 'btn primary big', disabled: !selected || selected.dead, onclick: () => selected && play(selected) }, 'Play'),
        h('button', { class: 'btn big', onclick: renderCreate }, 'New Hero'),
        selected
          ? h('button', {
              class: 'btn danger', onclick: () => {
                if (!selected || !confirm(`Delete ${selected.name} forever?`)) return;
                deleteCharacter(selected.id);
                chars.splice(chars.indexOf(selected), 1);
                selected = chars[0] ?? null;
                renderList();
              },
            }, 'Delete')
          : null,
      ),
      h('div', { class: 'menu-actions' }, h('button', { class: 'btn', onclick: () => showTransfer(root, play) }, 'Export / Import')),
      h('div', { class: 'credits dim' }, 'All art and sound generated in code. ',
        h('button', { class: 'ver-link', title: "What's new", onclick: showChangelog }, `v${__APP_VERSION__}`)),
    );
  };

  const renderCreate = () => {
    screen.innerHTML = '';
    let cls: ClassId = 'reaver';
    let hardcore = false;
    const name = h('input', { class: 'name-in', maxlength: 15, placeholder: 'Hero name', value: '', 'aria-label': 'Hero name' }) as HTMLInputElement;
    const cards = h('div', { class: 'class-cards' });
    const drawCards = () => {
      cards.innerHTML = '';
      for (const c of Object.values(CLASSES)) {
        cards.append(
          h('button', { class: `class-card ${cls === c.id ? 'sel' : ''}`, onclick: () => { cls = c.id; drawCards(); } },
            h('div', { class: 'cc-portrait big', style: { background: c.color } }, c.name[0]),
            h('div', { class: 'cc-name' }, c.name),
            h('div', { class: 'small dim' }, c.desc)),
        );
      }
    };
    drawCards();
    const hc = h('label', { class: 'hc-toggle' }, h('input', { type: 'checkbox', onchange: (e: Event) => (hardcore = (e.target as HTMLInputElement).checked) }), ' Hardcore (death is permanent)');
    screen.append(
      h('div', { class: 'logo small' }, h('div', { class: 'logo-main' }, 'NEW HERO')),
      cards,
      name,
      hc,
      h(
        'div',
        { class: 'menu-actions' },
        h('button', {
          class: 'btn primary big', onclick: () => {
            const n = name.value.trim() || CLASSES[cls].name;
            const c = createCharacter(n.slice(0, 15), cls, hardcore);
            saveCharacter(c);
            play(c);
          },
        }, 'Create'),
        h('button', { class: 'btn big', onclick: () => (chars.length ? renderList() : showMenu(root, play)) }, 'Back'),
      ),
      chars.length ? '' : h('button', { class: 'btn', onclick: () => showTransfer(root, play) }, 'Import a save'),
    );
    name.focus();
  };

  if (chars.length) renderList();
  else renderCreate();
}

/** Overlay for moving heroes between devices: download/copy all heroes, or load a file/code. */
function showTransfer(root: HTMLElement, play: (c: Character) => void) {
  const chars = loadCharacters();
  const status = h('div', { class: 'xfer-status' });
  const say = (msg: string, bad = false) => {
    status.textContent = msg;
    status.classList.toggle('bad', bad);
  };
  const close = () => {
    ov.remove();
    showMenu(root, play);
  };
  const code = h('textarea', { class: 'xfer-code', rows: 4, spellcheck: 'false', placeholder: 'Paste a save code here', 'aria-label': 'Save code' }) as HTMLTextAreaElement;

  const doImport = async (text: string) => {
    try {
      const incoming = await decodeSave(text);
      const have = new Set(chars.map((c) => c.id));
      const clash = incoming.filter((c) => have.has(c.id));
      if (clash.length && !confirm(`Replace the existing ${clash.map((c) => c.name).join(', ')} with the imported version?`)) return;
      importCharacters(incoming);
      say(`Imported ${incoming.map((c) => c.name).join(', ')}.`);
      setTimeout(close, 700);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true);
    }
  };
  const file = h('input', {
    type: 'file', accept: '.json,application/json,text/plain', style: { display: 'none' },
    onchange: async () => {
      const f = file.files?.[0];
      if (f) await doImport(await f.text());
      file.value = '';
    },
  }) as HTMLInputElement;

  const stamp = new Date().toISOString().slice(0, 10);
  const exportBox = chars.length
    ? h('div', { class: 'xfer-sec' },
        h('div', { class: 'xfer-h' }, `Export (${chars.length} hero${chars.length === 1 ? '' : 'es'})`),
        h('div', { class: 'menu-actions' },
          h('button', { class: 'btn', onclick: () => { downloadFile(`hellforge-save-${stamp}.json`, bundleJson(chars)); say('Save file downloaded.'); } }, 'Download file'),
          h('button', {
            class: 'btn', onclick: async () => {
              const c = await encodeCode(chars);
              code.value = c;
              code.select();
              try {
                await navigator.clipboard.writeText(c);
                say(`Save code copied (${c.length.toLocaleString()} characters).`);
              } catch {
                say('Copy the code from the box below.');
              }
            },
          }, 'Copy save code')))
    : null;

  const ov = h('div', { class: 'overlay xfer', onclick: (e: Event) => e.target === ov && close() },
    h('div', { class: 'ov-box xfer-box' },
      h('div', { class: 'xfer-title' }, 'Export / Import'),
      exportBox,
      h('div', { class: 'xfer-sec' },
        h('div', { class: 'xfer-h' }, 'Import'),
        h('div', { class: 'menu-actions' },
          h('button', { class: 'btn', onclick: () => file.click() }, 'Load file'),
          h('button', { class: 'btn', onclick: () => doImport(code.value) }, 'Import code')),
        h('div', { class: 'small dim' }, 'Heroes with the same identity are replaced; others are kept.')),
      code,
      status,
      file,
      h('button', { class: 'btn big', onclick: close }, 'Close')));
  document.body.append(ov);
}

/** Small release-notes overlay opened from the version number. */
function showChangelog() {
  const close = () => ov.remove();
  const ov = h('div', { class: 'overlay xfer', onclick: (e: Event) => e.target === ov && close() },
    h('div', { class: 'ov-box xfer-box' },
      h('div', { class: 'xfer-title' }, "What's new"),
      h('div', { class: 'changelog' },
        ...CHANGELOG.map((r) => h('div', { class: 'cl-rel' },
          h('div', { class: 'cl-head' }, h('span', { class: 'cl-ver' }, `v${r.version}`), h('span', { class: 'dim' }, ` ${r.date}`)),
          h('ul', {}, ...r.notes.map((n) => h('li', {}, n)))))),
      h('button', { class: 'btn big', onclick: close }, 'Close')));
  document.body.append(ov);
}
