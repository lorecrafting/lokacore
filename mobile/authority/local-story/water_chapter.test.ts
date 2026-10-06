// Actual bundled D6 chapter, real rollback-journal SQLite and shop-offer custody.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadCartridge,
  newWorld,
  gameView,
  INSTALLED,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

// Breaks: a bought shop item transferred through an underwater corpse is called corrupt after lawful Chapel recovery.
test('bought torch survives real drowning, Chapel recovery and cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-water-chapter-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const bundle = read('protocol/fixtures/missing_child_v035_hash.json');
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
  let host = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  t.after(() => host.sql.close());
  const open = () => {
    const result = openStory(host.db, releases, host.host);
    assert.equal(result.kind, 'open', JSON.stringify(result));
    if (result.kind !== 'open') throw new Error('save did not open');
    return result;
  };
  let story = open(),
    n = 0;
  const entity = (kind: string, key: string) =>
    fresh.entityIds[`ashmere_missing_child@0.0.35:${kind}/${key}`];
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const request = {
      invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    };
    const result = story.invoke(request);
    assert.equal(
      result.kind === 'saved' && (result.decision as { kind: string }).kind,
      'accepted',
      JSON.stringify(result),
    );
    return request;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  move('north', 'west');
  const peg = entity('npc', 'peg'),
    torch = entity('item', 'torch');
  const offer = gameView(story.world())
    .entities.find((e) => e.id === peg)!
    .shop!.find((o) => o.item_id === torch)!;
  assert.equal(offer.buy.price, 3);
  invoke('buy', [peg, torch], { quoted_price: 3 });
  move('east', 'south', 'west');
  const board = gameView(story.world()).notices!.find((n) => n.transport)!.transport!;
  invoke(board.action.action_key, [...board.action.target_ids!], {
    route: board.route,
    quoted_fare: board.fare,
  });
  move('east');
  invoke('sedge_swim', [entity('npc', 'sedge')]);
  invoke('choose', [], {
    continuation_id: gameView(story.world()).choice!.continuation_id,
    choice_id: 'learn',
  });
  move('west');
  const back = gameView(story.world()).notices!.find((n) => n.transport)!.transport!;
  invoke(back.action.action_key, [...back.action.target_ids!], {
    route: back.route,
    quoted_fare: back.fare,
  });
  move('east', 'north', 'down', 'down');
  assert.equal(gameView(story.world()).water?.remaining_seconds, 120);
  host.clock.wall += 120_001;
  host.clock.mono += 120_001;
  story.pulse('active', story.runId());
  assert.equal(gameView(story.world()).place.title.key, 'room.chapel_nave.title');
  const recovery = gameView(story.world()).corpse_recovery![0];
  assert.ok(recovery.roots.some((r) => r.id === torch));
  const recovered = invoke('recover_corpse', [recovery.corpse_id]);
  host.sql.close();
  host = elapsedHost(path, { wall: 130001, mono: 0 }, bundle);
  story = open();
  assert.equal(story.world().state.containers[torch], fresh.body);
  const replay = story.invoke(recovered);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
});
