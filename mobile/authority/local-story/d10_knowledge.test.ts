import { openStory } from './authority.ts';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { fragment } from '../../../kernel/ts/test/fragment.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openGame } from './session.ts';

// Showcase plus an inline Knock on the Smithy's open south store door (answered by the smith).
const f = fragment('protocol/fixtures/toolbox_showcase_hash.json');
const smithy = `${f.prefix}:room/smithy`;
function knockable(c: any) {
  c.entry = f.ref('room', 'the_fold');
  c.rooms[smithy].exits.south.knock = {
    npc: f.ref('npc', 'smith'),
    room: f.ref('room', 'woodstore'),
    answered: 'knock.store.answered',
    unanswered: 'knock.store.unanswered',
  };
  c.text['knock.store.answered'] = 'The smith calls back.';
  c.text['knock.store.unanswered'] = 'No one answers.';
  const door = c.barriers[`${f.prefix}:barrier/store_door`];
  door.initial = 'open';
  delete door.opens_when;
}
const invoke = (
  game: ReturnType<typeof openGame>,
  action_key: string,
  input: object = {},
  target_ids: string[] = [],
) => {
  const reply = game.invoke({ action_key, target_ids, input } as never);
  assert.equal(reply.kind, 'saved', JSON.stringify(reply));
  if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
  return reply;
};
const names = (game: ReturnType<typeof openGame>): string[] =>
  game
    .view()
    .view.map!.rooms.map((r) => r.title)
    .sort();

// Break: durable discovery or observations disappear on cold open, or a failed/stale move earns a visit.
test('D10 real SQLite keeps each entry/Look and shared door commit across cold reopen and retry', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d10-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = elapsedHost(join(dir, 'save.db'), { wall: 10000, mono: 0 }, f.bundle(knockable));
  t.after(() => a.sql.close());
  let game = a.game;
  const reopen = () => {
    a.sql.close();
    a.sql.open();
    game = openGame(a.db, a.bundle, a.host);
    assert.ok(game.view().view);
  };
  reopen();
  assert.deepEqual(names(game), ['room.the_fold.title']);
  invoke(game, 'look');
  reopen();
  assert.deepEqual(names(game), ['room.the_fold.title']);
  const before = game.view().token;
  invoke(game, 'move', { direction: 'south' });
  reopen();
  assert.deepEqual(names(game), ['room.smithy.title', 'room.the_fold.title']);
  const stale = game.invoke({
    action_key: 'move',
    target_ids: [],
    input: { direction: 'south' },
    view_freshness_token: before,
  } as never);
  assert.equal(stale.kind, 'stale_view');
  const rows = () =>
    a.sql
      .prepare(
        "SELECT section,key,value FROM state_row WHERE section IN ('visited_rooms','observed_npcs','barriers') ORDER BY section,key",
      )
      .all();
  const knowledge = rows();
  invoke(game, 'knock', { direction: 'south' });
  reopen();
  assert.deepEqual(rows(), knowledge);
  invoke(game, 'close', { direction: 'south' });
  reopen();
  const blocked = game.invoke({
    action_key: 'move',
    target_ids: [],
    input: { direction: 'south' },
  } as never);
  assert.equal(blocked.kind, 'saved');
  if (blocked.kind === 'saved') assert.equal(blocked.decision.kind, 'rejected');
  assert.equal(names(game).includes('room.woodstore.title'), false);
  const pressed = invoke(game, 'open', { direction: 'south' });
  // Breaks: the door check reads the stored command's envelope, not its payload, and the latch never plays.
  assert.equal(
    game.lastNarration(pressed.kind === 'saved' ? pressed.command_id : '')?.opened,
    true,
  );
  reopen();
  invoke(game, 'move', { direction: 'south' });
  reopen();
  assert.ok(names(game).includes('room.woodstore.title'));
  const observations = a.sql
    .prepare("SELECT value FROM state_row WHERE section='observed_npcs'")
    .all()
    .map((r) => JSON.parse(r.value as string));
  assert.ok(observations.some((r) => r.at === 25200));
});

// Break: corrupted knowledge is silently repaired or untyped, rather than refusing without changing save bytes.
test('D10 malformed and forged knowledge rows refuse in place without deleting saved progress', (t) => {
  for (const kind of [
    'missing_current',
    'wrong_actor',
    'future_observation',
    'forged_visit',
    'unsafe_time',
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-d10-corrupt-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'save.db');
    const a = elapsedHost(path, { wall: 10000, mono: 0 }, f.bundle());
    invoke(a.game, 'look');
    if (kind === 'missing_current')
      a.sql.exec("DELETE FROM state_row WHERE section='visited_rooms'");
    if (kind === 'wrong_actor')
      a.sql.exec(
        "UPDATE state_row SET value=json_set(value,'$.actor_id','00000000-0000-4000-8000-000000000099') WHERE section='visited_rooms'",
      );
    if (kind === 'future_observation')
      a.sql.exec(
        "UPDATE state_row SET value=json_set(value,'$.at',999999) WHERE section='observed_npcs'",
      );
    if (kind === 'unsafe_time') {
      const r = a.sql
        .prepare("SELECT key,value FROM state_row WHERE section='observed_npcs' LIMIT 1")
        .get()!;
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='observed_npcs' AND key=?")
        .run((r.value as string).replace(/"at":\d+/, '"at":1e999'), r.key as string);
    }
    if (kind === 'forged_visit') {
      const existing = a.sql
        .prepare("SELECT key,value FROM state_row WHERE section='visited_rooms' LIMIT 1")
        .get()!;
      const row = JSON.parse(existing.value as string);
      row.room_id = f.genesis().roomIds[`${f.prefix}:room/forge_stall`];
      a.sql
        .prepare("INSERT INTO state_row VALUES ('visited_rooms',?,?)")
        .run(
          encode({ kind: 'visit', actor_id: row.actor_id, room_id: row.room_id }),
          JSON.stringify(row),
        );
    }
    a.sql.close();
    const bytes = readFileSync(path);
    a.sql.open();
    assert.throws(
      () => openGame(a.db, a.bundle, a.host),
      (error: any) =>
        error.cause?.kind === 'save_corrupt' && typeof error.cause.newGame === 'function',
      kind,
    );
    a.sql.close();
    assert.deepEqual(readFileSync(path), bytes, kind);
  }
});

// Break: an uncertain entry COMMIT exposes a visit before its receipt or invents a newer observation on retry.
test('D10 failed and lost COMMIT keep whole knowledge and replay one accepted entry', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d10-fault-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const b = f.bundle();
  const fresh = f.genesis();
  const releases = [{ fresh, content_hash: b.sha256 }] as const;
  for (const kind of ['failed', 'lost'] as const) {
    const a = elapsedHost(join(dir, kind + '.db'), { wall: 10000, mono: 0 }, b);
    invoke(a.game, 'look');
    let opened = openStory(a.db, releases, a.host);
    assert.equal(opened.kind, 'open');
    if (opened.kind !== 'open') throw new Error('open required');
    let story = opened;
    const request = {
      invocation_id: 'dddddddd-0000-4000-8000-000000000001',
      actor_id: fresh.character,
      action_key: 'move',
      target_ids: [],
      input: { direction: 'north' },
    };
    const snapshot = () =>
      JSON.stringify(
        ['head', 'state_row', 'receipt'].map((table) =>
          a.sql.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all(),
        ),
      );
    const before = snapshot(),
      memory = story.world();
    if (kind === 'failed')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    a.fault.kind = kind;
    a.fault.armed = true;
    assert.equal(story.invoke(request).kind, 'pending');
    assert.strictEqual(story.world(), memory);
    assert.equal(
      story.invoke({ ...request, invocation_id: 'dddddddd-0000-4000-8000-000000000002' }).kind,
      'pending',
    );
    a.fault.reads = false;
    if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.sql.close();
    a.sql.open();
    opened = openStory(a.db, releases, a.host);
    assert.equal(opened.kind, 'open', kind);
    if (opened.kind !== 'open') throw new Error('open required');
    story = opened;
    assert.equal(Object.keys(story.world().state.visited_rooms!).length, kind === 'lost' ? 2 : 1);
    if (kind === 'failed') assert.equal(snapshot(), before);
    const result = story.invoke(request);
    assert.equal(result.kind, 'saved');
    if (result.kind === 'saved') assert.equal(result.replay, kind === 'lost');
    assert.equal(Object.keys(story.world().state.visited_rooms!).length, 2);
    const complete = snapshot();
    const replay = story.invoke(request);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved') assert.equal(replay.replay, true);
    assert.equal(snapshot(), complete);
    a.sql.close();
  }
});
