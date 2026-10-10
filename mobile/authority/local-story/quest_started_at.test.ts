import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStory } from './authority.ts';
import { bundle, fresh, setup } from './__tests__/bell-setup.test.ts';

// Breaks: recovery accepts a quest row whose started_at (toolbox row W23) is not a LogicalTime or
// lies after the saved clock, so the Journal would compute a hint from a forged stage start.
test('saved quest started_at must be a past LogicalTime; absent or past reopens', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-quest-started-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(join(dir, 'story.db'));
  a.search();
  const q = a.rows('quests').find((r) => r.value.quest.key === 'missing_child')!;
  const { clock } = a.sql.prepare('SELECT clock FROM head').get() as { clock: number };
  const reopen = (started_at: unknown) => {
    a.sql
      .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
      .run(JSON.stringify({ ...q.value, started_at }), 'quests', q.key);
    return openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind;
  };
  assert.equal(reopen(clock), 'open');
  assert.equal(reopen(undefined), 'open');
  assert.equal(reopen('soon'), 'save_corrupt');
  assert.equal(reopen(-1), 'save_corrupt');
  assert.equal(reopen(clock + 1), 'save_corrupt');
  a.sql.close();
});
