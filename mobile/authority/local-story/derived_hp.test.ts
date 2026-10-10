// Toolbox row 2 derived hp maximum through real SQLite: a save holding hp above the authored
// maximum reopens at that value (docs/system/mechanics.md resource@1, loka-kgd.8).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-derived-hp-'));
let artifact;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/derived_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
// The dummy always hits for 1, so the round writes the player's hp row below the derived 16.
artifact.cartridge.npcs['derived_sampler@0.0.1:npc/dummy'].attack = {
  chance: 100,
  damage_min: 1,
  damage_max: 1,
};
const canonical = encode(artifact.cartridge);
const bundle = { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${bundle.sha256}"}`),
  INSTALLED,
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e2f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;

// Breaks: reopen validates or rebuilds the hp row against the authored maximum 10, so a save holding
// 15 (constitution 16, derived maximum 16) refuses to open or reads clamped to 10.
test('a save holding hp 15 above the authored maximum 10 reopens at 15 / 16', (t) => {
  const saves = mkdtempSync(join(tmpdir(), 'loka-derived-hp-saves-'));
  t.after(() => rmSync(saves, { recursive: true, force: true }));
  const path = join(saves, 'hardy.db');
  let p = elapsedHost(path, undefined, bundle);
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  let story = open();
  let n = 0;
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const r = story.invoke({
      invocation_id: `dddddddd-8888-4888-8888-${String(++n).padStart(12, '0')}`,
      actor_id: story.world().character,
      action_key,
      target_ids,
      input,
    } as never);
    assert.equal(
      r.kind === 'saved' && (r.decision as { kind: string }).kind,
      'accepted',
      action_key,
    );
  };
  const elapse = (seconds: number) => {
    const from = story.world().state.clock;
    const r = story.elapsed({ expected_run_id: story.runId(), from, until: from + seconds });
    assert.equal(r.kind, 'saved', String(seconds));
  };
  invoke('choose_ancestry', [], { ancestry: 'hardy' });
  elapse(3 * 3600);
  invoke('move', [], { direction: 'east' });
  invoke('attack', [story.world().entityIds['derived_sampler@0.0.1:npc/dummy']!]);
  elapse(150);
  const hp = () => gameView(story.world()).resources!.find((r) => r.resource.key === 'hp')!;
  assert.deepEqual([hp().current, hp().maximum], [15, 16]);
  p.sql.close();
  p = elapsedHost(path, undefined, bundle);
  story = open();
  assert.deepEqual([hp().current, hp().maximum], [15, 16]);
  p.sql.close();
});
