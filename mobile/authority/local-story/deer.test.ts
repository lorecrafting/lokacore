import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, fresh, ref } from '../../../kernel/ts/test/deer_fixture.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { openStory } from './authority.ts';

const releases = [{ fresh: fresh(), content_hash: bundle.sha256 }] as const;
function adapter(sql: DatabaseSync) {
  return {
    execSync: (q: string) => sql.exec(q),
    runSync: (q: string, ...args: any[]) => sql.prepare(q).run(...args),
    getFirstSync: (q: string, ...args: any[]) => sql.prepare(q).get(...args) ?? null,
    getAllSync: (q: string, ...args: any[]) => sql.prepare(q).all(...args),
    isInTransactionSync: () => sql.isTransaction,
  };
}
function setup(t: TestContext, seed?: readonly number[]) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-deer-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA page_size = 512');
  const db = adapter(sql);
  let next = 0;
  const host = {
    kernel_version: `loka-kernel@${'0'.repeat(40)}`,
    newId: () => `aaaaaaaa-0000-4000-8000-${String(++next).padStart(12, '0')}`,
    time: { wall: () => 10000, monotonic: () => 0 },
  };
  const p = { sql, db, host };
  const selected = seed
    ? ([{ fresh: fresh(seed), content_hash: bundle.sha256 }] as const)
    : releases;
  const story = openStory(db as never, selected, host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw Error('open failed');
  return { path, p, story, selected };
}
function move(story: ReturnType<typeof setup>['story'], direction: string, n: number) {
  const result = story.invoke({
    invocation_id: `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`,
    actor_id: story.world().character,
    action_key: 'move',
    target_ids: [],
    input: { direction },
  });
  assert.equal(result.kind, 'saved', JSON.stringify(result));
}

// Breaks: a pending generation-bound sight or its move receipt cannot cold-load from real SQLite.
test('pending sight and confirmed flight cold-reopen with conserved deer custody', (t) => {
  const { path, p, story } = setup(t);
  for (const [i, direction] of ['south', 'south', 'west'].entries()) move(story, direction, i + 1);
  const deer = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) =>
      identity.origin.kind === 'spawned' &&
      identity.origin.role === 'deer' &&
      identity.definition.key === 'willow_deer',
  )![0];
  assert.equal(
    Object.values(story.world().state.jobs ?? {}).filter((j) => j.sight && j.status === 'pending')
      .length,
    1,
  );
  p.sql.close();
  const q = new DatabaseSync(path);
  t.after(() => q.close());
  const opened = openStory(adapter(q) as never, releases, p.host);
  assert.equal(opened.kind, 'open');
  if (opened.kind !== 'open') return;
  const advanced = opened.elapsed({ expected_run_id: opened.runId(), from: 64800, until: 65100 });
  assert.equal(advanced.kind, 'saved', JSON.stringify(advanced));
  const snapshot = encode(opened.world().state as never);
  const replay = opened.elapsed({ expected_run_id: opened.runId(), from: 64800, until: 65100 });
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.equal(encode(opened.world().state as never), snapshot);
  assert.equal(
    opened.world().state.containers[deer],
    opened.world().roomIds[ref('room', 'drowned_oak')],
  );
  assert.equal(
    Object.values(opened.world().state.created ?? {}).filter((i) => i.origin.kind === 'death')
      .length,
    0,
  );
});

// Breaks: a surviving round-to-sight handoff commits a state that cold reopen misclassifies or replays as a second flight.
test('missed round and +300 flight cold-reopen with closed combat', (t) => {
  const { path, p, story, selected } = setup(t, [2710938419, 1329376837, 2657997399, 1914447725]);
  for (const [i, direction] of ['south', 'south', 'west'].entries()) move(story, direction, i + 1);
  const deer = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) =>
      identity.origin.kind === 'spawned' &&
      identity.origin.role === 'deer' &&
      identity.definition.key === 'willow_deer',
  )![0];
  const attack = story.invoke({
    invocation_id: 'cccccccc-0000-4000-8000-000000000007',
    actor_id: story.world().character,
    action_key: 'attack',
    target_ids: [deer],
    input: {},
  });
  assert.equal(attack.kind, 'saved', JSON.stringify(attack));
  for (const [from, until] of [
    [64800, 64950],
    [64950, 65100],
  ]) {
    const advanced = story.elapsed({ expected_run_id: story.runId(), from, until });
    assert.equal(advanced.kind, 'saved', JSON.stringify(advanced));
  }
  assert.equal(Object.values(story.world().state.encounters ?? {})[0]?.status, 'closed');
  assert.equal(
    story.world().state.containers[deer],
    story.world().roomIds[ref('room', 'drowned_oak')],
  );
  p.sql.close();
  const q = new DatabaseSync(path);
  t.after(() => q.close());
  const reopened = openStory(adapter(q) as never, selected, p.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind === 'open')
    assert.equal(encode(reopened.world().state as never), encode(story.world().state as never));
});

// Breaks: a forged sight binding is accepted as a playable save or overwritten during recovery.
test('forged current sight binding refuses without changing saved bytes', (t) => {
  const { path, p, story } = setup(t);
  for (const [i, direction] of ['south', 'south', 'west'].entries()) move(story, direction, i + 1);
  const row = p.sql
    .prepare(
      "SELECT key, value FROM state_row WHERE section='population_slots' AND value LIKE '%sight_job_id%'",
    )
    .get()!;
  const value = JSON.parse(row.value as string);
  value.sight_job_id = 'aaaaaaaa-0000-4000-8000-000000000099';
  p.sql
    .prepare("UPDATE state_row SET value=? WHERE section='population_slots' AND key=?")
    .run(JSON.stringify(value), row.key as string);
  const altered = readFileSync(path);
  p.sql.close();
  const sql = new DatabaseSync(path);
  t.after(() => sql.close());
  const db = adapter(sql);
  assert.equal(openStory(db as never, releases, p.host).kind, 'save_corrupt');
  assert.deepEqual(readFileSync(path), altered);
});

// Breaks: cold recovery drops the fatal slot, exact corpse/hide custody, or a cancelled sight occurrence.
test('fatal deer and its owned hide cold-reopen without replacement', (t) => {
  const { path, p, story } = setup(t);
  for (const [i, direction] of ['south', 'south', 'west'].entries()) move(story, direction, i + 1);
  const deer = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) =>
      identity.origin.kind === 'spawned' &&
      identity.origin.role === 'deer' &&
      identity.definition.key === 'willow_deer',
  )![0];
  const attack = story.invoke({
    invocation_id: 'cccccccc-0000-4000-8000-000000000007',
    actor_id: story.world().character,
    action_key: 'attack',
    target_ids: [deer],
    input: {},
  });
  assert.equal(attack.kind, 'saved', JSON.stringify(attack));
  const fatal = story.elapsed({ expected_run_id: story.runId(), from: 64800, until: 64950 });
  assert.equal(fatal.kind, 'saved', JSON.stringify(fatal));
  const corpse = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) => identity.origin.kind === 'death' && identity.origin.victim_id === deer,
  )![0];
  const hide = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) =>
      identity.origin.kind === 'spawned' &&
      identity.origin.role === 'hide' &&
      identity.origin.member_id === deer,
  )![0];
  p.sql.close();
  const sql = new DatabaseSync(path);
  t.after(() => sql.close());
  const reopened = openStory(adapter(sql) as never, releases, p.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.equal(reopened.world().state.containers[hide], corpse);
  assert.equal(
    Object.values(reopened.world().state.population_slots ?? {}).find((s) => s.member_id === deer)
      ?.replacement_due,
    237750,
  );
  assert.equal(
    Object.values(reopened.world().state.jobs ?? {}).filter(
      (j) => j.sight && j.status === 'pending',
    ).length,
    0,
  );
});
