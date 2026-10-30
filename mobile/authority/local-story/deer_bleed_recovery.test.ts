import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ref, shoo } from '../../../kernel/ts/test/deer_fixture.ts';
import type { DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { newWorld } from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';

// The crow always hits back and every hit opens an inline C5 bleed; the player always misses.
function bleeding(c: any) {
  const effect = shoo.ref('bleed', 'bleeding');
  // C5 bleed compiles only beside skill@1 and food@1 (lib/loka/content/bleed.ex).
  for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities])
    for (const k of ['bleed', 'skill', 'food']) caps[k] = 1;
  c.npcs[ref('npc', 'crow')].hp = { gain: 0, maximum: 10, minimum: 0, start: 10 };
  c.npcs[ref('npc', 'willow_deer')].hp = { gain: 0, maximum: 2, minimum: 0, start: 2 };
  c.resources[ref('resource', 'hp')].gain = 0; // no regen at 68400, so HP counts only hits and ticks
  c.bleeds = {
    [ref('bleed', 'bleeding')]: {
      key: 'bleeding',
      duration: 300,
      tick_every: 100,
      hp_loss: 1,
      narration: Object.fromEntries(
        ['applied', 'expired', 'refreshed', 'tick'].map((k) => [k, 'combat.npc_hit']),
      ),
    },
  };
  // Only a hound-role member opens a bleed (bleed/shared.ts wound): a bundle without member_role, the crow's.
  c.npcs[ref('npc', 'crow')].attack = {
    chance: 100,
    damage_min: 1,
    damage_max: 1,
    on_positive_hit: { effect },
  };
}
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
  const loaded = shoo.load(bleeding);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(loaded.cartridge as never, id(100) as never, [1, 2, 3, 4]);
  const releases = [{ fresh, content_hash: shoo.bundle(bleeding).sha256 }] as const;
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
    if (r.kind === 'saved')
      assert.equal((r.decision as unknown as DecisionResult).kind, 'accepted', JSON.stringify(r));
  };
  const tick = (until: number) => {
    const r = story.elapsed({
      expected_run_id: story.runId(),
      from: story.world().state.clock,
      until,
    });
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved')
      assert.equal((r.decision as unknown as DecisionResult).kind, 'accepted', JSON.stringify(r));
    if (r.kind !== 'saved') throw Error('elapsed not saved');
    return r.decision as unknown as DecisionResult;
  };
  const reopen = () => {
    sql.close();
    sql = new DatabaseSync(path);
    return open();
  };
  invoke(1, 'move', { direction: 'west' });
  tick(67950);
  const w = story.world();
  const crow = Object.entries(w.state.created ?? {}).find(
    ([member, origin]) =>
      origin.origin.kind === 'spawned' &&
      origin.origin.role === 'hunter' &&
      w.state.containers[member] === w.state.containers[w.body],
  )![0];
  invoke(2, 'attack', {}, [crow]);
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
  assert.equal(p.result.kind, 'accepted');
  if (p.result.kind !== 'accepted') return;
  const jobs = p.story.world().state.jobs!;
  const completed = p.result.delta.ops
    .filter((op) => op.op === 'job.complete')
    .map((op) => ({
      group: op.writer_group,
      kind: jobs[op.job_id].bleed_body_id ? 'bleed' : jobs[op.job_id].job.key,
    }));
  // The bleed joins the crow's round group after unrelated population jobs of the same advance.
  const bleed = completed.findIndex((c) => c.kind === 'bleed');
  const group = completed[bleed]!.group;
  const round = completed.findIndex((c) => c.group === group);
  assert.ok(round < bleed, JSON.stringify(completed));
  assert.ok(
    completed.slice(round + 1, bleed).some((c) => c.group !== group && c.kind === 'willow_deer'),
    JSON.stringify(completed),
  );
  const opened = p.reopen();
  assert.equal(opened.kind, 'open');
  if (opened.kind !== 'open') return;
  assert.equal(opened.world().state.clock, 68400);
  // 10 HP less three crow hits (68100, 68250, 68400) and three bleed ticks (68200, 68300, 68400).
  assert.equal(level(opened.world(), opened.world().body, resourceRef(opened.world(), 'hp')), 4);
  // Two invocations (move, attack) and six elapsed advances.
  assert.equal(p.sql().prepare('SELECT count(*) AS n FROM receipt').get()!.n, 8);
});

// Break: replacing the old deer-only group detector accidentally lets replay ignore forged paired or unrelated groups.
for (const kind of ['bleed', 'population', 'mixed sight cancellation'] as const)
  test(`forged ${kind} group refuses without rewriting saved bytes`, (t) => {
    const p = journey(t);
    if (kind === 'mixed sight cancellation') {
      p.invoke(8, 'flee');
      // The flee leaves the green east or south; either way walk to the willow deer.
      const lane = p.story.world().roomIds[ref('room', 'lane')];
      const fled = p.story.world().state.containers[p.story.world().body] === lane;
      const route = [...(fled ? ['north', 'east'] : []), 'south', 'south', 'west'];
      for (const [i, direction] of route.entries()) p.invoke(20 + i, 'move', { direction });
      const w = p.story.world();
      const deer = Object.entries(w.state.created ?? {}).find(
        ([member, origin]) =>
          origin.origin.kind === 'spawned' &&
          origin.origin.role === 'prey' &&
          w.state.containers[member] === w.state.containers[w.body],
      )![0];
      // Hits at 68450 and on the round at 68600 end the deer as the bleed ticks at 68600.
      p.tick(68450);
      p.invoke(10, 'attack', {}, [deer]);
      for (const at of [68500, 68550, 68600]) p.tick(at);
    }
    const row = p
      .sql()
      .prepare('SELECT scope, invocation_id, response FROM receipt ORDER BY revision DESC LIMIT 1')
      .get()!;
    const response = JSON.parse(row.response as string);
    const bleedGroup = response.delta.ops.find(
      (op: any) =>
        op.op === 'job.complete' && !!p.story.world().state.jobs?.[op.job_id]?.bleed_body_id,
    )?.writer_group;
    const op = response.delta.ops.find((op: any) =>
      kind === 'bleed'
        ? op.op === 'job.complete' && !!p.story.world().state.jobs?.[op.job_id]?.bleed_body_id
        : kind === 'population'
          ? op.op === 'population.control' && op.writer_group !== bleedGroup
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
