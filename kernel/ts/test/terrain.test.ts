// Terrain movement costs (toolbox row 43a; docs/system/mechanics.md, Terrain movement costs) on
// terrain_sampler's pinned artifact: yard (no tags) north to road [road], east to ford
// [road, marsh], east to fen [marsh]; a move costs 3 mv, road 50%, marsh 300%; mv starts at 10.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { type Cartridge, type World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/terrain_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);
const room = (k: string) => `terrain_sampler@0.0.1:room/${k}`;

/** The pinned artifact, edited and re-hashed, loaded. */
function load(edit: (c: any) => void = () => {}) {
  const c = structuredClone(kat.value);
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const refused = (edit: (c: any) => void) => {
  const r = load(edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};

let n = 0;
const id = () => `eeeeeeee-4343-4a4a-8a4a-${String(++n).padStart(12, '0')}` as never;
/** A new game in the yard on the artifact edited by `edit`. */
function yard(edit?: (c: any) => void) {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  n = 0;
  return newWorld(
    r.cartridge as Cartridge,
    '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e43' as never,
    [1, 2, 3, 4],
  );
}
function send(w: World, direction: string) {
  const payload = { type: 'move', actor_id: w.character, direction };
  return step(w, { id: id(), world_context_id: w.context, payload } as never, n);
}
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'))!;
/** Moves `direction`, accepted, and returns the world and the mv the move wrote (0: no op). */
function go(w: World, direction: string): [World, number] {
  const r = send(w, direction);
  assert.equal(code(r), 'accepted', JSON.stringify(r.decision));
  const ops = (r.decision as any).delta.ops.filter((o: any) => o.op === 'resource.adjust');
  return [r.world, ops.reduce((a: number, o: any) => a + o.from - o.to, 0)];
}
/** The moves in turn: each move's mv paid, and the last world. */
function walk(w: World, dirs: string[]): [World, number[]] {
  const paid: number[] = [];
  for (const d of dirs) {
    const [next, p] = go(w, d);
    paid.push(p);
    w = next;
  }
  return [w, paid];
}

// Breaks: the destination's tags do not scale the fare (or the origin's do), a percent rounds
// instead of flooring, or the exits list shows a move the fare refuses as available.
test('case 1: road halves, marsh triples, the fen is refused and shown unavailable', () => {
  const [w, paid] = walk(yard(), ['north', 'east']);
  assert.deepEqual(paid, [1, 3]);
  assert.equal(mv(w), 6);
  const r = send(w, 'east');
  assert.equal(code(r), 'insufficient_resource');
  assert.equal(mv(r.world), 6);
  const exits = gameView(w).exits;
  const east = exits.find((e) => e.direction === 'east')!;
  assert.deepEqual([east.available, east.reason?.code], [false, 'insufficient_resource']);
  assert.equal(exits.find((e) => e.direction === 'west')!.available, true);
});

// Breaks: the origin's tags scale the fare (yard is untagged, so road to yard costs 3).
test('case 2: the way back pays the destination, not the origin', () => {
  const [w, paid] = walk(yard(), ['north', 'east', 'west', 'south', 'north']);
  assert.deepEqual(paid, [1, 3, 1, 3, 1]);
  assert.equal(mv(w), 1);
  assert.equal(code(send(w, 'south')), 'insufficient_resource');
});

// Breaks: a fare equal to the whole pool is refused, or a move at 0 mv into a road is free.
test('case 3: a fare may spend the pool to 0; the next is refused', () => {
  const [w, paid] = walk(
    yard((c) => (c.resources['terrain_sampler@0.0.1:resource/mv'].start = 4)),
    ['north', 'east'],
  );
  assert.deepEqual([paid, mv(w)], [[1, 3], 0]);
  assert.equal(code(send(w, 'west')), 'insufficient_resource');
});

// Breaks: the tags apply in a sorted or fixed order rather than the room's authored order.
test('case 4: authored tag order: marsh then road floors to 4', () => {
  const [w, paid] = walk(
    yard((c) => (c.rooms[room('ford')].tags = ['marsh', 'road'])),
    ['north', 'east'],
  );
  assert.deepEqual([paid, mv(w)], [[1, 4], 5]);
});

// Breaks: terrain-free movement changes (the base cost no longer holds without a table).
test('case 5: without a terrain table a move costs the base 3', () => {
  const [w, paid] = walk(
    yard((c) => delete c.world.movement.terrain),
    ['north'],
  );
  assert.deepEqual([paid, mv(w)], [[3], 7]);
});

// Breaks: terrain does not scale the 1 mv default, or a fare of 0 writes a resource op.
test('case 6: without cost the 1 mv default scales: 0, 0, then 3', () => {
  const [w, paid] = walk(
    yard((c) => delete c.world.movement.cost),
    ['north', 'east', 'east'],
  );
  assert.deepEqual([paid, mv(w)], [[0, 0, 3], 7]);
});

// Breaks: the schema admits an unknown tag or a percent outside 0..1000, or the loader admits
// the sampler under kernel_api 1.105.
test('case 7: the loader refuses an unknown tag, a bad percent and API 1.105', () => {
  const terrain = (t: object) => (c: any) => (c.world.movement.terrain = t);
  const schema = (at: string) => ['SCHEMA_VIOLATION', `.cartridge.world.movement.terrain${at}`];
  assert.deepEqual(refused(terrain({ lava: 50 })), schema('.lava'));
  assert.deepEqual(refused(terrain({ road: 1001 })), schema('.road'));
  assert.deepEqual(refused(terrain({ road: -1 })), schema('.road'));
  assert.equal(refused(terrain({ road: 0, marsh: 1000 })), 'loaded');
  assert.equal(
    refused((c) => (c.world.movement = {})),
    'loaded',
  );
  assert.equal(
    refused(() => {}),
    'loaded',
  );
  assert.deepEqual(
    refused((c) => (c.manifest.requires.kernel_api.at_least = '1.105')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
});
