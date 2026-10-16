// Toolbox row FD6, the Chronicle's host read (mechanics.md, Chronicle): hand-built receipts.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { chronicle } from './narration.ts';
import type { Story } from './save.ts';

const SCOPE = 'story/lineage/player';
const story = (sql: DatabaseSync) =>
  ({
    db: { getAllSync: (query: string, scope: string) => sql.prepare(query).all(scope) },
    meta: { lineage_id: 'lineage' },
    fresh: { state: { clock: 0 } },
    world: {
      character: 'player',
      state: { clock: 500_000 }, // the clock now: never a past receipt's day
      cartridge: { world: { combat: { narration: { player_hit: 'strike' } } } },
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
function chronicled(...responses: object[]) {
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
    const first = chronicle(story(sql)).map((e) => [e.day, e.record.lines[0].key, e.milestone]);
    sql.close();
    sql = new DatabaseSync(path); // reopened: the same entries, read from storage
    assert.deepEqual(
      chronicle(story(sql)).map((e) => [e.day, e.record.lines[0].key, e.milestone]),
      first,
    );
    return first;
  } finally {
    sql.close();
    rmSync(folder, { recursive: true, force: true });
  }
}

// Breaks: the clock folds from the receipt before (r2 lands on day 1); rejected receipts or
// combat-only receipts appear; the day drops its `+ 1`; another character's receipts appear.
test('accepted receipts with World lines, each on the day of the clock after it', () => {
  assert.deepEqual(
    chronicled(
      accepted(['A']),
      accepted(['maud.leaves'], [advance(90_000)]),
      accepted(['B'], [], ['story_point_reached']),
      { kind: 'rejected', error: { code: 'not_here' }, narration: [{ key: 'R' }] },
      accepted(['strike'], [], ['attack_result']),
    ),
    [
      [1, 'A', false],
      [2, 'maud.leaves', false],
      [2, 'B', true],
    ],
  );
});

// Breaks: a day boundary compared with `>` (86400 stays on day 1); the first advance of a receipt
// counts instead of its last.
test('a day begins at exactly one legacy day; a receipt counts its last advance', () => {
  assert.deepEqual(chronicled(accepted(['A'], [advance(86_399)])), [[1, 'A', false]]);
  assert.deepEqual(chronicled(accepted(['A'], [advance(86_400)])), [[2, 'A', false]]);
  assert.deepEqual(chronicled(accepted(['A'], [advance(86_400), advance(10)])), [[1, 'A', false]]);
});
