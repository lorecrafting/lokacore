// A worn item survives save and reopen (c1-equipment; mechanics.md equipment@1): the local
// authority on Node with real SQLite (node:sqlite) over the wear known answer
// (protocol/fixtures/cartridge_wear_hash.json). The head holder's id is Python's (the fixture's
// description), the state hash the headless kernel's over the same invocations.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { hash } from '../../../kernel/ts/src/foundation/canonical.ts';
import type { Command, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { gameView, INSTALLED, step } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';

const kat = read('protocol/fixtures/cartridge_wear_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
const CAP = '0f5f2329-bcff-82f4-948a-3d22a75fb068'; // ordinal 7, leather_cap
const HEAD = '15349791-fa65-81f7-b378-bb8212b808d2'; // ordinal 12, the head holder
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(loaded.cartridge as Cartridge, CONTEXT, [1, 2, 3, 4]);

/** A connection adapted to expo-sqlite's sync names, as keyed.test.ts. */
const adapt = (sql: DatabaseSync) => ({
  execSync: (s: string) => void sql.exec(s),
  runSync: (s: string, ...p: (string | number | null)[]) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
  isInTransactionSync: () => sql.isTransaction,
});
let n = 0;
const host = {
  kernel_version: `loka-kernel@${'0123456789'.repeat(4)}`,
  newId: () => `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
};
const open = (path: string) => {
  const o = openStory(adapt(new DatabaseSync(path)), [{ content_hash: kat.sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') throw new Error('unreachable');
  return o;
};

// Breaks: the holder's contents not saved or not restored (the cap back in the body or lost), or
// the restored world differing from the one the kernel reached.
test('a worn cap is still worn after reopen, in the state the headless kernel reaches', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-wear-')), 'save.db');
  const o = open(path);
  for (const action_key of ['take', 'wear']) {
    const i = { invocation_id: host.newId(), action_key, actor_id: fresh.character };
    const r = o.invoke({ ...i, target_ids: [CAP], input: {} }) as Saved;
    assert.equal((r.decision as { kind: string }).kind, 'accepted', action_key);
  }
  const headless = ['take', 'wear'].reduce((w, type) => {
    const payload = { type, actor_id: w.character, item_id: CAP };
    const c = { id: host.newId(), world_context_id: CONTEXT, payload } as Command;
    return step(w, c, 0).world;
  }, fresh);
  const reopened = open(path).world();
  assert.equal(reopened.state.containers[CAP], HEAD);
  assert.deepEqual(gameView(reopened).equipment, gameView(o.world()).equipment);
  assert.equal(hash(reopened.state as never), hash(headless.state as never));
});
