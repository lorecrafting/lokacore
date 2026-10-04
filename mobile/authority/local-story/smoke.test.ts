// The smoke screen's controller on Node with real SQLite (node:sqlite), one connection per
// simulated process, as local_story.test.ts does. Expected values are literals read from the
// items fixture (protocol/fixtures/cartridge_items_hash.json): the Ferry Landing holds Bram and
// a leather satchel with an exit north to the Village Green.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { presenter } from '../../app/book/presenter.ts';
import type { Game } from '../../packages/game-view/session.ts';
import { localSession, openGame } from './session.ts';
import type { Db } from './store.ts';

type P = (string | number | null)[];
const ITEMS = read('protocol/fixtures/cartridge_items_hash.json') as never;
const adapt = (
  sql: DatabaseSync,
  tap: (s: string, run: () => unknown) => unknown = (_, r) => r(),
): Db => ({
  execSync: (s) => void tap(s, () => sql.exec(s)),
  isInTransactionSync: () => sql.isTransaction,
  runSync: (s, ...p: P) => tap(s, () => sql.prepare(s).run(...p)),
  getFirstSync: <T>(s: string, ...p: P) =>
    tap(s, () => sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: P) => tap(s, () => sql.prepare(s).all(...p)) as T[],
});
const processOn = (
  path: string,
  tap?: (s: string, run: () => unknown) => unknown,
  pageSize = 0,
) => {
  const sql = new DatabaseSync(path);
  if (pageSize) sql.exec(`PRAGMA page_size = ${pageSize}`);
  const game = openGame(adapt(sql, tap), ITEMS, {
    newId: randomUUID,
    kernel_version: `loka-kernel@${'0'.repeat(40)}`,
  });
  return { sql, game, ...screenOf(game) };
};
// ponytail: the presenter (app/book) is this file's harness, so the authority tests still drive presses by
// label and read the log; test-only, a stub Game would hide the real session.
const shown = new WeakMap<Game, ReturnType<typeof presenter>>();
const at = (g: Game) => shown.get(g) ?? shown.set(g, presenter(g)).get(g)!;
const screenOf = (game: Game) => {
  const p = at(game);
  return {
    now: () => {
      const { view, text, buttons, log, pending, fault } = p.screen();
      return {
        place: text(view.place.title.key),
        carrying: view.inventory.map((e) => text(e.name)),
        buttons: buttons.map((b) => b.label),
        log: [...log],
        pending,
        fault,
      };
    },
    press: (label: string) => p.press(p.screen().buttons.find((b) => b.label === label)!),
  };
};

// Breaks: a button that sends the wrong invocation (target, direction or actor), a world that is
// not committed through the authority, a restart that loads the fresh world instead of the save,
// or invocation ids that restart at 1 after a restart (the receipt of the first take would then
// make the next press a conflict instead of a move).
test('a scripted session survives a restart and plays on', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  assert.equal(a.now().place, 'Ferry Landing');
  assert.deepEqual(a.now().buttons, [
    'Look',
    'Scan',
    'Go north',
    'Take a leather satchel',
    'Take a flask of lamp oil',
  ]);
  a.press('Take a leather satchel');
  assert.deepEqual(a.now().carrying, ['a leather satchel']);
  assert.deepEqual(a.now().log, ['You pick up a leather satchel.']);
  a.press('Go north');
  assert.equal(a.now().place, 'Village Green');
  a.sql.close();

  const b = processOn(path);
  assert.equal(b.now().place, 'Village Green');
  assert.deepEqual(b.now().carrying, ['a leather satchel']);
  assert.deepEqual(b.now().log, []);
  assert.ok(b.now().buttons.includes('Drop a leather satchel'));
  b.press('Go south');
  assert.deepEqual([b.now().log, b.now().place], [[], 'Ferry Landing']);
});

// Breaks: the next invocation id taken from the count of receipts. A malformed press saves no
// receipt but used id 1, so the take got id 2; after a restart the count (1) gave id 2 again, which
// the take's receipt answered "(conflict)" instead of moving.
test('an invalid press before a save does not make the next id collide after a restart', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  at(a.game).press({ label: 'bad', action_key: 'NOT A KEY', target_ids: [], input: {} });
  assert.deepEqual(a.now().log, ['(invalid)']);
  a.press('Take a leather satchel');
  a.sql.close();
  const b = processOn(path);
  b.press('Go north');
  assert.deepEqual([b.now().log, b.now().place], [[], 'Village Green']);
});

// Breaks (03 §15): a press whose COMMIT outcome is unknown shown as a success (the satchel carried,
// "taken"), or no pending flag for the view; a restart then loads what really committed. Simulated
// fault: the connection breaks right after the real COMMIT, as in local_story.test.ts.
test('an unknown COMMIT shows pending, not a success; a restart shows what committed', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  let arm = false;
  const a: ReturnType<typeof processOn> = processOn(path, (s, run) => {
    const out = run();
    if (!arm || s !== 'COMMIT') return out;
    arm = false;
    a.sql.close();
    throw new Error('connection lost');
  });
  arm = true;
  a.press('Take a leather satchel');
  assert.deepEqual(a.now().log, []);
  assert.equal(a.now().pending, true);
  assert.deepEqual(a.now().carrying, []);
  const b = processOn(path);
  assert.equal(b.now().pending, false);
  assert.deepEqual(b.now().carrying, ['a leather satchel']);
});

// A lost COMMIT acknowledgement whose first reconcile read also fails: the attempt is pending
// until the next press, which settles it.
const lostAck = () => {
  let stage = 0;
  const tap = (s: string, run: () => unknown) => {
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
  const p = processOn(join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db'), tap);
  const revision = () =>
    (p.sql.prepare('SELECT revision FROM head').get() as { revision: number }).revision;
  return { p, revision, arm: () => (stage = 1) };
};

// Breaks (03 §§14-15): a retry of an unconfirmed press that mints a new invocation id instead of
// resending the original: "Go north" (committed, ack lost) answered "You can't do that: not here."
// from the new id, not the original's replayed move (which adds no answer line).
test('a pending press is retried with its own id and replays what committed', () => {
  const { p, arm } = lostAck();
  arm();
  p.press('Go north');
  assert.equal(p.now().pending, true);
  p.press('Take a leather satchel'); // another button: still retries the north
  assert.deepEqual(p.now().log, []);
  assert.equal(p.now().pending, false);
  assert.equal(p.now().place, 'Village Green');
  assert.deepEqual(p.now().carrying, []);
});

// Breaks: taking the greatest receipt id of the scope: another allocator's id
// (ffffffff-...-000000000001) made the next smoke id 2, which the earlier "Go north" already used
// (a conflict instead of a move).
test('a same-scope receipt from another allocator does not move the id counter', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  a.press('Take a leather satchel');
  a.press('Go north');
  a.sql.exec(`INSERT INTO receipt VALUES ('story/smoke', 'ffffffff-0000-4000-8000-000000000001',
    'foreign', 'x', 'loka-intent-v1', 'x', 'null', 2, 'null')`);
  a.sql.close();
  const b = processOn(path);
  b.press('Go south');
  assert.deepEqual(b.now().log, []);
  assert.equal(b.now().place, 'Ferry Landing');
});

// Breaks: a throw shown as "not saved" with the retry cleared (a read error can follow a durable
// commit), hides the visible fault, or clears the original retry. A real SQLITE_FULL
// (512-byte page, max_page_count clamped); lifting the clamp, the next press resends "Go north".
test('a failed write is not claimed unsaved; the next press retries it', () => {
  const p = processOn(join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db'), undefined, 512);
  const one = (q: string) => Object.values(p.sql.prepare(q).get()!)[0];
  p.sql.exec(`PRAGMA max_page_count = ${one('PRAGMA page_count')}`);
  p.press('Go north');
  assert.equal(p.now().pending, true);
  assert.match(p.now().fault!, /full/i);
  assert.deepEqual(p.now().log, []);
  assert.equal(one('SELECT revision FROM head'), 0);
  p.sql.exec('PRAGMA max_page_count = 1000000');
  p.press('Scan');
  assert.deepEqual(p.now().log, []);
  assert.equal(p.now().place, 'Village Green');
  assert.equal(p.now().pending, false);
  assert.equal(p.now().fault, undefined); // a stale fault would keep offering start over
});

// Breaks: after "scan" committed with its ack lost, a retry whose receipt lookup fails clears the
// attempt as "not saved"; the next press then mints a new id and commits scan again (revision 2).
test('a read error after a durable commit does not commit the press twice', () => {
  let reads = 0; // receipt reads since the ack was lost
  let armed = false;
  let lost = false;
  const tap = (s: string, run: () => unknown) => {
    if (lost && s.startsWith('SELECT * FROM receipt') && [1, 3].includes(++reads))
      throw new Error('read failed');
    const out = run();
    if (armed && !lost && s === 'COMMIT') {
      lost = true;
      throw new Error('COMMIT acknowledgement lost');
    }
    return out;
  };
  const p = processOn(join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db'), tap);
  armed = true;
  p.press('Scan'); // committed, ack lost, first reconcile read fails: pending
  p.press('Scan'); // reconcile reads, then the receipt lookup fails
  p.press('Scan'); // the receipt is read: replayed, not applied again
  assert.equal(p.sql.prepare('SELECT revision FROM head').get()!.revision, 1);
  assert.equal(p.now().pending, false);
});

// Breaks (03 §14; R6P-A03): a receipt that is not a DecisionResult replayed as saved, or its
// conflict leaving pending set, so every later button retries the confirmed "scan".
test('a confirmed receipt that is not a decision is a conflict and ends the attempt', () => {
  const { p, arm } = lostAck();
  arm();
  p.press('Scan'); // committed, ack lost, first reconcile read fails: pending
  p.sql.exec(
    `UPDATE receipt SET response = '{"kind":"accepted","narration":5,"outcome":"scanned"}'`,
  );
  p.press('Scan'); // settles, finds the receipt, which is not a decision
  assert.equal(p.now().pending, false);
  p.press('Go north');
  assert.deepEqual(p.now().log, []);
  assert.equal(p.now().place, 'Village Green');
});

// The app's save file under localSession, as App.tsx wires it: `remove` closes the handle and deletes
// the file, as expo's closeSync and deleteDatabaseSync do (the main file only).
// `fail` names a step that throws: 'open' always (as expo's open can), 'remove' once.
const app = (path: string, fail?: 'open' | 'remove', tap?: Parameters<typeof adapt>[1]) => {
  let sql: DatabaseSync | undefined;
  const c = localSession(
    () => {
      if (fail === 'open') throw new Error('disk I/O error');
      return adapt((sql = new DatabaseSync(path)), tap);
    },
    () => {
      sql?.close(); // as App.tsx: the handle is closed once, then forgotten
      sql = undefined;
      if (fail === 'remove') {
        fail = undefined;
        throw new Error('could not delete');
      }
      rmSync(path);
    },
    ITEMS,
    { newId: randomUUID, kernel_version: `loka-kernel@${'0'.repeat(40)}` },
  );
  const now = () => screenOf(c.game()!).now();
  const press = (l: string) => screenOf(c.game()!).press(l);
  const startOver = () => at(c.game()!).startOverFailed(c.startOver()); // as Book logs it
  return { c, sql: () => sql!, now, press, startOver };
};

/** A save at revision 1 (the satchel taken) whose index `name` has its b-tree page type byte broken. */
const damaged = (name: string) => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  a.press('Take a leather satchel');
  const at = (q: string) => Number(Object.values(a.sql.prepare(q).get()!)[0]);
  const root = at(`SELECT rootpage FROM sqlite_master WHERE name = '${name}'`);
  const offset = (root - 1) * at('PRAGMA page_size');
  a.sql.close();
  const file = readFileSync(path);
  file[offset] = 0xff;
  writeFileSync(path, file);
  return path;
};

// Breaks: a failed save with no Start over button (the NOTADB file has a replace, no new game); start over that keeps the file: a NOTADB file cannot be repaired on its handle (its new
// game throws), so reopening the same bytes fails again; or a start over that throws. A corrupt
// receipt id index fails the open untyped (the smoke's next-id read uses it): no new game, same
// file replace.
test('start over replaces a file that does not open with a fresh game', () => {
  const notadb = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  writeFileSync(notadb, Buffer.alloc(4096, 'x'));
  const index = damaged('sqlite_autoindex_receipt_1');
  for (const [path, kind] of [
    [notadb, 'save_corrupt'],
    [index, undefined],
  ]) {
    const a = app(path!);
    assert.equal(a.c.failed()?.kind, kind, path);
    assert.equal(a.c.failed()?.startOver, true, path); // else SaveError shows no Start over: a trap
    a.c.startOver();
    assert.equal(a.c.failed(), undefined, path);
    assert.equal(a.now().place, 'Ferry Landing');
    a.press('Go north');
    assert.deepEqual(a.now().log, []);
    assert.equal(a.now().place, 'Village Green');
    assert.equal(readFileSync(path!).subarray(0, 16).toString('latin1'), 'SQLite format 3\0');
  }
});

// Breaks: start over that always deletes the file, even where the authority's new game repairs it
// in place: the old run's trace (and any pending report) is lost, so only the new run is traced.
// A damaged identity (its format name rewritten) is save_corrupt with a new game (saves.test.ts).
test('start over of a damaged identity keeps the file and its old run', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  a.press('Take a leather satchel');
  a.sql.exec("UPDATE save SET format = 'loka-save-x'");
  a.sql.close();
  const b = app(path);
  assert.equal(b.c.failed()?.kind, 'save_corrupt');
  b.c.startOver();
  assert.deepEqual(b.now().carrying, []);
  const runs = b.sql().prepare("SELECT count(DISTINCT record ->> '$.ids.run_id') AS n FROM trace");
  assert.equal(runs.get()!.n, 2);
});

// Breaks: a malformed receipt command-id index (the reopen's narration read uses it, R6P P5b)
// swallowed so the save plays on, or thrown out of the open (a crash on the phone) with no start
// over; or a start over that cannot get past it.
test('a damaged receipt index fails the open with start over, which gives a fresh game', () => {
  const b = app(damaged('sqlite_autoindex_receipt_2'));
  assert.equal(b.c.game(), undefined);
  assert.match(b.c.failed()!.message, /malformed/);
  assert.equal(b.c.failed()!.replace, true);
  b.c.startOver();
  assert.equal(b.now().place, 'Ferry Landing');
  assert.deepEqual(b.now().carrying, []);
  b.press('Go north');
  assert.deepEqual(b.now().log, []);
  assert.equal(b.now().place, 'Village Green');
});

// Breaks (10 §32; saves.test.ts): start over of a newer app's save, destroying it instead of
// asking for an app update. Its format is a higher loka-save-vN.
test("a newer app's save is never started over", () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  a.press('Take a leather satchel');
  a.sql.exec("UPDATE save SET format = 'loka-save-v3'");
  a.sql.close();
  const before = readFileSync(path);
  const b = app(path);
  assert.equal(b.c.failed()?.kind, 'unsupported_save_format');
  b.c.startOver();
  assert.equal(b.c.failed()?.kind, 'unsupported_save_format');
  b.sql().close();
  assert.deepEqual(readFileSync(path), before);
});

// Breaks: a start over whose delete failed (expo's can throw) offering no start over again, so the
// player is stuck on the error screen until a restart.
test('a start over whose delete failed can be tried again', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  writeFileSync(path, Buffer.alloc(4096, 'x'));
  const a = app(path, 'remove');
  a.c.startOver();
  assert.equal(a.c.failed()?.message, 'could not delete');
  a.c.startOver();
  assert.equal(a.now().place, 'Ferry Landing');
});

// Breaks: start over deleting a save whose open failed for a reason other than corruption (a full
// disk, an I/O error): the save may be intact once the cause is gone, so nothing is offered.
test('an open that fails but not as corrupt is never started over', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  processOn(path).sql.close();
  const before = readFileSync(path);
  const a = app(path, 'open');
  assert.equal(a.c.failed()?.message, 'disk I/O error');
  a.c.startOver();
  assert.deepEqual(readFileSync(path), before);
});

// Breaks: a start over during play that fails (here every write refused: PRAGMA query_only)
// dropping the game being played, so the press can no longer be retried; or its failure kept as
// state that outlives the play's recovery (shown again beside a later, unrelated fault).
test('a start over that fails during play keeps the game and its retry', () => {
  const a = app(join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db'));
  a.sql().exec('PRAGMA query_only = 1');
  a.press('Go north');
  assert.match(a.now().fault!, /readonly/);
  a.startOver();
  assert.equal(a.now().log.at(-1), '(start over: attempt to write a readonly database)');
  assert.equal(a.c.failed(), undefined); // a cached failure would outlive the play's recovery
  a.sql().exec('PRAGMA query_only = 0');
  a.press('Scan');
  assert.deepEqual(a.now().log, []);
  assert.equal(a.now().place, 'Village Green');
});

// Breaks (03 §15): a start over whose COMMIT outcome is unknown leaving the old game playable: its
// next press settles the new game, then applies the abandoned run's move to it. The ack is lost and
// the first reconcile read fails, as lostAck stages it; the next start over settles it.
test('a pending start over leaves no game to play until it settles', () => {
  let stage = 0;
  const a = app(join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db'), undefined, (s, run) => {
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
  });
  a.press('Go north');
  stage = 1;
  a.c.startOver();
  assert.equal(a.c.game(), undefined);
  a.c.startOver();
  assert.equal(a.now().place, 'Ferry Landing');
  assert.deepEqual(a.now().log, []);
});

// Gate R6 (docs/evidence/2026-09-30-gate-r6-iphone11/README.md): the tap script the owner plays on
// the phone, its three kill points (a kill after tap N is a close and reopen), and the end state
// declared in advance. The state literals are hand-checked: seven accepted commands, so revision
// 7; the satchel dropped at the Village Green, the player back at the Ferry Landing.
const GATE_TAPS = [
  'Take a leather satchel',
  'Go north',
  'Go south',
  'Scan',
  'Go north',
  'Drop a leather satchel',
  'Go south',
];
const GATE_KILLS = [2, 5, 6];
const gateRun = (kills: number[]) => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-gate-')), 'save.db');
  let p = processOn(path);
  GATE_TAPS.forEach((label, i) => {
    p.press(label);
    if (!kills.includes(i + 1)) return;
    p.sql.close();
    p = processOn(path);
  });
  return { path, p };
};
/** What the gate compares: the head, every world row and the receipt count. */
const dump = (path: string) => {
  const sql = new DatabaseSync(path, { readOnly: true });
  const all = (q: string) => sql.prepare(q).all();
  const out = {
    head: all('SELECT * FROM head'),
    rows: all('SELECT * FROM state_row ORDER BY section, key'),
    receipts: (all('SELECT count(*) AS n FROM receipt')[0] as { n: number }).n,
  };
  sql.close();
  return out;
};

// Breaks: a tap that sends the wrong invocation, or a restart that loses or repeats a press, so the
// script ends anywhere but revision 7 at the Ferry Landing with an empty satchel slot; or an end
// state that depends on where the kills fall.
test('the gate tap script ends at its declared state, wherever the kills fall', () => {
  const { path, p } = gateRun(GATE_KILLS);
  assert.equal(p.now().place, 'Ferry Landing');
  assert.deepEqual(p.now().carrying, []);
  assert.deepEqual(p.now().buttons, ['Look', 'Scan', 'Go north']);
  p.sql.close();
  const end = dump(path);
  assert.deepEqual(
    end.head.map((h) => h.revision),
    [7],
  );
  assert.equal(end.receipts, 7);
  assert.deepEqual(end, dump(gateRun([]).path));
});

// The device comparison: LOKA_DEVICE_DB names the save copied off the phone after the run.
test(
  'the save copied from the phone equals the reference',
  { skip: !process.env.LOKA_DEVICE_DB },
  () => {
    assert.deepEqual(dump(process.env.LOKA_DEVICE_DB!), dump(gateRun(GATE_KILLS).path));
  },
);
