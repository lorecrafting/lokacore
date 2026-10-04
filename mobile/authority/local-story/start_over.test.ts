// Start over over a corrupt report table, and the latest committed narration on reopen (R6P P4a;
// ROADMAP R6P; 23 §11; 06 §43; PM D2, D3b), on real SQLite (node:sqlite) with the ferry known
// answer (protocol/fixtures/cartridge_ferry_hash.json): accept the lantern quest, take the lantern,
// talk to Bram, choose leave, which reaches the story point lantern_resolved. The ids are the
// hand-checked literals of local_story.test.ts and story_points.test.ts (same context and seed).
// The helpers are small copies of smoke.test.ts's and recovery.test.ts's (test files run their
// tests when imported).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, constants } from 'node:sqlite';
import { test } from 'node:test';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Host, type Saved } from './authority.ts';
import { presenter, type Button } from '../../app/book/presenter.ts';
import type { Game } from '../../packages/game-view/session.ts';
import { localSession, type Bundled } from './session.ts';
import { elapsedBundle, checkpoint, receipts } from '../../../kernel/ts/test/elapsed_host.ts';
import type { Db } from './store.ts';

const FERRY = read('protocol/fixtures/cartridge_ferry_hash.json');
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157';
const BRAM = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const LANTERN = '6a70d262-b6ea-8b64-9809-ec7f79d1521e';
const LEAVE = 'You hand Bram the lantern. He lifts it toward the reeds and calls the others in.';
const B = [
  { key: 'narration.bram.leave', participants: { actor: BODY, bram: BRAM, lantern: LANTERN } },
];
type P = (string | number | null)[];
const adapt = (sql: DatabaseSync): Db => ({
  execSync: (s) => void sql.exec(s),
  isInTransactionSync: () => sql.isTransaction,
  runSync: (s, ...p: P) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
});
// One presenter (its log) per game, as Book keeps one.
const shown = new WeakMap<Game, ReturnType<typeof presenter>>();
const at = (g: Game) => shown.get(g) ?? shown.set(g, presenter(g)).get(g)!;
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-p4a-')), 'save.db');
const all = (sql: DatabaseSync, q: string) => JSON.stringify(sql.prepare(q).all());
const bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** The app's save under localSession, as App.tsx wires it (smoke.test.ts `app`). */
function app(path: string, bundled: Bundled = FERRY as never, time?: Host['time']) {
  let sql: DatabaseSync | undefined;
  const c = localSession(
    () => adapt((sql = new DatabaseSync(path))),
    () => {
      sql?.close();
      sql = undefined;
      rmSync(path);
    },
    bundled,
    { newId: randomUUID, kernel_version: `loka-kernel@${'0'.repeat(40)}`, time },
  );
  const screen = () => at(c.game()!).screen();
  const press = (b: Button) => at(c.game()!).press(b);
  const tap = (label: string) => press(screen().buttons.find((b) => b.label === label)!);
  /** Plays from a fresh game to Bram's choice. */
  const talk = () =>
    ["Offer to fetch Bram's lantern", 'Take a brass lantern', 'Talk Bram the ferryman'].map(tap);
  // The smoke buttons never list `choose` (GameView omits the modal answers): built by hand.
  const leave = () => {
    const { continuation_id } = screen().view.choice!;
    press({
      label: 'leave',
      action_key: 'choose',
      target_ids: [],
      input: { choice_id: 'leave', continuation_id },
    });
  };
  return { c, sql: () => sql!, talk, leave, screen };
}

/** `path` with byte 0 of `name`'s root page (its b-tree page type) overwritten (recovery.test.ts). */
function corruptPage(path: string, name: string) {
  const sql = new DatabaseSync(path);
  const at = (q: string) => Number(Object.values(sql.prepare(q).get()!)[0]);
  const offset =
    (at(`SELECT rootpage FROM sqlite_master WHERE name = '${name}'`) - 1) * at('PRAGMA page_size');
  sql.close();
  const file = readFileSync(path);
  file[offset] = 0xff;
  writeFileSync(path, file);
}

// Breaks (ROADMAP SM2 carry; OFF-07; 23 §11): Start over that never checks the report storage,
// so the authority's new game "succeeds" in place and the next story point fails again; or a
// check whose failure does not classify as corrupt, so the smoke keeps the corrupt game. The
// table's root page (the scan itself throws) and its primary-key index (the scan reports it).
for (const name of ['report', 'sqlite_autoindex_report_1'])
  test(`a corrupt ${name} page: Start over gives a working save`, () => {
    const path = save();
    const a = app(path);
    a.talk();
    a.sql().close();
    corruptPage(path, name);
    const b = app(path);
    b.leave();
    assert.match(b.screen().fault!, /malformed/);
    b.c.startOver();
    assert.equal(b.c.failed(), undefined);
    b.talk();
    b.leave();
    assert.equal(b.screen().log.at(-1), LEAVE);
    assert.equal(all(b.sql(), 'SELECT disposition FROM report'), '[{"disposition":"pending"}]');
    assert.equal(all(b.sql(), 'PRAGMA quick_check'), '[{"quick_check":"ok"}]');
  });

/** `path` with the record-header length of `name`'s first leaf cell set to 0xff (page header intact). */
function corruptRecord(path: string, name: string) {
  const sql = new DatabaseSync(path);
  const at = (q: string) => Number(Object.values(sql.prepare(q).get()!)[0]);
  const page =
    (at(`SELECT rootpage FROM sqlite_master WHERE name = '${name}'`) - 1) * at('PRAGMA page_size');
  sql.close();
  const file = readFileSync(path);
  file[page + file.readUInt16BE(page + 8) + 1] = 0xff; // after the cell's 1-byte payload size
  writeFileSync(path, file);
}

// Breaks (OFF-07): a scan that checks pages but not records (quick_check), so Start over succeeds
// in place over a malformed report index record and the next story point fails again.
test('a malformed report index record: Start over gives a working save', () => {
  const path = save();
  const a = app(path);
  a.talk();
  a.leave();
  a.sql().close();
  corruptRecord(path, 'sqlite_autoindex_report_1');
  const b = app(path);
  b.c.startOver();
  b.talk();
  b.leave();
  assert.equal(b.screen().log.at(-1), LEAVE);
  assert.equal(all(b.sql(), 'SELECT disposition FROM report'), '[{"disposition":"pending"}]');
});

// Breaks (23 §11): a false positive in the scan, which replaces the file and loses the pending
// report. (A new game that drops or deletes the reports: story_points.test.ts "a new game keeps a
// pending report"; Start over that always deletes the file: smoke.test.ts "damaged identity".)
test('an intact report table survives Start over in place', () => {
  const a = app(save());
  a.talk();
  a.leave();
  const reports = all(a.sql(), 'SELECT * FROM report');
  assert.match(reports, /"disposition":"pending"/);
  a.c.startOver();
  assert.equal(all(a.sql(), 'SELECT * FROM report'), reports);
  const runs = "SELECT count(DISTINCT record ->> '$.ids.run_id') AS n FROM trace";
  assert.equal(all(a.sql(), runs), '[{"n":2}]');
});

/** A process on the save at `path` through openStory, the ferry its only release. */
function processOn(path: string) {
  const sql = new DatabaseSync(path);
  const artifact = `{"cartridge":${FERRY.canonical},"content_hash":"${FERRY.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4] as never,
  );
  const host = { kernel_version: `loka-kernel@${'0'.repeat(40)}`, newId: randomUUID };
  const opened = openStory(adapt(sql), [{ content_hash: FERRY.sha256, fresh }], host);
  return { sql, story: opened as Extract<typeof opened, { kind: 'open' }> };
}
const send = (
  p: ReturnType<typeof processOn>,
  n: number,
  action_key: string,
  target_ids: string[] = [],
  input = {},
) =>
  p.story.invoke({
    invocation_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    action_key,
    actor_id: p.story.world().character,
    target_ids,
    input,
  });
/** Coils the rope (narration A), then plays to leave chosen (narration B) at revision 5. */
function played(p: ReturnType<typeof processOn>) {
  send(p, 1, 'coil_rope');
  send(p, 2, 'lantern');
  send(p, 3, 'take', [LANTERN]);
  const talk = send(p, 4, 'bram', [BRAM]) as Saved;
  const [op] = (talk.decision as { delta: { ops: { continuation_id: string }[] } }).delta.ops;
  const input = { choice_id: 'leave', continuation_id: op!.continuation_id };
  assert.deepEqual(saved(send(p, 5, 'choose', [], input)), [false, 5]);
  return input;
}
const saved = (r: unknown) => [(r as Saved).replay, (r as Saved).revision];
const RECEIPTS = 'SELECT * FROM receipt';
/** The narration expected after `played`: leave's, under its receipt's command id. */
const latest = (sql: DatabaseSync) => ({
  command_id: sql
    .prepare(
      "SELECT command_id FROM receipt WHERE invocation_id = '00000000-0000-4000-8000-000000000005'",
    )
    .get()!.command_id,
  lines: B,
});

// Breaks (06 §43; PM D2): the oldest narration instead of the latest, one read from memory
// (none after a reopen), a later receipt without narration taken as the latest, one read inside an open transaction, a replay that decides again or adds a receipt, or a narration kept
// after a new game deleted the receipts.
test('the latest committed narration is read again on reopen, from the receipts', () => {
  const path = save();
  const a = processOn(path);
  const input = played(a);
  a.sql.close();
  const b = processOn(path);
  assert.deepEqual(b.story.narration(), latest(b.sql));
  b.sql.exec('BEGIN'); // as after a failed ROLLBACK: what it reads may be uncommitted
  assert.equal(b.story.narration(), undefined);
  b.sql.exec('ROLLBACK');
  assert.deepEqual(saved(send(b, 6, 'look')), [false, 6]); // accepted, no narration
  const rejected = send(b, 7, 'take', [LANTERN]) as Saved; // Bram holds it now
  assert.deepEqual(
    [(rejected.decision as { kind: string }).kind, rejected.revision],
    ['rejected', 6],
  );
  const receipts = all(b.sql, RECEIPTS);
  assert.deepEqual(saved(send(b, 5, 'choose', [], input)), [true, 5]);
  assert.deepEqual(b.story.narration(), latest(b.sql));
  assert.equal(all(b.sql, RECEIPTS), receipts);
  assert.deepEqual(b.story.newGame(), { kind: 'replaced' });
  assert.equal(b.story.narration(), undefined);
});

// Breaks (PM D3b): P4a state an older save (before B: no observation table) lacks, so it does
// not open or loses its narration; a narration read that writes (an acknowledgement); or a
// Start over that drops the old save's pending report.
test('an older save reopens with its narration and keeps its report on Start over', () => {
  const path = save();
  const a = processOn(path);
  played(a);
  a.sql.exec('DROP TABLE observation');
  const kept = ['SELECT * FROM receipt', 'SELECT * FROM state_row', 'SELECT * FROM report'];
  const before = kept.map((q) => all(a.sql, q));
  a.sql.close();
  for (let i = 0; i < 3; i++) {
    const p = processOn(path);
    const file = bytes(path);
    assert.deepEqual(p.story.narration(), latest(p.sql));
    assert.equal(bytes(path), file);
    assert.deepEqual(
      kept.map((q) => all(p.sql, q)),
      before,
    );
    p.sql.close();
  }
  const p = processOn(path);
  assert.deepEqual(p.story.newGame(), { kind: 'replaced' });
  assert.equal(all(p.sql, 'SELECT * FROM report'), before[2]);
});

const REPORTS = 'SELECT * FROM report';

// Breaks (R6P-A01; 23 §11; S6a): SQLite's "malformed JSON" (a damaged receipt in an intact file)
// classified as a corrupt file, or the open's refusal dropped, so Start over deletes the file and
// the pending report with it instead of the authority's new game in place.
test('a malformed receipt response: Start over keeps the pending report', () => {
  const path = save();
  const a = app(path);
  a.talk();
  a.leave();
  const reports = all(a.sql(), REPORTS);
  assert.match(reports, /"disposition":"pending"/);
  a.sql().exec("UPDATE receipt SET response = '{' WHERE revision = 4");
  a.sql().close();
  const b = app(path);
  assert.deepEqual(
    [b.c.failed()?.kind, b.c.failed()?.replace, b.c.failed()?.startOver],
    ['save_corrupt', false, true],
  );
  b.c.startOver();
  assert.equal(b.c.failed(), undefined);
  assert.equal(all(b.sql(), REPORTS), reports);
});

// Breaks (SM2a: an open that fails for another reason may be intact): a narration read that fails
// for a reason other than damage (here a real lock) offered the new game, which erases the save.
test('a narration read that fails on a lock offers no Start over', () => {
  const path = save();
  const a = app(path);
  a.talk();
  a.leave();
  a.sql().close();
  const other = new DatabaseSync(path);
  const db = adapt(new DatabaseSync(path));
  const c = localSession(
    () => ({
      ...db,
      getFirstSync: <T>(s: string, ...p: P) => {
        if (s.includes("'$.narration'")) other.exec('BEGIN EXCLUSIVE');
        return db.getFirstSync<T>(s, ...p);
      },
    }),
    () => {},
    FERRY as never,
    { newId: randomUUID, kernel_version: `loka-kernel@${'0'.repeat(40)}` },
  );
  const failed = c.failed()!;
  assert.deepEqual(
    [failed.message, failed.replace, failed.newGame],
    ['database is locked', false, undefined],
  );
});

// Breaks (R6P-A02; ROADMAP SM2a): a save whose rows parse but cannot be shown (no place for the
// body, a null choice, a resource without its fields) opens, and the first screen throws outside
// the save-error screen; or its Start over replaces the intact file instead of the new game.
for (const [what, damage] of [
  ['no body row', `DELETE FROM state_row WHERE section = 'containers' AND key = '${BODY}'`],
  ['a null choice', "UPDATE state_row SET value = 'null' WHERE section = 'choices'"],
  ['an empty resource', "UPDATE state_row SET value = '{}' WHERE section = 'resources'"],
])
  test(`a save with ${what}: save_corrupt, Start over repairs it in place`, () => {
    const path = save();
    const a = app(path);
    a.talk();
    a.sql().exec(damage!);
    a.sql().close();
    const b = app(path);
    assert.deepEqual([b.c.failed()?.kind, b.c.failed()?.replace], ['save_corrupt', false]);
    b.c.startOver();
    assert.equal(b.c.failed(), undefined);
    assert.equal(b.screen().view.place.title.key, 'room.ferry_landing.title');
  });

// Breaks (review F1): a receipt whose narration holds a null line parses, so the open passes and the
// presenter throws on `.key` while drawing; it must route to the save-error screen at open.
test('a receipt narration line that is null: save_corrupt at open, Start over repairs it', () => {
  const path = save();
  const a = app(path);
  a.talk();
  a.leave();
  a.sql().exec(
    "UPDATE receipt SET response = json_set(response, '$.narration', json('[null]')) WHERE json_array_length(response, '$.narration') > 0",
  );
  a.sql().close();
  const b = app(path);
  assert.deepEqual([b.c.failed()?.kind, b.c.failed()?.replace], ['save_corrupt', false]);
  b.c.startOver();
  assert.equal(b.screen().view.place.title.key, 'room.ferry_landing.title');
});

// Breaks (R6P-A03; 03 §14 original outcome): a receipt whose response is not a DecisionResult
// replayed as {kind: 'saved', replay: true, decision: null}, or taken as no receipt (decided again).
test('a receipt response that is not a decision replays as a conflict', () => {
  const path = save();
  const a = processOn(path);
  assert.deepEqual(saved(send(a, 1, 'coil_rope')), [false, 1]);
  a.sql.exec("UPDATE receipt SET response = 'null'");
  a.sql.close();
  const b = processOn(path);
  const receipts = all(b.sql, RECEIPTS);
  assert.deepEqual(send(b, 1, 'coil_rope'), { kind: 'conflict' });
  assert.equal(all(b.sql, RECEIPTS), receipts);
});

// Breaks: proven elapsed opening corruption dereferences absent metadata or cannot reach confirmed host file recovery.
test('elapsed NOTADB and page corruption recover only through explicit working Start over', () => {
  const time = { wall: () => 10000, monotonic: () => 0 };
  for (const fault of ['notadb', 'head']) {
    const path = save(),
      bundle = elapsedBundle();
    if (fault === 'notadb') writeFileSync(path, Buffer.alloc(4096, 'x'));
    else {
      app(path, bundle, time).sql().close();
      corruptPage(path, 'head');
    }
    const a = app(path, bundle, time);
    assert.equal(a.c.failed()?.kind, 'save_corrupt');
    assert.equal(a.c.failed()?.startOver, true);
    a.c.startOver();
    assert.equal(a.c.failed(), undefined);
    assert.equal(a.c.game()!.view().view.time, 64800);
    assert.equal(a.sql().prepare('SELECT format FROM save').get()!.format, 'loka-save-v2');
    assert.deepEqual(checkpoint(a.sql()), { wall_ms: 10000, remainder: 0, target: 64800 });
    assert.equal(
      a.c.game()!.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'saved',
    );
    assert.equal(receipts(a.sql()), 1);
    a.sql().close();
  }
});

// Breaks: an unreadable corrupt opening guesses a new witness, resets a readable replacement, or removes while closure/read is unknown.
test('unreadable elapsed opening refuses a newly readable replacement and waits on real SQLite uncertainty', () => {
  const path = save(),
    replacement = save(),
    bundle = elapsedBundle();
  const time = { wall: () => 10000, monotonic: () => 0 };
  writeFileSync(path, Buffer.alloc(4096, 'x'));
  const a = app(path, bundle, time),
    old = a.c.failed()!.newGame!;
  const b = app(replacement, bundle, time);
  b.sql().exec(
    "UPDATE save SET run_id = 'bbbbbbbb-0000-4000-8000-000000000001'; UPDATE elapsed SET run_id = 'bbbbbbbb-0000-4000-8000-000000000001'",
  );
  b.sql().close();
  writeFileSync(path, readFileSync(replacement));
  a.sql().exec('BEGIN');
  a.sql().setAuthorizer((action, operation) =>
    action === constants.SQLITE_TRANSACTION && operation === 'ROLLBACK'
      ? constants.SQLITE_DENY
      : constants.SQLITE_OK,
  );
  assert.equal(old().kind, 'pending');
  assert.equal(a.sql().isTransaction, true);
  a.sql().setAuthorizer(null);
  a.sql().exec('ROLLBACK');
  a.sql().setAuthorizer((action) =>
    action === constants.SQLITE_SELECT ? constants.SQLITE_DENY : constants.SQLITE_OK,
  );
  assert.equal(old().kind, 'pending');
  a.sql().setAuthorizer(null);
  assert.equal(old().kind, 'stale_view');
  assert.equal(
    a.sql().prepare('SELECT run_id FROM save').get()!.run_id,
    'bbbbbbbb-0000-4000-8000-000000000001',
  );
  assert.deepEqual(checkpoint(a.sql()), { wall_ms: 10000, remainder: 0, target: 64800 });
  assert.equal(receipts(a.sql()), 0);
  a.c.startOver();
  assert.equal(a.c.failed(), undefined);
  assert.equal(a.c.game()!.view().view.time, 64800);
  assert.equal(
    a.sql().prepare('SELECT run_id FROM save').get()!.run_id,
    'bbbbbbbb-0000-4000-8000-000000000001',
  );
  a.sql().close();
});
