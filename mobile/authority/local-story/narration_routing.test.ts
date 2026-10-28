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
            death: { narration: { woke: 'authored.woke' } },
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
    // A later writer group's open (a reaction or timed job's engage) is combat too (PM, #406).
    sql.prepare('UPDATE receipt SET response = ?').run(moved(1));
    assert.deepEqual(narration(story()), {
      command_id: 'round',
      lines: engage,
      combat_lines: [0, 1],
    });
    // Break (loka-x6t.30): a round where every blow was status-skipped has no attack event; its
    // skip lines (engine or authored key, each binding status) still belong to combat, and the
    // same authored key told elsewhere without the binding does not.
    const stunned = { status: 'condition.stunned' };
    const skips = [
      { key: 'bell' },
      { key: 'combat.skipped', bindings: stunned },
      { key: 'authored.skip', bindings: stunned },
      { key: 'authored.skip' },
    ];
    sql
      .prepare('UPDATE receipt SET response = ?')
      .run(JSON.stringify({ ...decision, events: [], narration: skips }));
    assert.deepEqual(narration(story()), {
      command_id: 'round',
      lines: skips,
      combat_lines: [1, 2],
    });
    // Break (loka-glj8): the room reached does not open at a flight's ran_in or a fight's death
    // woke line, or a death off the fight (a bleed, no combat page) loses its lines before woke.
    const cut = (outcome: string, d: object, keys: string[]) => {
      sql
        .prepare('UPDATE receipt SET response = ?')
        .run(
          JSON.stringify({ ...decision, outcome, ...d, narration: keys.map((key) => ({ key })) }),
        );
      const { arrival, combat_lines } = narration(story())!;
      return [arrival, combat_lines];
    };
    const close = { events: [], delta: { ops: [{ op: 'encounter.close', writer_group: 0 }] } };
    assert.deepEqual(cut('fled', close, ['combat.fled', 'combat.ran_in', 'crows']), [1, [0, 1, 2]]);
    assert.deepEqual(cut('waited', {}, ['authored.strike', 'authored.woke']), [1, [0]]);
    assert.deepEqual(cut('waited', { events: [] }, ['bleed', 'authored.woke']), [
      undefined,
      undefined,
    ]);
  } finally {
    sql.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
