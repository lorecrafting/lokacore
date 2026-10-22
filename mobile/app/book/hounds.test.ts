import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { bundle, unpacked } from '../../authority/local-story/__tests__/goblins.ts';
import { buttonsOf, group, pagesAfter } from './model.ts';

// The kernel's controlled goblins, unpacked; the body starts at the inn, two moves from the pit.
const artifact = bundle(unpacked);
function preview() {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, artifact);
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
  for (const direction of ['west', 'south']) invoke('move', [], { direction });
  return { ...a, invoke, buttons, pulse };
}

// Breaks: identical blueprint names bind Attack to the first goblin, or a departed goblin keeps a stale detail route.
test('Book offers instance-bound Attack and prunes a departed goblin detail', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const before = a.game.view().view;
  const goblins = before.entities.filter((e) => e.kind === 'npc' && e.name === 'npc.goblin.short');
  assert.equal(goblins.length, 4);
  assert.equal(new Set(goblins.map((e) => e.id)).size, 4);
  for (const goblin of goblins)
    assert.deepEqual(
      a
        .buttons()
        .on(goblin.id)
        .filter((b) => b.action_key === 'attack')
        .map((b) => b.target_ids),
      [[goblin.id]],
    );
  const here = () => a.game.view().view.entities.some((e) => e.id === goblins[0]!.id);
  for (let i = 0; i < 24; i++) a.pulse();
  assert.equal(here(), false);
  assert.deepEqual(
    pagesAfter([{ kind: 'thing', id: goblins[0]!.id }], before, a.game.view().view),
    [],
  );
});

// Breaks: the Book loses nested Take or offers a corpse purchase after the goblin's ear transfers to its corpse.
test('Book exposes a killed goblin ear through ordinary Contents and Carrying', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const member = a.game
    .view()
    .view.entities.find((e) => e.kind === 'npc' && e.name === 'npc.goblin.short')!.id;
  a.invoke('attack', [member]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.pulse();
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  }
  assert.ok(corpse);
  const pelt = corpse.contents?.find((e) => e.name === 'item.ear.short');
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
