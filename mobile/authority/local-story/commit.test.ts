// A receipt response that is not a valid DecisionResult (loka-kgd.187: an accepted result with
// `narration: []`) on real SQLite (node:sqlite, the phone's rollback journal). Expected values:
// the schema (protocol/decision.schema.json narration minItems 1) and the bytes the real invoke
// path wrote for the same receipt, never commit's own output.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';
import { commit } from './commit.ts';
import type { Receipt } from './store.ts';

// protocol/fixtures/cartridge_dusk_hash.json; its pick_lock is accepted (it draws and fails).
const kat = read('protocol/fixtures/cartridge_dusk_hash.json');
const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId,
  [27274249, 25704967, 31982592, 12605441] as unknown as RngState,
);
const pick = {
  invocation_id: '00000000-0000-4000-8000-000000000001',
  action_key: 'pick_lock',
  actor_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9',
  target_ids: [],
  input: {},
};
const dir = mkdtempSync(join(tmpdir(), 'loka-commit-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function opened(path: string) {
  const sql = new DatabaseSync(path);
  type P = (string | number | null)[];
  const db = {
    execSync: (s: string) => sql.exec(s),
    runSync: (s: string, ...p: P) => sql.prepare(s).run(...p),
    getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T,
    getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  const newId = () => 'aaaaaaaa-0000-4000-8000-000000000001';
  const s = openStory(db, [{ content_hash: kat.sha256, fresh }], { kernel_version: 'k', newId });
  assert.equal(s.kind, 'open');
  return { sql, db, story: s as Extract<typeof s, { kind: 'open' }> };
}
const bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const RECEIPT = 'SELECT * FROM receipt';

// Breaks: commit writes a schema-invalid response (found only on the next reopen, as save_corrupt),
// or writes part of it, or the check refuses a valid response or changes the bytes it writes.
test('commit refuses an invalid DecisionResult before writing; the valid one writes as invoke', () => {
  const played = opened(join(dir, 'played.db'));
  assert.equal((played.story.invoke(pick) as { kind: string }).kind, 'saved');
  const [row] = played.sql.prepare(RECEIPT).all() as Record<string, string | number>[];
  const r = {
    ...row,
    command: JSON.parse(row!.command as string),
    response: JSON.parse(row!.response as string),
  } as unknown as Receipt;
  const next = played.story.world();
  const path = join(dir, 'fresh.db');
  const { sql, db } = opened(path);
  const before = bytes(path);
  const bad = { ...r, response: { ...(r.response as object), narration: [] } };
  assert.throws(
    // No BEGIN: refused before the transaction, so no lock, rollback or fence.
    () => commit({ ...db, execSync: (q) => assert.fail(q) }, next, bad.response as never, bad, []),
    /invalid DecisionResult; nothing was saved/,
  );
  assert.equal(bytes(path), before);
  assert.equal(commit(db, next, r.response as never, r, []), true);
  assert.deepEqual(sql.prepare(RECEIPT).all(), [row]);
  played.sql.close();
  sql.close();
});
