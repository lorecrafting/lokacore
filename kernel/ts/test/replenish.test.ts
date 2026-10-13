// Toolbox row 19b (docs/system/mechanics.md Replenish) on the compiled replenish sampler: the
// mine's seam harvests ore_01..05; the mine holds ore_01 and ore_02, the sealed store ore_03..05,
// a stone and a crate holding apple_01; a trader in the mine holds nothing. seam_regrowth moves
// one ore an hour from the store to the mine up to 2; shelf moves the apple from the crate to the
// trader up to 1.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { replenish } from '../src/content/cartridge_replenish.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-replenish-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/replenish_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
/** The sampler artifact with `edit` applied to its cartridge, rehashed and loaded. */
function edited(edit: (c: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const S = 'replenish_sampler@0.0.1:';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'replenish_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});

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
function waitUntil(w: World, until: number): World {
  const r = play(w, { type: 'wait', until });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = (cartridge = content) =>
  newWorld(cartridge, '3d7f2b0c-8e4a-4f6b-9c2d-1a3e5f7b9d2c' as never, [1, 2, 3, 4]);
const id = (w: World, kind: string, key: string) =>
  kind === 'room'
    ? w.roomIds[`replenish_sampler@0.0.1:room/${key}`]!
    : w.entityIds[`replenish_sampler@0.0.1:${kind}/${key}`]!;
const ORE = ['ore_01', 'ore_02', 'ore_03', 'ore_04', 'ore_05'];
/** [ore in the mine, ore in the store]. */
const ore = (w: World) =>
  ['mine', 'store'].map(
    (room) =>
      ORE.filter((k) => w.state.containers[id(w, 'item', k)] === id(w, 'room', room)).length,
  );
const mine = (w: World) => play(w, { type: 'harvest', target_id: Object.keys(w.details)[0] });
const harvested = () => {
  let w = fresh();
  for (let i = 0; i < 2; i++) {
    const r = mine(w);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
  }
  return w;
};

// Breaks: the job never runs or never reschedules (the mine stays empty, or stops at 1), the cap
// is ignored (3 at 10800) or counts the wrong holder, count is ignored (2 at 3600), items move
// from outside `from`, or the crossed-step drain skips an interval in one long wait.
test('a harvested seam refills one ore an hour from the store up to its cap', () => {
  let w = harvested();
  const r = mine(w);
  assert.equal(r.decision.kind === 'rejected' && r.decision.error.code, 'not_found');
  w = waitUntil(w, 3600);
  assert.deepEqual(ore(w), [1, 2]);
  w = waitUntil(w, 7200);
  assert.deepEqual(ore(w), [2, 1]);
  w = waitUntil(w, 10800);
  assert.deepEqual(ore(w), [2, 1]);
  const once = waitUntil(harvested(), 10800);
  assert.deepEqual(ore(once), [2, 1]);
  assert.deepEqual(once.state.containers, w.state.containers);
  assert.equal(mine(w).decision.kind, 'accepted');
});

// Breaks: a full target still takes stock (the mine holds 3), the shelf entry is not seeded or
// reads the wrong holder (the trader stays empty), or a non-listed item moves (the stone).
test('a full mine takes nothing; the shelf fills the trader from the crate; the stone stays', () => {
  const w = waitUntil(fresh(), 3600);
  assert.deepEqual(ore(w), [2, 3]);
  assert.equal(w.state.containers[id(w, 'item', 'apple_01')], id(w, 'npc', 'trader'));
  assert.equal(w.state.containers[id(w, 'item', 'stone')], id(w, 'room', 'store'));
});

// Breaks: the move ignores the target's capacity, which a non-listed item already fills, so
// compose refuses the transfer (capacity_exceeded), the job faults and every wait past it fails.
test('a container target full of other items takes nothing and time still advances', () => {
  const r = edited((c) => {
    c.items[`${S}item/crate`].capacity = 1;
    Object.assign(c.replenish[`${S}replenish/shelf`], {
      items: [ref('item', 'stone')],
      from: { in: 'room', room: ref('room', 'store') },
      to: { in: 'item', item: ref('item', 'crate') },
    });
  });
  assert.ok(r.ok, JSON.stringify(r));
  const w = waitUntil(waitUntil(fresh(r.cartridge as Cartridge), 3600), 7200);
  assert.equal(w.state.containers[id(w, 'item', 'stone')], id(w, 'room', 'store'));
  assert.equal(w.state.containers[id(w, 'item', 'apple_01')], id(w, 'item', 'crate'));
});

// Breaks: the loader admits replenish under kernel_api 1.70, a template, spawn-template,
// template-item or self-move holder, a non-container item target or one beside a listed
// container (which may be or hold it), an unresolved item or holder, or a duplicate item; or
// drops the harvest allowance, so the seam's ore in the store is refused (twin of
// test/loka/content_replenish_test.exs).
test('loader: replenish needs kernel_api 1.71 and resolved, distinct holders and items', () => {
  const reload = (edit: (c: any) => void) => {
    const r = edited(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const at = '.cartridge.replenish["replenish_sampler@0.0.1:replenish/seam_regrowth"]';
  const seam = (c: any) => c.replenish['replenish_sampler@0.0.1:replenish/seam_regrowth'];
  assert.deepEqual(
    reload((c) => (c.manifest.requires.kernel_api.at_least = '1.70')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  assert.deepEqual(
    reload((c) => (seam(c).from = { in: 'template' })),
    ['SCHEMA_VIOLATION', `${at}.from`],
  );
  assert.deepEqual(
    reload((c) => (seam(c).from = seam(c).to)),
    ['SCHEMA_VIOLATION', `${at}.from`],
  );
  const shelf = `.cartridge.replenish["${S}replenish/shelf"]`;
  assert.deepEqual(
    reload((c) => (c.npcs[`${S}npc/trader`].spawn_template = true)),
    ['SCHEMA_VIOLATION', `${shelf}.to`],
  );
  // A lone template item is refused first elsewhere (cartridge_death.ts); check this row alone.
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.items[`${S}item/crate`].location = { in: 'template' };
  assert.deepEqual(
    replenish(c, { named: () => {} } as never).map((d) => [d.code, d.path]),
    [['SCHEMA_VIOLATION', `${shelf}.from`]],
  );
  assert.deepEqual(
    reload((c) => (seam(c).to = { in: 'item', item: ref('item', 'stone') })),
    ['SCHEMA_VIOLATION', `${at}.to`],
  );
  assert.deepEqual(
    reload((c) => {
      seam(c).items[4] = ref('item', 'crate');
      seam(c).to = { in: 'item', item: ref('item', 'crate') };
    }),
    ['SCHEMA_VIOLATION', `${at}.to`],
  );
  // A listed container leaves an item reserve alone (only a target can nest), but not a target
  // it holds: the move would put it inside itself.
  assert.equal(
    reload((c) => (c.items[`${S}item/apple_01`].container = true)),
    'loaded',
  );
  assert.deepEqual(
    reload((c) => {
      c.items[`${S}item/apple_01`].container = true;
      Object.assign(c.replenish[`${S}replenish/shelf`], {
        items: [ref('item', 'crate')],
        from: { in: 'room', room: ref('room', 'store') },
        to: { in: 'item', item: ref('item', 'apple_01') },
      });
    }),
    ['SCHEMA_VIOLATION', `${shelf}.to`],
  );
  assert.deepEqual(
    reload((c) => (seam(c).to = { in: 'npc', npc: ref('npc', 'nobody') })),
    ['UNRESOLVED_REFERENCE', `${at}.to.npc`],
  );
  assert.deepEqual(
    reload((c) => (seam(c).items[4] = ref('item', 'nothing'))),
    ['UNRESOLVED_REFERENCE', `${at}.items[4]`],
  );
  assert.deepEqual(
    reload((c) => (seam(c).items[4] = seam(c).items[0])),
    ['DUPLICATE_DEFINITION', `${at}.items`],
  );
  assert.deepEqual(
    reload((c) => (seam(c).to = { in: 'npc', npc: ref('npc', 'trader') })),
    [
      'OUTCOME_MISMATCH',
      '.cartridge.rooms["replenish_sampler@0.0.1:room/mine"].details.seam.harvest.items[2]',
    ],
  );
});
