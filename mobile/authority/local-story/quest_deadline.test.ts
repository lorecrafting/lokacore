// Toolbox row W24 generic deadline through real SQLite on cartridges/quest_sampler (find_key fails
// `late` 40 real minutes, 120000 logical units, after acceptance): cold reopen with the job pending,
// replay, a failed COMMIT and a lost acknowledgement at expiry, and job rows that do not match the
// save (docs/system/save.md, Quest deadline recovery).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { elapsedHost, receipts } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-deadline-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/quest_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const bundle = { canonical: encode(artifact.cartridge), sha256: artifact.content_hash as string };
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const key = initial.entityIds['quest_sampler@0.0.1:item/key']!;
const DUE = 120000;
const ref = { cartridge_id: 'quest_sampler', cartridge_version: '0.0.1', kind: 'fact' };
// facts.json keeper_trust: default 2, reactions/late.json assigns 0.
const trust = (w: World) => value(w, w.character, { ...ref, key: 'keeper_trust' } as never);
const entry = (w: World) => gameView(w).journal[0]!;
const job = (w: World) => Object.values(w.state.jobs ?? {}).find((j) => j.quest_instance_id)!;

// One save file at `path`: open, cold reopen, invocations with stable ids.
function save(t: TestContext, name: string) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-deadline-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, `${name}.db`);
  let p = elapsedHost(path, undefined, bundle);
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  const s = {
    p,
    story: open(),
    n: 0,
    // `same`: the reopened state equals the memory one (not after a pending COMMIT).
    reopen(same = true) {
      const before = encode(s.story.world().state as never);
      p.sql.close();
      s.p = p = elapsedHost(path, undefined, bundle);
      s.story = open();
      if (same) assert.equal(encode(s.story.world().state as never), before);
    },
    invocation: (action_key: string, target_ids: string[] = []) => ({
      invocation_id: `dddddddd-2424-4777-8777-${String(++s.n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input: {},
    }),
    saved(action_key: string, target_ids: string[] = []) {
      const i = s.invocation(action_key, target_ids);
      assert.equal(s.story.invoke(i).kind, 'saved', action_key);
      s.reopen();
      const again = s.story.invoke(i);
      assert.equal(again.kind === 'saved' && again.replay, true, action_key);
    },
  };
  t.after(() => p.sql.close());
  return s;
}

// Breaks: the pending generic job not rebuilt on reopen (no countdown, no expiry), the generic
// quest refused at load as a legacy deadline without its bound offer, or the stale job of a quest
// resolved on time failing it or penalising at its due time.
test('a pending generic deadline reopens, replays and its stale job only completes', (t) => {
  const s = save(t, 'on-time');
  const t0 = s.story.world().state.clock;
  s.saved('find_key');
  assert.equal(entry(s.story.world()).remaining, DUE);
  s.saved('take', [key]);
  s.saved('leave_word');
  assert.equal(entry(s.story.world()).state, 'resolved');
  const until = t0 + DUE + 3000;
  const run = { expected_run_id: s.story.runId(), from: t0, until };
  assert.equal(s.story.elapsed(run).kind, 'saved');
  s.reopen();
  const w = s.story.world();
  assert.deepEqual([entry(w).state, job(w).status, trust(w)], ['resolved', 'completed', 2]);
});

// Breaks: a failed expiry COMMIT adopts half of the failure, trust or job; a lost acknowledgement
// fails the quest or lowers trust twice on replay.
test('expiry survives a failed and a lost COMMIT and replays once', (t) => {
  for (const kind of ['failed', 'lost'] as const) {
    const s = save(t, kind);
    const t0 = s.story.world().state.clock;
    s.saved('find_key');
    const before = Number(receipts(s.p.sql));
    if (kind === 'failed')
      s.p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent DEFERRABLE INITIALLY DEFERRED)',
      );
    const expiry = { expected_run_id: s.story.runId(), from: t0, until: t0 + DUE };
    s.p.fault.kind = kind;
    s.p.fault.armed = true;
    assert.equal(s.story.elapsed(expiry).kind, 'pending', kind);
    s.p.fault.reads = false;
    if (s.p.sql.isTransaction) s.p.sql.exec('ROLLBACK');
    s.reopen(false);
    const committed = kind === 'lost';
    const w = s.story.world();
    assert.deepEqual(
      [entry(w).state, job(w).status, trust(w), entry(w).remaining],
      committed ? ['failed', 'completed', 0, undefined] : ['active', 'pending', 2, DUE],
      kind,
    );
    assert.equal(receipts(s.p.sql), before + (committed ? 1 : 0), kind);
    const replay = s.story.elapsed(expiry);
    assert.equal(replay.kind, 'saved', kind);
    if (replay.kind === 'saved') assert.equal(replay.replay, committed, kind);
    assert.deepEqual([entry(s.story.world()).state, trust(s.story.world())], ['failed', 0], kind);
  }
});

// Breaks (deadline-save.ts): a generic job row bound to another actor, or naming a quest with no
// deadline, loads and faults every later elapsed run instead of giving typed save_corrupt.
test('a generic deadline job row that does not match the save is save_corrupt', (t) => {
  const s = save(t, 'forged');
  s.saved('find_key');
  const row = s.p.sql.prepare("SELECT key, value FROM state_row WHERE section='jobs'").get()!;
  const original = JSON.parse(String(row.value));
  const forge = (change: object) =>
    s.p.sql
      .prepare("UPDATE state_row SET value=? WHERE section='jobs' AND key=?")
      .run(JSON.stringify({ ...original, ...change }), String(row.key));
  const opened = () => openStory(s.p.db, releases, s.p.host).kind;
  for (const change of [
    { actor_id: '00000000-0000-4000-8000-0000000000ff' },
    { job: { ...original.job, key: 'nope' } },
  ]) {
    forge(change);
    assert.equal(opened(), 'save_corrupt', JSON.stringify(change));
  }
  forge({});
  assert.equal(opened(), 'open');
});
