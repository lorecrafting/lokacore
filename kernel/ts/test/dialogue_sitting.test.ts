// loka-vduxr.11: once per sitting and a reaction's end_talk, played on the compiled persuade sampler
// (the compiler half is in content_dialogue_sitting_test.exs, a scene from any choice in scene.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRow } from '../../../mobile/authority/local-story/dialogue-save.ts';
import { gameView } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { P, content, opens, ops, plain, play } from './dialogue_play.ts';

const SITTING = { z_first: plain({ sitting: true, order: 1 }), a_stays: plain({ order: 2 }) };
const row = (g: ReturnType<typeof play>) => {
  const id = g.view().continuation_id;
  const r = g.world().state.choices![id];
  return [id, r] as [string, any];
};

// Breaks: a taken sitting choice comes back, the drop loses written order, the row is not what a
// save check accepts, the view draws a row the protocol refuses, or the spent hub soft locks.
test('a sitting choice leaves the reopened hub, in order, and a save mid-sitting reopens', () => {
  const g = play(content({ ...SITTING, m_too: plain({ sitting: true, order: 3 }) }));
  g.opened();
  assert.deepEqual(g.ids(), ['z_first', 'a_stays', 'm_too']);
  const stale = g.view().continuation_id;
  const answered = g.choose('z_first');
  assert.deepEqual(opens(answered).choice_ids, ['a_stays', 'm_too']);
  assert.deepEqual(g.ids(), ['a_stays', 'm_too']);
  assert.deepEqual(validate('GameView', gameView(g.world())), []);
  checkRow(g.world(), ...row(g));
  g.reload();
  assert.deepEqual(g.ids(), ['a_stays', 'm_too']);
  // Spent this sitting, so a stale card and the live row both refuse it.
  assert.equal(
    g.send({ type: 'choose', continuation_id: stale, choice_id: 'z_first' }).kind,
    'rejected',
  );
  assert.equal(g.choose('z_first').kind, 'rejected');
  // Only sitting choices may be missing from a saved row.
  const [id, r] = row(g);
  assert.throws(() => checkRow(g.world(), id, { ...r, choice_ids: ['m_too'] }));
});

// Breaks: the last answer reopens an empty hub, or a fresh Talk still remembers the sitting.
test('the last sitting choice closes the talk and the next Talk shows them all', () => {
  const g = play(content({ a: plain({ sitting: true }), b: plain({ sitting: true }) }));
  g.opened();
  assert.ok(opens(g.choose('a')));
  const last = g.choose('b');
  assert.equal(last.kind, 'accepted');
  assert.equal(opens(last), undefined);
  assert.equal(g.view(), undefined);
  g.opened();
  assert.deepEqual(g.ids(), ['a', 'b']);
});

const cutShort = (c: any) => {
  c.lock.capabilities.reaction = 1;
  c.manifest.requires.capabilities.reaction = c.lock.capabilities.reaction;
  (c.reactions ??= {})[`${P}:reaction/cut`] = {
    key: 'cut',
    on: { event: 'choice_resolved', choice: 'cut' },
    steps: [{ op: 'end_talk' }],
  };
};

// Breaks: end_talk faults on two writers of the row its own decision reopened (no_last_writer_wins),
// or leaves the talk open.
test('end_talk closes the row the same answer reopened', () => {
  const g = play(content({ cut: plain(), stay: plain() }, {}, cutShort));
  g.opened();
  const d = g.choose('cut');
  assert.equal(d.kind, 'accepted', JSON.stringify(d));
  assert.equal(g.view(), undefined);
  assert.equal(ops(d).filter((o: string) => o === 'choice.close').length, 1);
  g.opened();
  assert.equal(opens(g.choose('stay')).op, 'choice.open');
  assert.ok(g.view());
});

// Breaks: with nothing open (a lone choice does not reopen) end_talk throws or closes a row.
test('end_talk with no talk open does nothing', () => {
  const g = play(content({ cut: plain() }, {}, cutShort));
  g.opened();
  const d = g.choose('cut');
  assert.equal(d.kind, 'accepted', JSON.stringify(d));
  assert.equal(ops(d).filter((o: string) => o === 'choice.close').length, 0);
});
