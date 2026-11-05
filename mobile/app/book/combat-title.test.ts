// The Combat page's title names who opened the fight, in the cartridge's words (book-ui.md, Live
// combat response; loka-kgd.207).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatTitle } from './combat-title.ts';
import { view } from './__tests__/combat-book.test.ts';
import { mounted } from './__tests__/mounted.ts';

const TITLE = 'You attack a marsh rat!';

const words: Record<string, string> = {
  'combat.title_you_attack': 'You attack {target}!',
  'combat.title_attacks_you': '{attacker} attacks you!',
  'npc.goblin': 'goblin',
  'npc.rat': 'a marsh rat',
};
const text = (key: string) => words[key] ?? key;
const goblin = { id: 'g', name: 'npc.goblin', words: { bare: 'npc.goblin', article: 'the' } };
const fight = (encounter_id: string) => ({
  encounter_id,
  opponent_id: 'g',
  name: 'npc.goblin',
  active_opponents: [goblin, { id: 'r', name: 'npc.rat' }],
});
const by = { one: { npc_id: 'g', player: true }, two: { npc_id: 'r', player: false } };
const opener = (id: string) => by[id as keyof typeof by];

test('the title names who opened each fight, and nothing when that is not known', () => {
  // Breaks: the player's own attack titled as the foe's, or the foe named without its article.
  assert.equal(combatTitle(fight('one') as never, text, opener), 'You attack the goblin!');
  // Breaks: a second fight reuses the first fight's opener, or the attacker slot is left lower case.
  assert.equal(combatTitle(fight('two') as never, text, opener), 'A marsh rat attacks you!');
  // Breaks: an old save with no opening receipt guesses a title (the Book names no opener it cannot read).
  assert.equal(combatTitle(fight('three') as never, text, opener), undefined);
  assert.equal(combatTitle(fight('one') as never, text, undefined), undefined);
  // Breaks: a cartridge with no words for the key (the prologue) shows the raw key as its title.
  assert.equal(
    combatTitle(fight('one') as never, (k) => (k.startsWith('combat') ? k : text(k)), opener),
    undefined,
  );
});

// Breaks: the title blanks while the opener cannot be read (a save in flight, the opener fallen),
// or a new fight with no known opener keeps the last fight's title.
test('a fight keeps its title while its opener is unread; the next fight has its own', () => {
  const rat = { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' };
  const h = mounted(
    view({ combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } }),
  );
  // The page scrolls to its newest line when its content grows, and only once it has one.
  const scrolled = () => {
    const view = h.node((n) => n.props?.onContentSizeChange);
    let to = false;
    view.ref.current = { scrollToEnd: () => (to = true) };
    view.props.onContentSizeChange(0, 1000);
    return to;
  };
  try {
    assert.ok(h.texts().includes(TITLE));
    assert.equal(scrolled(), false); // no line yet: nothing to scroll to
    h.game.opener = () => undefined;
    h.publish(
      view({ combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } }),
      'combat.hit',
    );
    assert.ok(h.texts().includes(TITLE));
    assert.equal(scrolled(), true); // the page opens at its newest line
    h.publish(
      view({
        combat: {
          ...rat,
          encounter_id: 'next',
          active_opponents: [{ id: 'rat', name: 'npc.rat' }],
        },
      }),
      'combat.hit',
    );
    assert.equal(h.texts().includes(TITLE), false);
  } finally {
    h.close();
  }
});
