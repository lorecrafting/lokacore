// A death outside a fight: the dead page, then Let go (book-ui.md, Dead page), over controlled Book
// boundary inputs (the harness: __tests__/mounted.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { view } from './__tests__/combat-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { mounted } from './__tests__/mounted.ts';

const TITLE = 'You attack a marsh rat!';
const SHRINE = {
  combat: undefined,
  place: {
    id: 'shrine',
    title: { key: 'shrine.title' },
    description: { key: 'shrine.description' },
  },
  revival: { lines: ['rev.1', 'rev.2', 'rev.3'], seconds: 10 },
};
const RECEIPT = ['bleed.tick', 'death.fell', 'combat.death'];
const DEATH = ['You bleed.', 'You die.', 'You wake at the shrine.'];
const these = (h: ReturnType<typeof mounted>, of: string[]) =>
  h.texts().filter((t) => of.includes(t));
// A cellar with a line in its log, read on the World page.
const cellar = () => {
  const h = mounted(view({ combat: undefined }));
  h.texts(); // mounts the subscription
  h.publish(view({ combat: undefined }), 'room.drip');
  assert.ok(h.texts().includes('Water drips.'));
  return h;
};

// Breaks (book-ui.md, Dead page): an off-fight death skips the dead page (straight to the recovery
// room or the spirit state), draws the recovery room's title or paragraphs early, drops the room's
// kept log, keeps the status row or bottom row, does not turn from another page, reads the death
// lines twice (on the dead page and again at the rise), or Let go misses the spirit state.
test('an off-fight death shows the dead page; Let go enters the spirit state', () => {
  const clock = Date.now;
  let now = 0;
  Date.now = () => now;
  const id = '00000000-0000-4000-8000-000000000000'; // the harness's ids are not schema ids
  const { combat: _, ...wire } = view({
    ...SHRINE,
    actor_id: id,
    place: { ...SHRINE.place, id },
    entities: [{ id, kind: 'npc', name: 'npc.rat', actions: [] }],
  });
  assert.deepEqual(validate('GameView', wire), []);
  const h = cellar();
  try {
    h.tap(CONTENTS);
    h.tap('Settings'); // the death turns the Book from any page
    h.die(view(SHRINE), RECEIPT);
    const t = h.texts();
    assert.ok(t.includes('The cellar'));
    assert.equal(t.includes('The shrine'), false); // not drawn until Let go
    assert.deepEqual(these(h, ['Water drips.', ...DEATH]), ['Water drips.', ...DEATH]);
    assert.deepEqual(
      h.texts().filter((x) => ['Let go', 'Back to World', 'Rise', 'Settings'].includes(x)),
      ['Let go'],
    );
    assert.equal(h.footer(), false);
    assert.match(h.said(), /You die\./); // read once, here
    h.tap('Let go');
    assert.deepEqual(these(h, ['Dark.', ...DEATH]), ['Dark.']); // held until the rise
    now = 60_000;
    h.tap('Rise');
    assert.ok(h.texts().includes('The shrine'));
    assert.deepEqual(these(h, ['Water drips.', ...DEATH]), DEATH);
    assert.doesNotMatch(h.said(), /You die\./); // not read again
  } finally {
    h.close();
    Date.now = clock;
  }
});

// Breaks (book-ui.md :133): without revival, Let go keeps the old room's log or title, drops the
// receipt's lines with the room change, or reorders them.
test('an off-fight death without revival: Let go turns to the recovery room, its log the receipt', () => {
  const h = cellar();
  try {
    h.die(view({ ...SHRINE, revival: undefined }), RECEIPT);
    h.tap('Let go');
    const t = h.texts();
    assert.ok(t.includes('The shrine') && !t.includes('The cellar') && !t.includes('Let go'));
    assert.deepEqual(these(h, ['Water drips.', 'Dark.', ...DEATH]), DEATH);
  } finally {
    h.close();
  }
});

// Breaks (book-ui.md, Closure): a death that closes an encounter shows the dead page instead of
// the Combat page.
test('a death that closes a fight keeps the Combat page', () => {
  const rat = { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' };
  const h = cellar();
  try {
    h.publish(
      view({ combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } }),
      'combat.hit',
    );
    h.publish(view(SHRINE), 'combat.death', 'combat.hit');
    const t = h.texts();
    assert.ok(t.includes(TITLE) && t.includes('Let go'));
    assert.equal(t.includes('The cellar') || t.includes('Water drips.'), false);
  } finally {
    h.close();
  }
});

// Breaks (book-ui.md, Dead page: Reopen, A scene): a reopen before Let go shows the dead page or
// the spirit state; with a scene open, Let go starts the spirit state or skips the scene card.
test('a reopen shows the recovery room solid; a scene shows after Let go', () => {
  const h = cellar();
  try {
    h.die(view(SHRINE), RECEIPT);
    h.close();
    const again = mounted(view(SHRINE)); // nothing stored: the receipt is the Game's last
    again.game.lastNarration = h.game.lastNarration;
    const t = again.texts();
    assert.ok(t.includes('The shrine'));
    assert.equal(t.includes('Let go') || t.includes('Rise') || t.includes('Dark.'), false);
    again.close();
    const scene = cellar();
    scene.die(
      view({
        ...SHRINE,
        scene: { scene: { key: 'road' }, line: 'road.crows', index: 1, count: 1 },
      }),
      RECEIPT,
    );
    assert.equal(scene.texts().includes('Crows lift off the road.'), false);
    scene.tap('Let go');
    const s = scene.texts();
    assert.ok(s.includes('Crows lift off the road.'));
    assert.equal(s.includes('Rise') || s.includes('Dark.'), false);
    scene.close();
  } finally {
    h.close();
  }
});
