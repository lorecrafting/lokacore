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
import { load } from './store.ts';
import { expeditionSave } from './expedition-save.ts';

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

// Breaks: receipt replay accepts a forged shelter flag at Start, a foreign command actor,
// or a shelter command that silently replaces the current attempt identity.
test('cold reopen refuses forged expedition transitions without changing saved rows', (t) => {
  const { bundle, initial } = fixture();
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  const invoke = (action_key: string, input: object = {}) => {
    const notice = a.game
      .view()
      .view.notices?.find((n) => n.actions?.some((action) => action.action_key === action_key));
    const reply = a.game.invoke({
      action_key,
      target_ids: notice ? [notice.id] : [],
      input,
    } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  const corrupt = (change: (row: any, command: any) => void) => {
    const before = load(a.db, initial, () => {
      throw new Error('existing save required');
    })!;
    const receipt = a.sql
      .prepare('SELECT command_id, command, response FROM receipt ORDER BY revision DESC LIMIT 1')
      .get()!;
    const saved = a.sql
      .prepare('SELECT key,value FROM state_row WHERE section=?')
      .get('expeditions')!;
    try {
      const response = JSON.parse(receipt.response as string);
      const command = JSON.parse(receipt.command as string);
      const transition = response.delta.ops.find((op: any) => op.op === 'expedition.transition');
      change(transition.value, command);
      a.sql
        .prepare('UPDATE receipt SET command=?, response=? WHERE command_id=?')
        .run(JSON.stringify(command), JSON.stringify(response), receipt.command_id);
      a.sql
        .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
        .run(JSON.stringify(transition.value), 'expeditions', transition.quest_instance_id);
      const forged = {
        ...before.world,
        state: {
          ...before.world.state,
          expeditions: { [transition.quest_instance_id]: transition.value },
        },
      };
      assert.throws(
        () => expeditionSave(forged, a.db, before.meta, before.revision),
        /inconsistent expedition receipt/,
      );
      const snapshot = JSON.stringify(
        a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(),
      );
      assert.throws(
        () => openGame(a.db, bundle, a.host),
        (error: any) => error.cause?.kind === 'save_corrupt',
      );
      assert.equal(
        JSON.stringify(a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all()),
        snapshot,
      );
    } finally {
      a.sql
        .prepare('UPDATE receipt SET command=?, response=? WHERE command_id=?')
        .run(receipt.command, receipt.response, receipt.command_id);
      a.sql
        .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
        .run(saved.value, 'expeditions', saved.key);
    }
  };
  invoke('begin_marsh_watch', { transition: 'start' });
  corrupt((row) => {
    row.sheltered = true;
  });
  corrupt((_, command) => {
    command.payload.actor_id = 'aaaaaaaa-0000-4000-8000-000000009999';
  });
  invoke('flee');
  if (a.game.view().view.place.title.key === 'room.adder_nest.title')
    invoke('move', { direction: 'west' });
  if (a.game.view().view.place.title.key === 'room.hound_run.title')
    invoke('move', { direction: 'west' });
  invoke('move', { direction: 'west' });
  invoke('move', { direction: 'south' });
  const row = a.game
    .view()
    .view.journal.find((q) => q.quest.key === 'a_night_in_the_marsh')!.expedition!;
  invoke('use_marsh_shelter', {
    transition: 'shelter',
    quest_instance_id: row.quest_instance_id,
    attempt_id: row.attempt_id,
    cursor: 3,
  });
  corrupt((row) => {
    row.attempt_id = 'aaaaaaaa-0000-4000-8000-000000009999';
  });
});
