// Toolbox row 20a through real SQLite on cartridges/escrow_sampler: the two ore the smith's
// `commission` moved into the vault, its 3 pennies and the `ordered` fact survive cold reopen; the
// same invocation replays its receipt and a new one is refused while the order is open
// (docs/system/mechanics.md, Escrow custody). Row 20b: the order's job survives cold reopen, and
// the sword is claimed once after the due time (Timed job claim and cancel).
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
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-escrow-save-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/escrow_sampler', file], {
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
const S = 'escrow_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'escrow_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const ore = (k: string) => initial.entityIds[`${S}:item/ore_${k}`]!;
const smith = initial.entityIds[`${S}:npc/smith`]!;
const vault = initial.roomIds[`${S}:room/vault`]!;
/** Where each ore is, the player's pennies and `ordered`. */
const truth = (w: World) => [
  ['a', 'b', 'c', 'd'].map((k) => w.state.containers[ore(k)] === vault),
  level(w, w.body, resourceRef(w, 'pennies')),
  value(w, w.character, ref('fact', 'ordered')),
];

// Breaks: save recovery rejects the escrow's entity.transfer into a room (cold reopen is
// save_corrupt), the receipt is not replayed (a second commission or a refusal), or the order
// is not kept (the later commission takes c and d).
test('the escrowed ore and the order survive cold reopen; a retry replays', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-escrow-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'order.db');
  let p = elapsedHost(path, undefined, bundle);
  let story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  let n = 0;
  const invocation = (action_key: string, target_ids: string[], input = {}) => ({
    invocation_id: `aaaaaaaa-2020-4020-8020-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const commission = () =>
    invocation('commission', [smith], { service: ref('service', 'commission'), quoted_price: 3 });
  const run = (i: ReturnType<typeof invocation>, kind = 'accepted') => {
    const r = (story as Extract<typeof story, { kind: 'open' }>).invoke(i);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, kind, JSON.stringify(r));
    return r;
  };
  run(invocation('take', [ore('a')]));
  run(invocation('take', [ore('b')]));
  const order = commission();
  run(order);
  assert.deepEqual(truth(story.world()), [[true, true, false, false], 7, true]);
  p.sql.close();

  p = elapsedHost(path, undefined, bundle);
  story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open', JSON.stringify(story));
  if (story.kind !== 'open') return;
  assert.deepEqual(truth(story.world()), [[true, true, false, false], 7, true]);
  const again = run(order);
  if (again.kind === 'saved') assert.equal(again.replay, true);
  run(invocation('take', [ore('c')]));
  run(invocation('take', [ore('d')]));
  const later = run(commission(), 'rejected');
  if (later.kind === 'saved')
    assert.deepEqual((later.decision as any).error, { code: 'invalid_state' });
  assert.deepEqual(truth(story.world()), [[true, true, false, false], 7, true]);
  p.sql.close();
});

// Breaks: the order job lost on save (no pending row after reopen, or the claim is ready at
// once), the job completion not saved (the claim stays not_ready after reopen), the claim receipt
// not replayed, or the claim leaving the order open (a second claim pays again).
test('the order job survives cold reopen and the sword is claimed once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-claim-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'claim.db');
  let n = 0;
  const invocation = (action_key: string, target_ids: string[], input = {}) => ({
    invocation_id: `bbbbbbbb-2020-4020-8020-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const reopen = () => {
    const p = elapsedHost(path, undefined, bundle);
    const story = openStory(p.db, releases, p.host);
    assert.equal(story.kind, 'open', JSON.stringify(story));
    if (story.kind !== 'open') throw new Error('not open');
    return { p, story };
  };
  const run = (story: ReturnType<typeof reopen>['story'], i: object, kind = 'accepted') => {
    const r = story.invoke(i as never);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, kind, JSON.stringify(r));
    return r;
  };
  const sword = initial.entityIds[`${S}:item/sword`]!;
  const pending = (w: World) => Object.values(w.state.jobs ?? {}).map((j) => j.status);
  let { p, story } = reopen();
  run(story, invocation('take', [ore('a')]));
  run(story, invocation('take', [ore('b')]));
  run(
    story,
    invocation('commission', [smith], { service: ref('service', 'commission'), quoted_price: 3 }),
  );
  const c0 = story.world().state.clock;
  p.sql.close();

  ({ p, story } = reopen());
  assert.deepEqual(pending(story.world()), ['pending']);
  const claim = invocation('claim', [smith], { service: ref('service', 'claim'), quoted_price: 1 });
  run(story, claim, 'rejected');
  assert.equal(
    story.elapsed({ expected_run_id: story.runId(), from: c0, until: c0 + 3601 }).kind,
    'saved',
  );
  p.sql.close();

  ({ p, story } = reopen());
  assert.deepEqual(pending(story.world()), ['completed']);
  const take = invocation('claim', [smith], { service: ref('service', 'claim'), quoted_price: 1 });
  run(story, take);
  const again = run(story, take);
  if (again.kind === 'saved') assert.equal(again.replay, true);
  const later = run(
    story,
    invocation('claim', [smith], { service: ref('service', 'claim'), quoted_price: 1 }),
    'rejected',
  );
  if (later.kind === 'saved')
    assert.deepEqual((later.decision as any).error, { code: 'invalid_state' });
  assert.equal(story.world().state.containers[sword], story.world().body);
  assert.deepEqual(truth(story.world()), [[true, true, false, false], 6, false]);
  p.sql.close();
  coldReopen(path, bundle);
});
