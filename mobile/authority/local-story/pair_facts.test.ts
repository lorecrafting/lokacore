// Toolbox row FD4 fact rows through real SQLite on cartridges/rivals_sampler: an NPC-NPC pair row
// survives cold reopen and replay (facts-save.ts; docs/system/mechanics.md, NPC-NPC pair facts).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
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

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-pair-facts-save-'));
let artifact: { cartridge: unknown; content_hash: string };
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/rivals_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const bundle = { canonical: encode(artifact.cartridge as never), sha256: artifact.content_hash };
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const S = 'rivals_sampler@0.0.1';
const id = (k: string) => initial.entityIds[`${S}:${k}`]!;
const gloats = (w: World, npc: string, other: string) =>
  value(
    w,
    w.character,
    {
      cartridge_id: 'rivals_sampler',
      cartridge_version: '0.0.1',
      kind: 'fact',
      key: 'gloats',
    } as never,
    id(`npc/${npc}`) as never,
    id(`npc/${other}`) as never,
  );

// Breaks: the facts section drops with_id on write or reopen (the row fails facts_typed and the save
// is save_corrupt, or reads back at the wrong pair), or the give receipt replays into a second write.
test('an NPC-NPC pair row survives cold reopen and replay', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-pair-facts-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'reopen.db');
  let p = elapsedHost(path, undefined, bundle);
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  let story = open();
  let n = 0;
  const run = (action_key: string, target_ids: string[]) => {
    const i = {
      invocation_id: `dddddddd-4848-4888-8888-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input: {},
    };
    assert.equal(story.invoke(i as never).kind, 'saved', action_key);
    p.sql.close();
    p = elapsedHost(path, undefined, bundle);
    story = open();
    const again = story.invoke(i as never);
    assert.equal(again.kind === 'saved' && again.replay, true, action_key);
  };
  run('take', [id('item/apple')]);
  run('give', [id('item/apple'), id('npc/smith')]);
  const w = story.world();
  assert.deepEqual([gloats(w, 'smith', 'miller'), gloats(w, 'miller', 'smith')], [true, false]);
  p.sql.close();
});
