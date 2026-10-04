// Derived chapters survive real SQLite close/reopen (mechanics.md Chapters; ADR-072).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { Command, Key, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { identify, resolve } from '../../../kernel/ts/src/commands/invocation.ts';
import { gameView, INSTALLED, step } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';

const kat = read('protocol/fixtures/cartridge_chapters_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId,
  [1, 2, 3, 4],
);
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
const open = (sql: DatabaseSync) => {
  const o = openStory(adapt(sql), [{ content_hash: kat.sha256, fresh }], host);
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') throw new Error('unreachable');
  return o;
};

// Breaks: deriving from transient events or stale view data instead of restored quest rows,
// or the authority resolving invocation choices differently from the headless kernel.
test('reopen derives Reeds from the saved trigger choice, equal to headless play', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-chapters-'));
  const path = join(dir, 'save.db');
  let sql = new DatabaseSync(path);
  try {
    const o = open(sql);
    let headless = fresh;
    for (const [revision, [action_key, target]] of [
      ['lantern', undefined],
      ['take', 'item/lantern'],
      ['bram', 'npc/bram'],
      ['choose', undefined],
    ].entries()) {
      const input =
        action_key === 'choose'
          ? { choice_id: 'take_it', continuation_id: gameView(o.world()).choice!.continuation_id }
          : {};
      const invocation = {
        invocation_id: host.newId(),
        action_key,
        actor_id: fresh.character,
        target_ids: target ? [fresh.entityIds[`ashmere_chapters@0.0.1:${target}`]] : [],
        input,
      };
      const r = o.invoke(invocation) as Saved;
      assert.equal(r.kind, 'saved');
      assert.equal((r.decision as { kind: string }).kind, 'accepted');
      const headlessInput =
        action_key === 'choose'
          ? { choice_id: 'take_it', continuation_id: gameView(headless).choice!.continuation_id }
          : {};
      const id = identify('headless-chapters', headless.character, {
        ...invocation,
        input: headlessInput,
      });
      assert.equal(id.kind, 'identified');
      if (id.kind !== 'identified') throw new Error('unreachable');
      const s = step(headless, resolve(headless, id) as Command, revision + 1, action_key as Key);
      assert.equal(s.decision.kind, 'accepted');
      headless = s.world;
    }
    sql.close();
    sql = new DatabaseSync(path);
    const reopened = gameView(open(sql).world());
    assert.deepEqual(reopened.chapter, { index: 2, title: 'chapter.reeds' });
    assert.deepEqual(reopened, gameView(headless));
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
