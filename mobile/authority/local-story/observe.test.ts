// The local authority's evaluation.budget_exceeded (04 §5.4; ADR-075 §7; R6P B, PM D3/D3b): one
// record per budget fault in the save's observation table, a sink whose failure changes nothing,
// capped, and created on an older save without touching its rows. The release is the green known
// answer (protocol/fixtures/cartridge_green_hash.json) with its move overridden by an action whose
// policy is `all` of 32769 true time_window leaves, so every move faults budget_exceeded at
// admission's query_steps; look (an engine verb) is accepted. Expected values are literals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Host } from './authority.ts';
import { observe } from './trace.ts';

const G = 'ashmere_green@0.0.1';
const KERNEL = `loka-kernel@${'0123456789'.repeat(4)}`;
const release = (() => {
  const c = structuredClone(read('protocol/fixtures/cartridge_green_hash.json').value);
  c.manifest.requires.capabilities.policy = c.lock.capabilities.policy = 1;
  const TRUE = { op: 'time_window', from: 0, to: 12 }; // true at 06:00
  c.actions[`${G}:action/move`] = {
    key: 'move',
    label: 'room.belfry.title', // any key of the catalog
    accessibility: 'room.belfry.title',
    target: { kind: 'none' },
    command: 'move',
    priority: 0,
    input: ['direction'],
    policy: { policy_version: 1, root: { op: 'all', items: Array(32769).fill(TRUE) } },
  };
  const text = encode(c);
  const content_hash = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${content_hash}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
  return { content_hash, fresh: newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]) };
})();
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-r6pb-')), 'save.db');

/**
 * A process on the save at `path`: one connection, expo-sqlite's sync names, each statement first
 * passed to `tap` (which may throw it unrun), and the host's optional latency clock.
 */
function processOn(path: string, latency?: Host['latency'], tap = (_: string) => {}) {
  const sql = new DatabaseSync(path);
  type P = (string | number | null)[];
  const db = {
    execSync: (s: string) => void (tap(s), sql.exec(s)),
    runSync: (s: string, ...p: P) => (tap(s), sql.prepare(s).run(...p)),
    getFirstSync: <T>(s: string, ...p: P) => (tap(s), sql.prepare(s).get(...p) ?? null) as T,
    getAllSync: <T>(s: string, ...p: P) => (tap(s), sql.prepare(s).all(...p)) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  let n = 0;
  const host = { kernel_version: KERNEL, newId: () => id(++n), latency };
  const opened = openStory(db, [release], host);
  const story = opened as Extract<typeof opened, { kind: 'open' }>;
  const all = (q: string) => JSON.stringify(sql.prepare(q).all());
  const send = (k: number, action_key: string, input = {}) =>
    story.invoke({
      invocation_id: id(100 + k),
      action_key,
      actor_id: release.fresh.character,
      target_ids: [],
      input,
    });
  return { sql, db, story, all, send };
}
const north = { direction: 'north' };
const FAULT = { kind: 'fault', code: 'budget_exceeded' };
const STORED = ['head', 'state_row', 'receipt', 'save'].map((t) => `SELECT * FROM ${t}`);

// Breaks (5b): no record of the budget fault, one whose ids are not the run's plus the command and
// the revision it was decided against, or one a rejection or an accepted command also writes.
test('a budget fault is one valid observation of its limit, with the ReplayIds of its decision', () => {
  const p = processOn(save());
  assert.equal(p.send(1, 'look').kind, 'saved'); // revision 1
  assert.deepEqual(p.send(2, 'move', north), FAULT);
  const rows = p.sql.prepare('SELECT record FROM observation').all();
  const [record] = rows.map((r) => JSON.parse(r.record as string));
  const command_id = p.sql.prepare('SELECT command_id FROM trace WHERE ordinal = 2').get()!;
  assert.deepEqual(record, {
    format: 'loka-obs-v1',
    event: 'evaluation.budget_exceeded',
    store: 'diagnostics',
    ids: {
      content_hash: release.content_hash,
      kernel_version: KERNEL,
      seed: [1, 2, 3, 4],
      run_id: id(2), // the first save's second id: lineage, then run
      command_id: command_id.command_id,
      revision: 1,
    },
    data: { limit: 'query_steps' },
  });
  assert.equal(rows.length, 1);
  assert.deepEqual(validate('ObservationRecord', record), []);
});

// Breaks (04 §5.4: observation failure cannot change the fault, commit state or retry outcome):
// a sink write that throws out of invoke, rolls back or blocks the next commit. Red control:
// without observe's catch this test throws.
test('a failing observation sink changes no reply, revision, storage or retry', () => {
  const p = processOn(save());
  p.sql.exec('DROP TABLE observation');
  const before = STORED.map(p.all);
  assert.deepEqual(p.send(1, 'move', north), FAULT);
  assert.deepEqual(STORED.map(p.all), before);
  assert.deepEqual(p.send(1, 'move', north), FAULT); // the same invocation retried
  const looked = p.send(2, 'look');
  assert.deepEqual([looked.kind, (looked as { revision: number }).revision], ['saved', 1]);
});

// Breaks (PM D3b): an old save (before B, no observation table) not given the table on open, or
// changed by it (its receipts or state), or an unbounded sink (1001 records kept).
test('an older save gains the sink untouched, and the sink keeps the newest 1000 records', () => {
  const path = save();
  const first = processOn(path);
  first.send(1, 'look');
  first.sql.exec('DROP TABLE observation');
  const before = STORED.map(first.all);
  first.sql.close();
  for (let i = 0; i < 3; i++) {
    const p = processOn(path);
    assert.deepEqual(STORED.map(p.all), before);
    assert.ok(p.sql.prepare("SELECT 1 FROM sqlite_master WHERE name = 'observation'").get());
    p.sql.close();
  }
  const p = processOn(path);
  assert.equal(p.send(2, 'look').kind, 'saved');
  for (let n = 1; n <= 1001; n++) observe(p.db, { n });
  const count = p.sql.prepare('SELECT count(*) AS n FROM observation').get()!.n;
  const oldest = p.sql.prepare('SELECT record FROM observation ORDER BY rowid LIMIT 1').get()!;
  assert.deepEqual([count, oldest.record], [1000, '{"n":2}']);
});

// Breaks (11 §13; R6P P6a): no record of a NEW decision, a timer that also spans storage (the
// receipt lookup, COMMIT: every statement here costs 7 ms, so it gives more than 1500), a record
// on a receipt replay, or one whose ids are not the run's and the command's. The fake clock moves
// 1.5 ms per reading; resolve and step touch no storage.
test('each NEW decision, accepted or fault, is one kernel.decision_latency of resolve and step', () => {
  let t = 0;
  const latency = { host: 'hermes_ios' as const, now: () => (t += 1.5) };
  const p = processOn(save(), latency, () => void (t += 7));
  assert.equal(p.send(1, 'look').kind, 'saved');
  assert.equal(p.send(1, 'look').kind, 'saved'); // its replay
  assert.deepEqual(p.send(2, 'move', north), FAULT);
  const traced = p.sql.prepare('SELECT command_id FROM trace WHERE ordinal > 0 ORDER BY ordinal');
  const timed = p.sql
    .prepare(
      "SELECT record FROM observation WHERE record ->> '$.event' = 'kernel.decision_latency'",
    )
    .all()
    .map((r) => JSON.parse(r.record as string));
  const expected = traced.all().map(({ command_id }) => ({
    format: 'loka-obs-v1',
    event: 'kernel.decision_latency',
    store: 'operations',
    ids: { kernel_version: KERNEL, host: 'hermes_ios', run_id: id(2), command_id },
    data: { state: 'observed', value: 1500 },
  }));
  assert.equal(expected.length, 2);
  assert.deepEqual(timed, expected);
  for (const record of timed) assert.deepEqual(validate('ObservationRecord', record), []);
});

// Breaks (03 §15; P4b commit_pending, then settle committed): a record written on the pending
// reply. Its transaction ROLLBACKs the attempt left open behind the fence, so the later COMMIT
// finds none. Only the authority's two ROLLBACKs jam here (P4b's harness jams all, so a write
// there could not roll it back and that harness cannot see this break).
test('a clock changes no reply or durable state when a COMMIT is held, then committed', () => {
  const play = (latency?: Host['latency']) => {
    let [held, jams] = [false, 0];
    const p = processOn(save(), latency, (s) => {
      if (held && s === 'COMMIT') {
        [held, jams] = [false, 2];
        throw new Error('COMMIT acknowledgement lost'); // unrun: the transaction stays open
      }
      if (jams && s === 'ROLLBACK') {
        jams -= 1;
        throw new Error('ROLLBACK failed');
      }
    });
    held = true;
    const replies = [p.send(1, 'look')];
    p.sql.exec('COMMIT');
    replies.push(p.send(1, 'look'));
    const timed = p.sql.prepare('SELECT count(*) AS n FROM observation').get()!.n;
    return { replies, durable: STORED.map(p.all), timed };
  };
  const plain = play();
  assert.deepEqual(plain.replies[0], { kind: 'pending' });
  assert.deepEqual(play({ host: 'hermes_ios', now: () => 0 }), plain);
});
