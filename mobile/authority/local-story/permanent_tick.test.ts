// Toolbox row W8 ticking permanent status rows through real SQLite (loka-rn3b): the needs sampler's
// hungry made permanent keeps an active row with a tick and job but no end across a month of
// catch-up and a cold reopen (docs/system/save.md, Status recovery).
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
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-permanent-tick-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-permanent-tick-saves-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/needs_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const hungry = artifact.cartridge.statuses['needs_sampler@0.0.1:status/hungry'];
hungry.duration = 'permanent';
delete hungry.narration.expired;
const canonical = encode(artifact.cartridge);
const bundle = { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
const loaded = loadCartridge(
  new TextEncoder().encode(JSON.stringify({ ...artifact, content_hash: bundle.sha256 })),
  INSTALLED,
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const HOUR = 3600;
const MONTH = 30 * 24 * HOUR;

// Breaks: load or recovery refuses or rewrites an active status row with a tick and job but no
// ends_at, the catch-up drain expires it or stops its ticks, or the month's catch-up never ends.
test('a ticking permanent hungry ticks through a month of catch-up and a cold reopen', (t) => {
  const path = join(saves, 'hungry.db');
  let p = elapsedHost(path, undefined, bundle);
  t.after(() => {
    p.sql.close();
    rmSync(saves, { recursive: true, force: true });
  });
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  let story = open();
  const moved = story.invoke({
    invocation_id: 'dddddddd-6666-4666-8666-000000000001',
    actor_id: initial.character,
    action_key: 'move',
    target_ids: [],
    input: { direction: 'east' },
  });
  assert.equal(moved.kind, 'saved');
  const t0 = story.world().state.clock;
  const ticking = (next_tick_at: number) => [
    {
      label: 'condition.hungry',
      resource: 'hunger',
      per_tick: -1,
      tick_every: HOUR,
      kind: 'debuff',
      next_tick_at,
    },
  ];
  const caught = story.elapsed({ expected_run_id: story.runId(), from: t0, until: t0 + MONTH + 1 });
  assert.equal(caught.kind, 'saved');
  p.sql.close();
  p = elapsedHost(path, undefined, bundle);
  story = open();
  // The timed thirsty ended with its day; hungry still ticks, an hour past the month.
  assert.deepEqual(gameView(story.world()).conditions, ticking(t0 + MONTH + HOUR));
  coldReopen(path, bundle);
});
