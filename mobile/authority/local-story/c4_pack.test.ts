import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { bundle, fixture, h1, h2, nest } from '../../../kernel/ts/test/c4_pack_fixture.ts';
import { openStory } from './authority.ts';
import type { Db } from './store.ts';

// The kernel's controlled goblin pack: the body, h1 and h2 in the pit, 5-second rounds, sure
// 1-damage blows. h1 starts at 1 of 8 hp, under the 25% flight line; the pit's only exit is north.
const fresh = fixture();
const initial = {
  ...fresh,
  state: {
    ...fresh.state,
    resources: {
      ...fresh.state.resources,
      [key({ kind: 'resource', entity_id: h1, resource: resourceRef(fresh, 'hp') })]: {
        value: 1,
        at: fresh.state.clock,
      },
    },
  },
};

const releases = [{ fresh: initial, content_hash: bundle().sha256 }] as const;

function host(path: string) {
  const sql = new DatabaseSync(path);
  const db: Db = {
    execSync: (query) => sql.exec(query),
    runSync: (query, ...args) => sql.prepare(query).run(...args),
    getFirstSync: (query, ...args) => (sql.prepare(query).get(...args) ?? null) as never,
    getAllSync: (query, ...args) => sql.prepare(query).all(...args) as never,
    isInTransactionSync: () => sql.isTransaction,
  };
  let n = 0;
  return {
    sql,
    db,
    host: {
      kernel_version: `loka-kernel@${'0'.repeat(40)}`,
      newId: () => `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      time: { wall: () => 10000, monotonic: () => 0 },
    },
  };
}

// Breaks: a committed flight is rejected when the elapsed endpoint is later than its round due clock.
test('SQLite reopens a rotated pack then a wounded goblin flight with one surviving encounter', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-pack-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = host(path);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  const attack = story.invoke({
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    actor_id: fresh.character,
    action_key: 'attack',
    target_ids: [h2],
    input: {},
  });
  assert.equal(attack.kind, 'saved');
  const first = story.elapsed({ expected_run_id: story.runId(), from: 64800, until: 64805 });
  assert.equal(first.kind, 'saved');
  const rotated = Object.values(story.world().state.encounters ?? {})[0]!;
  assert.equal(rotated.round, 2);
  assert.equal(rotated.next_opponent_id, h1);
  p.sql.close();
  const q = host(path);
  const reopened = openStory(q.db, releases, q.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.equal(encode(reopened.world().state as never), encode(story.world().state as never));
  const second = reopened.elapsed({ expected_run_id: reopened.runId(), from: 64805, until: 64811 });
  assert.equal(second.kind, 'saved');
  const narration = reopened.narration();
  assert.deepEqual(
    narration?.lines.map((line) => line.key),
    ['combat.player_hit', 'combat.goblin_fled_north'],
  );
  assert.deepEqual(narration?.combat_lines, [0, 1]);
  assert.equal(reopened.world().state.containers[h1], nest);
  const origin = reopened.world().state.created![h1]!.origin;
  assert.equal(origin.kind, 'spawned');
  if (origin.kind !== 'spawned') return;
  const slot =
    reopened.world().state.population_slots![
      key({ kind: 'population_slot', plan: origin.by, slot: 1 })
    ]!;
  assert.equal(slot.last_flight_at, 64810);
  const active = Object.values(reopened.world().state.encounters ?? {})[0]!;
  assert.equal(active.status, 'open');
  assert.equal(active.active_ids?.includes(h1), false);
  const encounter_id = Object.keys(reopened.world().state.encounters ?? {})[0]!;
  q.sql
    .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
    .run(
      JSON.stringify({ ...active, active_ids: [...active.active_ids!, h1].sort() }),
      'encounters',
      encounter_id,
    );
  q.sql.close();
  const forged = readFileSync(path);
  const bad = host(path);
  t.after(() => bad.sql.close());
  assert.equal(openStory(bad.db, releases, bad.host).kind, 'save_corrupt');
  assert.deepEqual(readFileSync(path), forged);
});

// Breaks: a failed flight COMMIT adopts the transfer/slot/encounter without its receipt, or retry flies twice.
test('failed SQLite flight COMMIT keeps the old pack then exact retry flies once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-pack-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = host(path);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  assert.equal(
    story.invoke({
      invocation_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      actor_id: fresh.character,
      action_key: 'attack',
      target_ids: [h2],
      input: {},
    }).kind,
    'saved',
  );
  assert.equal(
    story.elapsed({ expected_run_id: story.runId(), from: 64800, until: 64805 }).kind,
    'saved',
  );
  const before = encode(story.world().state as never);
  const rows = p.sql
    .prepare('SELECT section, key, value FROM state_row ORDER BY section, key')
    .all();
  assert.equal(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 2);
  p.sql.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE parent(id INTEGER PRIMARY KEY);
    CREATE TABLE orphan(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED);
    CREATE TRIGGER orphaned AFTER INSERT ON receipt BEGIN INSERT INTO orphan VALUES (1); END;`);
  const exact = { expected_run_id: story.runId(), from: 64805, until: 64810 };
  assert.throws(() => story.elapsed(exact), /nothing was saved/);
  assert.equal(encode(story.world().state as never), before);
  assert.deepEqual(
    p.sql.prepare('SELECT section, key, value FROM state_row ORDER BY section, key').all(),
    rows,
  );
  assert.equal(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 2);
  p.sql.close();

  const q = host(path);
  const reopened = openStory(q.db, releases, q.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.equal(encode(reopened.world().state as never), before);
  q.sql.exec('DROP TRIGGER orphaned');
  assert.equal(reopened.elapsed(exact).kind, 'saved');
  assert.equal(q.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 3);
  assert.equal(reopened.world().state.containers[h1], nest);
  const active = Object.values(reopened.world().state.encounters ?? {})[0]!;
  assert.equal(active.status, 'open');
  assert.equal(active.active_ids?.includes(h1), false);
  q.sql.close();
});
