// Toolbox row W8 permanent status rows through real SQLite: a scar row with no end, tick or job
// reopens and keeps through later rounds (docs/system/save.md, Status recovery).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

const scratch = mkdtempSync(join(tmpdir(), 'loka-scars-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-scars-saves-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/scars_sampler', file], {
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
const wolf = initial.entityIds['scars_sampler@0.0.1:npc/wolf']!;
const SCARRED = [{ label: 'condition.scarred', resource: 'hp', tick_every: 60 }];

// Breaks: load or recovery refuses or rewrites an active status row with no ends_at, next_tick_at
// or job_id, or an elapsed run after reopen faults on it (a status job looked up by its job id).
test('a permanent scar row reopens and keeps through the next round', (t) => {
  const path = join(saves, 'scar.db');
  let p = elapsedHost(path, undefined, bundle);
  t.after(() => {
    p.sql.close();
    rmSync(saves, { recursive: true, force: true });
  });
  const reopen = () => {
    p.sql.close();
    p = elapsedHost(path, undefined, bundle);
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  let story = openStory(p.db, releases, p.host);
  if (story.kind !== 'open') throw new Error(story.kind);
  let n = 0;
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) =>
    story.invoke({
      invocation_id: `dddddddd-9999-4999-8999-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    }).kind;
  const round = () => {
    const from = story.world().state.clock;
    return story.elapsed({ expected_run_id: story.runId(), from, until: from + 150 }).kind;
  };
  assert.equal(invoke('move', [], { direction: 'east' }), 'saved');
  assert.equal(invoke('attack', [wolf]), 'saved');
  assert.equal(round(), 'saved');
  story = reopen();
  assert.deepEqual(gameView(story.world()).conditions, SCARRED);
  assert.equal(round(), 'saved');
  story = reopen();
  assert.deepEqual(gameView(story.world()).conditions, SCARRED);
});
