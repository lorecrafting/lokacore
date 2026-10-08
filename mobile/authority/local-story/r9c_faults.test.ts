// E2 exit criterion 6: real SQLite faults on representative cross-domain r9c_interactions commits
// through the real local authority (save.md "Commit, fence, reconcile"). Faults are the corpus's
// own (faults.test.ts): SQLITE_FULL from a clamped max_page_count, a COMMIT a deferred foreign key
// fails, the elapsed host's lost acknowledgement and unreadable store (elapsed-host.test.ts), and
// a child process SIGKILLed before or after COMMIT. Only the unreadable-store and lost-ack rows fence
// and answer pending; SQLITE_FULL fails outright, a failed COMMIT settles in the call. Every row: the
// settled save is the prior or next revision (a literal per row; next = the fault-free run of the same
// invocation on a byte copy); memory equals the store; a cold reopen serves it; a duplicate applies once.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { INSTALLED, gameView, loadCartridge, newWorld } from '../../../kernel/ts/src/index.ts';
import type { DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Reply } from './authority.ts';
import { sqliteHost } from './__tests__/elapsed-host.test.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ID: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as never,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh, content_hash: pin.sha256 }] as const;
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'r9c_interactions', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;

type Open = Extract<ReturnType<typeof openStory>, { kind: 'open' }>;
function open(p: ReturnType<typeof sqliteHost>) {
  const s = openStory(p.db, releases, p.host);
  assert.equal(s.kind, 'open');
  return s as Open;
}
let sent = 0;
const attempt = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
  invocation_id: `dddddddd-5555-4555-8555-${String(++sent).padStart(12, '0')}`,
  actor_id: fresh.character,
  action_key,
  target_ids,
  input,
});

// The kill child: `kill <save> before|after <invocation json>` opens the save and SIGKILLs itself
// at the COMMIT of the transaction that wrote the invocation's receipt, just before it runs or just
// after it commits (or fails).
if (process.argv[2] === 'kill') {
  const [path, when, invocation] = process.argv.slice(3) as [string, string, string];
  const p = sqliteHost(path);
  const s = open(p);
  const { execSync, runSync } = p.db;
  let receipt = false;
  p.db.runSync = (q, ...v) => ((receipt ||= q.startsWith('INSERT INTO receipt')), runSync(q, ...v));
  p.db.execSync = (q) => {
    const die = receipt && q === 'COMMIT';
    if (die && when === 'before') process.kill(process.pid, 'SIGKILL');
    try {
      execSync(q);
    } finally {
      if (die) process.kill(process.pid, 'SIGKILL');
    }
  };
  s.invoke(JSON.parse(invocation));
  process.exit(1); // not killed: the parent sees no SIGKILL
}

/** A new save at `path`, played by `steps` (each command saved and accepted), then closed. */
function prefix(path: string, steps: (a: ReturnType<typeof driver>) => void) {
  const p = sqliteHost(path);
  const a = driver(open(p));
  a.run('choose_ancestry', [], { ancestry: 'fen_born' });
  steps(a);
  p.sql.close();
}
function driver(s: Open) {
  const view = () => gameView(s.world());
  const check = (r: Reply) => {
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    assert.equal((r as any).decision.kind, 'accepted', JSON.stringify(r));
  };
  const run = (action_key: string, target_ids?: string[], input?: object) =>
    check(s.invoke(attempt(action_key, target_ids, input)));
  const shown = () =>
    attempt('continue', [], { scene: view().scene!.scene, line: view().scene!.index });
  return {
    s,
    view,
    run,
    move: (...ds: string[]) => ds.forEach((direction) => run('move', [], { direction })),
    choose: (choice_id: string, answer?: string) =>
      run('choose', [], {
        continuation_id: view().choice!.continuation_id,
        choice_id,
        ...(answer && { answer }),
      }),
    shown,
    line: () => check(s.invoke(shown())),
    elapse: (until: number) =>
      check(s.elapsed({ expected_run_id: s.runId(), from: s.world().state.clock, until })),
  };
}

const TABLES = ['head', 'state_row', 'receipt', 'report', 'elapsed'];
/** Memory and storage: the head (revision, clock, RNG), rows, receipts, reports and elapsed checkpoint. */
const snap = (p: ReturnType<typeof sqliteHost>, s: Open) => ({
  memory: encode(s.world().state as never),
  stored: TABLES.map((t) => p.sql.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all()),
});
// The elapsed host's `failed` fault inserts into `child`; ORPHAN fails COMMIT on the receipt.
const FK =
  'PRAGMA foreign_keys = ON; CREATE TABLE parent (id INTEGER PRIMARY KEY); ' +
  'CREATE TABLE child (id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED)';
const ORPHAN =
  'CREATE TRIGGER orphaned AFTER INSERT ON receipt BEGIN INSERT INTO child VALUES (1); END';
// A settling probe with no effect: fenced() runs first, then the wrong run id is refused.
const probe = (s: Open) => s.elapsed({ expected_run_id: 'probe', from: 0, until: 0 }).kind;

type Fault = 'full' | 'commit' | 'failed' | 'lost' | 'before' | 'after';
/**
 * One fault row on a byte copy of the save at `base`: `call` makes the faulted commit (the same
 * payload each time), `outcome` is the literal revision the store must settle on.
 */
function row(
  base: string,
  fault: Fault,
  outcome: 'prior' | 'next',
  call: (s: Open) => Reply,
  invocation?: object, // the kill child's: `call` invokes it
) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s5-'));
  try {
    copyFileSync(base, join(dir, 'ref.db'));
    const r = sqliteHost(join(dir, 'ref.db'));
    const rs = open(r);
    const reference = call(rs);
    assert.equal((reference as any).decision?.kind, 'accepted', JSON.stringify(reference));
    const next = snap(r, rs);
    r.sql.close();
    const path = join(dir, `${fault}.db`);
    copyFileSync(base, path);
    let p = sqliteHost(path);
    let s = open(p);
    const prior = snap(p, s);
    const expected = outcome === 'prior' ? prior : next;
    if (fault === 'full') {
      const n = p.sql.prepare('PRAGMA page_count').get()!.page_count;
      p.sql.exec(`PRAGMA max_page_count = ${n}`);
      assert.throws(() => call(s), { errcode: 13 }); // SQLITE_FULL: a definite failure, no fence
      p.sql.exec('PRAGMA max_page_count = 1073741823');
    } else if (fault === 'commit') {
      p.sql.exec(`${FK}; ${ORPHAN}`);
      assert.throws(() => call(s), /nothing was saved/); // reconciled in the call: no receipt
      p.sql.exec('DROP TRIGGER orphaned');
    } else if (fault === 'failed' || fault === 'lost') {
      p.sql.exec(FK);
      p.fault.kind = fault;
      p.fault.armed = true;
      assert.equal(call(s).kind, 'pending');
      // Fenced while the store cannot be read: every call answers pending; memory is the prior.
      assert.deepEqual([call(s).kind, probe(s)], ['pending', 'pending']);
      assert.equal(encode(s.world().state as never), prior.memory);
      p.fault.reads = false;
    } else {
      p.sql.close();
      const kill = [
        fileURLToPath(import.meta.url),
        'kill',
        path,
        fault,
        JSON.stringify(invocation),
      ];
      const child = spawnSync(process.execPath, kill, { encoding: 'utf8', timeout: 60000 });
      assert.equal(child.signal, 'SIGKILL', child.stderr);
    }
    if (fault !== 'before' && fault !== 'after') {
      assert.equal(probe(s), 'stale_view'); // settled: no longer fenced
      assert.deepEqual(snap(p, s), expected); // memory serves only what the store confirmed
      p.sql.close();
    }
    p = sqliteHost(path); // cold reopen through the real loader
    s = open(p);
    assert.deepEqual(snap(p, s), expected);
    const again = call(s);
    assert.equal(again.kind, 'saved', JSON.stringify(again));
    assert.equal(again.kind === 'saved' && again.revision, (reference as any).revision);
    assert.equal(again.kind === 'saved' && again.replay, outcome === 'next');
    assert.deepEqual(snap(p, s), next);
    const twice = call(s);
    assert.equal(twice.kind === 'saved' && twice.replay, true);
    assert.deepEqual(snap(p, s), next); // applied once: no row, receipt or report change
    p.sql.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Breaks: memory adopted before a failed COMMIT or a SQLITE_FULL write (save.ts:53-60), a failed
// COMMIT reconciled as committed without its receipt (save.ts:83), a lost acknowledgement served
// as the prior state or applied twice on retry, or a fenced call answered from unconfirmed memory.
// The first two are also killed on the chapter by faults.test.ts:213 (both measured). This row is
// the cross-domain receipt: Wick's exchange moves three herbs and three bandages, sets two facts
// and turns in his quest in one commit (r9c_custody_terminal.test.ts family 1).
test('F1 family 1 exchange: full write, failed COMMIT, unreadable failed COMMIT, lost ack', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s5-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = join(dir, 'f1.db');
  let exchange: object;
  prefix(base, (a) => {
    // ferry_landing south, south, west: willow_shade's fenwort; back north to chapel_nave.
    a.move('south', 'south', 'west');
    for (const k of ['01', '02', '03', '04']) a.run('take', [ID[`item/fenwort_${k}`]!]);
    a.move('east', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
    a.run('a_wick_offer', [ID['npc/wick']!]);
    a.choose('accept');
    a.run('b_wick_turn_in', [ID['npc/wick']!]);
    exchange = attempt('choose', [], {
      continuation_id: a.view().choice!.continuation_id,
      choice_id: 'exchange',
    });
  });
  const call = (s: Open) => s.invoke(exchange);
  row(base, 'full', 'prior', call);
  row(base, 'commit', 'prior', call);
  row(base, 'failed', 'prior', call);
  row(base, 'lost', 'next', call);
});

// Breaks: a kill before the final COMMIT that keeps the memory, story point or report rows, one
// after it that loses them, a failed final COMMIT that keeps any of them (memory first: also
// killed on the chapter by faults.test.ts:213 and bell_receipts.test.ts:10/:305), or the retried
// final Continue writing a second report. The commit spans memory facts, the story point, its report and the head.
test('F2 family 2 final Continue: failed COMMIT, kill before and after COMMIT', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s5-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = join(dir, 'f2.db');
  const npc = (k: string) => [ID[`npc/${k}`]!];
  let last!: object;
  prefix(base, (a) => {
    // The legal route to the belfry (r9c_custody_terminal.test.ts belfry()), then Ring.
    a.run('elspeth', npc('elspeth'));
    a.choose('accept');
    a.move('north', 'north');
    a.run('take', [ID['item/fox_drawing']!]);
    a.move('south', 'south');
    a.run('a_elspeth_report', npc('elspeth'));
    a.choose('report');
    a.move('south', 'south');
    a.run('study_tracks', [ID['detail/reed_bank/tracks']!]);
    a.move('south', 'south');
    a.run('a_vesper_meeting', npc('vesper'));
    a.choose('meet_wren');
    a.run('b_vesper_riddle', npc('vesper'));
    a.choose('answer', 'LANTERN');
    a.run('a_wren_escort', npc('wren'));
    a.choose('rescue');
    a.move('north', 'north', 'north', 'north');
    a.run('a_elspeth_rescue', npc('elspeth'));
    a.choose('rescued');
    a.move('north', 'north', 'north', 'north', 'north');
    a.run('a_aldric_offer', npc('aldric'));
    a.choose('accept');
    a.move('up', 'up');
    a.run('ring_bell', [ID['detail/belfry/bell']!]);
    for (let line = 1; line <= 3; line++) a.line();
    a.move('down', 'down', 'south', 'south', 'south');
    a.run('begin_epilogue_rescued_prior', [ID['detail/village_green/market_cross']!]);
    for (const _ of [1, 2]) a.line();
    assert.equal(a.view().scene?.index, 3); // the final line: its Continue reports
    last = a.shown();
  });
  const call = (s: Open) => s.invoke(last);
  row(base, 'commit', 'prior', call);
  row(base, 'before', 'prior', call, last);
  row(base, 'after', 'next', call, last);
});

// Breaks: an elapsed settlement whose SQLITE_FULL write or lost acknowledgement leaves the clock,
// burned torch fuel or completed population jobs in memory without the store (memory first: also
// killed on the ferry fixture by faults.test.ts:357/:387), or a resent window settling twice. The commit is the
// paid Rest's elapsed settlement: clock, light fuel and every due job in one revision.
test('F3 family 3 paid Rest settlement: full write, lost ack', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s5-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = join(dir, 'f3.db');
  let evidence!: { expected_run_id: string; from: number; until: number };
  prefix(base, (a) => {
    const entity = (k: string) => a.view().entities.find((e) => e.id === ID[`npc/${k}`])!;
    const torch = ID['item/torch']!;
    a.move('north', 'west');
    const price = entity('peg').shop!.find((s) => s.item_id === torch)!.buy!.price;
    a.run('buy', [ID['npc/peg']!, torch], { quoted_price: price });
    a.move('east');
    a.run('wear', [torch]);
    a.run('ignite', [torch]);
    a.move('east');
    const room = entity('maud').services!.find((s) => s.service.key === 'lantern_room')!;
    a.run(room.action.action_key, [ID['npc/maud']!], {
      service: room.service,
      quoted_price: room.price,
    });
    a.move('up');
    a.run('rest');
    evidence = { expected_run_id: a.s.runId(), from: a.s.world().state.clock, until: 68400 };
  });
  const call = (s: Open) => s.elapsed(evidence);
  row(base, 'full', 'prior', call);
  row(base, 'lost', 'next', call);
});

// Breaks: a paid ferry crossing whose failed COMMIT moves the body or the fare without the store,
// or whose lost acknowledgement is decided again on retry (a second fare). The commit moves the
// body across the fen and the fare from player to Sedge. Both save.ts mutants are also killed on
// the chapter by transport.test.ts:210.
test('F4 family 4 paid ferry crossing: failed COMMIT, lost ack', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s5-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = join(dir, 'f4.db');
  prefix(base, (a) => a.move('west'));
  const board = attempt('board_ferry', [ID['detail/boathouse/ferry']!], {
    route: ref('transport', 'fen_outbound'),
    quoted_fare: 5, // transports/fen_outbound.json
  });
  const call = (s: Open) => s.invoke(board);
  row(base, 'commit', 'prior', call);
  row(base, 'lost', 'next', call);
});
