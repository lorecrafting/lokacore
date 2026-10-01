// The smoke screen's controller on Node with real SQLite (node:sqlite), one connection per
// simulated process, as local_story.test.ts does. Expected values are literals read from the
// items fixture (protocol/fixtures/cartridge_items_hash.json): the Ferry Landing holds Bram and
// a leather satchel with an exit north to the Village Green.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { openSmoke } from './smoke.ts';

const PENDING = '(pending: not confirmed saved; press any button to retry it)';
type P = (string | number | null)[];
const processOn = (
  path: string,
  tap: (s: string, run: () => unknown) => unknown = (_, r) => r(),
  pageSize = 0,
) => {
  const sql = new DatabaseSync(path);
  if (pageSize) sql.exec(`PRAGMA page_size = ${pageSize}`);
  const smoke = openSmoke(
    {
      execSync: (s) => void tap(s, () => sql.exec(s)),
      isInTransactionSync: () => sql.isTransaction,
      runSync: (s, ...p: P) => tap(s, () => sql.prepare(s).run(...p)),
      getFirstSync: <T>(s: string, ...p: P) =>
        tap(s, () => sql.prepare(s).get(...p) ?? null) as T | null,
      getAllSync: <T>(s: string, ...p: P) => tap(s, () => sql.prepare(s).all(...p)) as T[],
    },
    read('protocol/fixtures/cartridge_items_hash.json') as never,
  );
  const now = () => {
    const { view, text, buttons, log, pending } = smoke.screen();
    return {
      place: text(view.place.title.key),
      carrying: view.inventory.map((e) => text(e.name)),
      buttons: buttons.map((b) => b.label),
      log: [...log],
      pending,
    };
  };
  const press = (label: string) =>
    smoke.press(smoke.screen().buttons.find((b) => b.label === label)!);
  return { sql, smoke, now, press };
};

// Breaks: a button that sends the wrong invocation (target, direction or actor), a world that is
// not committed through the authority, a restart that loads the fresh world instead of the save,
// or invocation ids that restart at 1 after a restart (the receipt of the first take would then
// make the next press a conflict instead of a move).
test('a scripted session survives a restart and plays on', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  assert.equal(a.now().place, 'Ferry Landing');
  assert.deepEqual(a.now().buttons, ['look', 'scan', 'Go north', 'take a leather satchel']);
  a.press('take a leather satchel');
  assert.deepEqual(a.now().carrying, ['a leather satchel']);
  assert.deepEqual(a.now().log, ['> take a leather satchel', 'taken']);
  a.press('Go north');
  assert.equal(a.now().place, 'Village Green');
  a.sql.close();

  const b = processOn(path);
  assert.equal(b.now().place, 'Village Green');
  assert.deepEqual(b.now().carrying, ['a leather satchel']);
  assert.deepEqual(b.now().log, []);
  assert.ok(b.now().buttons.includes('drop a leather satchel'));
  b.press('Go south');
  assert.deepEqual(b.now().log, ['> Go south', 'moved']);
  assert.equal(b.now().place, 'Ferry Landing');
});

// Breaks: the next invocation id taken from the count of receipts. A malformed press saves no
// receipt but used id 1, so the take got id 2; after a restart the count (1) gave id 2 again, which
// the take's receipt answered "(conflict)" instead of moving.
test('an invalid press before a save does not make the next id collide after a restart', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  a.smoke.press({ label: 'bad', action_key: 'NOT A KEY', target_ids: [], input: {} });
  assert.deepEqual(a.now().log, ['> bad', '(invalid)']);
  a.press('take a leather satchel');
  a.sql.close();
  const b = processOn(path);
  b.press('Go north');
  assert.deepEqual(b.now().log, ['> Go north', 'moved']);
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
  a.press('take a leather satchel');
  assert.deepEqual(a.now().log, ['> take a leather satchel', PENDING]);
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
// resending the original: "Go north" (committed, ack lost) answered "You can't: not_found"
// from the new id, not the original's replayed "moved".
test('a pending press is retried with its own id and replays what committed', () => {
  const { p, arm } = lostAck();
  arm();
  p.press('Go north');
  assert.equal(p.now().pending, true);
  p.press('take a leather satchel'); // another button: still retries the north
  assert.deepEqual(p.now().log.slice(-2), ['> Go north', 'moved']);
  assert.equal(p.now().pending, false);
  assert.equal(p.now().place, 'Village Green');
  assert.deepEqual(p.now().carrying, []);
});

// Breaks: the same retry minting a new id, so a committed "scan" ran twice (revision 2).
test('retrying a pending scan does not commit it twice', () => {
  const { p, revision, arm } = lostAck();
  arm();
  p.press('scan');
  p.press('scan');
  assert.equal(revision(), 1);
});

// Breaks: taking the greatest receipt id of the scope: another allocator's id
// (ffffffff-...-000000000001) made the next smoke id 2, which the earlier "Go north" already used
// (a conflict instead of a move).
test('a same-scope receipt from another allocator does not move the id counter', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  a.press('take a leather satchel');
  a.press('Go north');
  a.sql.exec(`INSERT INTO receipt VALUES ('story/smoke', 'ffffffff-0000-4000-8000-000000000001',
    'foreign', 'x', 'loka-intent-v1', 'x', 'null', 2, 'null')`);
  a.sql.close();
  const b = processOn(path);
  b.press('Go south');
  assert.deepEqual(b.now().log, ['> Go south', 'moved']);
});

// Breaks: a definite write failure (real SQLITE_FULL) that leaves the pending retry set and
// logs nothing: "scan" then re-ran the failed "Go north".
test('a definite write failure is logged and the next press is a new action', () => {
  const p = processOn(
    join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db'),
    undefined,
    512, // a receipt then needs new pages, which max_page_count forbids
  );
  const one = (q: string) => Object.values(p.sql.prepare(q).get()!)[0];
  p.sql.exec(`PRAGMA max_page_count = ${one('PRAGMA page_count')}`);
  p.press('Go north');
  const failed = p.now();
  assert.equal(failed.pending, false);
  assert.equal(failed.log[0], '> Go north');
  assert.match(failed.log[1], /^\(not saved: .*full/i);
  assert.equal(one('SELECT revision FROM head'), 0);
  assert.equal(failed.place, 'Ferry Landing');
  p.sql.exec('PRAGMA max_page_count = 1000000');
  p.press('scan');
  assert.equal(p.now().log[2], '> scan');
});
