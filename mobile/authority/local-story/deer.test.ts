import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, content, ref } from '../../../kernel/ts/test/deer_fixture.ts';
import { newWorld } from '../../../kernel/ts/src/index.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { jobCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { deerSave } from './deer-save.ts';
import { openStory } from './authority.ts';

const initial = (seed: readonly number[] = [1, 2, 3, 4]) =>
  newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, seed);
const releases = [{ fresh: initial(), content_hash: bundle.sha256 }] as const;
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
  const fault = { kind: '' as '' | 'failed' | 'lost', armed: false, reads: false, inserted: false };
  const db = {
    execSync(q: string) {
      const before = sql.isTransaction;
      try {
        sql.exec(q);
      } catch (e) {
        if (fault.armed && before) {
          fault.armed = false;
          fault.reads = true;
        }
        throw e;
      }
      if (fault.armed && fault.kind === 'lost' && before && !sql.isTransaction) {
        fault.armed = false;
        fault.reads = true;
        throw Error('lost COMMIT acknowledgement');
      }
    },
    runSync(q: string, ...args: any[]) {
      if (fault.armed && fault.kind === 'failed' && !fault.inserted) {
        fault.inserted = true;
        sql.exec('INSERT INTO child VALUES (1)');
      }
      return sql.prepare(q).run(...args);
    },
    getFirstSync(q: string, ...args: any[]) {
      if (fault.reads) sql.prepare('SELECT * FROM unavailable_deer_reads').get();
      return sql.prepare(q).get(...args) ?? null;
    },
    getAllSync(q: string, ...args: any[]) {
      if (fault.reads) sql.prepare('SELECT * FROM unavailable_deer_reads').get();
      return sql.prepare(q).all(...args);
    },
    isInTransactionSync: () => sql.isTransaction,
  };
  let next = 0;
  const host = {
    kernel_version: `loka-kernel@${'0'.repeat(40)}`,
    newId: () => `aaaaaaaa-0000-4000-8000-${String(++next).padStart(12, '0')}`,
    time: { wall: () => 10000, monotonic: () => 0 },
  };
  const p = { sql, db, host, fault };
  const selected = seed
    ? ([{ fresh: initial(seed), content_hash: bundle.sha256 }] as const)
    : releases;
  const story = openStory(p.db as never, selected, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw Error('open failed');
  const choice = story.invoke({
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000001',
    actor_id: story.world().character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry: 'fey_touched' },
  });
  assert.equal(choice.kind, 'saved', JSON.stringify(choice));
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

// Breaks: historical recovery treats a second sight completion as the population arrival cause.
test('sight-only receipt cannot justify a later deer binding', (t) => {
  const { p, story } = setup(t);
  for (const [i, direction] of ['south', 'south', 'west'].entries()) move(story, direction, i + 1);
  for (const [from, until] of [
    [64800, 65100],
    [65100, 68100],
  ]) {
    const saved = story.elapsed({ expected_run_id: story.runId(), from, until });
    assert.equal(saved.kind, 'saved', JSON.stringify(saved));
  }
  move(story, 'south', 8);
  move(story, 'north', 9);
  const saved = story.elapsed({ expected_run_id: story.runId(), from: 68100, until: 68400 });
  assert.equal(saved.kind, 'saved', JSON.stringify(saved));
  const oak = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) => identity.origin.kind === 'spawned' && identity.definition.key === 'oak_deer',
  )![0];
  const receipts = p.sql.prepare('SELECT scope, invocation_id, response FROM receipt').all();
  const receipt = receipts.find((row) => {
    const response = JSON.parse(row.response as string);
    return response.delta?.ops?.some(
      (op: any) =>
        op.op === 'job.schedule' && op.sight?.member_id === oak && op.sight.seen_at === 68400,
    );
  })!;
  const response = JSON.parse(receipt.response as string);
  const ops = response.delta.ops as any[];
  const scheduled = ops.find(
    (op) => op.op === 'job.schedule' && op.sight?.member_id === oak && op.sight.seen_at === 68400,
  )!;
  const bound = ops.find(
    (op) => op.op === 'population.slot' && op.value?.sight_job_id === scheduled.job_id,
  )!;
  const oldId = bound.expected.sight_job_id;
  assert.ok(oldId);
  const fakeCause = jobCommandId(oldId, 68400);
  scheduled.sight.cause_id = fakeCause;
  ops.push({ op: 'job.complete', writer_group: scheduled.writer_group, job_id: oldId });
  p.sql
    .prepare('UPDATE receipt SET response=? WHERE scope=? AND invocation_id=?')
    .run(JSON.stringify(response), receipt.scope as string, receipt.invocation_id as string);
  const world = story.world();
  const current = world.state.jobs![scheduled.job_id]!;
  const forged = {
    ...world,
    state: {
      ...world.state,
      jobs: {
        ...world.state.jobs,
        [scheduled.job_id]: { ...current, sight: { ...current.sight!, cause_id: fakeCause } },
      },
    },
  };
  const lineage = p.sql.prepare('SELECT lineage_id FROM save').get()!.lineage_id as string;
  assert.throws(
    () => deerSave(forged as never, adapter(p.sql) as never, { lineage_id: lineage } as never),
    /inconsistent deer sight receipt/,
  );
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

// Breaks: a failed or uncertain COMMIT adopts only part of a deer sight/death transaction,
// or retry allocates a second sight occurrence, corpse, or hide transfer.
test('real COMMIT faults preserve all-prior or all-next deer rows and one replayable receipt', (t) => {
  for (const transition of ['sight', 'death'] as const)
    for (const fault of ['known_failed', 'unknown_absent', 'lost'] as const) {
      const { path, p, story } = setup(t);
      for (const [i, direction] of ['south', 'south', 'west'].entries())
        move(story, direction, i + 1);
      const deer = Object.entries(story.world().state.created ?? {}).find(
        ([, identity]) =>
          identity.origin.kind === 'spawned' &&
          identity.origin.role === 'deer' &&
          identity.definition.key === 'willow_deer',
      )![0];
      if (transition === 'death') {
        const attack = story.invoke({
          invocation_id: 'cccccccc-0000-4000-8000-000000000007',
          actor_id: story.world().character,
          action_key: 'attack',
          target_ids: [deer],
          input: {},
        });
        assert.equal(attack.kind, 'saved', `${transition}/${fault}`);
      }
      const prior = story.world();
      const before = encode(prior.state as never);
      const rows = p.sql
        .prepare('SELECT section, key, value FROM state_row ORDER BY section, key')
        .all();
      const receiptCount = p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
      const exact = {
        expected_run_id: story.runId(),
        from: 64800,
        until: transition === 'death' ? 64950 : 65100,
      };
      if (fault !== 'lost')
        p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
      p.fault.kind = fault === 'lost' ? 'lost' : 'failed';
      p.fault.armed = true;
      if (fault === 'known_failed') {
        const exec = p.db.execSync;
        p.db.execSync = (operation: string) => {
          try {
            exec(operation);
          } catch (error) {
            p.fault.reads = false;
            throw error;
          }
        };
        assert.throws(
          () => story.elapsed(exact),
          /COMMIT failed; nothing was saved/,
          `${transition}/${fault}`,
        );
      } else {
        assert.equal(story.elapsed(exact).kind, 'pending', `${transition}/${fault}`);
        assert.equal(
          story.invoke({
            invocation_id: 'cccccccc-0000-4000-8000-000000000099',
            actor_id: story.world().character,
            action_key: 'look',
            target_ids: [],
            input: {},
          }).kind,
          'pending',
          `${transition}/${fault}`,
        );
      }
      assert.equal(story.world(), prior, `${transition}/${fault}`);
      p.fault.reads = false;
      if (p.sql.isTransaction) p.sql.exec('ROLLBACK');
      if (fault !== 'lost') {
        assert.equal(encode(story.world().state as never), before, `${transition}/${fault}`);
        assert.deepEqual(
          p.sql.prepare('SELECT section, key, value FROM state_row ORDER BY section, key').all(),
          rows,
          `${transition}/${fault}`,
        );
        assert.equal(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, receiptCount);
      } else
        assert.equal(
          p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n,
          Number(receiptCount) + 1,
        );
      p.sql.close();
      const sql = new DatabaseSync(path);
      t.after(() => sql.close());
      const reopened = openStory(adapter(sql) as never, releases, p.host);
      assert.equal(reopened.kind, 'open', `${transition}/${fault}`);
      if (reopened.kind !== 'open') continue;
      assert.equal(
        fault === 'lost'
          ? encode(reopened.world().state as never) !== before
          : encode(reopened.world().state as never) === before,
        true,
        `${transition}/${fault}`,
      );
      const settled = reopened.elapsed(exact);
      assert.equal(settled.kind, 'saved', `${transition}/${fault}`);
      if (settled.kind === 'saved')
        assert.equal(settled.replay, fault === 'lost', `${transition}/${fault}`);
      assert.equal(
        sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n,
        Number(receiptCount) + 1,
      );
      const state = reopened.world().state;
      if (transition === 'sight') {
        assert.equal(state.containers[deer], reopened.world().roomIds[ref('room', 'drowned_oak')]);
        assert.equal(
          Object.values(state.population_slots ?? {}).find((s) => s.member_id === deer)
            ?.sight_job_id,
          null,
        );
      } else {
        const corpse = Object.entries(state.created ?? {}).find(
          ([, identity]) => identity.origin.kind === 'death' && identity.origin.victim_id === deer,
        )![0];
        const hide = Object.entries(state.created ?? {}).find(
          ([, identity]) =>
            identity.origin.kind === 'spawned' &&
            identity.origin.role === 'hide' &&
            identity.origin.member_id === deer,
        )![0];
        assert.equal(state.containers[hide], corpse);
        assert.equal(
          Object.values(state.population_slots ?? {}).find((s) => s.member_id === deer)
            ?.replacement_due,
          237750,
        );
      }
    }
});
