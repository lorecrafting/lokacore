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
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';
import { playSmoke, type Button } from './smoke.ts';
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
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-p4a-')), 'save.db');
const all = (sql: DatabaseSync, q: string) => JSON.stringify(sql.prepare(q).all());
const bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** The app's save under playSmoke, as App.tsx wires it (smoke.test.ts `app`). */
function app(path: string) {
  let sql: DatabaseSync | undefined;
  const c = playSmoke(
    () => adapt((sql = new DatabaseSync(path))),
    () => {
      sql?.close();
      sql = undefined;
      rmSync(path);
    },
    FERRY as never,
    randomUUID,
  );
  const screen = () => c.game()!.screen();
  const press = (b: Button) => c.game()!.press(b);
  const tap = (label: string) => press(screen().buttons.find((b) => b.label === label)!);
  /** Plays from a fresh game to Bram's choice. */
  const talk = () =>
    ["Offer to fetch Bram's lantern", 'take a brass lantern', 'Talk Bram the ferryman'].map(tap);
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
// (none after a reopen), a replay that decides again or adds a receipt, or a narration kept
// after a new game deleted the receipts.
test('the latest committed narration is read again on reopen, from the receipts', () => {
  const path = save();
  const a = processOn(path);
  const input = played(a);
  a.sql.close();
  const b = processOn(path);
  assert.deepEqual(b.story.narration(), latest(b.sql));
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
