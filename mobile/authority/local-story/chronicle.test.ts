// Toolbox row FD6, the Chronicle's host read (mechanics.md, Chronicle): hand-built receipts.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { chronicle } from './chronicle.ts';
import type { Story } from './save.ts';

const SCOPE = 'story/lineage/player';
const story = (sql: DatabaseSync, calendar?: object) =>
  ({
    db: {
      getAllSync: (query: string, scope: string) => sql.prepare(query).all(scope),
      isInTransactionSync: () => sql.isTransaction,
    },
    meta: { lineage_id: 'lineage' },
    fresh: { state: { clock: 0 } },
    world: {
      character: 'player',
      state: { clock: 500_000 }, // the clock now: never a past receipt's day
      cartridge: { calendar, world: { combat: { narration: { player_hit: 'strike' } } } },
    },
  }) as unknown as Story;
const accepted = (narration: string[], ops: object[] = [], events: string[] = []) => ({
  kind: 'accepted',
  outcome: 'waited',
  delta: { ops },
  events: events.map((type) => ({ payload: { type } })),
  narration: narration.map((key) => ({ key })),
});
const advance = (to: number) => ({ op: 'time.advance', from: 0, to, writer_group: 0 });
function chronicled(responses: object[], calendar?: object, open?: true) {
  const folder = mkdtempSync(join(tmpdir(), 'loka-chronicle-'));
  const path = join(folder, 'save.db');
  let sql = new DatabaseSync(path);
  try {
    sql.exec(
      "CREATE TABLE receipt(command_id TEXT, response TEXT, scope TEXT, revision INTEGER, command TEXT DEFAULT 'null')",
    );
    const insert = sql.prepare(
      'INSERT INTO receipt(command_id, response, scope, revision) VALUES (?, ?, ?, ?)',
    );
    // Inserted newest first: the read orders by revision, not by row order.
    responses.forEach((_, i) => {
      const n = responses.length - i;
      insert.run(`r${n}`, JSON.stringify(responses[n - 1]), SCOPE, n);
    });
    insert.run('other', JSON.stringify(accepted(['X'])), 'story/lineage/other', 1);
    if (open) sql.exec('BEGIN'); // an unknown COMMIT whose ROLLBACK failed
    const first = chronicle(story(sql, calendar)).map((e) => [
      e.day,
      e.record.lines[0].key,
      e.milestone,
    ]);
    if (open) sql.exec('ROLLBACK');
    sql.close();
    sql = new DatabaseSync(path); // reopened: the same entries, read from storage
    assert.deepEqual(
      chronicle(story(sql, calendar)).map((e) => [e.day, e.record.lines[0].key, e.milestone]),
      open ? [[1, 'A', false]] : first,
    );
    return first;
  } finally {
    sql.close();
    rmSync(folder, { recursive: true, force: true });
  }
}

// Breaks: the clock folds from the receipt before (r2 lands on day 1); rejected receipts or
// combat-only receipts appear; the day drops its `+ 1`; another character's receipts appear; an old
// receipt the latest-narration checks refuse against today's world (a riddle answer) throws.
test('accepted receipts with World lines, each on the day of the clock after it', () => {
  assert.deepEqual(
    chronicled([
      accepted(['A']),
      accepted(['maud.leaves'], [advance(90_000)]),
      accepted(['B'], [], ['story_point_reached']),
      { kind: 'rejected', error: { code: 'not_here' }, narration: [{ key: 'R' }] },
      accepted(['strike'], [], ['attack_result']),
      { ...accepted(['C']), outcome: 'riddle_wrong' },
    ]),
    [
      [1, 'A', false],
      [2, 'maud.leaves', false],
      [2, 'B', true],
      [2, 'C', false],
    ],
  );
});

// Breaks: a day boundary compared with `>` (86400 stays on day 1); the first advance of a receipt
// counts instead of its last.
test('a day begins at exactly one legacy day; a receipt counts its last advance', () => {
  assert.deepEqual(chronicled([accepted(['A'], [advance(86_399)])]), [[1, 'A', false]]);
  assert.deepEqual(chronicled([accepted(['A'], [advance(86_400)])]), [[2, 'A', false]]);
  assert.deepEqual(chronicled([accepted(['A'], [advance(86_400), advance(10)])]), [
    [1, 'A', false],
  ]);
});

// Break: the day length ignores the cartridge's calendar (a legacy 86400 keeps 1000 on day 1).
test('an authored calendar sets the day length', () => {
  const calendar = { units_per_hour: 100, hours_per_day: 10 };
  assert.deepEqual(chronicled([accepted(['A'], [advance(999)])], calendar), [[1, 'A', false]]);
  assert.deepEqual(chronicled([accepted(['A'], [advance(1000)])], calendar), [[2, 'A', false]]);
});

// Break: a read inside an open transaction lists receipts that may never commit (narration's guard).
test('an open transaction lists nothing; the committed rows return after it ends', () => {
  assert.deepEqual(chronicled([accepted(['A'])], undefined, true), []);
});
