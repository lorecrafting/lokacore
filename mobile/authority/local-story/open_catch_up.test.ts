// Catch-up at open (authority.ts opened; save.md, Opening a story): real SQLite files, a forged
// row or a clamped file. Start over's `remove` must never run: the file is kept.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedBundle, elapsedHost, sqliteHost } from './__tests__/elapsed-host.test.ts';
import { localSession } from './session.ts';

const bundle = elapsedBundle();
const RUN = 'aaaaaaaa-0000-4000-8000-000000000002'; // elapsedHost's first run
const LATER = { wall: 20000, mono: 0 }; // 10 s after the save's 10000, at rate 50: 500 world seconds
const bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const launch = (path: string, prepare = (_: DatabaseSync) => {}, clock = LATER, b = bundle) => {
  const p = sqliteHost(path, clock);
  const session = localSession(
    () => (prepare(p.sql), p.db),
    () => assert.fail('the save file was removed'),
    b,
    { ...p.host, newId: randomUUID },
  );
  return { ...p, session };
};
/** A new save at 10000 and, with the same debt on a copy, the catch-up receipt it would write. */
const saved = () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-open-'));
  const path = join(dir, 'save.db');
  elapsedHost(path, undefined, bundle).sql.close();
  copyFileSync(path, join(dir, 'copy.db'));
  const copy = launch(join(dir, 'copy.db'));
  assert.equal(copy.session.game()!.view().view.time, 65300); // a valid catch-up credits the 500
  const receipt = copy.sql.prepare('SELECT * FROM receipt').get() as Record<string, never>;
  copy.sql.close();
  return { path, receipt };
};

const forgeKind = (kind: string) => (sql: DatabaseSync) =>
  void sql
    .prepare(`UPDATE state_row SET value = json_set(value, '$.job.kind', ?) WHERE section = 'jobs'`)
    .run(kind);

const FORGED: [string, (sql: DatabaseSync, receipt: Record<string, never>) => void][] = [
  [
    'the catch-up command already has a receipt of another intent (a conflict)',
    (sql, receipt) => {
      const row = { ...receipt, intent_digest: 'x'.repeat(64) };
      const columns = Object.keys(row);
      sql
        .prepare(`INSERT INTO receipt (${columns}) VALUES (${columns.map(() => '?')})`)
        .run(...Object.values(row));
    },
  ],
  [
    'a pending job is already due',
    (sql) =>
      void sql
        .prepare(
          `UPDATE state_row SET value = json_set(value, '$.due_time', 64800, '$.job.kind', 'order') WHERE section = 'jobs'`,
        )
        .run(),
  ],
  [
    'a pending NPC job is due at an hour its schedule does not have',
    (sql) =>
      void sql
        .prepare(
          `UPDATE state_row SET value = json_set(value, '$.due_time', 64900) WHERE section = 'jobs'`,
        )
        .run(),
  ],
  // Breaks: load admits a row no handler can run, and its TypeError fails every launch.
  ...['quest', 'bleed', 'room', 'rule', 'tick', 'replenish', 'wage', 'bogus'].map(
    (kind) => [`a pending job of forged kind ${kind}`, forgeKind(kind)] as (typeof FORGED)[number],
  ),
];

// Breaks: a refused catch-up result escapes openGame with no cause, no Start over, on every launch.
for (const [name, forge] of FORGED)
  test(`${name}: open offers Start over, keeps the bytes, and Start over plays`, () => {
    const { path, receipt } = saved();
    const raw = new DatabaseSync(path);
    forge(raw, receipt);
    raw.close();
    const before = bytes(path);
    const a = launch(path);
    try {
      assert.equal(a.session.game(), undefined);
      const failed = a.session.failed()!;
      assert.equal(failed.kind, 'save_corrupt');
      assert.equal(failed.startOver, true);
      assert.equal(bytes(path), before);
      a.session.startOver();
      assert.equal(a.session.failed(), undefined);
      assert.equal(a.session.game()!.view().view.time, 64800); // the calendar's start
      assert.equal(
        a.session.game()!.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
        'saved',
      );
      const { run_id } = a.sql.prepare('SELECT run_id FROM save').get() as { run_id: string };
      assert.notEqual(run_id, RUN);
    } finally {
      a.sql.close();
    }
  });

// Breaks: a refusal rolls back or re-applies a step already settled (save.md, Opening a story).
test('a refusal on the second step keeps the first step, and the next launch changes nothing', () => {
  const { path } = saved();
  const dueSoon = (sql: DatabaseSync) =>
    sql.exec(
      `UPDATE state_row SET value = json_set(value, '$.due_time', 64900, '$.job.kind', 'order') WHERE section = 'jobs'`,
    );
  const raw = new DatabaseSync(path);
  dueSoon(raw);
  raw.close();
  const copyPath = `${path}.steps`;
  copyFileSync(path, copyPath);
  const copy = launch(copyPath);
  const [first, second] = copy.sql
    .prepare('SELECT * FROM receipt ORDER BY revision')
    .all() as Record<string, never>[];
  copy.sql.close();
  const forged = new DatabaseSync(path);
  FORGED[0][1](forged, second);
  forged.close();

  const a = launch(path);
  const kept = a.sql.prepare('SELECT command_id, revision FROM receipt ORDER BY revision').all();
  assert.equal(a.session.failed()!.kind, 'save_corrupt');
  assert.deepEqual(
    kept.map((r) => ({ ...r })),
    [
      { command_id: first.command_id, revision: 1 },
      { command_id: second.command_id, revision: second.revision },
    ],
  );
  a.sql.close();
  const settled = bytes(path);
  const b = launch(path);
  assert.equal(b.session.failed()!.kind, 'save_corrupt');
  b.sql.close();
  assert.equal(bytes(path), settled);
});

// Breaks: a refused open skips the trace catch-up Start over runs before the old receipts go.
test('Start over after a refused catch-up keeps the old run in the trace', () => {
  const { path, receipt } = saved();
  const raw = new DatabaseSync(path);
  FORGED[0][1](raw, receipt);
  raw.close();
  const a = launch(path);
  try {
    a.session.startOver();
    const trace = a.sql.prepare('SELECT record FROM trace').all() as { record: string }[];
    assert.equal(trace.filter((r) => r.record.includes(receipt.command_id)).length, 1);
  } finally {
    a.sql.close();
  }
});

// Breaks: the guard widens to any throw, offering a destructive Start over for a full disk that
// may clear (session.ts: an open that failed for another reason is never started over).
test('a full disk during catch-up at open offers no Start over and keeps the bytes', () => {
  const { path } = saved();
  const before = bytes(path);
  const a = launch(path, (sql) => {
    const { page_count } = sql.prepare('PRAGMA page_count').get() as { page_count: number };
    sql.exec(`PRAGMA max_page_count = ${page_count}`);
  });
  try {
    assert.equal(a.session.game(), undefined);
    const failed = a.session.failed()!;
    assert.match(failed.message, /full/);
    assert.equal(failed.startOver, false);
    assert.equal(bytes(path), before);
  } finally {
    a.sql.close();
  }
});

// Breaks: a kernel fault during catch-up reads as a damaged save, offering to replace an intact run.
test('a kernel fault during catch-up at open keeps the game and its debt, with no refusal', () => {
  const { path } = saved();
  const raw = new DatabaseSync(path);
  raw.exec(
    `UPDATE state_row SET value = json_set(value, '$.due_time', 64900, '$.job.kind', 'population') WHERE section = 'jobs'`,
  );
  raw.close();
  const a = launch(path);
  try {
    assert.equal(a.session.failed(), undefined);
    assert.equal(a.session.game()!.view().view.time, 64800); // nothing settled: the debt remains
  } finally {
    a.sql.close();
  }
});

// Break detected: the load check refusing a lawful save whose wage row the kernel already moved.
test('a wage row the kernel advanced loads', () => {
  const c = JSON.parse(bundle.canonical);
  const ref = { cartridge_id: 'ferry_sampler', cartridge_version: '0.0.1' };
  const member = { ...ref, kind: 'fact', key: 'hired' };
  const resource = { ...ref, kind: 'resource', key: 'ma' };
  c.facts['ferry_sampler@0.0.1:fact/hired'] = {
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    per_subject: true,
    meaning: 'hired',
    key: 'hired',
  };
  c.world = { group: { member, wage: { resource, amount: 3, every: 3600 } } };
  const canonical = encode(c);
  const b = { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
  const path = join(mkdtempSync(join(tmpdir(), 'loka-open-')), 'save.db');
  elapsedHost(path, undefined, b).sql.close();
  const wageDue = (sql: DatabaseSync) =>
    (
      sql.prepare('SELECT value FROM state_row WHERE section = ?').all('jobs') as {
        value: string;
      }[]
    )
      .map((r) => JSON.parse(r.value))
      .filter((r) => r.job.kind === 'wage')
      .map((r) => r.due_time)
      .sort();
  const later = launch(path, undefined, { wall: 90000, mono: 0 }, b); // 4000 world s: one wage due
  later.session.game();
  assert.deepEqual(wageDue(later.sql), [64800 + 3600, 64800 + 7200]); // the run row and the next
  later.sql.close();
  const again = launch(path, undefined, { wall: 90000, mono: 0 }, b);
  assert.equal(again.session.game()!.view().view.time, 64800 + 4000);
  again.sql.close();
});
