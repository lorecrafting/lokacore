// Milestone capture and delayed delivery (03 §26; 23 §§3-5, §11; pre-release-proof P2/P6) on
// Node with real SQLite (node:sqlite) in WAL mode, one connection per simulated process, as
// local_story.test.ts. The milestone is the bell known answer's ring_bell recipe emitting the
// custom event bell_rung (protocol/fixtures/cartridge_bell_hash.json; kernel/ts/test/checks.test.ts
// for its ids). The platform is a fake (the network is external): it keeps one acceptance per
// report id. Expected values are hand-written literals, never from the code under test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { encode, hash } from '../../../kernel/ts/src/canonical.ts';
import type {
  MilestoneReport,
  RngState,
  WorldContextId,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';
import { deliver } from './progress.ts';

const kat = read('protocol/fixtures/cartridge_bell_hash.json');
const fresh = (() => {
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
  return newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4] as unknown as RngState);
})();
const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
const BELL = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b';
const HASH = '99e59f482cc655fdc4db353b90963cceb78ad23157239cec41d27410bfabe1ed'; // the fixture's
const MILESTONES = new Map([['bell_rung', { milestone: 'bell_heard', outcome: 'rung' }]]);
const [A, B, C] = ['a', 'b', 'c'].map((x) => `${x.repeat(8)}-1111-4222-8333-444444444444`);
/** The n-th id a test's allocator hands out. */
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => {
  let n = 0;
  return () => id(++n);
};
const none = (): string => assert.fail('allocated a new id');

type Tap = (statement: string, run: () => unknown) => unknown;
type Options = { newId?: () => string; tap?: Tap; binding?: () => string | null; off?: boolean };
/** A process on the save at `path`: one connection, expo-sqlite's sync names, `tap` faults. */
function processOn(path: string, { newId = none, tap = (_, run) => run(), ...o }: Options = {}) {
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA journal_mode = WAL');
  type P = (string | number | null)[];
  const db = {
    execSync: (s: string) => void tap(s, () => sql.exec(s)),
    runSync: (s: string, ...p: P) => tap(s, () => sql.prepare(s).run(...p)),
    getFirstSync: <T>(s: string, ...p: P) => tap(s, () => sql.prepare(s).get(...p) ?? null) as T,
    getAllSync: <T>(s: string, ...p: P) => tap(s, () => sql.prepare(s).all(...p)) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  const host = { content_hash: HASH, kernel_version: `loka-kernel@${'0'.repeat(40)}`, newId };
  const milestones = o.off ? {} : { milestones: MILESTONES };
  const opened = openStory(db, fresh, { ...host, ...milestones, binding: o.binding ?? (() => A) });
  assert.equal(opened.kind, 'open');
  const story = opened as Extract<typeof opened, { kind: 'open' }>;
  const all = (q: string) =>
    sql
      .prepare(q)
      .all()
      .map((r) => Object.values(r));
  return { sql, db, story, all };
}
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-s5-')), 'save.db');
const ring = (n = 1) => ({
  invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
  action_key: 'ring_bell',
  actor_id: ACTOR,
  target_ids: [BELL],
  input: {},
});
const saved = (r: unknown) => [
  (r as { replay: boolean }).replay,
  (r as { revision: number }).revision,
];
const REPORTS = 'SELECT report_id, lineage_id, binding, report, disposition FROM report';
const count = (p: ReturnType<typeof processOn>, t: string) =>
  p.all(`SELECT count(*) FROM ${t}`)[0]![0];
/** The canonical MilestoneReport of the bell rung at revision 1 in run `run`, report `report`. */
const payload = (report: string, run: string) =>
  `{"milestone":"bell_heard","observed_revision":1,"outcome":"rung","release":{"cartridge_hash":"${HASH}","cartridge_id":"ashmere_bell","cartridge_version":"0.0.1"},"report_id":"${report}","run_id":"${run}"}`;

/** The fake platform: one acceptance per report id, its `result`; `lose` drops the next reply. */
function platform(result = 'accepted') {
  const kept = new Map<string, object>();
  const f = { kept, result, lose: false, offline: false, calls: [] as [string, string][] };
  const submit = async (report: MilestoneReport, account: string) => {
    if (f.offline) throw new Error('offline');
    const { report_id, release, milestone, outcome } = report;
    f.calls.push([report_id, account]);
    if (!kept.has(report_id)) {
      const payload_digest = createHash('sha256')
        .update(encode(report as never))
        .digest('hex');
      const rest = {
        evidence_class: 'offline_client_report',
        policy_revision: 1,
        result: f.result,
      };
      const head = { report_id, account_id: account, payload_digest, release, milestone, outcome };
      kept.set(report_id, { ...head, ...rest });
    }
    if (f.lose) {
      f.lose = false;
      throw new Error('response lost');
    }
    return kept.get(report_id);
  };
  return Object.assign(f, { submit });
}

// Breaks (23 §§4-5, 03 §26; pins 1, 3, 5, 8): no report for a committed custom_event milestone; a
// report missing its run, release, outcome or revision; its id minted again on restart, replay or
// delivery (newId is `none` after the capture); a receipt replay adding a second report; the
// binding read at open or at delivery instead of when the milestone is reached; an offline
// completion lost by a restart.
test('a milestone reached offline is captured once, survives restart, and is delivered', async () => {
  const path = save();
  let who: string | null = A;
  const a = processOn(path, { newId: ids(), binding: () => who });
  who = B;
  assert.deepEqual(saved(a.story.invoke(ring())), [false, 1]);
  who = C;
  const pending = [id(3), id(1), B, payload(id(3), id(2)), 'pending'];
  assert.deepEqual(a.all(REPORTS), [pending]);
  assert.deepEqual(validate('MilestoneReport', JSON.parse(payload(id(3), id(2)))), []);
  a.sql.close();
  const b = processOn(path, { binding: () => who });
  assert.deepEqual(saved(b.story.invoke(ring())), [true, 1]);
  assert.deepEqual(b.all(REPORTS), [pending]);
  const fake = platform();
  await deliver(b.db, fake.submit, 10);
  assert.deepEqual(fake.calls, [[id(3), B]]);
  assert.deepEqual(b.all(REPORTS), [[...pending.slice(0, 4), 'accepted']]);
});

// Breaks (23 §4, 03 §26; pin 4): a report or binding stored in state_row (or otherwise loaded into
// the world), changing the canonical state hash. Expected: sha256 of the hand-written state after
// the ring (the bell's fact set; clock and RNG unchanged).
test('a pending report leaves the canonical state hash unchanged', () => {
  // The fact's row key is its MutationTarget (the bell's fact, instance scope), canonical JSON.
  const fact = `{"fact":{"cartridge_id":"ashmere_bell","cartridge_version":"0.0.1","key":"chapel_bell_rung","kind":"fact"},"kind":"fact","scope":{"kind":"instance","world_context_id":"0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f"}}`;
  const rung = `{"clock":0,"containers":{"3d4829ad-9e43-81ef-bc10-66b1b267e157":"1a7c3699-2844-8a55-b29f-eac079c7bf50"},"facts":{${JSON.stringify(fact)}:true},"rng":[1,2,3,4]}`;
  const expected = createHash('sha256').update(rung).digest('hex');
  for (const off of [false, true]) {
    const path = save();
    processOn(path, { newId: ids(), off }).story.invoke(ring());
    const b = processOn(path);
    assert.equal(count(b, 'report'), off ? 0 : 1);
    assert.equal(hash(b.story.world().state as never), expected);
  }
});

// The definite COMMIT failure of the storage lessons: a deferred foreign-key violation raised by
// the insert into `table` fails the real COMMIT; its ROLLBACK succeeds.
const failCommit = (table: string) => `PRAGMA foreign_keys = ON;
  CREATE TABLE parent (id INTEGER PRIMARY KEY);
  CREATE TABLE orphan (id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED);
  CREATE TRIGGER orphaned AFTER INSERT ON ${table} BEGIN INSERT INTO orphan VALUES (1); END;`;
/** A lost COMMIT acknowledgement once `arm()`ed, whose first reconcile read then fails too. */
const lostAck = () => {
  let stage = 0;
  const tap: Tap = (s, run) => {
    if (stage === 2 && s.startsWith('SELECT')) {
      stage = 3;
      throw new Error('read failed');
    }
    const out = run();
    if (stage === 1 && s === 'COMMIT') {
      stage = 2;
      throw new Error('COMMIT acknowledgement lost');
    }
    return out;
  };
  return { tap, arm: () => (stage = 1) };
};

// Breaks (23 §4, 03 §26; pin 2): the report written in its own transaction, before the gameplay
// commit (left behind when the receipt's COMMIT fails) or after it (gameplay saved when the
// report's fails); an unknown COMMIT capturing a second report when it settles or is retried.
test('a report commits with its gameplay result or not at all', () => {
  for (const table of ['receipt', 'report']) {
    const p = processOn(save(), { newId: ids() });
    p.sql.exec(failCommit(table));
    assert.throws(() => p.story.invoke(ring()), /nothing was saved/, table);
    assert.deepEqual(p.all('SELECT revision FROM head'), [[0]], table);
    assert.deepEqual([count(p, 'receipt'), count(p, 'report')], [0, 0], table);
  }
  const { tap, arm } = lostAck();
  const p = processOn(save(), { newId: ids(), tap });
  arm();
  assert.deepEqual(p.story.invoke(ring()), { kind: 'pending' });
  assert.deepEqual(saved(p.story.invoke(ring())), [true, 1]);
  assert.deepEqual(saved(p.story.invoke(ring())), [true, 1]);
  assert.deepEqual(p.all('SELECT report_id FROM report'), [[id(3)]]);
});

// Breaks (23 §11, 10 §31 as amended; pin 6): a new game wiping the reports (red control: a
// `DELETE FROM report` in `replace`), or rewriting their run, lineage or release to the new game's.
test('a new game keeps a pending report, delivered under its original run', async () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(ring());
  assert.deepEqual(a.story.newGame(), { kind: 'replaced' });
  a.sql.close();
  const b = processOn(path);
  assert.deepEqual(b.all('SELECT lineage_id, report FROM report'), [
    [id(1), payload(id(3), id(2))],
  ]);
  const fake = platform();
  await deliver(b.db, fake.submit, 10);
  assert.deepEqual(fake.calls, [[id(3), A]]);
  assert.deepEqual(b.all('SELECT disposition FROM report'), [['accepted']]);
});

/** A save holding one pending report per binding, each in its own run (a new game between). */
function reports(...bindings: (string | null)[]) {
  let who: string | null = null;
  const p = processOn(save(), { newId: ids(), binding: () => who });
  for (const b of bindings) {
    who = b;
    p.story.invoke(ring());
    p.story.newGame();
  }
  return p;
}
const DISPOSITIONS = 'SELECT binding, disposition FROM report ORDER BY rowid';

// Breaks (23 §§4-5; pin 7): the local record taken from the reply but not persisted, or a lost
// reply leaving nothing for the retry to read back (the platform keeps one acceptance per report
// id, so a report id minted again at retry would earn a second); an acceptance stored that differs
// from the platform's.
test('a lost reply is retried and reads back the one acceptance', async () => {
  const p = reports(A);
  const fake = platform();
  fake.lose = true;
  await assert.rejects(deliver(p.db, fake.submit, 10), /response lost/);
  assert.deepEqual(p.all(DISPOSITIONS), [[A, 'pending']]);
  await deliver(p.db, fake.submit, 10);
  assert.equal(fake.kept.size, 1);
  const stored = JSON.parse(p.all('SELECT acceptance FROM report')[0]![0] as string);
  assert.deepEqual(stored, fake.kept.get(id(3)));
  assert.deepEqual(validate('MilestoneAcceptance', stored), []);
});

// Breaks (23 §4; pin 7): a batch not bounded; a conflict or rejection stored as accepted or left
// pending (resent forever); an unreachable platform, or a reply that is malformed or for another
// account or outcome, dropping or settling a report; a guest's report sent under no account;
// delivery reading or writing while a transaction is open (its uncommitted reports would be sent
// as saved, or the open transaction rolled back by the acknowledgement).
test('delivery is bounded, persists each disposition and drops nothing', async () => {
  const p = reports(A, B, C, null);
  const fake = platform();
  fake.offline = true;
  await assert.rejects(deliver(p.db, fake.submit, 10), /offline/);
  fake.offline = false;
  fake.result = 'rejected';
  await deliver(p.db, fake.submit, 1);
  fake.result = 'outcome_conflict';
  await deliver(p.db, fake.submit, 1);
  fake.result = 'accepted';
  // An acceptance with a result outside the schema, of another account, of another outcome.
  for (const wrong of [{ result: 'credited' }, { account_id: A }, { outcome: 'tolled' }]) {
    const answer = async (r: MilestoneReport, a: string) => ({
      ...(await fake.submit(r, a)),
      ...wrong,
    });
    await assert.rejects(deliver(p.db, answer, 10), /not an acceptance/);
  }
  assert.deepEqual(p.all(DISPOSITIONS), [
    [A, 'rejected'],
    [B, 'needs_attention'],
    [C, 'pending'],
    [null, 'pending'],
  ]);
  const sent = fake.calls.length;
  p.sql.exec('BEGIN');
  await assert.rejects(deliver(p.db, fake.submit, 10), /transaction is open/);
  p.sql.exec('ROLLBACK');
  assert.equal(fake.calls.length, sent);
  const opening = async (r: MilestoneReport, a: string) => {
    const answer = await fake.submit(r, a);
    p.sql.exec('BEGIN'); // left open while the answer was awaited
    return answer;
  };
  await assert.rejects(deliver(p.db, opening, 10), /transaction is open/);
  p.sql.exec('ROLLBACK');
  await deliver(p.db, fake.submit, 10);
  assert.deepEqual(p.all(DISPOSITIONS).slice(2), [
    [C, 'accepted'],
    [null, 'pending'],
  ]);
});
