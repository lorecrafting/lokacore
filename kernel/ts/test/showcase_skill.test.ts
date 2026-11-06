// The showcase's untargeted combat skill (loka-x6t.137): the word mend, known from the start, cast
// inside a fight, then cooling for 900 s, so the hotbar has a cooling slot to show.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { attack, fresh, go, MISS, play, pool, refused, seeded } from './showcase_fixture.ts';

const CTX = '5ca5e000-0000-4000-8000-0000000013a7';

// Breaks: mend gets a duration (a busy spell, which a fight refuses), loses its cooldown, needs a
// fact that starts false, loses its heal, or its cast ends the fight.
test('mend casts inside a fight, then cools for 900 s and is refused cooldown', () => {
  const s = attack(seeded(go(go(fresh(CTX), 'west').world, 'west').world, MISS), 'raider');
  assert.ok(engaged(s, s.body));
  const at = s.state.clock;
  const w = play(s, { type: 'cast', word: 'mend' }).world;
  assert.ok(engaged(w, w.body));
  assert.deepEqual([pool(s, 'hp'), pool(w, 'hp')], [8, 9]);
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  assert.deepEqual(
    v.spell_words?.find((x) => x.word === 'mend'),
    {
      word: 'mend',
      available: false,
      reason: { code: 'cooldown' },
      ends_at: at + 900,
      duration: 900,
    },
  );
  assert.equal(refused(w, { type: 'cast', word: 'mend' }), 'cooldown');
});
