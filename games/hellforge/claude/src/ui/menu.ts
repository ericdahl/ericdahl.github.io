import { CLASSES, createCharacter, DIFFICULTIES, type Character } from '../game/character';
import type { ClassId } from '../game/items';
import { h } from './dom';
import { deleteCharacter, loadCharacters, saveCharacter } from './save';

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
      h('div', { class: 'credits dim' }, 'All art and sound generated in code.'),
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
    );
    name.focus();
  };

  if (chars.length) renderList();
  else renderCreate();
}
