import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openStory } from './authority.ts';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { foodHost } from './__tests__/food-host.ts';
import { entity, prefix, ref, onlyFood } from '../../../kernel/ts/test/food_fixture.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { level } from '../../../kernel/ts/src/mechanics/resource.ts';
const mv = (a: ReturnType<typeof foodHost>) =>
  level(a.story.world(), a.initial.body, ref('resource', 'mv'));
function disk(t: any, change = (_c: any) => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-food-')),
    path = join(dir, 'save.db'),
    a = foodHost(path, change);
  t.after(() => {
    if (a.sql.isOpen) a.sql.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { a, path };
}
const apple = (a: ReturnType<typeof foodHost>, n = 1) => entity(a.initial, 'item', `apple_0${n}`);

// Breaks: orchard identities or terminal custody reset on reopen; stale retries replay a second MV gain.
test('real SQLite carries the same apple through storage/drop/Forage/give/Eat and later consumers', (t) => {
  const { a } = disk(t, (c) => {
    c.npcs[`${prefix}:npc/ada`].room.key = 'orchard';
    c.items[`${prefix}:item/storage_chest`].location = { in: 'room', room: ref('room', 'orchard') };
    c.barriers[`${prefix}:barrier/storage_chest_lid`].initial = 'open';
  });
  const trees = Object.keys(a.initial.details).find(
    (id) => a.initial.details[id].key === 'apple_trees',
  )!;
  const apples = [1, 2, 3].map((n) => apple(a, n)).sort();
  const id = apples[0],
    chest = entity(a.initial, 'item', 'storage_chest'),
    ada = entity(a.initial, 'npc', 'ada');
  a.invoke('take', [id]);
  a.reopen();
  a.invoke('put', [id, chest]);
  a.reopen();
  assert.equal(a.story.world().state.containers[id], chest);
  a.invoke('take', [id]);
  a.invoke('drop', [id]);
  a.reopen();
  assert.equal(a.story.world().state.containers[id], a.initial.roomIds[`${prefix}:room/orchard`]);
  a.invoke('harvest', [trees]);
  a.reopen();
  assert.equal(a.story.world().state.containers[id], a.initial.body);
  const eaten = a.invoke('eat', [id]);
  a.reopen();
  assert.equal(mv(a), 56);
  assert.equal(a.story.world().state.containers[id], a.initial.consumed);
  const receipt = a.sql
    .prepare('SELECT command_id FROM receipt WHERE invocation_id=?')
    .get(eaten.invocation_id)!;
  const narration = a.story.narration(receipt.command_id as string);
  assert.ok(narration);
  assert.equal(narration.detail_id, undefined);
  assert.deepEqual(
    narration.lines.map((l) => l.key),
    ['narration.eat_apple'],
  );
  const rows = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  const replay = a.story.invoke(eaten);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.command_id, receipt.command_id);
  assert.equal(mv(a), 56);
  assert.deepEqual(a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows);
  a.invoke('take', [apples[1]]);
  a.invoke('give', [apples[1], ada]);
  a.reopen();
  assert.equal(a.story.world().state.containers[apples[1]], ada);
  a.invoke('harvest', [trees]);
  a.reopen();
  assert.equal(a.story.world().state.containers[apples[2]], a.initial.body);
  a.invoke('eat', [apples[2]]);
  a.reopen();
  assert.equal(mv(a), 62);
});

// Breaks: deleting the food-only replay trigger permits a bounded forged MV benefit or terminal receipt/custody lie.
test('food-only cold-open refuses plausible bounded forgeries without writing bytes', (t) => {
  for (const mutation of [
    'mv',
    'restore',
    'nonfood',
    'holder-row',
    'item_id',
    'actor',
    'scope',
    'narration',
    'ops',
    'missing',
  ]) {
    const { a, path } = disk(t, onlyFood),
      id = apple(a);
    a.invoke('take', [id]);
    a.invoke('eat', [id]);
    const row = a.sql
      .prepare("SELECT * FROM receipt WHERE json_extract(command,'$.payload.type')='eat'")
      .get() as any;
    if (mutation === 'mv')
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='resources' AND key=?")
        .run(
          JSON.stringify({ value: 57, at: 0, rate: 18, remainder: 0 }),
          key({ kind: 'resource', entity_id: a.initial.body, resource: ref('resource', 'mv') }),
        );
    else if (mutation === 'restore')
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='containers' AND key=?")
        .run(JSON.stringify(a.initial.body), id);
    else if (mutation === 'nonfood')
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='containers' AND key=?")
        .run(JSON.stringify(a.initial.consumed), a.initial.body);
    else if (mutation === 'holder-row')
      a.sql
        .prepare("INSERT INTO state_row VALUES ('containers',?,?)")
        .run(a.initial.consumed!, JSON.stringify(a.initial.body));
    else if (mutation === 'missing')
      a.sql.prepare('DELETE FROM receipt WHERE invocation_id=?').run(row.invocation_id);
    else if (mutation === 'scope')
      a.sql
        .prepare('UPDATE receipt SET scope=? WHERE invocation_id=?')
        .run('story/foreign/actor', row.invocation_id);
    else {
      const d = JSON.parse(row.response),
        c = JSON.parse(row.command);
      if (mutation === 'item_id') d.item_id = apple(a, 2);
      if (mutation === 'actor') c.payload.actor_id = 'ffffffff-0000-4000-8000-000000000001';
      if (mutation === 'narration') d.narration = [{ key: 'narration.forage_apple' }];
      if (mutation === 'ops') d.delta.ops.pop();
      a.sql
        .prepare('UPDATE receipt SET response=?,command=? WHERE invocation_id=?')
        .run(JSON.stringify(d), JSON.stringify(c), row.invocation_id);
    }
    if (['item_id', 'actor', 'narration'].includes(mutation))
      assert.throws(() => a.story.narration(row.command_id), /invalid committed Eat/, mutation);
    a.sql.close();
    const before = readFileSync(path);
    // Reopen a real connection without invoking the helper's successful-open assertion.
    const sql = new DatabaseSync(path),
      db = {
        execSync: (q: string) => sql.exec(q),
        runSync: (q: string, ...p: any[]) => sql.prepare(q).run(...p),
        getFirstSync: (q: string, ...p: any[]) => sql.prepare(q).get(...p) ?? null,
        getAllSync: (q: string, ...p: any[]) => sql.prepare(q).all(...p),
        isInTransactionSync: () => sql.isTransaction,
      };
    try {
      assert.equal(openStory(db as any, a.releases, a.host).kind, 'save_corrupt', mutation);
    } finally {
      sql.close();
    }
    assert.deepEqual(readFileSync(path), before, mutation);
  }
});

// Breaks: failed or uncertain Eat adopts half custody/benefit or a lost acknowledgement applies twice.
test('real failed and committed/absent uncertain COMMIT preserve atomic Eat and exact retry', (t) => {
  for (const kind of ['definite', 'failed', 'lost'] as const) {
    const { a } = disk(t, onlyFood),
      id = apple(a);
    a.invoke('take', [id]);
    if (kind !== 'lost')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent DEFERRABLE INITIALLY DEFERRED)',
      );
    if (kind === 'definite') {
      const exec = a.db.execSync;
      a.db.execSync = (q) => {
        try {
          return exec(q);
        } finally {
          a.fault.reads = false;
        }
      };
    }
    const i = a.attempt('eat', [id]);
    a.fault.kind = kind === 'definite' ? 'failed' : kind;
    a.fault.armed = true;
    if (kind === 'definite')
      assert.throws(() => a.story.invoke(i), /COMMIT failed; nothing was saved/);
    else assert.equal(a.story.invoke(i).kind, 'pending');
    a.fault.reads = false;
    if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.reopen();
    assert.equal(mv(a), kind === 'lost' ? 56 : 50);
    assert.equal(
      a.story.world().state.containers[id],
      kind === 'lost' ? a.initial.consumed : a.initial.body,
    );
    const replay = a.story.invoke(i);
    assert.equal(replay.kind === 'saved' && (replay.decision as any).kind, 'accepted');
    a.reopen();
    assert.equal(mv(a), 56);
    assert.equal(a.story.world().state.containers[id], a.initial.consumed);
  }
});

// Breaks: a later corpse rebuild rejects earlier terminal custody or food in a corpse cannot rejoin ordinary held Eat.
test('spent apple and another apple in a real fight corpse both reopen before a later Eat', (t) => {
  const { a } = disk(t, (c) => {
    c.world.death.shrine = ref('room', 'orchard');
    c.world.death.restore.mv = 50;
    c.npcs[`${prefix}:npc/cellar_rat_1`].room.key = 'orchard';
    c.world.death_credit[0].room = ref('room', 'orchard');
    c.npcs[`${prefix}:npc/cellar_rat_1`].attack.chance = 100;
    c.npcs[`${prefix}:npc/cellar_rat_1`].attack.damage_min = 20;
    c.npcs[`${prefix}:npc/cellar_rat_1`].attack.damage_max = 20;
  });
  const spent = apple(a, 1),
    held = apple(a, 2),
    rat = entity(a.initial, 'npc', 'cellar_rat_1');
  a.invoke('take', [spent]);
  a.invoke('eat', [spent]);
  a.invoke('take', [held]);
  a.invoke('attack', [rat]);
  a.clock.wall += 3000;
  a.clock.mono += 3000;
  assert.equal(a.story.pulse('active', a.story.runId()).kind, 'ready');
  const world = a.story.world(),
    corpse = Object.keys(world.state.created ?? {}).find(
      (id) =>
        world.state.created![id].origin.kind === 'death' &&
        world.state.created![id].origin.owner_id === a.initial.character,
    )!;
  assert.ok(corpse);
  assert.equal(world.state.containers[held], corpse);
  assert.equal(world.state.containers[spent], a.initial.consumed);
  a.reopen();
  assert.equal(a.story.world().state.containers[held], corpse);
  a.invoke('take', [held]);
  a.reopen();
  a.invoke('eat', [held]);
  a.reopen();
  assert.equal(a.story.world().state.containers[held], a.initial.consumed);
  assert.equal(mv(a), 56);
});
