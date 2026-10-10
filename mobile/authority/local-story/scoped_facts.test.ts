// Toolbox row W2 fact rows through real SQLite on cartridges/scoped_facts_sampler: pair and entity
// rows survive cold reopen and replay, and a forged fact row is save_corrupt (facts-save.ts;
// docs/system/save.md, Scoped fact recovery).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { decode, encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-scoped-facts-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/scoped_facts_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const bundle = { canonical: encode(artifact.cartridge), sha256: artifact.content_hash as string };
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const S = 'scoped_facts_sampler@0.0.1';
const id = (k: string) => initial.entityIds[`${S}:${k}`]!;
const fact = (key: string) =>
  ({
    cartridge_id: 'scoped_facts_sampler',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key,
  }) as const;
const read = (w: World, key: string, who: string) =>
  value(w, w.character, fact(key), id(who) as never);

// One save file in a fresh directory: invocations that save, cold reopen and replay once.
function save(t: TestContext, name: string) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-scoped-facts-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, `${name}.db`);
  const open = () => {
    const s = openStory(h.p.db, releases, h.p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  const h = { p: elapsedHost(path, undefined, bundle), n: 0 } as any;
  h.story = open();
  h.reopen = () => {
    h.p.sql.close();
    h.p = elapsedHost(path, undefined, bundle);
    h.story = open();
  };
  h.run = (action_key: string, target_ids: string[] = [], input = {}) => {
    const i = {
      invocation_id: `dddddddd-4747-4777-8777-${String(++h.n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    };
    assert.equal(h.story.invoke(i).kind, 'saved', action_key);
    h.reopen();
    const again = h.story.invoke(i);
    assert.equal(again.kind === 'saved' && again.replay, true, action_key);
  };
  // Talk to `who` (its dialogue's key is the talk action), then pick `choice_id`.
  h.chat = (who: string, choice_id: string) => {
    h.run(`${who}_talk`, [id(`npc/${who}`)]);
    const rows = Object.entries(h.story.world().state.choices ?? {}) as [string, any][];
    const continuation_id = rows.find(([, r]) => r.status === 'pending')![0];
    h.run('choose', [], { choice_id, continuation_id });
  };
  return h;
}

// Breaks: the facts section drops the subject on write or reopen (the smith's rows read back as
// shared or default), or a talk, choose or give receipt replays into a second write.
test('pair and entity fact rows survive cold reopen and replay', (t) => {
  const h = save(t, 'reopen');
  h.chat('smith', 'greet');
  h.chat('smith', 'help');
  h.run('take', [id('item/apple')]);
  h.run('give', [id('item/apple'), id('npc/smith')]);
  const w = h.story.world();
  const smith = ['times_met', 'trust', 'fed'].map((k) => read(w, k, 'npc/smith'));
  assert.deepEqual(smith, [1, 1, true]);
  assert.deepEqual([read(w, 'times_met', 'npc/miller'), read(w, 'fed', 'npc/miller')], [0, false]);
  h.p.sql.close();
});

// Breaks (facts-save.ts): a forged fact row loads and is read or faults later instead of giving
// typed save_corrupt: a pair row without its subject, a subject that is no NPC, item or detail, a
// row of another character, a key with an extra field or in non-canonical text, or an untyped value.
test('a forged fact row is save_corrupt', (t) => {
  const h = save(t, 'forged');
  h.chat('smith', 'greet');
  const sql = h.p.sql;
  const row = sql.prepare("SELECT key, value FROM state_row WHERE section='facts'").get()!;
  const target = JSON.parse(JSON.stringify(decode(String(row.key))));
  const write = (key: string, v: string) => {
    sql.prepare("DELETE FROM state_row WHERE section='facts'").run();
    sql.prepare("INSERT INTO state_row VALUES ('facts', ?, ?)").run(key, v);
  };
  const opened = () => openStory(h.p.db, releases, h.p.host).kind;
  const { subject_id: _, ...bare } = target;
  for (const [key, v] of [
    [encode(bare), '1'],
    [encode({ ...target, subject_id: '00000000-0000-4000-8000-0000000000ff' }), '1'],
    [encode({ ...target, scope: { ...target.scope, character_id: id('npc/miller') } }), '1'],
    [encode({ ...target, extra: 1 }), '1'],
    [JSON.stringify(target, null, 1), '1'],
    [String(row.key), '-1'],
  ]) {
    write(key, v);
    assert.equal(opened(), 'save_corrupt', key + v);
  }
  write(String(row.key), String(row.value));
  assert.equal(opened(), 'open');
  sql.close();
});
