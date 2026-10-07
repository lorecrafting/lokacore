import { newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openGame } from './session.ts';

function bundle(entry?: string) {
  const c = structuredClone(read('protocol/fixtures/missing_child_v042_hash.json').value);
  if (entry) c.entry.key = entry;
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
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
  const a = elapsedHost(join(dir, 'save.db'), { wall: 10000, mono: 0 }, bundle());
  t.after(() => a.sql.close());
  let game = a.game;
  const reopen = () => {
    a.sql.close();
    a.sql.open();
    game = openGame(a.db, a.bundle, a.host);
    assert.ok(game.view().view);
  };
  invoke(game, 'choose_ancestry', { ancestry: 'road_born' });
  reopen();
  assert.deepEqual(names(game), ['room.ferry_landing.title']);
  invoke(game, 'look');
  reopen();
  assert.deepEqual(names(game), ['room.ferry_landing.title']);
  const before = game.view().token;
  invoke(game, 'move', { direction: 'north' });
  reopen();
  assert.deepEqual(names(game), ['room.ferry_landing.title', 'room.well_lane.title']);
  const stale = game.invoke({
    action_key: 'move',
    target_ids: [],
    input: { direction: 'north' },
    view_freshness_token: before,
  } as never);
  assert.equal(stale.kind, 'stale_view');
  for (const direction of ['north', 'north', 'north']) {
    invoke(game, 'move', { direction });
    reopen();
  }
  assert.ok(names(game).includes('room.chapel_steps.title'));
  const rows = () =>
    a.sql
      .prepare(
        "SELECT section,key,value FROM state_row WHERE section IN ('visited_rooms','observed_npcs','barriers') ORDER BY section,key",
      )
      .all();
  const knowledge = rows();
  invoke(game, 'knock', { direction: 'north' });
  reopen();
  assert.deepEqual(rows(), knowledge);
  invoke(game, 'close', { direction: 'north' });
  reopen();
  const blocked = game.invoke({
    action_key: 'move',
    target_ids: [],
    input: { direction: 'north' },
  } as never);
  assert.equal(blocked.kind, 'saved');
  if (blocked.kind === 'saved') assert.equal(blocked.decision.kind, 'rejected');
  assert.equal(names(game).includes('room.chapel_nave.title'), false);
  invoke(game, 'open', { direction: 'north' });
  reopen();
  invoke(game, 'move', { direction: 'north' });
  reopen();
  assert.ok(names(game).includes('room.chapel_nave.title'));
  const observations = a.sql
    .prepare("SELECT value FROM state_row WHERE section='observed_npcs'")
    .all()
    .map((r) => JSON.parse(r.value as string));
  assert.ok(observations.some((r) => r.at === 64800));
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
    const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle('chapel_nave'));
    invoke(a.game, 'choose_ancestry', { ancestry: 'road_born' });
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
      const fresh = newWorld(
        read('protocol/fixtures/missing_child_v042_hash.json').value as Cartridge,
        '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
        [1, 2, 3, 4],
      );
      row.room_id = fresh.roomIds['ashmere_missing_child@0.0.42:room/scriptorium'];
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
  const b = bundle();
  const fresh = newWorld(
    read('protocol/fixtures/missing_child_v042_hash.json').value as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh, content_hash: b.sha256 }] as const;
  for (const kind of ['failed', 'lost'] as const) {
    const a = elapsedHost(join(dir, kind + '.db'), { wall: 10000, mono: 0 }, b);
    invoke(a.game, 'choose_ancestry', { ancestry: 'road_born' });
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

// Break: the shared entry owner omits ferry or water transfers and the due drowning return.
test('D10 ferry, water entry/surface and due drowning return discover once and reopen at each intermediate', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d10-route-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = elapsedHost(join(dir, 'save.db'), { wall: 10000, mono: 0 }, bundle());
  t.after(() => a.sql.close());
  let game = a.game;
  const reopen = () => {
    a.sql.close();
    a.sql.open();
    game = openGame(a.db, a.bundle, a.host);
  };
  const act = (key: string, input: object = {}, ids: string[] = []) => {
    invoke(game, key, input, ids);
    reopen();
  };
  act('choose_ancestry', { ancestry: 'road_born' });
  act('move', { direction: 'west' });
  const cross = () => {
    const f = game.view().view.notices!.find((n) => n.transport)!.transport!;
    act(f.action.action_key, { route: f.route, quoted_fare: f.fare }, [...f.action.target_ids!]);
  };
  cross();
  assert.ok(names(game).includes('room.fen_isle_landing.title'));
  act('move', { direction: 'east' });
  const sedge = game.view().view.entities.find((e) => e.name === 'npc.sedge.short')!;
  act('sedge_swim', {}, [sedge.id]);
  act('choose', { continuation_id: game.view().view.choice!.continuation_id, choice_id: 'learn' });
  act('move', { direction: 'west' });
  cross();
  for (const direction of ['east', 'north', 'down', 'down']) act('move', { direction });
  assert.ok(names(game).includes('room.well_bottom.title'));
  act('move', { direction: 'up' });
  assert.equal(game.view().view.place.title.key, 'room.well_shaft.title');
  act('move', { direction: 'down' });
  const before = names(game);
  a.clock.wall += 120001;
  a.clock.mono += 120001;
  // Open the actual authority so the test drives the same elapsed writer as the session.
  const fresh = newWorld(
    read('protocol/fixtures/missing_child_v042_hash.json').value as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const story = openStory(a.db, [{ fresh, content_hash: a.bundle.sha256 }], a.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('open required');
  story.pulse('active', story.runId());
  reopen();
  assert.equal(game.view().view.place.title.key, 'room.chapel_nave.title');
  assert.deepEqual(names(game), [...before, 'room.chapel_nave.title'].sort());
});
