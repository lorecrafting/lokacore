import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { buttonsOf, group } from './model.ts';
const pin = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v021_hash.json', import.meta.url),
    'utf8',
  ),
);
const ids = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v021_ids.json', import.meta.url),
    'utf8',
  ),
);

// Breaks: the patch projects no actionable exact target, or Wick offers completion before a confirmed ready occurrence.
test('Book patch and Wick controls use confirmed exact targets, readiness and journal state', () => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin);
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  move('south', 'south', 'west');
  const view = a.game.view().view,
    patch = ids['detail/willow_shade/fenwort_patch'];
  assert.equal(view.notices!.find((n) => n.id === patch)!.remaining, 12);
  const buttons = buttonsOf(
    view,
    (k) => pin.value.text[k],
    (k) => pin.value.text[k],
  );
  const harvest = group(buttons as never)
    .on(patch)
    .find((b) => b.action_key === 'harvest')!;
  assert.deepEqual(harvest.target_ids, [patch]);
  assert.equal(harvest.detail_id, patch);
  for (let i = 0; i < 3; i++) invoke(harvest.action_key, harvest.target_ids, harvest.input);
  move('east', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'east');
  const wick = ids['npc/wick'];
  invoke('a_wick_offer', [wick]);
  assert.equal(a.game.view().view.choice!.choices[0].available, true);
  const answer = (choice_id: string) =>
    invoke('choose', [], {
      continuation_id: a.game.view().view.choice!.continuation_id,
      choice_id,
    });
  answer('accept');
  assert.equal(
    a.game.view().view.journal.find((q) => q.quest.key === 'infirmary_herbs')!.state,
    'active',
  );
  invoke('b_wick_turn_in', [wick]);
  assert.equal(a.game.view().view.choice!.speaker_id, wick);
  const exchange = buttonsOf(
    a.game.view().view,
    (k) => pin.value.text[k],
    (k) => pin.value.text[k],
  ).find((b) => b.input.choice_id === 'exchange')!;
  assert.ok(exchange);
  answer('exchange');
  assert.equal(
    a.game.view().view.journal.find((q) => q.quest.key === 'infirmary_herbs')!.state,
    'resolved',
  );
  a.sql.close();
});
