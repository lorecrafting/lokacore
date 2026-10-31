// A save made before a kernel_api bump is refused at its pin with Start over (loka-548k review):
// dialogue receipts gained `speaker` at kernel_api 1.124, so a showcase save from 1.122 must not
// replay under this kernel, where its riddle or exchange receipt would read as save_corrupt.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';

// protocol/fixtures/toolbox_showcase_hash.json sha256 on main at 993a4947b (kernel_api 1.122).
const MAIN_1_122 = 'e46313c07cdd7bad726bd0bea8f9ec88660162798ce7316758ef8d7b3ca44e8e';
const showcase = read('protocol/fixtures/toolbox_showcase_hash.json');
const release = (canonical: string) => {
  const sha = createHash('sha256').update(canonical).digest('hex');
  const artifact = `{"cartridge":${canonical},"content_hash":"${sha}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
  const fresh = newWorld(loaded.cartridge as Cartridge, context, [
    1, 2, 3, 4,
  ] as unknown as RngState);
  return { content_hash: sha, fresh };
};
const open = (path: string, releases: ReturnType<typeof release>[], n = { i: 0 }) => {
  const sql = new DatabaseSync(path);
  type P = (string | number | null)[];
  const db = {
    execSync: (s: string) => void sql.exec(s),
    runSync: (s: string, ...p: P) => sql.prepare(s).run(...p),
    getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T,
    getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  const newId = () => `aaaaaaaa-0000-4000-8000-${String(++n.i).padStart(12, '0')}`;
  return { sql, opened: openStory(db as never, releases, { kernel_version: 'k', newId }) };
};

// Breaks: kernel_api (and the showcase's at_least) left at 1.122, so main's save keeps its pin.
test('a showcase save from kernel_api 1.122 is refused at its pin and offers Start over', () => {
  const installed = release(showcase.canonical);
  const old = release(showcase.canonical.replace('"at_least":"1.124"', '"at_least":"1.122"'));
  assert.equal(old.content_hash, MAIN_1_122);
  const path = join(mkdtempSync(join(tmpdir(), 'loka-pin-')), 'save.db');
  const a = open(path, [old]);
  assert.equal(a.opened.kind, 'open');
  a.sql.close();
  const b = open(path, [installed]);
  assert.equal(b.opened.kind, 'pinned_release_missing');
  assert.equal(typeof (b.opened as { newGame?: unknown }).newGame, 'function');
  b.sql.close();
});
