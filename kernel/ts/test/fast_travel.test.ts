// Toolbox row 32 on the compiled fast travel sampler: a carter's road joins North Post and South
// Post (not neighbours; the lane lies between) for 3 coins a ride, each direction gated by its
// action policy `visited_count {room: <destination>, at_least: 1}`. The player starts at North Post
// with 10 coins at clock 28800. Expected values are hand-counted from the sampler's literals.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fast-travel-'));
let artifact: Uint8Array, compiled: string;
try {
  const file = join(scratch, 'artifact.json');
  const r = spawnSync('mix', ['loka.compile', 'cartridges/fast_travel_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  compiled = r.stdout + r.stderr;
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const S = 'fast_travel_sampler@0.0.1:';
const C0 = 28800;

let n = 0;
const play = (w: World, p: object, action?: string) =>
  step(
    w,
    {
      id: `dddddddd-3232-4333-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
    action as never,
  );
const ok = (r: ReturnType<typeof step>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const refused = (r: ReturnType<typeof step>, code: string) => {
  assert.equal(r.decision.kind === 'rejected' && r.decision.error.code, code);
  return r.world;
};
const route = (k: string) => ({
  cartridge_id: 'fast_travel_sampler',
  cartridge_version: '0.0.1',
  kind: 'transport',
  key: k,
});
const routes = { north_road: 'ride_south', south_road: 'ride_north' } as const;
const ride = (w: World, k: keyof typeof routes, quoted_fare = 3) =>
  play(
    w,
    {
      type: 'use_transport',
      endpoint_id: Object.keys(w.details).find((id) => w.details[id].transport?.route.key === k),
      route: route(k),
      quoted_fare,
    },
    routes[k],
  );
const walk = (w: World, direction: string) => ok(play(w, { type: 'move', direction }));
const carter = (w: World) => w.entityIds[`${S}npc/carter`];
const coins = (w: World) => [w.body, carter(w)].map((id) => level(w, id, resourceRef(w, 'coins')));
const at = (w: World) =>
  Object.keys(w.roomIds).find((r) => w.roomIds[r] === w.state.containers[w.body]);
const offer = (w: World) => gameView(w).notices!.find((x) => x.transport)!.transport!.action;
const fresh = () => {
  n = 0;
  return newWorld(content, '6e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f21' as never, [3, 2, 3, 2]);
};

// Breaks: the compiler warns VISITS_UNRECORDED (knowledge@1 dropped), so visits never count.
test('the sampler compiles with no warning', () => {
  assert.doesNotMatch(compiled, /"severity":"warning"/);
});

// Breaks: an ungated route (policy `all []`) lets the player ride to a post never visited.
test('a route to an unvisited post is offered unavailable and refused', () => {
  const w = fresh();
  assert.equal(at(w), `${S}room/north_post`);
  assert.equal(level(w, w.body, resourceRef(w, 'hp')), 10);
  const { available, reason } = offer(w);
  assert.deepEqual([available, reason], [false, { code: 'invalid_state' }]);
  assert.equal(refused(ride(w, 'north_road'), 'invalid_state'), w);
  assert.deepEqual(coins(w), [10, 0]);
  assert.equal(w.state.clock, C0);
});

// Breaks: at_least 2, a fare paid without the trip, a trip that moves the clock, or one fare for
// both routes.
test('visited posts ride both ways instantly for each route fare, refusing stale quotes and the broke', () => {
  let w = walk(walk(fresh(), 'south'), 'south');
  assert.equal(at(w), `${S}room/south_post`);
  assert.equal(offer(w).available, true);
  let clock = w.state.clock;
  w = ok(ride(w, 'south_road'));
  assert.equal(at(w), `${S}room/north_post`);
  assert.deepEqual(coins(w), [7, 3]);
  assert.equal(w.state.clock, clock);
  clock = w.state.clock;
  w = ok(ride(w, 'north_road'));
  assert.equal(at(w), `${S}room/south_post`);
  assert.deepEqual(coins(w), [4, 6]);
  assert.equal(w.state.clock, clock);
  assert.equal(refused(ride(w, 'south_road', 2), 'invalid_target'), w);
  const purse = key({ kind: 'resource', entity_id: w.body, resource: resourceRef(w, 'coins') });
  const rows = w.state.resources!;
  const broke = {
    ...w,
    state: { ...w.state, resources: { ...rows, [purse]: { ...rows[purse], value: 2 } } },
  };
  assert.equal(refused(ride(broke, 'south_road'), 'insufficient_resource'), broke);
  assert.deepEqual(coins(broke), [2, 6]);
  assert.equal(at(broke), `${S}room/south_post`);
});
