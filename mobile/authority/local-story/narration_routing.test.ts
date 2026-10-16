import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { narration } from './narration.ts';
import type { Story } from './save.ts';

// Break: background combat shares an ambient receipt and loses line routing on a cold reopen.
test('committed combat line indices come from pinned keys and structured receipt events', () => {
  const folder = mkdtempSync(join(tmpdir(), 'loka-narration-'));
  const path = join(folder, 'save.db');
  let sql = new DatabaseSync(path);
  const story = () =>
    ({
      db: {
        isInTransactionSync: () => sql.isTransaction,
        getFirstSync: (query: string, scope: string) => sql.prepare(query).get(scope),
      },
      meta: { lineage_id: 'lineage' },
      world: {
        character: 'player',
        cartridge: {
          world: {
            combat: { narration: { player_hit: 'authored.strike', npc_died: 'authored.fall' } },
          },
        },
      },
    }) as unknown as Story;
  try {
    sql.exec(
      "CREATE TABLE receipt(command_id TEXT, response TEXT, scope TEXT, revision INTEGER, command TEXT DEFAULT 'null')",
    );
    const lines = [
      { key: 'bell' },
      { key: 'authored.strike' },
      { key: 'door' },
      { key: 'authored.fall' },
    ];
    const decision = {
      kind: 'accepted',
      outcome: 'waited',
      delta: { ops: [] },
      events: [{ payload: { type: 'attack_result' } }],
      narration: lines,
    };
    sql
      .prepare('INSERT INTO receipt(command_id, response, scope, revision) VALUES (?, ?, ?, ?)')
      .run('round', JSON.stringify(decision), 'story/lineage/player', 1);
    assert.deepEqual(narration(story()), { command_id: 'round', lines, combat_lines: [1, 3] });
    sql.close();
    sql = new DatabaseSync(path);
    assert.deepEqual(narration(story()), { command_id: 'round', lines, combat_lines: [1, 3] });
    // The same text key without a combat occurrence remains an ordinary authored room event.
    sql.prepare('UPDATE receipt SET response = ?').run(JSON.stringify({ ...decision, events: [] }));
    assert.deepEqual(narration(story()), { command_id: 'round', lines });
    // A root escape has an encounter close, not an attack event, and still routes to combat.
    sql.prepare('UPDATE receipt SET response = ?').run(
      JSON.stringify({
        ...decision,
        outcome: 'fled',
        events: [],
        delta: { ops: [{ op: 'encounter.close', writer_group: 0 }] },
        narration: [{ key: 'escape' }],
      }),
    );
    assert.deepEqual(narration(story()), {
      command_id: 'round',
      lines: [{ key: 'escape' }],
      combat_lines: [0],
    });
    // Any other command's root close (not an engage or flee) keeps its lines in the World log.
    sql.prepare('UPDATE receipt SET response = ?').run(
      JSON.stringify({
        ...decision,
        events: [],
        delta: { ops: [{ op: 'encounter.close', writer_group: 0 }] },
      }),
    );
    assert.deepEqual(narration(story()), { command_id: 'round', lines });
    // Break (loka-x6t.32): a move that opens an encounter (a hostile engage) leaves its engage line
    // in the World log; the opening receipt's narration is all combat (book-ui.md, Opening).
    const engage = [{ key: 'fall' }, { key: 'npc.warden.engage' }];
    const moved = (writer_group: number) =>
      JSON.stringify({
        ...decision,
        outcome: 'moved',
        events: [],
        delta: { ops: [{ op: 'encounter.open', writer_group }] },
        narration: engage,
      });
    sql.prepare('UPDATE receipt SET response = ?').run(moved(0));
    assert.deepEqual(narration(story()), {
      command_id: 'round',
      lines: engage,
      combat_lines: [0, 1],
    });
    // A dependent group's open (a reaction's) is not this command's encounter root.
    sql.prepare('UPDATE receipt SET response = ?').run(moved(1));
    assert.deepEqual(narration(story()), { command_id: 'round', lines: engage });
  } finally {
    sql.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
