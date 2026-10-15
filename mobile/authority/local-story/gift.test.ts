// Homestead hs-7 through real SQLite on cartridges/gift_sampler: the farmer's trust from a given
// apple, and the barter's knife in the body with two pelts in the stall and no job row, survive
// cold reopen; the barter replays its receipt (docs/system/mechanics.md, Barter (toolbox row
// kgd.70)).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decode, encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
  type World,
} from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-gift-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/gift_sampler', file], {
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
const S = 'gift_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'gift_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const item = (k: string) => initial.entityIds[`${S}:item/${k}`]!;
const farmer = initial.entityIds[`${S}:npc/farmer`]!;
const trader = initial.entityIds[`${S}:npc/trader`]!;
const stall = initial.roomIds[`${S}:room/stall`]!;
/** The farmer's trust, where the knife and pelts are, and the job rows. */
const truth = (w: World) => [
  Object.entries(w.state.facts ?? {}).find(([k]) => {
    const t = decode(k) as any;
    return t.fact.key === 'trust' && t.subject_id === farmer;
  })?.[1],
  w.state.containers[item('knife_01')] === w.body,
  ['pelt_01', 'pelt_02', 'pelt_03'].map((k) => w.state.containers[item(k)] === stall),
  w.state.jobs ?? {},
];

// Breaks: save recovery rejects the barter's output transfer out of a room (cold reopen is
// save_corrupt), the receipt not replayed (a retry is refused order_open), or the gift's pair fact
// not saved.
test('a gift and a barter survive cold reopen; the barter retry replays', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-gift-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'gift.db');
  let p = elapsedHost(path, undefined, bundle);
  let story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  let n = 0;
  const invocation = (action_key: string, target_ids: string[], input = {}) => ({
    invocation_id: `aaaaaaaa-2121-4020-8020-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const run = (i: ReturnType<typeof invocation>) => {
    const r = (story as Extract<typeof story, { kind: 'open' }>).invoke(i);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    return r;
  };
  run(invocation('take', [item('apple')]));
  run(invocation('give', [item('apple'), farmer]));
  run(invocation('take', [item('pelt_01')]));
  run(invocation('take', [item('pelt_02')]));
  const barter = invocation('barter', [trader], {
    service: ref('service', 'knife_for_pelts'),
    quoted_price: 0,
  });
  run(barter);
  const after = [1, true, [true, true, false], {}];
  assert.deepEqual(truth(story.world()), after);
  p.sql.close();

  p = elapsedHost(path, undefined, bundle);
  story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open', JSON.stringify(story));
  if (story.kind !== 'open') return;
  assert.deepEqual(truth(story.world()), after);
  const again = run(barter);
  if (again.kind === 'saved') assert.equal(again.replay, true);
  p.sql.close();
});
