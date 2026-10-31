// The save pin names the kernel_api it was made under (loka-daha; save.md, Opening a story): a save
// from any other kernel_api is refused at its pin with Start over, on a cartridge whose content and
// at_least did not change. 1.124 changed dialogue receipts without touching unbumped cartridges.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/runtime/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Release } from './authority.ts';

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
const releases: [Release] = [release(showcase.canonical)];
const open = (path: string, kernel_version = 'k', n = { i: 0 }) => {
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
  return { sql, opened: openStory(db as never, releases, { kernel_version, newId }) };
};
const pinOf = (sql: DatabaseSync) =>
  JSON.parse((sql.prepare('SELECT pin FROM save').get() as { pin: string }).pin);
/** A save made by this build, its pin then rewritten in SQLite to `edit`. */
const saved = (edit: string) => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-pin-')), 'save.db');
  const a = open(path);
  assert.equal(a.opened.kind, 'open');
  a.sql.exec(`UPDATE save SET pin = ${edit}`);
  a.sql.close();
  return path;
};

for (const [name, edit, pinned] of [
  ['an older kernel_api (1.0)', "json_set(pin, '$.kernel_api', '1.0')", '1.0'],
  ["a newer app's kernel_api (9.0)", "json_set(pin, '$.kernel_api', '9.0')", '9.0'],
  ['no kernel_api (a pin from before loka-daha)', "json_remove(pin, '$.kernel_api')", undefined],
] as const)
  // Breaks: openStory comparing the content hash only, a range, or a missing key as a match.
  test(`a save pinned to ${name} is refused at its pin on the same release; Start over pins the installed kernel_api`, () => {
    const path = saved(edit);
    const bytes = readFileSync(path);
    const b = open(path);
    assert.equal(b.opened.kind, 'pinned_release_missing');
    const refused = b.opened as { pinned: Record<string, unknown>; newGame: () => unknown };
    assert.equal(refused.pinned.kernel_api, pinned);
    assert.equal(refused.pinned.content_hash, showcase.sha256);
    assert.deepEqual(readFileSync(path), bytes, 'a refusal writes nothing');
    assert.deepEqual(refused.newGame(), { kind: 'replaced' });
    assert.equal(pinOf(b.sql).kernel_api, INSTALLED.kernel_api);
    b.sql.close();
  });

// Breaks: the pin naming the host's build (kernel_version) instead of the kernel contract.
test('a save reopens under another build of the same kernel_api', () => {
  const path = saved('pin');
  const b = open(path, 'k2');
  assert.equal(b.opened.kind, 'open');
  assert.equal(pinOf(b.sql).kernel_api, INSTALLED.kernel_api);
  b.sql.close();
});
