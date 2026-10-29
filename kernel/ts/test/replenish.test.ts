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
import { commands, ctx } from './harness.ts';

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

const stream = commands('eeeeeeee-4444-4444-8444');
const { send: play } = stream;
function waitUntil(w: World, until: number): World {
  const r = play(w, { type: 'wait', until });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = (cartridge = content) =>
  newWorld(cartridge, ctx('3d7f2b0c-8e4a-4f6b-9c2d-1a3e5f7b9d2c'), [1, 2, 3, 4]);
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
const harvested = (cartridge = content) => {
  let w = fresh(cartridge);
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

// Breaks: the loader refuses a listed container as an item reserve.
test('loader: a container reserve loads', () => {
  const reload = (edit: (c: any) => void) => {
    const r = edited(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  assert.equal(
    reload((c) => (c.items[`${S}item/apple_01`].container = true)),
    'loaded',
  );
});

// Homestead hs-1: the sampler with a `dig` recipe on the seam whose custom_event `dig` runs `apply`.
const RUN = { op: 'replenish.run', key: ref('replenish', 'seam_regrowth') };
const digging =
  (apply: object[] = [RUN]) =>
  (c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.101';
    for (const k of ['action_recipe', 'reaction'])
      c.manifest.requires.capabilities[k] = c.lock.capabilities[k] = 1;
    // The step emits no event: it needs no fact@1 (which owns fact_changed).
    delete c.manifest.requires.capabilities.fact;
    delete c.lock.capabilities.fact;
    c.recipes = {
      [`${S}recipe/dig`]: {
        key: 'dig',
        label: 'action.mine',
        aliases: ['dig'],
        target: { kind: 'detail', room: ref('room', 'mine'), detail: 'seam' },
        priority: 10,
        policy: { policy_version: 1, root: { op: 'all', items: [] } },
        outcomes: {
          success: {
            sequence: [{ op: 'event.emit', event: 'dig' }],
            narration: { actor: 'narration.mine' },
          },
        },
      },
    };
    c.reactions = {
      [`${S}reaction/dig`]: { key: 'dig', on: { event: 'custom_event', custom: 'dig' }, apply },
    };
  };
const dig = (w: World) => {
  const r = play(w, { type: 'perform', action: 'dig' });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};

// Breaks: the step is not dispatched (the mine stays empty), ignores the cap (3 on the third dig)
// or count (2 at once), completes or schedules the entry's job (jobs change), or the timed job
// stops counting the stock the step moved (a third ore at 3600), or the loader claims the step
// emits fact_changed (no fact@1 here).
test('a dig event moves one ore from the store at once, up to the cap; the job still runs', () => {
  const loaded = edited(digging());
  assert.ok(loaded.ok, JSON.stringify(loaded));
  let w = harvested(loaded.cartridge as Cartridge);
  const jobs = w.state.jobs;
  w = dig(w);
  assert.deepEqual(ore(w), [1, 2]);
  w = dig(w);
  assert.deepEqual(ore(w), [2, 1]);
  w = dig(w);
  assert.deepEqual(ore(w), [2, 1]);
  assert.equal(w.state.clock, 0);
  assert.deepEqual(w.state.jobs, jobs);
  w = waitUntil(w, 3600);
  assert.deepEqual(ore(w), [2, 1]);
});

// Breaks: the loader drops replenish.run's refusal under `after` (as item.move's, row FD1).
// Stale and repeated keys are the compiler's (test/loka/content_replenish_test.exs).
test('loader: replenish.run refuses a delayed reaction', () => {
  const reload = (edit: (c: any) => void) => {
    const r = edited(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const at = `.cartridge.reactions["${S}reaction/dig"]`;
  assert.deepEqual(
    reload((c) => {
      digging()(c);
      c.reactions[`${S}reaction/dig`].after = 60;
    }),
    ['SCHEMA_VIOLATION', `${at}.apply[0].op`],
  );
});

// Break: replenish.run ignores the root command's write of the item (hs-1 fix round 1): the drop
// and the same-command sweep write the ore in two groups, and the drop faults conflicting_write.
test('a sweep rule on item_dropped moves the dropped ore on in the same command', () => {
  const loaded = edited((c) => {
    digging()(c);
    c.replenish[`${S}replenish/sweep`] = {
      ...c.replenish[`${S}replenish/seam_regrowth`],
      key: 'sweep',
      from: { in: 'room', room: ref('room', 'mine') },
      to: { in: 'room', room: ref('room', 'store') },
      cap: 5,
    };
    c.reactions[`${S}reaction/dig`].on = { event: 'item_dropped' };
    c.reactions[`${S}reaction/dig`].apply = [{ ...RUN, key: ref('replenish', 'sweep') }];
  });
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const w = harvested(loaded.cartridge as Cartridge);
  assert.deepEqual(ore(w), [0, 3]); // the other two ore are held
  const rooms = [id(w, 'room', 'mine'), id(w, 'room', 'store')];
  const held = ORE.map((k) => id(w, 'item', k)).find(
    (o) => !rooms.includes(w.state.containers[o]!),
  )!;
  const r = play(w, { type: 'drop', item_id: held });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.equal(r.world.state.containers[held], rooms[1]);
});
