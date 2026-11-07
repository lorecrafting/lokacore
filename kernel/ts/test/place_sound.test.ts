// A room's authored bed tag and its exposed tag reach the view (book-ui.md, Beds; Storm).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { bodyOf, type World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { fresh, ref } from './showcase_fixture.ts';

const CONTEXT = '7e1f0c2a-5d3b-4c8e-9a6f-000000000043';
const standing = (w: World, room: string) => {
  const body = bodyOf(w, w.character)!;
  const state = {
    ...w.state,
    containers: { ...w.state.containers, [body]: w.roomIds[ref('room', room)]! },
  };
  return gameView({ ...w, state } as World);
};

// Breaks: placeView drops or renames `sound` or `exposed`, reads the tag from the wrong list, or
// projects `exposed: false` on a covered room (the Book tests presence).
test('place carries the authored sound and the exposed tag', () => {
  const w = fresh(CONTEXT);
  const fold = standing(w, 'the_fold');
  assert.equal(fold.place.sound, 'wild');
  assert.equal(fold.place.exposed, true);
  assert.deepEqual(validate('GameView', fold), []);

  const church = standing(w, 'church').place;
  assert.equal(church.sound, 'church');
  assert.equal('exposed' in church, false);

  const shop = standing(w, 'carpenter_shop').place;
  assert.equal('sound' in shop, false);
  assert.equal('exposed' in shop, false);
});
