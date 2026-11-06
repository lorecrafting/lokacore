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
// kept log, keeps the status row or bottom row (catching up included), does not turn from another page, reads the death
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
    h.publish(view(SHRINE), undefined, undefined, { kind: 'catching_up' });
    assert.equal(h.footer(), false); // catching up included
    assert.match(h.said(), /You die\./); // read once, here
    h.publish(view(SHRINE), 'road.crows'); // after the death: held until the rise
    assert.equal(h.texts().includes('Crows lift off the road.'), false);
    assert.doesNotMatch(h.said(), /Crows/);
    h.tap('Let go');
    assert.deepEqual(these(h, ['Dark.', ...DEATH]), ['Dark.']); // held until the rise
    now = 60_000;
    h.tap('Rise');
    assert.ok(h.texts().includes('The shrine'));
    assert.deepEqual(these(h, ['Water drips.', ...DEATH]), DEATH);
    assert.doesNotMatch(h.said(), /You die\./); // not read again
    assert.match(h.said(), /Crows lift off the road\./); // never drawn, so read at the rise
  } finally {
    h.close();
    Date.now = clock;
  }
});

// Breaks (book-ui.md :133): without revival, Let go keeps the old room's log or title, drops the
// receipt's lines with the room change, or reorders them; or the recovery room's cue, or a line
// after the death, shows on the dead page.
test('an off-fight death without revival: Let go turns to the recovery room, its log the receipt', () => {
  const h = cellar();
  try {
    const shrine = view({
      ...SHRINE,
      revival: undefined,
      cues: [{ sense: 'heat', text: 'cue.heat' }],
    });
    h.die(shrine, RECEIPT);
    assert.equal(h.texts().includes('cue.heat'), false);
    h.publish(shrine, 'road.crows'); // after the death
    assert.deepEqual(these(h, [...DEATH, 'Crows lift off the road.']), DEATH);
    assert.doesNotMatch(h.said(), /Crows/);
    h.tap('Let go');
    const t = h.texts();
    assert.ok(t.includes('The shrine') && !t.includes('The cellar') && !t.includes('Let go'));
    assert.deepEqual(these(h, ['Water drips.', 'Dark.', 'cue.heat', ...DEATH]), [
      ...DEATH,
      'cue.heat',
    ]);
    assert.ok(t.includes('Crows lift off the road.')); // drawn once the page is let go
    assert.match(h.said(), /Crows lift off the road\./); // and read
  } finally {
    h.close();
  }
});

// Breaks (book-ui.md, Spirit state): an encounter that ends the spirit state reads the dead page's
// lines again.
test('an encounter ending the spirit state does not reread the death', () => {
  const h = cellar();
  try {
    h.die(view(SHRINE), RECEIPT);
    h.tap('Let go');
    h.publish(view({ ...SHRINE, combat: view().combat }), 'combat.hit');
    assert.equal(these(h, ['Dark.', 'Rise']).length, 0); // woken
    assert.doesNotMatch(h.said(), /You die\./);
  } finally {
    h.close();
  }
});

// Breaks (book-ui.md, Closure): a death that closes an encounter shows the dead page instead of
// the Combat page.
test('a death that closes a fight keeps the Combat page', () => {
  const rat = { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat', interval: 150 };
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
// the spirit state, or a fault leaves it up; with a scene open, the dead page is not first, or Let go starts the spirit state or skips the card.
test('a reopen shows the recovery room solid; a scene shows after Let go', () => {
  const h = cellar();
  const open = [h];
  try {
    h.die(view(SHRINE), RECEIPT);
    h.close();
    const again = mounted(view(SHRINE)); // nothing stored: the receipt is the Game's last
    again.game.lastNarration = h.game.lastNarration;
    const t = again.texts();
    assert.ok(t.includes('The shrine'));
    assert.equal(t.includes('Let go') || t.includes('Rise') || t.includes('Dark.'), false);
    const scene = { scene: { scene: { key: 'road' }, line: 'road.crows', index: 1, count: 1 } };
    const e = cellar();
    open.push(again, e);
    e.die(view({ ...SHRINE, ...scene }), RECEIPT);
    assert.deepEqual(these(e, ['Crows lift off the road.', 'Let go']), ['Let go']);
    e.tap('Let go');
    assert.ok(e.texts().includes('Crows lift off the road.')); // its card
    e.publish(view(SHRINE)); // and it ends: no spirit state behind it
    assert.equal(these(e, ['Rise', 'Dark.']).length, 0);
    const fault = cellar();
    open.push(fault); // a fault ends the dead page, as a reopen does
    fault.die(view(SHRINE), RECEIPT);
    fault.publish(view(SHRINE), undefined, undefined, { kind: 'fault', code: 'x' });
    assert.equal(fault.texts().includes('Let go'), false);
  } finally {
    open.forEach((x) => x.close());
  }
});

// Breaks (book-ui.md, Dead page, Turn): a background death turns no page from Contents
// (loka-kgd.216), or one on the World page, from the clock or a press there, turns the page
// instead of changing it in place (loka-kgd.217).
test('a death turns to the dead page from another page; on the World page it changes in place', () => {
  const turn = (h: ReturnType<typeof mounted>) =>
    h.node((n) => n.type?.name === 'PageTurn').props.turn as number;
  const stood = { kind: 'saved', decision: { kind: 'accepted', events: [], outcome: 'stood' } };
  const dies = { ...stood, decision: { ...stood.decision, narration: [{ key: 'combat.death' }] } };
  for (const [from, death] of [
    [CONTENTS, (h: ReturnType<typeof mounted>) => h.die(view(SHRINE), RECEIPT)],
    [undefined, (h: ReturnType<typeof mounted>) => h.die(view(SHRINE), RECEIPT)],
    [
      undefined,
      (h: ReturnType<typeof mounted>) => (
        h.answer(dies, view(SHRINE), 'combat.death'),
        h.tap('sitting')
      ),
    ],
  ] as const) {
    const h = cellar();
    try {
      if (from) h.tap(from);
      const was = turn(h);
      death(h);
      assert.ok(h.texts().includes('Let go'));
      assert.equal(turn(h), was + (from ? 1 : 0));
    } finally {
      h.close();
    }
  }
});
