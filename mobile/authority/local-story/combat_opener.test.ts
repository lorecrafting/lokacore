import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bundle, fresh, rat, room } from '../../../kernel/ts/test/combat_fixture.ts';
import { engaged } from '../../../kernel/ts/src/mechanics/combat/shared.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
const at = (path: string) => {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  p.sql
    .prepare('INSERT OR REPLACE INTO state_row VALUES (?,?,?)')
    .run('containers', fresh.body, JSON.stringify(room(fresh, 'lantern_cellar')));
  const story = openStory(p.db, releases, p.host);
  if (story.kind !== 'open') throw new Error('test setup');
  return { ...p, story };
};

// The Combat title reads who opened the fight from its opening receipt (book-ui.md, Live combat response).
test('the opener of a fight comes from its receipt, survives a cold reopen and is per encounter', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'loka-opener-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const path = join(directory, 'save.db');
  const p = at(path);
  const attack = {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000001',
    actor_id: fresh.character,
    action_key: 'attack',
    target_ids: [rat(fresh)],
    input: {},
  };
  assert.equal(p.story.invoke(attack).kind, 'saved');
  const fight = engaged(p.story.world(), fresh.body)!.id;
  // Breaks: an Attack reads as the NPC's doing, or the npc is not the one on encounter.open.
  assert.deepEqual(p.story.opener(fight), { npc_id: rat(fresh), player: true });
  // Breaks: any receipt's encounter.open answers, whatever encounter was asked.
  assert.equal(p.story.opener('00000000-0000-4000-8000-0000000000ff'), undefined);
  // More fights in the same world, each a copy of the first receipt opened by another command.
  const copy = (type: string, encounter: string, npc: string) =>
    p.sql
      .prepare(
        `INSERT INTO receipt SELECT scope, ?, ?, actor_id, intent_digest_version, intent_digest,
           json_set(command, '$.payload.type', ?), revision, replace(replace(response, ?, ?), ?, ?)
         FROM receipt WHERE rowid = 1`,
      )
      .run(encounter, encounter, type, fight, encounter, rat(fresh), npc);
  copy('move', 'second-fight', rat(fresh, 3)); // the NPC's: a move into a hostile's room
  copy('cast', 'cast-fight', 'cast-npc');
  copy('perform', 'perform-fight', 'perform-npc');
  // Breaks: a lookup inside the commit transaction answers with (or caches the miss of) rows that
  // may never commit; the same lookup after COMMIT answers.
  p.sql.exec('BEGIN');
  copy('attack', 'open-fight', 'open-npc');
  assert.equal(p.story.opener('open-fight'), undefined);
  p.sql.exec('COMMIT');
  assert.deepEqual(p.story.opener('open-fight'), { npc_id: 'open-npc', player: true });
  p.sql.close();

  // Breaks: the opener lives only in memory, so a reload loses the title.
  const q = at(path);
  assert.deepEqual(q.story.opener(fight), { npc_id: rat(fresh), player: true });
  // Breaks: a second fight answers with the first fight's opener, or a move reads as the player's attack.
  assert.deepEqual(q.story.opener('second-fight'), { npc_id: rat(fresh, 3), player: false });
  // Breaks: a spell's or a performance's fight-back reads as the foe's attack.
  assert.deepEqual(q.story.opener('cast-fight'), { npc_id: 'cast-npc', player: true });
  assert.deepEqual(q.story.opener('perform-fight'), { npc_id: 'perform-npc', player: true });
  q.sql.close();

  // Breaks: an old save with no opening receipt guesses an opener instead of none.
  const r = at(path);
  r.sql
    .prepare("UPDATE receipt SET response = replace(response, 'encounter.open', 'encounter.gone')")
    .run();
  assert.equal(r.story.opener(fight), undefined);
  // Breaks: a miss scans the whole save again on every draw of the Combat page.
  r.sql
    .prepare("UPDATE receipt SET response = replace(response, 'encounter.gone', 'encounter.open')")
    .run();
  assert.equal(r.story.opener(fight), undefined);
  r.sql.close();
});

// Breaks: the Combat page reads the opener while a lost COMMIT holds the press unsettled, when the
// save's reads fail, so drawing the page throws (session.ts, as lastNarration).
test('no opener is read while the opening press is unsettled', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'loka-opener-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const path = join(directory, 'save.db');
  at(path).sql.close();
  const h = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  h.fault.kind = 'lost';
  h.fault.armed = true;
  const attack = { action_key: 'attack', target_ids: [rat(fresh)], input: {} };
  assert.equal(h.game.invoke(attack as never).kind, 'pending');
  assert.equal(h.game.opener!('any-fight'), undefined); // any lookup not yet cached reads the save
  h.sql.close();
});
