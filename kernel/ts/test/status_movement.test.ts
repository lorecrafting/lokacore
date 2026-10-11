// Status reader 7 (movement) on the compiled ward sampler, edited: the shrine (north of the hall)
// applies `warded` and `hushed` to whoever enters; the den (east of the hall) is given terrain tags
// and the statuses `movement` declarations per test. The mv pool starts at 100.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { type Cartridge, type World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-ward-movement-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ward_sampler', file], {
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
const S = (key: string) => `ward_sampler@0.0.1:status/${key}`;
const DEN = 'ward_sampler@0.0.1:room/den';
const MV = {
  cartridge_id: 'ward_sampler',
  cartridge_version: '0.0.1',
  kind: 'resource',
  key: 'mv',
};

let n = 0;
const id = () => `eeeeeeee-5656-4545-8545-${String(++n).padStart(12, '0')}` as never;
function send(w: World, direction: string) {
  const payload = { type: 'move', actor_id: w.character, direction };
  return step(w, { id: id(), world_context_id: w.context, payload } as never, n);
}
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
function go(w: World, direction: string) {
  const r = send(w, direction);
  assert.equal(code(r), 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'))!;

/** `content` with the den tagged `tags`, each status's movement as given, and `world` merged. */
function edited(tags: string[], movement: Record<string, object>, world: object = {}): Cartridge {
  const statuses = { ...content.statuses };
  for (const [key, m] of Object.entries(movement))
    statuses[S(key)] = { ...statuses[S(key)]!, movement: m } as never;
  const rooms = { ...content.rooms, [DEN]: { ...content.rooms[DEN]!, tags } };
  return { ...content, statuses, rooms, world: { ...content.world, ...world } } as Cartridge;
}
/** A new game on `c`, in the hall. */
function hall(c: Cartridge) {
  n = 0;
  return newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e57' as never, [1, 2, 3, 4]);
}
const east = (w: World) => gameView(w).exits.find((e) => e.direction === 'east')!;

// Breaks: a terrain-tagged room admits a body no active status passes into (crossable dropped or
// passes ignored), a pass of another tag or of only one of the room's tags admits it, or the
// GameView offers the exit step refuses.
test('a terrain room admits a move only while active statuses pass each of its tags', () => {
  const water = hall(edited(['water', 'exposed'], { warded: { passes: ['water'] } }));
  assert.deepEqual([east(water).available, code(send(water, 'east'))], [false, 'invalid_state']);
  const blessed = go(go(water, 'north'), 'south');
  assert.equal(east(blessed).available, true);
  assert.equal(code(send(blessed, 'east')), 'accepted');
  for (const [tags, movement] of [
    [['water'], { warded: { passes: ['air'] } }],
    [['water', 'chasm'], { warded: { passes: ['water'] } }],
  ] as const) {
    const w = go(go(hall(edited([...tags], movement)), 'north'), 'south');
    assert.equal(code(send(w, 'east')), 'invalid_state', JSON.stringify(movement));
  }
  const both = edited(['water', 'chasm'], {
    warded: { passes: ['water'] },
    hushed: { passes: ['chasm'] },
  });
  assert.equal(code(send(go(go(hall(both), 'north'), 'south'), 'east')), 'accepted');
});

// Breaks: cost_percent is ignored, rounded up, summed as deltas instead of applied in turn, or
// applied in an order other than definition order (hushed before warded), or a fare rounded to 0
// still writes an mv op. Fare 15 mv.
test('cost_percent scales the fare, each status in turn in definition order, rounded down', () => {
  const fare = { movement: { cost: { resource: MV, amount: 15 } } };
  for (const [movement, paid] of [
    [{}, 15],
    [{ warded: { cost_percent: 50 } }, 7],
    [{ hushed: { cost_percent: 300 }, warded: { cost_percent: 50 } }, 22],
  ] as const) {
    const blessed = go(hall(edited([], movement, fare)), 'north');
    assert.equal(mv(blessed) - mv(go(blessed, 'south')), paid, JSON.stringify(movement));
  }
  // The default 1 mv fare at 50 rounds to 0: the move is free and writes no mv op.
  const free = go(hall(edited([], { warded: { cost_percent: 50 } })), 'north');
  const r = send(free, 'south');
  assert.equal(code(r), 'accepted');
  assert.equal(mv(r.world), mv(free));
  assert.ok(!JSON.stringify(r.decision).includes('"resource.adjust"'), JSON.stringify(r.decision));
});

/** The sampler's artifact, edited and re-hashed, loaded: its first diagnostic's code and path. */
function reload(edit: (c: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}

// Breaks (twin of test/loka/content_status_movement_test.exs): a status movement, a room's air,
// chasm or water tag, or an item's water tag loads under API 1.61, or a movement status without per_tick is refused.
test('loader: movement and terrain tags need API 1.62; movement stands in for per_tick', () => {
  const api = (v: string) => (c: any) => (c.manifest.requires.kernel_api.at_least = v);
  const moving = (c: any) => {
    const { resistances: _, ...plain } = c.statuses[S('warded')];
    c.statuses[S('warded')] = { ...plain, movement: { cost_percent: 50 } };
  };
  const tagged = (tag: string) => (c: any) => {
    c.rooms[DEN].tags = [tag];
    c.manifest.requires.capabilities.tags = c.lock.capabilities.tags = 1;
  };
  const floor = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
  const item = (c: any) => {
    c.items[Object.keys(c.items)[0]].tags = ['water'];
    c.manifest.requires.capabilities.tags = c.lock.capabilities.tags = 1;
  };
  for (const edit of [moving, tagged('air'), tagged('chasm'), tagged('water'), item]) {
    assert.equal(
      reload((c) => (api('1.62')(c), edit(c))),
      'loaded',
    );
    assert.deepEqual(
      reload((c) => (api('1.61')(c), edit(c))),
      floor,
    );
  }
  assert.equal(
    reload((c) => (api('1.61')(c), tagged('wooden')(c))),
    'loaded',
  );
});
