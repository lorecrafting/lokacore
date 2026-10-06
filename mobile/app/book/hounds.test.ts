import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { buttonsOf, group, pagesAfter } from './model.ts';

const pin = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v029_hash.json', import.meta.url),
    'utf8',
  ),
);
function preview() {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  const buttons = () =>
    group(
      buttonsOf(
        a.game.view().view,
        (x) => x,
        (x) => x,
      ) as never,
    );
  const pulse = () => {
    a.clock.wall += 3000;
    a.clock.mono += 3000;
    assert.equal(a.game.pulse().kind, 'ready');
  };
  for (const direction of ['south', 'south', 'east']) invoke('move', [], { direction });
  return { ...a, invoke, buttons, pulse };
}

// Breaks: identical blueprint names bind Attack to the first hound, or a departed hound keeps a stale detail route.
test('Book offers instance-bound Attack and prunes a departed hound detail', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const before = a.game.view().view;
  const hounds = before.entities.filter(
    (e) => e.kind === 'npc' && e.name === 'npc.fen_hound.short',
  );
  assert.equal(hounds.length, 4);
  assert.equal(new Set(hounds.map((e) => e.id)).size, 4);
  for (const hound of hounds)
    assert.deepEqual(
      a
        .buttons()
        .on(hound.id)
        .filter((b) => b.action_key === 'attack')
        .map((b) => b.target_ids),
      [[hound.id]],
    );
  for (let i = 0; i < 24; i++) a.pulse();
  assert.deepEqual(
    pagesAfter([{ kind: 'thing', id: hounds[0]!.id }], before, a.game.view().view),
    [],
  );
});

// Breaks: the Book loses nested Take or offers a corpse purchase after the hound's pelt transfers to its corpse.
test('Book exposes a killed hound pelt through ordinary Contents and Carrying', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const member = a.game
    .view()
    .view.entities.find((e) => e.kind === 'npc' && e.name === 'npc.fen_hound.short')!.id;
  a.invoke('attack', [member]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.pulse();
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  }
  assert.ok(corpse);
  const pelt = corpse.contents?.find((e) => e.name === 'item.hound_pelt.short');
  assert.ok(pelt);
  assert.ok(
    !a
      .buttons()
      .on(corpse.id)
      .some((b) => b.action_key === 'buy'),
  );
  assert.deepEqual(
    a
      .buttons()
      .on(pelt.id)
      .filter((b) => b.action_key === 'take')
      .map((b) => b.target_ids),
    [[pelt.id]],
  );
  a.invoke('take', [pelt.id]);
  assert.ok(a.game.view().view.inventory.some((e) => e.id === pelt.id));
});
