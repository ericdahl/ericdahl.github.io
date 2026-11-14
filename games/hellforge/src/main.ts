import './style.css';
import { createCharacter, type Character } from './game/character';
import type { ClassId } from './game/items';
import { Game } from './ui/game';
import { showMenu } from './ui/menu';
import { loadCharacters, loadSharedStashes, saveCharacter } from './ui/save';

// Reading the saves first moves the item counter past every stored item, so nothing made from here on
// (a new hero's starting gear, say) shares an id with something already in a stash.
loadCharacters();
loadSharedStashes();

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) : undefined;

function play(c: Character) {
  new Game(root, c, () => showMenu(root, play), seed);
}

if (params.has('autostart')) {
  // Test hook: jump straight into a fresh hero.
  const cls = (params.get('class') as ClassId) || 'reaver';
  const c = createCharacter('Tester', cls);
  saveCharacter(c);
  play(c);
} else {
  showMenu(root, play);
}
