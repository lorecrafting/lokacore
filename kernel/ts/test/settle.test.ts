// Settle S3-1 (N1) on the compiled settle sampler (mechanics.md "Settle S3-1: narrate"): the
// `arrival_line` rule says `settle.arrival_line` when the character enters `road` (west of the
// entry `square`). The calendar starts at 600. The 1.103 floor is loader_floors.json's
// "a narrate step" case. Twin of test/loka/content_settle_test.exs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { living } from '../src/mechanics/death/shared.ts';
import { livingCount } from '../src/mechanics/population/refs.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { hydrate } from '../src/runtime/created.ts';
import { check } from '../src/runtime/invariants.ts';
import { validate } from '../src/foundation/validate.ts';
import { resolved } from '../src/commands/actions.ts';

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

function load(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
function world(edit?: (c: any) => void, context = '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'): World {
  const r = load(edit);
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
// says the line twice. A move's own text is view-side; its receipt carries only this line.
test('S3-1: entering the road says the authored line once in the move receipt', () => {
  assert.deepEqual(lines(west(world()).decision as never), [LINE]);
});

// Breaks: a line goes before the lines of the steps before it (unshift, not push).
test('S3-1: a rule says its lines in step order', () => {
  const first = { op: 'narrate', text: 'room.road.title' };
  const w = world((c) => c.reactions[RULE].apply.unshift(first));
  assert.deepEqual(lines(west(w).decision as never), ['room.road.title', LINE]);
});

// Breaks: a fired (after) rule skips the step, or says it when scheduled instead of when due.
test('S3-1: a delayed line is said by the advance that reaches its due time, not before', () => {
  // The loader refuses the player gate's subject leaf in an `after` rule (SCHEMA_VIOLATION).
  const w = world((c) => {
    c.reactions[RULE].after = 300;
    delete c.reactions[RULE].when;
  });
  assert.equal(w.state.clock, 600);
  const moved = west(w);
  assert.ok(!lines(moved.decision as never).includes(LINE));
  assert.deepEqual(wait(moved.world, 899), []);
  assert.deepEqual(wait(moved.world, 900), [LINE]);
});

// Breaks: the loader admits a line whose text key is not in the catalog.
test('loader: a narrate text key resolves in the text catalog', () => {
  const r = load((c) => (c.reactions[RULE].apply[0].text = 'settle.missing'));
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'UNRESOLVED_REFERENCE',
    `.cartridge.reactions["${RULE}"].apply[0].text`,
  ]);
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
function hour(c: any, key: string, at: number, apply: object[]) {
  c.reactions[`settle_sampler@0.0.1:reaction/${key}`] = {
    key,
    on: { event: 'clock_hour' },
    when: { policy_version: 1, root: { op: 'time_window', from: at, to: at + 1 } },
    apply,
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
      when: { policy_version: 1, root: { op: 'fact_compare', fact: BAND, equals: false } },
      apply: [{ op: 'npc.move', plan: PLAN, room: ref('room', 'square') }],
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
const [A, B] = ['83d13ad4-0f8a-8037-9f83-ecfdc02e6e5b', 'f26a01c4-9f87-837a-b166-460cadc44708'];

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
      c.reactions['settle_sampler@0.0.1:reaction/out'].apply.push({
        op: 'fact.assign',
        fact: road,
        value: true,
      });
      c.reactions['settle_sampler@0.0.1:reaction/band_road'] = {
        ...c.reactions[MOVE],
        key: 'band_road',
        on: { event: 'fact_changed', fact: road },
        when: { policy_version: 1, root: { op: 'fact_compare', fact: road, equals: true } },
        apply: [{ op: 'npc.move', plan: PLAN, room: ref('room', 'road') }],
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

// Breaks: the loader admits an unknown plan, a plan move that also names an NPC, or one with no
// room (the event's room is no place for a whole band). Twin of content_settle_test.exs.
test('loader: a plan move names a known plan and a room, never an NPC', () => {
  const at = `.cartridge.reactions["${MOVE}"].apply[0]`;
  const refused = (edit: (s: any) => void) => {
    const r = load((c) => {
      // A placed NPC (the raider is a spawn template, refused at .npc on its own).
      const { spawn_template, ...guard } = c.npcs['settle_sampler@0.0.1:npc/raider'];
      c.npcs['settle_sampler@0.0.1:npc/guard'] = { ...guard, key: 'guard' };
      edit(c.reactions[MOVE].apply[0]);
    });
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  assert.deepEqual(
    refused((s) => (s.plan = ref('population', 'nobody'))),
    ['UNRESOLVED_REFERENCE', `${at}.plan`],
  );
  assert.deepEqual(
    refused((s) => (s.npc = ref('npc', 'guard'))),
    ['SCHEMA_VIOLATION', `${at}.plan`],
  );
  assert.deepEqual(
    refused((s) => delete s.room),
    ['SCHEMA_VIOLATION', `${at}.plan`],
  );
});

// Settle S3-1 (mechanics.md "Settle S3-1: the charter and the smith"): the reeve sells the
// charter (B8), which opens the storehouse chest (G7) and the stakes' raise_smithy (S6 build);
// the build's smithy_raised event brings the smith (FD5 move, W10 cases). Pennies start at 16.
const S = 'settle_sampler@0.0.1:';
let m = 0;
const act = (w: World, payload: object) =>
  step(
    w,
    {
      id: `dddddddd-0000-4000-8000-${String(++m).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    m,
  );
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const done = (w: World, payload: object) => {
  const r = act(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
};
const ent = (w: World, k: string) => w.entityIds[`${S}${k}`]!;
const smithAt = (w: World) => w.state.containers[ent(w, 'npc/smith')];
const smithState = (w: World) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => k.includes('"smith_state"'))?.[1];
const pennies = (w: World) => level(w, w.body, resourceRef(w, 'pennies'));
const buy = (w: World) =>
  act(w, {
    type: 'use_service',
    provider_id: ent(w, 'npc/reeve'),
    service: ref('service', 'buy_charter'),
    quoted_price: 5,
  });
const bought = (w: World) => {
  const r = buy(w);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const RAISE = { type: 'perform', action: 'raise_smithy' };
const raised = (w = world()) => done(bought(w), RAISE);
const built = (w: World) =>
  Object.keys(w.state.created ?? {}).filter((id) => w.state.created![id].origin.kind === 'built');
const offer = (w: World, action: string) => {
  let found:
    { available: boolean; reason?: { code: string; message?: { key: string } } } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === action ? (found = v) : v));
  return found;
};

// Breaks: the chest's get or put lock is dropped or read off the item: a stranger's take or put
// is offered or accepted (access_sampler pins the lock order; this pins the authored lock).
test('S3-1: a stranger may not take from the storehouse chest; the charter opens it', () => {
  const go = (w: World, direction: string) => done(w, { type: 'move', direction }).world;
  const take = (w: World) => act(w, { type: 'take', item_id: ent(w, 'item/old_knife') });
  const store = (w: World) => go(go(w, 'west'), 'south');
  const knife = (w: World) => {
    const chest = gameView(w).entities.find((e) => e.id === ent(w, 'item/chest'))!;
    const a = chest.contents!.find((e) => e.id === ent(w, 'item/old_knife'))!.actions;
    const o = a.find((x) => x.action_key === 'take')!;
    return [o.available, 'reason' in o && o.reason?.code];
  };
  const w = store(world());
  assert.deepEqual(knife(w), [false, 'permission_denied']);
  assert.equal(code(take(w)), 'permission_denied');
  const c = store(bought(world()));
  assert.deepEqual(knife(c), [true, false]);
  const held = take(c);
  assert.equal(code(held), 'accepted');
  const put = (w: World) =>
    act(w, { type: 'put', item_id: ent(w, 'item/old_knife'), container_id: ent(w, 'item/chest') });
  assert.equal(code(put(held.world)), 'accepted');
  // A stranger handed the knife may not put it back (the put lock).
  const k = ent(w, 'item/old_knife');
  const carrying = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [k]: w.body } },
  };
  assert.equal(code(put(carrying)), 'permission_denied');
  // Breaks: the carry cap is dropped or raised past the chest's 20 kg: a charter holder walks off
  // with the chest itself.
  assert.equal(code(act(c, { type: 'take', item_id: ent(c, 'item/chest') })), 'too_heavy');
});

// Breaks: buy_charter loses its charter_sold policy, or the fact_changed rule stops setting it: a
// second character buys the town's one charter. The stranger is this character with owns_charter
// cleared, 11 pennies left (the test world has one character).
test('S3-1: once the charter is sold, a second buyer is refused', () => {
  const w = bought(world());
  const stranger = structuredClone(w) as any;
  for (const k of Object.keys(stranger.state.facts))
    if (k.includes('"owns_charter"')) delete stranger.state.facts[k];
  assert.equal(offer(stranger, 'buy_charter')?.available, false);
  assert.equal(offer(stranger, 'buy_charter')?.reason?.code, 'invalid_state');
  assert.equal(code(buy(stranger)), 'invalid_state');
});

// Breaks: raise_smithy loses its owns_charter policy (offered or accepted before the charter), the
// charter costs other than 5, or the offer disagrees with admission.
test('S3-1: raise_smithy is unavailable before the charter; the charter costs 5 of 16 pennies', () => {
  const w = world();
  const agrees = (x: World, r: ReturnType<typeof step>) => {
    const resolves = Object.fromEntries(
      Object.values(resolved(x, x.character)).map((a) => [a.key, a.command]),
    );
    const view = gameView(x);
    return check('gameview_agrees_with_admission', {
      view,
      command: { payload: RAISE },
      decision: r.decision,
      resolves,
    });
  };
  assert.equal(offer(w, 'raise_smithy')?.available, false);
  assert.equal(offer(w, 'raise_smithy')?.reason?.code, 'invalid_state');
  const r = act(w, RAISE);
  assert.equal(code(r), 'invalid_state');
  assert.equal(agrees(w, r), true);
  assert.equal(offer(w, 'buy_charter')?.available, true);
  const c = bought(w);
  assert.equal(pennies(c), 11);
  assert.equal(offer(c, 'raise_smithy')?.available, true);
  assert.equal(agrees(c, act(c, RAISE)), true);
});

// Breaks: event.emit after build does not reach smith_comes, a step of it is dropped, or the line
// is not last; the build faces another way or names another blueprint.
test('S3-1: raising the smithy brings the smith; the square opens north to the smithy', () => {
  const r = raised();
  const w = r.world;
  assert.equal(lines(r.decision as never).at(-1), 'settle.smith_arrives');
  assert.equal(smithAt(w), room(w, 'square'));
  assert.equal(smithState(w), 'settled');
  assert.equal(built(w).length, 1);
  const north = done(w, { type: 'move', direction: 'north' }).world;
  assert.equal(gameView(north).place.title.key, 'blueprint.smithy.title');
  assert.deepEqual(validate('GameView', gameView(w)), []);
});

// Breaks: a W10 case reads the fact wrong or the hour boundary is off by one (exact hours 20, 8).
test('S3-1: the settled smith keeps to the square by day and the cottages by night', () => {
  const at = (w: World, until: number) => {
    const x = advance(w, until).w;
    return [smithAt(x), x];
  };
  const w = raised().world;
  const [a, w1] = at(w, 1999);
  assert.equal(a, room(w, 'square'));
  const [b, w2] = at(w1 as World, 2000);
  assert.equal(b, room(w, 'cottages'));
  const [c, w3] = at(w2 as World, 3199);
  assert.equal(c, room(w, 'cottages'));
  assert.equal(at(w3 as World, 3200)[0], room(w, 'square'));
});

// Breaks: either hour's fallback is the square (or a case holds at the default away state).
test('S3-1: with no smithy the smith stays on the far road', () => {
  const night = advance(world(), 2000).w;
  assert.equal(smithAt(night), room(night, 'far_road'));
  const w = advance(night, 3200).w;
  assert.equal(smithAt(w), room(w, 'far_road'));
  assert.equal(smithState(w), undefined);
});

// Breaks: a second raise on the taken site is accepted, says the line again or moves the smith.
test('S3-1: a second raise is refused service.site_taken and changes nothing', () => {
  const w = raised().world;
  assert.deepEqual(offer(w, 'raise_smithy')?.reason, {
    code: 'invalid_state',
    message: { key: 'service.site_taken' },
  });
  const r = act(w, RAISE);
  assert.equal(code(r), 'invalid_state');
  assert.equal(r.world, w);
});

// Breaks: reopen loses the built room or the smith's place, or replay mints another room id.
test('S3-1: save at 1000, reopen and replay keep the smith and the built room', () => {
  m = 0;
  const w = advance(raised().world, 1000).w;
  const keep = (x: World) => JSON.parse(JSON.stringify([smithAt(x), x.roomIds, x.rooms]));
  assert.deepEqual(keep(hydrate(world(), JSON.parse(JSON.stringify(w.state)), true)!), keep(w));
  m = 0;
  assert.deepEqual(keep(advance(raised().world, 1000).w), keep(w));
});

// Breaks: arrival_line's when gate dropped: a raider entering the road says the player's line.
test('S3-1: a raider entering the road says no arrival line', () => {
  const w = world((c) => {
    hour(c, 'spawn', 7, [{ op: 'population.spawn', plan: PLAN }]);
    hour(c, 'out', 8, [{ op: 'npc.move', plan: PLAN, room: ref('room', 'road') }]);
  });
  const at7 = advance(w, 700).w;
  const [run_id, from, until] = ['cccccccc-0000-4000-8000-000000000009' as never, 700, 800];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const id = elapsedCommandId(run_id, w.context, from, until) as never;
  const r = stepElapsed(at7, { id, world_context_id: w.context, payload } as never, 5);
  assert.deepEqual(
    advance(at7, 800).entered.map(([, to]) => to),
    [room(w, 'road')],
  );
  assert.deepEqual(lines(r.decision as never), []);
});

// Breaks: a long settlement drains the smith's schedule jobs differently from hourly steps (a
// skipped hour-20 or hour-8 job, or out of order).
test('S3-1: one wait to 08:00 day 2 leaves the smith where hourly waits do', () => {
  const w = raised().world;
  let hourly = w;
  for (let t = 700; t <= 3200; t += 100) hourly = advance(hourly, t).w;
  const once = advance(w, 3200).w;
  const where = (x: World) => [smithAt(x), x.state.clock, smithState(x)];
  assert.deepEqual(where(once), where(hourly));
});
