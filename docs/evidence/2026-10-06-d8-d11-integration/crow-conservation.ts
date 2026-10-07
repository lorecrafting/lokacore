// A controlled thirty-day engine replay; the checker has an explicit fifth-crow red control.
import assert from 'node:assert/strict';
import { fresh, prefix, ref } from '../../../kernel/ts/test/transport_fixture.ts';
import { elapsedCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { readFileSync } from 'node:fs';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { step, stepElapsed, type World } from '../../../kernel/ts/src/index.ts';
const start = 43200;
const end = start + 30 * 86400;
let world = fresh((c: any) => {
  c.entry = ref('room', 'village_green'); c.calendar.start = start;
  c.items[`${prefix}:item/old_coin`].location = { in: 'room', room: ref('room', 'village_green') };
});
const ids = JSON.parse(readFileSync('protocol/fixtures/missing_child_v039_ids.json', 'utf8'));
const coin = ids['item/old_coin'];
const nest = ids['item/crow_nest'];
let revision = 1;
function act(type: 'take' | 'drop') {
  const result = step(world, { id: `aaaaaaaa-0000-4000-8000-${String(++revision).padStart(12, '0')}` as never, world_context_id: world.context, payload: { type, actor_id: world.character, item_id: coin as never } }, revision);
  assert.equal(result.decision.kind, 'accepted'); world = result.world;
}
act('take'); act('drop');
if (process.argv.includes('--red-control')) {
  const [id, identity] = Object.entries(world.state.created!).find(([, i]) => i.origin.kind === 'spawned' && world.populationSpecs[key(i.origin.by)]?.plan.scavenge)!;
  const extra = 'aaaaaaaa-0000-4000-8000-999999999999';
  const hp = Object.entries(world.state.resources!).find(([target]) => { const t = JSON.parse(target); return t.entity_id === id && t.resource.key === 'hp'; })!;
  const target = { ...JSON.parse(hp[0]), entity_id: extra };
  world = { ...world, entities: { ...world.entities, [extra]: world.entities[id] }, state: { ...world.state, resources: { ...world.state.resources, [key(target)]: hp[1] }, containers: { ...world.state.containers, [extra]: world.state.containers[id] }, created: { ...world.state.created, [extra]: { ...identity, id: extra as never, origin: { ...identity.origin, member_id: extra as never } as never } } } };
}
const run = 'bbbbbbbb-0000-4000-8000-000000000008' as never;
let steps = 0, maxCrows = 0, maxNest = 0;
function conserved(w: World) {
  const crows = Object.entries(w.state.created ?? {}).filter(([, row]) => row.origin.kind === 'spawned' && w.populationSpecs[key(row.origin.by)]?.plan.scavenge);
  const live = crows.filter(([id]) => Object.entries(w.state.resources ?? {}).some(([target, row]) => { const t = JSON.parse(target); return t.entity_id === id && t.resource.key === 'hp' && row.value > 0; }));
  maxCrows = Math.max(maxCrows, live.length);
  assert.equal(live.length, 4, 'exactly four live authored crow slots, never a fifth birth');
  const roots = Object.values(w.state.containers).filter((id) => id === nest).length;
  maxNest = Math.max(maxNest, roots); assert.ok(roots <= 8, 'nest remains bounded at eight direct roots');
  const coins = Object.entries(w.entities).filter(([, e]) => e.kind === 'item' && e.key === 'old_coin');
  assert.equal(coins.length, 1, 'one exact authored coin is never duplicated');
  assert.ok(w.state.containers[coin], 'the coin always has a current holder');
  assert.equal(coins[0][0], coin, 'coin identity remains unchanged');
}
conserved(world);
while (world.state.clock < end) {
  const due = Object.values(world.state.jobs ?? {}).filter((j) => j.status === 'pending').map((j) => j.due_time).filter((at) => at > world.state.clock);
  const until = Math.min(end, ...due);
  const result = stepElapsed(world, { id: elapsedCommandId(run, world.context, world.state.clock, until) as never, world_context_id: world.context, payload: { type: 'elapsed', actor_id: world.character, run_id: run, from: world.state.clock, until } }, ++revision);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  world = result.world; steps++; conserved(world);
}
assert.equal(world.state.containers[coin], nest, 'delivered coin remains recoverable in the original nest');
for (const row of Object.values(world.state.crows ?? {})) assert.equal(row.phase, 'idle', 'transport returns before ordinary wandering');
console.log(JSON.stringify({ logical_days: 30, steps, max_live_crows: maxCrows, max_nest_roots: maxNest, coin_id_conserved: true, coin_holder: 'original_nest' }));
