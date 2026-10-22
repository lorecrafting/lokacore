import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { fragment } from '../../../kernel/ts/test/fragment.ts';
import { openStory, type Saved } from './authority.ts';

const f = fragment('protocol/fixtures/cartridge_errand_hash.json');
const { sha256 } = f.bundle();
const fresh = f.genesis();
const adapt = (sql: DatabaseSync) => ({
  execSync: (s: string) => void sql.exec(s),
  runSync: (s: string, ...p: (string | number | null)[]) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
  isInTransactionSync: () => sql.isTransaction,
});
const host = {
  kernel_version: `loka-kernel@${'0123456789'.repeat(4)}`,
  newId: () => crypto.randomUUID(),
};

// Breaks: recovery accepts a quest row whose started_at (toolbox row W23) is not a LogicalTime or
// lies after the saved clock, so the Journal would compute a hint from a forged stage start.
test('saved quest started_at must be a past LogicalTime; absent or past reopens', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-quest-started-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sql = new DatabaseSync(join(dir, 'story.db'));
  t.after(() => sql.close());
  const db = adapt(sql);
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
