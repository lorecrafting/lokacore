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
  gameView,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openGame } from './session.ts';
import { openStory } from './authority.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { load } from './store.ts';
import { expeditionSave } from './expedition-save.ts';

function fixture(danger = false) {
  const content = structuredClone(
    read('kernel/ts/test/fixtures/c6-provisional-artifact.json').cartridge,
  );
  content.entry.key = 'hound_run';
  if (danger) {
    content.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
    (Object.values(content.resources) as any[]).find((r) => r.key === 'hp')!.start = 2;
    for (const npc of Object.values(content.npcs) as any[])
      if (npc.key === 'fen_hound') npc.attack.chance = 100;
    content.world.combat.player_attack.chance = 0;
    delete content.world.combat.dodge;
  }
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
    if (reply.kind === 'saved') assert.equal((reply.decision as { kind: string }).kind, 'accepted');
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

// Breaks: a scheduled fatal bleed preserves route credit, a same-body shrine return revives it,
// or the recovery loader refuses the run_job receipt that carries the death.
test('a real hound bleed fails stage three before shrine return and immediate retry reopens', (t) => {
  const { bundle } = fixture(true);
  const dir = mkdtempSync(join(tmpdir(), 'loka-c6-fatal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = elapsedHost(join(dir, 'save.db'), { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  let game = a.game;
  const view = () => game.view().view;
  const attempt = () =>
    view().journal.find((q) => q.quest.key === 'a_night_in_the_marsh')!.expedition!;
  const invoke = (action_key: string, input: object = {}) => {
    const notice = view().notices?.find((n) =>
      n.actions?.some((action) => action.action_key === action_key),
    );
    const reply = game.invoke({
      action_key,
      target_ids: notice ? [notice.id] : [],
      input,
    } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
  };
  const pulse = (seconds: number) => {
    a.clock.wall += seconds * 20;
    a.clock.mono += seconds * 20;
    assert.equal(game.pulse().kind, 'ready');
  };
  const reopen = () => {
    a.sql.close();
    a.sql.open();
    game = openGame(a.db, bundle, a.host);
  };
  invoke('begin_marsh_watch', { transition: 'start' });
  pulse(150);
  assert.ok(view().bleeding);
  invoke('flee');
  if (view().place.title.key === 'room.adder_nest.title') invoke('move', { direction: 'west' });
  if (view().place.title.key === 'room.hound_run.title') invoke('move', { direction: 'west' });
  invoke('move', { direction: 'west' });
  invoke('move', { direction: 'south' });
  assert.equal(attempt().cursor, 3);
  reopen();
  const first = attempt().attempt_id;
  pulse(100);
  assert.equal(view().place.title.key, 'room.chapel_nave.title');
  assert.equal(attempt().status, 'failed');
  assert.equal(attempt().cursor, 0);
  reopen();
  assert.equal(attempt().status, 'failed');
  for (let i = 0; i < 7; i++) invoke('move', { direction: 'south' });
  invoke('move', { direction: 'east' });
  assert.equal(view().place.title.key, 'room.hound_run.title');
  assert.equal(attempt().cursor, 0);
  invoke('retry_marsh_watch', {
    transition: 'restart',
    quest_instance_id: attempt().quest_instance_id,
    attempt_id: first,
  });
  assert.equal(attempt().status, 'active');
  assert.equal(attempt().cursor, 0);
  assert.notEqual(attempt().attempt_id, first);
  reopen();
  assert.equal(attempt().status, 'active');
  assert.equal(attempt().cursor, 0);
});

// Breaks: uncertain completion COMMIT exposes half a route/reward or receipt replay rewards twice.
test('final route completion reconciles real failed and lost COMMIT outcomes and replays once', (t) => {
  const { bundle, initial } = fixture();
  const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
  const dir = mkdtempSync(join(tmpdir(), 'loka-c6-commit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const kind of ['failed', 'lost'] as const) {
    const a = elapsedHost(join(dir, kind + '.db'), { wall: 10000, mono: 0 }, bundle);
    let opened = openStory(a.db, releases, a.host);
    assert.equal(opened.kind, 'open');
    if (opened.kind !== 'open') throw new Error('open required');
    let story = opened;
    let n = 0;
    const invocation = (action_key: string, input: object = {}) => {
      const notice = gameView(story.world()).notices?.find((row) =>
        row.actions?.some((action) => action.action_key === action_key),
      );
      return {
        invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
        actor_id: initial.character,
        action_key,
        target_ids: notice ? [notice.id] : [],
        input,
      } as never;
    };
    const invoke = (key: string, input: object = {}) => {
      const reply = story.invoke(invocation(key, input));
      assert.equal(reply.kind, 'saved', JSON.stringify(reply));
      if (reply.kind === 'saved')
        assert.equal((reply.decision as { kind: string }).kind, 'accepted');
    };
    invoke('begin_marsh_watch', { transition: 'start' });
    invoke('flee');
    if (gameView(story.world()).place.title.key === 'room.adder_nest.title')
      invoke('move', { direction: 'west' });
    if (gameView(story.world()).place.title.key === 'room.hound_run.title')
      invoke('move', { direction: 'west' });
    for (const direction of ['west', 'south', 'north']) invoke('move', { direction });
    assert.equal(Object.values(story.world().state.expeditions!)[0].cursor, 4);
    const snapshot = () =>
      JSON.stringify(
        ['head', 'state_row', 'receipt'].map((table) =>
          a.sql.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all(),
        ),
      );
    const before = snapshot();
    const memory = story.world();
    if (kind === 'failed')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    a.fault.kind = kind;
    a.fault.armed = true;
    const finish = invocation('move', { direction: 'east' });
    assert.equal(story.invoke(finish).kind, 'pending');
    assert.equal(story.world(), memory);
    assert.equal(story.invoke(invocation('look')).kind, 'pending');
    a.fault.reads = false;
    if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.sql.close();
    a.sql.open();
    opened = openStory(a.db, releases, a.host);
    assert.equal(opened.kind, 'open', kind);
    if (opened.kind !== 'open') throw new Error('open required');
    story = opened;
    const row = Object.values(story.world().state.expeditions!)[0];
    assert.equal(row.cursor, kind === 'lost' ? 5 : 4);
    assert.equal(row.status, kind === 'lost' ? 'completed' : 'active');
    if (kind === 'failed') assert.equal(snapshot(), before);
    const reply = story.invoke(finish);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.replay, kind === 'lost');
    const spec = Object.values(initial.cartridge.quests!).find((q) => q.expedition)!.expedition!;
    assert.equal(value(story.world(), initial.character, spec.faction), -1);
    assert.equal(value(story.world(), initial.character, spec.survived_fact), true);
    const completed = snapshot();
    const replay = story.invoke(finish);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved') assert.equal(replay.replay, true);
    assert.equal(snapshot(), completed);
    a.sql.close();
  }
});
