import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fragment } from '../../../kernel/ts/test/fragment.ts';
import { openStory, type Saved } from './authority.ts';
import { sqliteHost } from './__tests__/elapsed-host.test.ts';

const f = fragment('protocol/fixtures/cartridge_errand_hash.json');
const { sha256 } = f.bundle();
const fresh = f.genesis();

// Breaks: recovery accepts a quest row whose started_at (toolbox row W23) is not a LogicalTime or
// lies after the saved clock, so the Journal would compute a hint from a forged stage start.
test('saved quest started_at must be a past LogicalTime; absent or past reopens', (t) => {
  const { sql, db, host } = sqliteHost();
  t.after(() => sql.close());
  const o = openStory(db, [{ content_hash: sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') return;
  const reply = o.invoke({
    invocation_id: host.newId(),
    action_key: 'lantern',
    actor_id: fresh.character,
    target_ids: [],
    input: {},
  } as never) as Saved;
  assert.equal((reply.decision as { kind: string }).kind, 'accepted');
  const q = sql
    .prepare("SELECT key, value FROM state_row WHERE section='quests'")
    .all()
    .map((r: any) => ({ key: r.key as string, value: JSON.parse(r.value) }))
    .find((r) => r.value.quest.key === 'lantern')!;
  const { clock } = sql.prepare('SELECT clock FROM head').get() as { clock: number };
  const reopen = (started_at: unknown) => {
    const w = sql
      .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
      .run(JSON.stringify({ ...q.value, started_at }), 'quests', q.key);
    assert.equal(w.changes, 1);
    return openStory(db, [{ content_hash: sha256, fresh }], host).kind;
  };
  assert.equal(reopen(clock), 'open');
  assert.equal(reopen(undefined), 'open');
  assert.equal(reopen('soon'), 'save_corrupt');
  assert.equal(reopen(-1), 'save_corrupt');
  assert.equal(reopen(clock + 1), 'save_corrupt');
});
