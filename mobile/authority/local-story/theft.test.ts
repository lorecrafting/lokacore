// Toolbox rows 33 and 34 through real SQLite on cartridges/theft_sampler (docs/system/mechanics.md,
// Theft, fence and witnessed offense): an unseen theft (the purse) and a seen one (the ring) save
// their transfers, their per-item stolen marks and wanted; after cold reopen the fence buys the
// stolen purse and the shopkeeper still refuses the stolen ring.
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
  type World,
} from '../../../kernel/ts/src/index.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-theft-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/theft_sampler', file], {
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
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e33' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const S = 'theft_sampler@0.0.1';
// The story draws its own run (ids differ from `initial`), so ids come from the opened world.
let world = initial;
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'theft_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const item = (k: string) => world.entityIds[`${S}:item/${k}`]!;
const npc = (k: string) => world.entityIds[`${S}:npc/${k}`]!;
/** Who holds the purse and ring, their stolen marks and wanted. */
const truth = (w: World) => [
  ['purse', 'ring'].map((k) => w.state.containers[item(k)] === w.body),
  ['purse', 'ring'].map((k) => value(w, w.character, ref('fact', 'stolen'), item(k))),
  value(w, w.character, ref('fact', 'wanted')),
];

// Breaks: save recovery rejects the theft's transfer or its per-item stolen row (cold reopen is
// save_corrupt or the marks are lost), so the fence refuses the purse or the shopkeeper buys the ring.
test('stolen goods and wanted survive cold reopen; the fence still knows them', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-theft-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'theft.db');
  let n = 0;
  const reopen = () => {
    const p = elapsedHost(path, undefined, bundle);
    const story = openStory(p.db, releases, p.host);
    assert.equal(story.kind, 'open', JSON.stringify(story));
    if (story.kind !== 'open') throw new Error('not open');
    world = story.world();
    const run = (action_key: string, target_ids: string[], input = {}, kind = 'accepted') => {
      const r = story.invoke({
        invocation_id: `cccccccc-3333-4033-8033-${String(++n).padStart(12, '0')}`,
        actor_id: story.world().character,
        action_key,
        target_ids,
        input,
      } as never);
      assert.equal(r.kind, 'saved', JSON.stringify(r));
      if (r.kind === 'saved') assert.equal((r.decision as any).kind, kind, JSON.stringify(r));
      if (kind === 'rejected' && r.kind === 'saved')
        assert.deepEqual((r.decision as any).error, { code: 'invalid_state' });
    };
    return { p, story, run };
  };
  let { p, story, run } = reopen();
  run('take', [item('purse')]);
  run('move', [], { direction: 'west' });
  run('take', [item('ring')]);
  assert.deepEqual(truth(story.world()), [[true, true], [true, true], true]);
  p.sql.close();

  ({ p, story, run } = reopen());
  assert.deepEqual(truth(story.world()), [[true, true], [true, true], true]);
  run('sell', [npc('shopkeeper'), item('ring')], { quoted_price: 5 }, 'rejected');
  run('move', [], { direction: 'east' });
  run('move', [], { direction: 'east' });
  run('sell', [npc('fence'), item('purse')], { quoted_price: 3 });
  assert.equal(story.world().state.containers[item('purse')], npc('fence'));
  p.sql.close();

  ({ p, story } = reopen());
  assert.equal(story.world().state.containers[item('purse')], npc('fence'));
  p.sql.close();
});
