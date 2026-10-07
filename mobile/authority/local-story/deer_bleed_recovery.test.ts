import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, content } from '../../../kernel/ts/test/deer_fixture.ts';
import { newWorld } from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';

const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
function journey(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-deer-bleed-'));
  const path = join(dir, 'save.db');
  let sql = new DatabaseSync(path);
  t.after(() => {
    sql.close();
    rmSync(dir, { recursive: true });
  });
  const db = {
    execSync: (q: string) => sql.exec(q),
    runSync: (q: string, ...p: any[]) => sql.prepare(q).run(...p),
    getFirstSync: (q: string, ...p: any[]) => sql.prepare(q).get(...p) ?? null,
    getAllSync: (q: string, ...p: any[]) => sql.prepare(q).all(...p),
    isInTransactionSync: () => sql.isTransaction,
  };
  const fresh = newWorld(content, id(100) as never, [1, 2, 3, 4]);
  const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
  let n = 9000;
  const host = { kernel_version: `loka-kernel@${'0'.repeat(40)}`, newId: () => id(++n) };
  const open = () => openStory(db as never, releases, host);
  const initial = open();
  assert.equal(initial.kind, 'open');
  if (initial.kind !== 'open') throw Error('initial open');
  let story = initial;
  const invoke = (n: number, action_key: string, input: object = {}, target_ids: string[] = []) => {
    const r = story.invoke({
      invocation_id: id(n),
      actor_id: story.world().character,
      action_key,
      input,
      target_ids,
    } as never);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
  };
  const tick = (until: number) => {
    const r = story.elapsed({
      expected_run_id: story.runId(),
      from: story.world().state.clock,
      until,
    });
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
    return r;
  };
  const reopen = () => {
    sql.close();
    sql = new DatabaseSync(path);
    return open();
  };
  invoke(1, 'choose_ancestry', { ancestry: 'fey_touched' });
  for (const [i, direction] of ['south', 'south', 'east'].entries())
    invoke(i + 2, 'move', { direction });
  tick(67950);
  const w = story.world();
  const hound = Object.entries(w.state.created ?? {}).find(
    ([member, origin]) =>
      origin.origin.kind === 'spawned' &&
      origin.origin.role === 'hound' &&
      w.state.containers[member] === w.state.containers[w.body],
  )![0];
  invoke(7, 'attack', {}, [hound]);
  for (const at of [68100, 68200, 68250, 68300]) tick(at);
  const before = reopen();
  assert.equal(before.kind, 'open');
  if (before.kind !== 'open') throw Error('before interleaving');
  story = before;
  const result = tick(68400);
  return { path, sql: () => sql, story, result, reopen, invoke, tick };
}

// Break: deer recovery mistakes a legal round/bleed group resumed after unrelated population jobs for a sight handoff.
test('real SQLite reopens a lawful interleaved round, population and bleed receipt', (t) => {
  const p = journey(t);
  assert.equal(p.result.kind, 'saved');
  if (p.result.kind !== 'saved' || p.result.decision.kind !== 'accepted') return;
  const jobs = p.story.world().state.jobs!;
  const completed = p.result.decision.delta.ops
    .filter((op) => op.op === 'job.complete')
    .map((op) => ({
      group: op.writer_group,
      kind: jobs[op.job_id].bleed_body_id ? 'bleed' : jobs[op.job_id].job.key,
    }));
  assert.deepEqual(completed.slice(4, 10), [
    { group: 5, kind: 'fen_hound' },
    { group: 6, kind: 'crow_branches' },
    { group: 7, kind: 'fen_hounds' },
    { group: 8, kind: 'willow_deer' },
    { group: 5, kind: 'bleed' },
    { group: 10, kind: 'orchard_deer' },
  ]);
  const opened = p.reopen();
  assert.equal(opened.kind, 'open');
  if (opened.kind !== 'open') return;
  assert.equal(opened.world().state.clock, 68400);
  assert.equal(level(opened.world(), opened.world().body, resourceRef(opened.world(), 'hp')), 8);
  assert.equal(p.sql().prepare('SELECT count(*) AS n FROM receipt').get()!.n, 11);
});

// Break: replacing the old deer-only group detector accidentally lets replay ignore forged paired or unrelated groups.
for (const kind of ['bleed', 'population', 'mixed sight cancellation'] as const)
  test(`forged ${kind} group refuses without rewriting saved bytes`, (t) => {
    const p = journey(t);
    if (kind === 'mixed sight cancellation') {
      p.invoke(8, 'flee');
      p.invoke(9, 'move', { direction: 'west' });
      const w = p.story.world();
      const deer = Object.entries(w.state.created ?? {}).find(
        ([member, origin]) =>
          origin.origin.kind === 'spawned' &&
          origin.origin.role === 'deer' &&
          w.state.containers[member] === w.state.containers[w.body],
      )![0];
      p.invoke(10, 'attack', {}, [deer]);
      for (const at of [68500, 68550, 68600, 68700]) p.tick(at);
    }
    const row = p
      .sql()
      .prepare('SELECT scope, invocation_id, response FROM receipt ORDER BY revision DESC LIMIT 1')
      .get()!;
    const response = JSON.parse(row.response as string);
    const op = response.delta.ops.find((op: any) =>
      kind === 'bleed'
        ? op.op === 'job.complete' && !!p.story.world().state.jobs?.[op.job_id]?.bleed_body_id
        : kind === 'population'
          ? op.op === 'population.control' && op.writer_group === 7
          : op.op === 'job.cancel' && !!op.sight_member_id,
    );
    if (kind === 'mixed sight cancellation')
      assert.ok(
        response.delta.ops.some(
          (op: any) =>
            op.op === 'job.complete' && !!p.story.world().state.jobs?.[op.job_id]?.bleed_body_id,
        ),
      );
    assert.ok(op, kind);
    op.writer_group = 0;
    p.sql()
      .prepare('UPDATE receipt SET response=? WHERE scope=? AND invocation_id=?')
      .run(JSON.stringify(response), row.scope as string, row.invocation_id as string);
    const bytes = readFileSync(p.path);
    const refused = p.reopen();
    assert.equal(refused.kind, 'save_corrupt', kind);
    assert.deepEqual(readFileSync(p.path), bytes, kind);
  });
