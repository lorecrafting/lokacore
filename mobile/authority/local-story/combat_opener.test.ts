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
  // A second fight, opened by the NPC (a move into a hostile's room), in the same world.
  p.sql
    .prepare(
      `INSERT INTO receipt SELECT scope, 'second', 'second', actor_id, intent_digest_version, intent_digest,
         json_set(command, '$.payload.type', 'move'), revision, replace(replace(response, ?, ?), ?, ?) FROM receipt`,
    )
    .run(fight, 'second-fight', rat(fresh), rat(fresh, 3));
  p.sql.close();

  // Breaks: the opener lives only in memory, so a reload loses the title.
  const q = at(path);
  assert.deepEqual(q.story.opener(fight), { npc_id: rat(fresh), player: true });
  // Breaks: a second fight answers with the first fight's opener, or a move reads as the player's attack.
  assert.deepEqual(q.story.opener('second-fight'), { npc_id: rat(fresh, 3), player: false });
  q.sql.close();

  // Breaks: an old save with no opening receipt guesses an opener instead of none.
  const r = at(path);
  r.sql
    .prepare("UPDATE receipt SET response = replace(response, 'encounter.open', 'encounter.gone')")
    .run();
  assert.equal(r.story.opener(fight), undefined);
  r.sql.close();
});
