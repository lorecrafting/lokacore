// Toolbox row 21 through real SQLite on cartridges/durability_sampler: the edge a combat round
// wore off the wielded sword (a W2 entity fact row) survives cold reopen (docs/system/mechanics.md,
// Durability, crafting quality and repair; docs/lessons/mechanics.md, committed intermediate state).
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
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-durability-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/durability_sampler', file], {
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
const S = 'durability_sampler@0.0.1';
const sword = initial.entityIds[`${S}:item/sword`]!;
const edge = {
  cartridge_id: 'durability_sampler',
  cartridge_version: '0.0.1',
  kind: 'fact',
  key: 'edge',
} as never;

// Breaks: save recovery rejects the combat receipt's fact.assign on the weapon subject (cold
// reopen is save_corrupt), or the facts row loses its subject (the edge reads back 2).
test('the edge one worn hit left survives cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-durability-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'worn.db');
  let p = elapsedHost(path, undefined, bundle);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  let n = 0;
  const run = (action_key: string, target_ids: string[] = [], input = {}) => {
    const i = {
      invocation_id: `dddddddd-2121-4121-8121-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    };
    const r = story.invoke(i);
    assert.equal(r.kind, 'saved', `${action_key} ${JSON.stringify(r)}`);
  };
  run('choose_ancestry', [], { ancestry: 'smith' });
  run('take', [sword]);
  run('wear', [sword]);
  run('attack', [initial.entityIds[`${S}:npc/dummy`]!]);
  const from = story.world().state.clock;
  const hit = story.elapsed({ expected_run_id: story.runId(), from, until: from + 150 });
  assert.equal(hit.kind, 'saved', JSON.stringify(hit));
  assert.equal(value(story.world(), initial.character, edge, sword), 1);
  p.sql.close();
  p = elapsedHost(path, undefined, bundle);
  const reopened = openStory(p.db, releases, p.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind === 'open')
    assert.equal(value(reopened.world(), initial.character, edge, sword), 1);
  p.sql.close();
});
