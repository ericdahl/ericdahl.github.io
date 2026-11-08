import { describe, expect, it } from 'vitest';
import { createCharacter } from '../src/game/character';
import { makeItem } from '../src/game/items';
import { itemTooltip } from '../src/ui/tooltip';

function wand() {
  const it = makeItem('yew_wand');
  it.identified = true;
  it.mods = [{ stat: 'skills_arcanist', value: 1 }, { stat: 'mana', value: 15 }];
  return it;
}

describe('item tooltip', () => {
  it("flags another class's skill bonus as having no effect", () => {
    const html = itemTooltip(wand(), createCharacter('N', 'necromancer'));
    expect(html).toContain('<div class="dim">+1 to Arcanist Skills (no effect)</div>');
    expect(html).toContain('<div class="blue">+15 to Mana</div>');
  });

  it("shows the hero's own class bonus normally", () => {
    const html = itemTooltip(wand(), createCharacter('A', 'arcanist'));
    expect(html).toContain('<div class="blue">+1 to Arcanist Skills</div>');
    expect(html).not.toContain('no effect');
  });
});
