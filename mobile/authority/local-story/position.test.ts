// A position survives save and reopen (c1-position; mechanics.md position@1): the local authority
// on Node with real SQLite (node:sqlite) over the rest known answer
// (protocol/fixtures/cartridge_rest_hash.json), the state hash the headless kernel's over the same
// invocation.
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

const kat = read('protocol/fixtures/cartridge_rest_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
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

// Breaks: the position fact not saved or not restored (standing again after reopen), or the
// restored world differing from the one the kernel reached.
test('a seated player is still sitting after reopen, in the state the headless kernel reaches', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-rest-')), 'save.db');
  const o = open(path);
  const i = { invocation_id: host.newId(), action_key: 'sit', actor_id: fresh.character };
  const r = o.invoke({ ...i, target_ids: [], input: {} }) as Saved;
  assert.equal((r.decision as { kind: string }).kind, 'accepted');
  const payload = { type: 'sit', actor_id: fresh.character };
  const c = { id: host.newId(), world_context_id: CONTEXT, payload } as Command;
  const headless = step(fresh, c, 0).world;
  const reopened = open(path).world();
  assert.equal(gameView(reopened).position, 'sitting');
  assert.equal(hash(reopened.state as never), hash(headless.state as never));
});
