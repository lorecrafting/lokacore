import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openGame } from './session.ts';

function fixture() {
  const content = structuredClone(
    read('kernel/ts/test/fixtures/c6-provisional-artifact.json').cartridge,
  );
  content.entry.key = 'hound_run';
  const canonical = encode(content);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: content, content_hash: sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const initial = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  return { bundle: { canonical, sha256 }, initial };
}

// Breaks: a route cursor is credited from room presence or a prior visit, rather than each new accepted edge.
test('C6 five real entries and optional shelter survive every cold reopen', (t) => {
  const { bundle } = fixture();
  const dir = mkdtempSync(join(tmpdir(), 'loka-c6-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = elapsedHost(join(dir, 'save.db'), { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  let game = a.game;
  const view = () => game.view().view;
  const expedition = () =>
    view().journal.find((q) => q.quest.key === 'a_night_in_the_marsh')?.expedition;
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
    return reply;
  };
  const reopen = () => {
    a.sql.close();
    a.sql.open();
    game = openGame(a.db, bundle, a.host);
    assert.ok(game.view().view);
  };
  const detail = view().notices!.find((n) =>
    n.actions?.some((a) => a.action_key === 'begin_marsh_watch'),
  )!;
  assert.ok(detail);
  const action = detail.actions!.find((a) => a.action_key === 'begin_marsh_watch')!;
  assert.equal(action.available, true);
  invoke('begin_marsh_watch', [detail.id], { transition: 'start' });
  assert.equal(expedition()?.cursor, 0);
  reopen();
  assert.ok(view().combat);
  invoke('flee');
  reopen();
  if (view().place.title.key === 'room.adder_nest.title') invoke('move', [], { direction: 'west' });
  if (view().place.title.key === 'room.hound_run.title') invoke('move', [], { direction: 'west' });
  assert.equal(expedition()?.cursor, 1);
  reopen();
  for (const [direction, cursor] of [
    ['west', 2],
    ['south', 3],
  ] as const) {
    invoke('move', [], { direction });
    reopen();
    assert.equal(expedition()?.cursor, cursor);
  }
  const shelter = view().notices!.find((n) =>
    n.actions?.some((a) => a.action_key === 'use_marsh_shelter'),
  )!;
  assert.ok(shelter);
  const before = view().time;
  const row = expedition()!;
  invoke('use_marsh_shelter', [shelter.id], {
    transition: 'shelter',
    quest_instance_id: row.quest_instance_id,
    attempt_id: row.attempt_id,
    cursor: 3,
  });
  reopen();
  assert.equal(expedition()?.sheltered, true);
  assert.equal(view().time, before);
  for (const [direction, cursor] of [
    ['north', 4],
    ['east', 5],
  ] as const) {
    invoke('move', [], { direction });
    reopen();
    assert.equal(expedition()?.cursor, cursor);
  }
  assert.equal(expedition()?.status, 'completed');
  assert.equal(
    view().journal.find((q) => q.quest.key === 'a_night_in_the_marsh')?.state,
    'resolved',
  );
});
