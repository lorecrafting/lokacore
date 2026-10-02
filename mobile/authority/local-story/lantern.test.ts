// The Ferryman's Lantern on the local authority (R6P P4b; pre-release-proof.md:55-63, :78, :84-88):
// the frozen traces and the 11 Lantern adverse cases (docs/spec/conformance/lantern-traces.json,
// adverse-cases.json `lantern`) played through openStory on node:sqlite in the rollback journal,
// one connection per simulated process, a kill a real child, on P3's compiled known answer
// (protocol/fixtures/cartridge_lantern_hash.json). Kernel values are projected onto the traces'
// vocabulary by the mapping in docs/ROADMAP.md (R6P row); the fixtures are the expected values,
// compared as canonical bytes. The platform is a fake (the network is external).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encode, hash, type Json } from '../../../kernel/ts/src/canonical.ts';
import type {
  DecisionResult,
  DefinitionRef,
  NarrationRecord,
  StoryPointReport,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { refString, type World } from '../../../kernel/ts/src/decision.ts';
import { value } from '../../../kernel/ts/src/fact.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { gameView, INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Reply } from './authority.ts';
import { deliver } from './progress.ts';
import { load } from './store.ts';

const kat = read('protocol/fixtures/cartridge_lantern_hash.json');
const { initial_state, traces } = read('docs/spec/conformance/lantern-traces.json');
const CASES: Case[] = read('docs/spec/conformance/adverse-cases.json').lantern;
const fresh = (() => {
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
  return newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4] as World['state']['rng']);
})();
const kernel_version = `loka-kernel@${'0123456789'.repeat(4)}`;
const def = (kind: string, key: string) =>
  ({ cartridge_id: 'lantern_proof', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const ref = (kind: string, key: string) => refString(def(kind, key));
const BRAM = fresh.entityIds[ref('npc', 'bram')]!;
const LANTERN = fresh.entityIds[ref('item', 'lantern')]!;
/** Trace names of the loaded world's ids, by definition ref (ROADMAP R6P row). */
const NAMES: Record<string, string> = {
  [fresh.body]: 'hero',
  [BRAM]: 'bram',
  [LANTERN]: 'lantern',
  ...Object.fromEntries(Object.entries(fresh.roomIds!).map(([r, id]) => [id, r.split('/')[1]!])),
};
const CHOICE = 'proof-choice:talk';
const ADA = '00000000-0000-4000-8000-0000000000ad'; // the account a run is bound to
const CODES: Record<string, string> = {
  carry: 'resolved_carry',
  leave: 'resolved_leave',
  exit_locked: 'exit_unavailable',
  proof_terminal: 'proof.terminal',
};

type Request = { id: string; action: string; input?: Record<string, Json>; view?: string };
type Step = {
  request?: Request;
  op?: 'recover' | 'settle';
  committed?: boolean;
  options?: { fault: string };
  result: object | null;
  state: object;
  durable?: object;
};
type Case = { id: string; prefix: { trace: string; from: number; to: number }; steps: Step[] };
type Tap = (statement: string, run: () => unknown) => unknown;
type Proc = ReturnType<typeof processOn>;
/** One save played by a test: its process and the minted continuation it has seen. */
type Run = { path: string; p: Proc; continuation?: string; last?: object };

/** A connection adapted to expo-sqlite's sync names, as local_story.test.ts. */
const adapt = (sql: DatabaseSync, tap: Tap = (_, run) => run()) => ({
  execSync: (s: string) => void tap(s, () => sql.exec(s)),
  runSync: (s: string, ...p: (string | number | null)[]) => tap(s, () => sql.prepare(s).run(...p)),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    tap(s, () => sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) =>
    tap(s, () => sql.prepare(s).all(...p)) as T[],
  isInTransactionSync: () => sql.isTransaction,
});

/**
 * A process on the save at `path`. Its armed `fault`, the frozen case it realizes:
 * - before_commit (choice-rollback): the receipt write fails, a definite failure; the real
 *   SQLITE_FULL path is local_story.test.ts:221-229.
 * - commit_pending (choice-unknown-commit-absent and -committed): COMMIT is held unrun and every
 *   ROLLBACK jams while `held`, so the outcome stays unknown; `settle` then has SQLite execute
 *   that COMMIT on this connection, or not, and the authority never sees it succeed. Storage
 *   must stay at revision 9 until `settle` (the cases' `durable`).
 * - ack_lost (no frozen case: the unknown COMMIT as it happens): SQLite executes COMMIT, then the
 *   connection is lost before the authority sees success.
 * - after_commit_before_memory (commit-before-display): SIGKILL right after the real COMMIT.
 */
const INJECTED = 'injected write failure';
function processOn(path: string, binding?: () => string | null) {
  const sql = new DatabaseSync(path);
  const p = { sql, held: false, fault: undefined as string | undefined };
  const tap: Tap = (s, run) => {
    if (p.fault === 'before_commit' && s.startsWith('INSERT INTO receipt')) {
      p.fault = undefined;
      throw new Error(INJECTED);
    }
    if (p.held && s === 'ROLLBACK') throw new Error('ROLLBACK failed');
    if (s !== 'COMMIT' || !p.fault) return run();
    if (p.fault === 'commit_pending') {
      [p.fault, p.held] = [undefined, true];
      throw new Error('COMMIT acknowledgement lost');
    }
    run();
    if (p.fault === 'ack_lost') {
      p.fault = undefined;
      p.sql.close();
      throw new Error('connection lost');
    }
    return process.kill(process.pid, 'SIGKILL');
  };
  const host = { kernel_version, newId: randomUUID, ...(binding && { binding }) };
  const o = openStory(adapt(sql, tap), [{ content_hash: kat.sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  return Object.assign(p, { story: o as Extract<typeof o, { kind: 'open' }> });
}
const revision = (p: Proc) => Number(p.story.token().split(':')[2]);

/** A request as the ActionInvocation its GameView action makes; ids hashed from the fixture's. */
function invocation(run: Run, r: Request) {
  const h = createHash('sha256').update(r.id).digest('hex');
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const input = { ...r.input };
  if (input.continuation_id === CHOICE) input.continuation_id = run.continuation!;
  if (r.action === 'wait') input.until = (input.until as number) * 3600;
  const [action_key, target_ids] = {
    activate: ['lantern', []],
    talk: ['bram', [BRAM]],
    take: ['take', [LANTERN]],
    drop: ['drop', [LANTERN]],
  }[r.action] ?? [r.action, []];
  // The fixture's view:N is the host token of revision N of the current run.
  const run_id = run.p.story.token().split(':')[1];
  const token = r.view && { view_freshness_token: r.view.replace(':', `:${run_id}:`) };
  return { invocation_id: id, action_key, actor_id: fresh.character, target_ids, input, ...token };
}

const result = (kind: string, code: string, revision: number, delivery = 'new') => ({
  kind,
  code,
  revision,
  delivery,
});
/** A Reply in the traces' result vocabulary at the process's current revision. */
function said(p: Proc, r: Reply) {
  const at = (kind: string, code: string, rev = revision(p), delivery = 'new') =>
    result(kind, code, rev, delivery);
  if (r.kind === 'conflict') return at('rejected', 'integrity_conflict');
  if (r.kind === 'stale_view') return at('rejected', 'stale_view');
  if (r.kind === 'pending') return at('retryable', 'commit_pending');
  if (r.kind !== 'saved') return r; // shown in bytes as a mismatch
  const d = r.decision as DecisionResult;
  const code = d.kind === 'accepted' ? d.outcome : d.kind === 'rejected' ? d.error.code : d.code;
  return at(d.kind, CODES[code] ?? code, r.revision, r.replay ? 'replay' : 'new');
}

const named = (run: Run, id: string | undefined) =>
  id === undefined ? null : id === run.continuation ? CHOICE : (NAMES[id] ?? id);
/** The narration entries of a receipt's lines, the choice's continuation projected. */
const entries = (run: Run, continuation: string, lines: NarrationRecord['lines']) =>
  lines.map((l) => ({
    id: `${named(run, continuation)}:outcome`,
    text_key: l.key,
    bindings: Object.fromEntries(
      Object.entries(l.participants ?? {}).map(([k, v]) => [k, named(run, v)]),
    ),
  }));

/**
 * The trace state of world `w` at `rev`, with the narration of `sql`'s committed receipts and the
 * story point of its report rows up to `rev` (memory has adopted nothing later).
 */
function project(run: Run, w: World, rev: number, sql: DatabaseSync) {
  const v = gameView(w);
  const at = (id: string) => named(run, w.state.containers[id]);
  type Event = { payload: { type: string; continuation_id?: string } };
  const receipts = sql
    .prepare(
      `SELECT revision, command ->> '$.payload.continuation_id' AS c, response FROM receipt
       WHERE revision <= ? AND response ->> '$.kind' = 'accepted' ORDER BY revision`,
    )
    .all(rev)
    .map((x) => ({ revision: x.revision, c: x.c as string, d: JSON.parse(x.response as string) }));
  const row = sql.prepare('SELECT report FROM report ORDER BY rowid DESC LIMIT 1').get();
  const sp = row && (JSON.parse(row.report as string) as StoryPointReport);
  const events: Event[] = receipts.find((x) => x.revision === sp?.observed_revision)?.d.events;
  const occurrence = events?.find((e) => e.payload.type === 'choice_resolved')?.payload;
  return {
    revision: rev,
    room: at(w.body),
    lantern: at(LANTERN),
    quest: v.journal[0]?.state ?? 'absent',
    choice: named(run, v.choice?.continuation_id),
    search_plan: value(w, w.character, def('fact', 'search_plan')),
    clock: w.state.clock / 3600,
    bram_room: at(BRAM),
    rng: w.state.rng,
    narration: receipts.flatMap((x) => entries(run, x.c, x.d.narration ?? [])),
    story_point: occurrence
      ? {
          key: CODES[sp!.story_point],
          occurrence: named(run, occurrence.continuation_id),
          outcome: sp!.outcome,
        }
      : null,
  };
}
const memory = (run: Run) => project(run, run.p.story.world(), revision(run.p), run.p.sql);
/** The save as a restart would load it, read on a second, read-only connection. */
function durable(run: Run) {
  const ro = new DatabaseSync(run.path, { readOnly: true });
  try {
    const saved = load(adapt(ro), fresh, () => assert.fail('no save'))!;
    return project(run, saved.world, saved.revision, ro);
  } finally {
    ro.close();
  }
}
/** The binding of each report row in the save, read on a read-only connection. */
function bindings(run: Run) {
  const ro = new DatabaseSync(run.path, { readOnly: true });
  try {
    return ro
      .prepare('SELECT binding FROM report')
      .all()
      .map((r) => r.binding);
  } finally {
    ro.close();
  }
}
const same = (what: string, actual: unknown, expected: unknown) =>
  assert.equal(encode(actual as Json), encode(expected as Json), what);

/** Plays one step (ROADMAP R6P row: faults, recover, settle, reading) and returns its result. */
function act(run: Run, step: Step) {
  const p = run.p;
  const at = (kind: string, code: string, rev = revision(p)) => result(kind, code, rev);
  if (step.op === 'settle') {
    if (step.committed) p.sql.exec('COMMIT');
    p.held = false;
    return null;
  }
  if (step.op === 'recover') {
    if (p.held) return said(p, p.story.invoke(run.last)); // fenced: no restart settles it yet
    if (p.sql.isOpen) p.sql.close();
    run.p = processOn(run.path);
    return at('recovered', 'recovered', revision(run.p));
  }
  const r = step.request!;
  if (r.action === 'look') return gameView(p.story.world()) && at('accepted', 'observed');
  const i = (run.last = invocation(run, r));
  if (step.options?.fault === 'after_commit_before_memory') {
    const args = [fileURLToPath(import.meta.url), 'kill', run.path, JSON.stringify(r)];
    const child = spawnSync(process.execPath, args);
    assert.equal(child.signal, 'SIGKILL', String(child.stderr));
    return at('retryable', 'commit_unknown');
  }
  p.fault = step.options?.fault;
  try {
    return said(p, p.story.invoke(i));
  } catch (e) {
    if ((e as Error).message !== INJECTED) throw e;
    return at('retryable', 'rolled_back');
  } finally {
    run.continuation ??= gameView(p.story.world()).choice?.continuation_id;
  }
}

// The child of commit-before-display: `kill <save> <request>` opens the save, then invokes the
// request and SIGKILLs itself right after the real COMMIT, before memory adopts it.
if (process.argv[2] === 'kill') {
  const [path, request] = process.argv.slice(3) as [string, string];
  const run: Run = { path, p: processOn(path) };
  run.continuation = gameView(run.p.story.world()).choice?.continuation_id;
  run.p.fault = 'after_commit_before_memory';
  run.p.story.invoke(invocation(run, JSON.parse(request)));
  process.exit(1); // not killed: the parent sees no SIGKILL
}

/** A new save at its initial state, its run bound to `binding`. */
function begin(binding = () => ADA as string | null): Run {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-lantern-')), 'save.db');
  const run: Run = { path, p: processOn(path, binding) };
  same('initial state', memory(run), initial_state);
  return run;
}
/** Plays `steps`, comparing each result, memory state and durable state with the fixture's. */
function play(run: Run, steps: Step[], label: string) {
  for (const [n, step] of steps.entries()) {
    const what = `${label} step ${n} (${step.request?.id ?? step.op})`;
    same(`${what} result`, act(run, step), step.result);
    same(`${what} state`, memory(run), step.state);
    const saved = step.durable ?? step.state;
    same(`${what} durable`, durable(run), saved);
    // 23 §§4-5, §11: one report per story point reached, bound to the run's account; none
    // survives a rollback, and a retry or recovery adds none.
    const sp = (saved as { story_point: object | null }).story_point;
    same(`${what} reports`, bindings(run), sp ? [ADA] : []);
    // 06 §43: the latest committed narration is the save's, whatever memory holds.
    const shown = run.p.story.narration();
    same(
      `${what} narration()`,
      shown ? entries(run, run.continuation!, shown.lines) : [],
      (saved as { narration: object[] }).narration.slice(-1),
    );
  }
}
const trace = (id: string) => traces.find((t: { id: string }) => t.id === id).steps as Step[];

/** The fake platform: one acceptance per report id; it loses its first reply if `lose`. */
function platform(lose = true) {
  const f = { kept: new Map<string, object>(), lose, calls: [] as string[] };
  const submit = async (report: StoryPointReport, account: string) => {
    f.calls.push(account);
    const { report_id, release, story_point, outcome } = report;
    const head = { report_id, account_id: account, payload_digest: hash(report as never) };
    const rest = {
      evidence_class: 'offline_client_report',
      policy_revision: 1,
      result: 'accepted',
    };
    if (!f.kept.has(report_id))
      f.kept.set(report_id, { ...head, release, story_point, outcome, ...rest });
    if (f.lose) {
      f.lose = false;
      throw new Error('response lost');
    }
    return f.kept.get(report_id);
  };
  return Object.assign(f, { submit });
}

// Breaks (pre-release-proof.md :55-63, :78): any rule, compiled content or host step the traces
// pin (a wrong exit, possession, quest state, fact, narration or its bindings, story point, clock,
// RNG or revision), memory or the save drifting from either; the run's report bound to the
// account signed in at delivery rather than at its start (23 §§4-5, §11), a wrong report payload,
// or a lost platform reply accepted twice (23 §11).
for (const { id } of traces)
  test(`${id} plays as its frozen trace; its story point reaches the run's account once`, async () => {
    let who: string | null = ADA;
    const run = begin(() => who);
    who = '00000000-0000-4000-8000-0000000000b0';
    play(run, trace(id), id);
    const db = adapt(run.p.sql);
    const f = platform();
    await assert.rejects(deliver(db, f.submit, 10), /response lost/);
    await deliver(db, f.submit, 10);
    assert.deepEqual([f.calls, f.kept.size], [[ADA, ADA], 1]);
    const row = run.p.sql.prepare('SELECT binding, report, disposition FROM report').all();
    const { report_id, run_id, ...report } = JSON.parse(row[0]!.report as string);
    const release = {
      cartridge_hash: '050cba8c964be222d47454c0a2e833dc592cfc905c8bcd09bb2def34f908b89d',
      cartridge_id: 'lantern_proof',
      cartridge_version: '0.0.1',
    };
    const outcome = id === 'lantern-carry' ? 'carry' : 'leave';
    assert.deepEqual(
      [row.length, row[0]!.binding, report, row[0]!.disposition],
      [
        1,
        ADA,
        { observed_revision: 10, outcome, release, story_point: 'proof_terminal' },
        'accepted',
      ],
    );
  });

// Breaks (04 §16): a view token naming no run, so after a new game an old run's token is current
// again once the new run reaches its revision, and a command made against that old view is decided.
test("an old run's view token is stale after a new game, at the same revision", () => {
  const run = begin();
  act(run, { request: { id: 'accept', action: 'activate' } } as Step);
  const old = run.p.story.token();
  assert.deepEqual(run.p.story.newGame(), { kind: 'replaced' });
  act(run, { request: { id: 'accept', action: 'activate' } } as Step);
  assert.equal(revision(run.p), 1);
  const north = { id: 'north', action: 'move', input: { direction: 'north' } };
  const i = { ...invocation(run, north), view_freshness_token: old };
  assert.deepEqual(run.p.story.invoke(i), { kind: 'stale_view' });
  const now = { ...i, view_freshness_token: run.p.story.token() };
  const moved = { kind: 'accepted', code: 'moved', revision: 2, delivery: 'new' };
  assert.deepEqual(said(run.p, run.p.story.invoke(now)), moved);
});

// Breaks (adverse-cases.json `lantern`; 03 §§14-15, 04 §16, 06 §43): early possession not
// credited; a choice resolved without its item or NPC present; the due-job drain skipped on wait;
// a replay deciding again (narration twice, a conflict, RNG drawn); altered intent replayed; a
// fault's consequences kept, a pending COMMIT presumed either way, a call decided while fenced, a
// killed COMMIT lost on restart; a read changing time, RNG or state; a stale view accepted or a
// replay refused as stale; a blocked exit accepted.
for (const c of CASES)
  test(`adverse ${c.id}`, async () => {
    const run = begin();
    for (const step of trace(c.prefix.trace).slice(c.prefix.from, c.prefix.to)) act(run, step);
    play(run, c.steps, c.id);
    await delivered(run, (c.steps.at(-1)!.state as { story_point: object | null }).story_point);
  });

/** Delivers the save's reports: one acceptance, to the run's account, if a story point was reached. */
async function delivered(run: Run, reached: object | null) {
  const f = platform(false);
  await deliver(adapt(run.p.sql), f.submit, 10);
  assert.deepEqual([f.calls, f.kept.size], reached ? [[ADA], 1] : [[], 0]);
}

// Breaks (03 §15; 23 §11): a COMMIT that SQLite executed but whose acknowledgement was lost
// presumed failed, so recovery decides the choice again (a second narration, a second report)
// instead of finding its receipt. Expected: choice-unknown-commit-committed's recover and replay.
test('a choice committed with its acknowledgement lost recovers to its receipt, reported once', async () => {
  const run = begin();
  for (const step of trace('lantern-carry').slice(0, 9)) act(run, step);
  const [resolve, , , , ...after] = CASES.find(
    (c) => c.id === 'choice-unknown-commit-committed',
  )!.steps;
  const lost = { ...resolve!, options: { fault: 'ack_lost' } };
  same('lost', act(run, lost), result('retryable', 'commit_pending', 9));
  assert.deepEqual(run.p.story.invoke(run.last), { kind: 'pending' }); // fenced
  play(run, after, 'after the lost acknowledgement');
  await delivered(run, {});
});
