// Toolbox row 19 on the compiled harvest sampler: the mine's ore seam (two lumps of ore) declares
// harvest.tool {tag: sharp}. Mining needs a held sharp item: the pickaxe (metal, sharp), not the
// wooden stick and not the pickaxe on the floor; the seam depletes after two lumps.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-harvest-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/harvest_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

let n = 0;
const play = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-4444-4444-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
const item = (w: World, key: string) => w.entityIds[`harvest_sampler@0.0.1:item/${key}`]!;
const seam = (w: World) => Object.keys(w.details)[0];
const take = (w: World, key: string) => {
  const r = play(w, { type: 'take', item_id: item(w, key) });
  assert.equal(r.decision.kind, 'accepted');
  return r.world;
};
const mine = (w: World) => play(w, { type: 'harvest', target_id: seam(w) });
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
// The seam's Harvest entry in the GameView, wherever it is listed.
const offer = (w: World) => {
  let found: { available: boolean; reason?: { code: string } } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === 'harvest' ? (found = v) : v));
  assert.ok(found, 'harvest offered');
  return found;
};
const ore = (w: World) => ['ore_01', 'ore_02'].map((k) => w.state.containers[item(w, k)]);
const fresh = () =>
  newWorld(content, '2c6e1a9b-7d3f-4e5a-8b1c-0f2e4d6a8c1b' as never, [1, 2, 3, 4]);

// Breaks: the tool gate is skipped (empty hands, the stick or the pickaxe on the floor mine ore),
// or the offer's code differs from the one step returns.
test('without a held sharp tool the seam refuses, with the same code offered, and keeps its ore', () => {
  const w = fresh();
  const room = w.state.containers[w.body];
  for (const x of [w, take(w, 'stick')]) {
    assert.equal(code(mine(x)), 'invalid_state');
    assert.equal(offer(x).reason?.code, 'invalid_state');
    assert.equal(x.state.containers[item(x, 'pickaxe')], room);
    assert.deepEqual(ore(x), [room, room]);
  }
});

// Breaks: a held pickaxe is refused, mining takes no item or the wrong one, or the seam never
// depletes (a third lump appears).
test('with the pickaxe held the seam yields each lump once, then is empty', () => {
  let w = take(fresh(), 'pickaxe');
  const room = w.state.containers[w.body];
  assert.equal(offer(w).available, true);
  let r = mine(w);
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  assert.deepEqual(ore(w), [w.body, room]);
  w = mine(w).world;
  assert.deepEqual(ore(w), [w.body, w.body]);
  r = mine(w);
  assert.equal(code(r), 'not_found');
  assert.equal(offer(w).reason?.code, 'not_found');
});

// Breaks: the loader admits a tool gate under kernel_api 1.51 (twin of
// test/loka/content_harvest_tool_test.exs).
test('loader: a harvest tool needs kernel_api 1.52', () => {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.manifest.requires.kernel_api.at_least = '1.51';
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(!r.ok);
  assert.equal(r.diagnostic.code, 'KERNEL_API_RANGE_INVALID');
});
