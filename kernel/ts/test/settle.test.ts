// Settle S3-1 (N1) on the compiled settle sampler (mechanics.md "Settle S3-1: narrate"): the
// `arrival_line` rule says `settle.arrival_line` when the character enters `road` (west of the
// entry `square`). The calendar starts at 600. Twin of test/loka/content_settle_test.exs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { living } from '../src/mechanics/death/shared.ts';
import { livingCount } from '../src/mechanics/population/refs.ts';
import { hydrate } from '../src/runtime/created.ts';
import { cartridgeOf, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-settle-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/settle_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const RULE = 'settle_sampler@0.0.1:reaction/arrival_line';
const LINE = 'settle.arrival_line';

const base = cartridgeOf(artifact);
function world(edit?: (c: any) => void, context = '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'): World {
  const r = reload(base, edit);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(r.cartridge as Cartridge, context as never, [1, 2, 3, 4]);
}
const lines = (d: { narration?: { key: string }[] }) => (d.narration ?? []).map((l) => l.key);
function west(w: World) {
  const id = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
  const payload = { actor_id: w.character, type: 'move', direction: 'west' };
  const r = step(w, { id, world_context_id: w.context, payload } as never, 1);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function wait(w: World, until: number) {
  const [run_id, from] = ['cccccccc-0000-4000-8000-000000000001' as never, w.state.clock];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const id = elapsedCommandId(run_id, w.context, from, until) as never;
  const r = stepElapsed(w, { id, world_context_id: w.context, payload } as never, 2);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return lines(r.decision as never);
}

// Breaks: the narrate branch dropped (or lowered to an op), so the move's receipt says nothing, or
// says the line twice. The move's own line (movement.moved) comes first.
test('S3-1: entering the road says the authored line once in the move receipt', () => {
  assert.deepEqual(lines(west(world()).decision as never), ['movement.moved', LINE]);
});

// Breaks: a line goes before the lines of the steps before it (unshift, not push).
test('S3-1: a rule says its lines in step order', () => {
  const first = { op: 'narrate', text: 'room.road.title' };
  const w = world((c) => c.reactions[RULE].steps.unshift(first));
  assert.deepEqual(lines(west(w).decision as never), ['movement.moved', 'room.road.title', LINE]);
});

// Breaks: a fired (after) rule skips the step, or says it when scheduled instead of when due.
test('S3-1: a delayed line is said by the advance that reaches its due time, not before', () => {
  const w = world((c) => (c.reactions[RULE].after = 300));
  assert.equal(w.state.clock, 600);
  const moved = west(w);
  assert.ok(!lines(moved.decision as never).includes(LINE));
  assert.deepEqual(wait(moved.world, 899), []);
  assert.deepEqual(wait(moved.world, 900), [LINE]);
});

// Settle S4-1 (N2) on the same sampler (mechanics.md "Plan move (Settle S4-1)"): `band_out` moves
// every living member of the `raiders` plan (home square, cap 3, targets 0) to `hills` when the
// instance fact band_out turns true. Test-only hour rules spawn the band and set the fact; the
// calendar runs 100 units an hour from 600 (hour 6).
const ref = (kind: string, key: string) => ({
  cartridge_id: 'settle_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const PLAN = ref('population', 'raiders');
const BAND = ref('fact', 'band_out');
const MOVE = 'settle_sampler@0.0.1:reaction/band_out';
function hour(c: any, key: string, at: number, steps: object[]) {
  c.reactions[`settle_sampler@0.0.1:reaction/${key}`] = {
    key,
    on: { event: 'clock_hour' },
    when: { op: 'time_window', from: at, to: at + 1 },
    steps,
  };
}
// Two raiders spawn at hour 7: slot 3 holds A, slot 2 holds B (this world context makes EntityId
// order A, B, unlike slot order); band_out turns true at `out` and (with band_in,
// a test-only plan move back to square) false at `back`.
function band(out: number, back?: number, spawn = true, edit = (_: any) => {}) {
  return world((c) => {
    if (spawn)
      hour(c, 'spawn', 7, [
        { op: 'population.spawn', plan: PLAN },
        { op: 'population.spawn', plan: PLAN },
      ]);
    hour(c, 'out', out, [{ op: 'fact.assign', fact: BAND, value: true }]);
    edit(c);
    if (back === undefined) return;
    hour(c, 'back', back, [{ op: 'fact.assign', fact: BAND, value: false }]);
    c.reactions['settle_sampler@0.0.1:reaction/band_in'] = {
      ...c.reactions[MOVE],
      key: 'band_in',
      when: { op: 'fact_compare', fact: BAND, equals: false },
      steps: [{ op: 'npc.move', plan: PLAN, room: ref('room', 'square') }],
    };
  }, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e12');
}
function advance(w: World, until: number) {
  const [run_id, from] = ['cccccccc-0000-4000-8000-000000000005' as never, w.state.clock];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const id = elapsedCommandId(run_id, w.context, from, until) as never;
  const r = stepElapsed(w, { id, world_context_id: w.context, payload } as never, 3);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const events = (r.decision as never as { events: { payload: Record<string, any> }[] }).events;
  const entered = events.filter((e) => e.payload.type === 'entity_entered_room');
  const ops = r.decision.kind === 'accepted' ? r.decision.delta.ops : [];
  return { w: r.world, ops, entered: entered.map((e) => [e.payload.entity_id, e.payload.room_id]) };
}
function attack(w: World, target_id: string) {
  const id = 'bbbbbbbb-0000-4000-8000-000000000002' as never;
  const payload = { actor_id: w.character, type: 'attack', target_id };
  const r = step(w, { id, world_context_id: w.context, payload } as never, 4);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const room = (w: World, key: string) => w.roomIds[`settle_sampler@0.0.1:room/${key}`]!;
const member = (w: World, slot: number) =>
  w.state.population_slots![key({ kind: 'population_slot', plan: PLAN, slot })]!;
const [A, B] = ['958ab551-90e6-8530-8abb-d7d3d42537a8', 'eeb7d808-89c9-81b0-8528-e5d406dee0da'];

// Breaks: the plan step moves nothing, moves in slot order (B first) instead of EntityId order,
// emits no entered event per member, or the move ends the members' slots (population_count).
test('S4-1: band_out moves every member to the hills in EntityId order, one event each', () => {
  const a = advance(band(8), 700);
  assert.deepEqual([member(a.w, 3).member_id, member(a.w, 2).member_id], [A, B]);
  assert.deepEqual(
    [A, B].map((e) => a.w.state.containers[e as never]),
    [room(a.w, 'square'), room(a.w, 'square')],
  );
  const b = advance(a.w, 800);
  const hills = room(b.w, 'hills');
  assert.deepEqual(b.entered, [
    [A, hills],
    [B, hills],
  ]);
  assert.deepEqual(
    [A, B].map((e) => b.w.state.containers[e as never]),
    [hills, hills],
  );
  assert.equal(livingCount(b.w, PLAN as never), 2);
});

// Breaks: a member's second plan move in one advance (another delivery) takes that delivery's
// writer group instead of joining its first move's (conflicting_write; writer_groups.test.ts).
test("S4-1: two plan moves of one band in one advance share each member's writer group", () => {
  const ROAD = 'settle_sampler@0.0.1:fact/band_road';
  const w = advance(
    band(8, undefined, true, (c) => {
      c.facts[ROAD] = { ...c.facts['settle_sampler@0.0.1:fact/band_out'], key: 'band_road' };
      const road = ref('fact', 'band_road');
      c.reactions['settle_sampler@0.0.1:reaction/out'].steps.push({
        op: 'fact.assign',
        fact: road,
        value: true,
      });
      c.reactions['settle_sampler@0.0.1:reaction/band_road'] = {
        ...c.reactions[MOVE],
        key: 'band_road',
        on: { event: 'fact_changed', fact: road },
        when: { op: 'fact_compare', fact: road, equals: true },
        steps: [{ op: 'npc.move', plan: PLAN, room: ref('room', 'road') }],
      };
    }),
    700,
  ).w;
  const b = advance(w, 800);
  const [hills, road] = [room(w, 'hills'), room(w, 'road')];
  assert.deepEqual(b.entered, [
    [A, hills],
    [B, hills],
    [A, road],
    [B, road],
  ]);
  for (const e of [A, B]) {
    const moves = b.ops.filter((o) => o.op === 'entity.transfer' && o.entity_id === e);
    assert.deepEqual(
      moves.map((o: any) => o.source_id),
      [room(w, 'square'), hills],
    );
    assert.equal(new Set(moves.map((o) => o.writer_group)).size, 1);
  }
});

// Breaks: the plan step moves a dead member (its slot keeps member_id until replaced), or the
// band_in move back to the square skips the survivor.
test('S4-1: a slain member stays where it fell; the survivor goes out and comes back', () => {
  let w = attack(advance(band(13, 14), 700).w, A);
  w = advance(w, 1200).w;
  assert.equal(living(w, A as never), false);
  const at = w.state.containers[A as never];
  const out = advance(w, 1300);
  assert.deepEqual(out.entered, [[B, room(w, 'hills')]]);
  const back = advance(out.w, 1400);
  assert.deepEqual(back.entered, [[B, room(w, 'square')]]);
  assert.equal(back.w.state.containers[A as never], at);
});

// Breaks: the plan step moves a member out of an open encounter, or one engaged member stops the
// rest of the band.
test('S4-1: an engaged member stays; the rest of the band moves', () => {
  const w = attack(advance(band(8), 700).w, A);
  const b = advance(w, 800);
  assert.ok(engaged(b.w, A as never));
  assert.deepEqual(b.entered, [[B, room(w, 'hills')]]);
  assert.equal(b.w.state.containers[A as never], room(w, 'square'));
});

// Breaks: a plan with no living member faults or emits an event.
test('S4-1: a plan with no member moves nothing', () => {
  assert.deepEqual(advance(band(8, undefined, false), 800).entered, []);
});

// Breaks (loka-kgd.159): a spawn and a plan move of the newborn in one hour fault on the containment
// write the move's writer-group join misses (conflicting_write), whichever rule runs first, and a
// band out of its plan's area fails the save loader.
for (const [first, second] of [
  ['a_spawn', 'z_move'],
  ['z_spawn', 'a_move'],
]) {
  test(`kgd.159: ${first} then ${second} in one hour: the newborn ends in the hills and reloads`, () => {
    const w = world((c) => {
      hour(c, first!, 7, [{ op: 'population.spawn', plan: PLAN }]);
      hour(c, second!, 7, [{ op: 'npc.move', plan: PLAN, room: ref('room', 'hills') }]);
    });
    const a = advance(w, 700);
    const born = member(a.w, 3).member_id as never;
    const expected = second === 'z_move' ? 'hills' : 'square';
    assert.equal(a.w.state.containers[born], room(a.w, expected));
    assert.ok(hydrate(w, JSON.parse(JSON.stringify(a.w.state)), true), 'the save loads');
  });
}

test('kgd.159: a band moved out of its area in a later hour still reloads', () => {
  const b = advance(advance(band(8), 700).w, 800);
  assert.ok(hydrate(band(8), JSON.parse(JSON.stringify(b.w.state)), true));
});

// Breaks: the loader's new plan-move rooms let a member stand anywhere; a forged room still refuses.
test('kgd.159: a member in a room no plan move names fails the save loader', () => {
  const w = band(99, undefined, true, (c) => delete c.reactions[MOVE]);
  const { w: b } = advance(w, 700);
  const forged = { ...b.state.containers, [member(b, 3).member_id as never]: room(b, 'hills') };
  assert.ok(hydrate(w, JSON.parse(JSON.stringify(b.state)), true), 'the unforged save loads');
  assert.equal(hydrate(w, { ...b.state, containers: forged }, true), undefined);
});
