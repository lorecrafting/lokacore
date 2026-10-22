import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import {
  bundle,
  text,
  patch,
  wick,
  id,
} from '../../authority/local-story/__tests__/infirmary-host.ts';
import { buttonsOf, group } from './model.ts';

// Breaks: the seam projects no actionable exact target, or the healer offers completion before the quest is active.
test('Book seam and healer controls use confirmed exact targets, readiness and journal state', () => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
  };
  const herbs = () => a.game.view().view.journal.find((q) => q.quest.key === 'herbs')?.state;
  invoke('take', [id('item', 'pickaxe')]);
  const view = a.game.view().view;
  assert.equal(view.notices!.find((n) => n.id === patch)!.remaining, 6);
  const harvest = group(
    buttonsOf(
      view,
      (k) => text[k],
      (k) => text[k],
    ) as never,
  )
    .on(patch)
    .find((b) => b.action_key === 'harvest')!;
  assert.deepEqual(harvest.target_ids, [patch]);
  assert.equal(harvest.detail_id, patch);
  for (let i = 0; i < 2; i++) invoke(harvest.action_key, harvest.target_ids, harvest.input);
  const healer = () =>
    group(
      buttonsOf(
        a.game.view().view,
        (k) => text[k],
        (k) => text[k],
      ) as never,
    )
      .on(wick)
      .map((b) => b.action_key);
  assert.deepEqual(
    ['a_offer', 'b_turn_in'].map((k) => healer().includes(k)),
    [true, false],
  );
  invoke('a_offer', [wick]);
  assert.equal(a.game.view().view.choice!.choices[0].available, true);
  const answer = (choice_id: string) =>
    invoke('choose', [], {
      continuation_id: a.game.view().view.choice!.continuation_id,
      choice_id,
    });
  answer('accept');
  assert.equal(herbs(), 'active');
  invoke('b_turn_in', [wick]);
  assert.equal(a.game.view().view.choice!.speaker_id, wick);
  const exchange = buttonsOf(
    a.game.view().view,
    (k) => text[k],
    (k) => text[k],
  ).find((b) => b.input.choice_id === 'exchange')!;
  assert.ok(exchange);
  answer('exchange');
  assert.equal(herbs(), 'resolved');
  a.sql.close();
});
