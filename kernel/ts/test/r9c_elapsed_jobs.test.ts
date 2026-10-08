// E2 S3: families 3 (paid Rest, dream, liquid, light) and 5 (patrol, deer job order) on the
// frozen synthetic cartridge. Every press is taken from GameView by key. Literals cite their
// content source under cartridges/r9c_interactions/ (owner decision (d): update in place).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { World } from '../src/index.ts';
import type { DecisionResult, DefinitionRef } from '../src/contracts.gen.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { value } from '../src/mechanics/fact.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ID: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const load = (canonical: string) => {
  const hash = createHash('sha256').update(canonical).digest('hex');
  const artifact = `{"cartridge":${canonical},"content_hash":"${hash}"}`;
  return loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
};
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'r9c_interactions',
    cartridge_version: '0.0.1',
    kind,
    key: name,
  }) as unknown as DefinitionRef;
const run_id = 'bbbbbbbb-0000-4000-8000-000000000003';

// A fey_touched character at ferry_landing, 64800, RNG [1, 2, 3, 4] (cartridge.json).
function play() {
  const loaded = load(pin.canonical);
  assert.ok(loaded.ok);
  let w: World = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  let n = 0;
  // Advertised actions anywhere in the view; an entity's own action targets that entity.
  const offered = (v: unknown, owner?: string, out: any[] = []): any[] => {
    if (Array.isArray(v)) v.forEach((x) => offered(x, owner, out));
    else if (v && typeof v === 'object') {
      const o = v as any;
      if ('action_key' in o && 'target' in o)
        out.push({ ...o, target_ids: o.target_ids ?? (owner ? [owner] : []) });
      else
        Object.values(o).forEach((x) => offered(x, typeof o.id === 'string' ? o.id : owner, out));
    }
    return out;
  };
  const invoke = (action_key: string, target_ids: string[], input: object) => {
    // Regression pin: with this scope the move-allocated sight job IDs reach both
    // equal-time orders in the deer test; another scope may reach only one.
    const id = identify('s3', w.character, {
      invocation_id: `cccccccc-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
      actor_id: w.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(id.kind, 'identified');
    if (id.kind !== 'identified') throw new Error(action_key);
    const command = resolve(w, id);
    assert.ok(!('kind' in command), `${action_key}: ${JSON.stringify(command)}`);
    const r = step(w, command as never, ++n, action_key as never);
    w = r.world;
    return r.decision;
  };
  const accept = (decision: DecisionResult) => {
    assert.equal(decision.kind, 'accepted', JSON.stringify(decision));
    return decision;
  };
  const a = {
    get w() {
      return w;
    },
    view: () => gameView(w),
    // The offer the view shows for this key and target list.
    offer: (action_key: string, target_ids: string[] = []) =>
      offered(gameView(w)).find(
        (o) => o.action_key === action_key && key(o.target_ids) === key(target_ids),
      ),
    press(action_key: string, target_ids: string[] = [], input: object = {}) {
      assert.equal(a.offer(action_key, target_ids)?.available, true, action_key);
      return accept(invoke(action_key, target_ids, input));
    },
    move(direction: string) {
      assert.equal(gameView(w).exits.find((e) => e.direction === direction)?.available, true);
      return a.press('move', [], { direction });
    },
    invoke,
    buy(item: string) {
      const row = gameView(w)
        .entities.find((e) => e.id === ID['npc/peg'])!
        .shop!.find((s) => s.item_id === ID[item])!;
      assert.equal(row.buy!.available, true);
      return accept(invoke('buy', [ID['npc/peg'], ID[item]], { quoted_price: row.buy!.price }));
    },
    service(name: string) {
      const s = gameView(w)
        .entities.find((e) => e.id === ID['npc/maud'])!
        .services!.find((s) => s.service.key === name)!;
      return a.press(s.action.action_key, [ID['npc/maud']], {
        service: s.service,
        quoted_price: s.price,
      });
    },
    // Dialogue answers are projected on the pending choice, with any patrol draw.
    choose(choice_id: string) {
      const c = gameView(w).choice!;
      const o = c.choices.find((o) => o.choice_id === choice_id)!;
      assert.equal(o.available, true, choice_id);
      return accept(
        invoke('choose', [], {
          continuation_id: c.continuation_id,
          choice_id,
          ...(o.patrol && { patrol: o.patrol }),
        }),
      );
    },
    elapse(until: number) {
      const from = w.state.clock;
      const r = stepElapsed(
        w,
        {
          id: elapsedCommandId(run_id as never, w.context, from, until),
          world_context_id: w.context,
          payload: { type: 'elapsed', actor_id: w.character, run_id, from, until },
        } as never,
        ++n,
      );
      const before = w.state;
      w = r.world;
      return { before, decision: accept(r.decision) };
    },
  };
  a.press('choose_ancestry', [], { ancestry: 'fey_touched' });
  return a;
}
type Play = ReturnType<typeof play>;

const pennies = (w: World, holder: string) =>
  w.state.resources![
    key({ kind: 'resource', resource: ref('resource', 'pennies'), entity_id: holder })
  ].value;
// Player, Peg, Maud: 20 + 20 + 10 = 50 (resources.json, npcs/peg.json, npcs/maud.json).
const ledger = (w: World) => {
  const l = [pennies(w, w.body), pennies(w, ID['npc/peg']), pennies(w, ID['npc/maud'])];
  assert.equal(l[0] + l[1] + l[2], 50);
  return l;
};
const mv = (a: Play) => a.view().resources!.find((r) => r.resource.key === 'mv')!.current;
const fuel = (a: Play, item: string) =>
  [...a.view().inventory, ...a.view().equipment!.flatMap((s) => (s.item ? [s.item] : []))].find(
    (e) => e.id === ID[item],
  )!.fuel!.remaining;
const liquid = (w: World, id: string) => {
  const l = w.state.liquids![id];
  return [l.kind?.key ?? null, l.quantity];
};
const fact = (w: World, name: string) => value(w, w.character, ref('fact', name));
const quest = (a: Play, name: string) => a.view().journal.find((q) => q.quest.key === name)?.state;
const dream = (a: Play) => a.view().notices!.find((n) => n.bed)!.dream!;

// Breaks: one B3/B8 writer moves money or stock without its counterpart, Fill/Pour/Drink or
// burn/Refuel creates or loses quantity across real elapsed settlement, or elapsed delivery
// during the open dream checkpoint drops a due job or credits the dream before the final ack.
test('family 3: one ledger, liquid and fuel carried through the paid dream and elapsed jobs', () => {
  const a = play();
  a.move('north');
  a.move('west');
  // npcs/peg.json buy prices: torch 3, lamp_oil 2, waterskin 4, spare_waterskin 4.
  for (const [item, after] of [
    ['item/torch', [17, 23, 10]],
    ['item/lamp_oil', [15, 25, 10]],
    ['item/waterskin', [11, 29, 10]],
    ['item/spare_waterskin', [7, 33, 10]],
  ] as const) {
    a.buy(item);
    assert.deepEqual(ledger(a.w), after);
  }
  a.move('east');
  const skin = ID['item/waterskin'],
    spare = ID['item/spare_waterskin'];
  const water = (id: string) => liquid(a.w, id);
  a.press('fill', [ID['detail/well_lane/well'], skin]);
  assert.deepEqual(water(skin), ['water', 4]); // capacity 4
  a.press('drink', [skin]);
  assert.deepEqual(water(skin), ['water', 3]);
  a.press('pour', [skin, spare]);
  assert.deepEqual(
    [water(skin), water(spare)],
    [
      [null, 0],
      ['water', 3],
    ],
  );

  // items/torch.json fuel 7200 at rate 1; items/lamp_oil.json supply 7200.
  a.press('wear', [ID['item/torch']]);
  a.press('ignite', [ID['item/torch']]);
  assert.equal(mv(a), 97); // 100 start, three 1-MV steps (cartridge.json world.movement)
  a.elapse(65400);
  assert.deepEqual([fuel(a, 'item/torch'), fuel(a, 'item/lamp_oil')], [6600, 7200]);
  assert.equal(mv(a), 100); // standing 18 per 3600 (resources.json): +3 over 600
  a.press('refuel', [ID['item/torch'], ID['item/lamp_oil']]);
  assert.deepEqual([fuel(a, 'item/torch'), fuel(a, 'item/lamp_oil')], [7200, 6600]);

  // The water-gated shaft exit: each exit's offer equals its keyed admission, lit and dark.
  a.move('down');
  for (const lit of [true, false]) {
    if (!lit) a.press('douse', [ID['item/torch']]);
    assert.equal(
      a.view().place.description.key,
      lit ? 'room.well_shaft.description' : 'room.well_shaft.dark',
    );
    const exits = a.view().exits.map((e) => [e.direction, e.available]);
    assert.deepEqual(exits, [
      ['down', false],
      ['up', true],
    ]);
    const before = a.w;
    const refused = a.invoke('move', [], { direction: 'down' });
    assert.deepEqual(refused, { kind: 'rejected', error: { code: 'invalid_state' } });
    assert.equal(a.w, before);
  }
  a.press('ignite', [ID['item/torch']]);
  a.move('up');
  a.move('east');

  // services/*.json: room 4 (entitlement), meal 2 (stock 1, MV +12), ale 1 (cask, MV +4).
  assert.equal(mv(a), 97); // 100, then down, up, east
  a.service('lantern_room');
  assert.deepEqual(ledger(a.w), [3, 33, 14]);
  assert.equal(fact(a.w, 'lantern_bed_paid'), true);
  assert.equal(a.view().position, 'standing');
  assert.equal(a.w.state.clock, 65400);
  a.service('lantern_meal');
  assert.deepEqual(ledger(a.w), [1, 33, 16]);
  assert.equal(mv(a), 100); // min(12, 100 - 97)
  const ale = a.offer('drink_lantern_ale', [ID['npc/maud']]);
  assert.equal(ale.available, false);
  assert.equal(ale.reason.message.key, 'service.full_mv');

  a.move('up');
  assert.equal(mv(a), 99);
  a.press('rest');
  assert.equal(a.view().position, 'resting');
  for (const line of [1, 2, 3]) {
    const d = dream(a);
    assert.equal(d.index, line);
    a.press(d.action!.action_key, [], { scene: d.scene, line: d.index });
  }
  assert.equal(dream(a).index, 4);
  // Resting 36 per 3600 (resources.json): +1 over 100 units; standing 18 would give +0.
  a.elapse(65500);
  assert.equal(mv(a), 100);
  const { decision } = a.elapse(68400);
  // All seven genesis population jobs fall due at 68400 and complete while the dream is open.
  assert.deepEqual(
    decision.kind === 'accepted' &&
      decision.delta.ops
        .filter((o) => o.op === 'job.complete')
        .map((o: any) => o.job_id)
        .sort(),
    Object.entries(ID)
      .filter(([k]) => /^population\/[a-z_0-9]+\/job$/.test(k))
      .map(([, v]) => v)
      .sort(),
  );
  assert.equal(a.w.state.clock, 68400);
  // Lit since the 65400 refuel: 7200 - 3000; torch + oil = 14400 - 3600 burned.
  assert.deepEqual([fuel(a, 'item/torch'), fuel(a, 'item/lamp_oil')], [4200, 6600]);
  assert.equal(dream(a).index, 4);
  assert.equal(fact(a.w, 'dream_seen'), false); // facts.json default
  assert.equal(quest(a, 'a_room_at_the_lantern'), 'active');

  // Departure keeps the dormant choice; the ale debits the cask while the dream waits.
  a.press('stand');
  a.move('down');
  assert.equal(mv(a), 99);
  a.service('lantern_ale');
  assert.deepEqual(ledger(a.w), [0, 33, 17]);
  assert.deepEqual(liquid(a.w, ID['item/lantern_ale_cask']), ['ale', 3]); // 4 at start
  assert.equal(
    a.w.state.resources![
      key({
        kind: 'resource',
        resource: ref('resource', 'lantern_meals'),
        entity_id: ID['npc/maud'],
      })
    ].value,
    3,
  );
  a.move('up');
  a.press('rest');
  const d = dream(a),
    c = d.choice!,
    o = c.choices.find((o) => o.choice_id === 'follow_fox')!;
  assert.equal(d.index, 4);
  assert.equal(o.available, true);
  assert.equal(o.action_key, 'dream_choose');
  const chosen = a.invoke(o.action_key!, [], {
    continuation_id: c.continuation_id,
    choice_id: o.choice_id,
    dream: o.dream,
  });
  assert.equal(chosen.kind, 'accepted');
  assert.equal(fact(a.w, 'dream_seen'), false); // facts.json default
  assert.equal(quest(a, 'a_room_at_the_lantern'), 'active');
  const ack = dream(a);
  assert.equal(ack.index, 5);
  a.press(ack.action!.action_key, [], { scene: ack.scene, line: ack.index });
  assert.equal(fact(a.w, 'dream_seen'), true);
  assert.equal(quest(a, 'a_room_at_the_lantern'), 'resolved');

  assert.deepEqual(
    [water(skin), water(spare)],
    [
      [null, 0],
      ['water', 3],
    ],
  );
  assert.deepEqual(a.w.state.rng, [1, 2, 3, 4]); // no draw: service, liquid, light, dream
});

const patrol = (w: World) => Object.values(w.state.patrols ?? {})[0]!;
const roomOf = (w: World, id: string) => w.state.containers[ID[id]];

// Breaks: a leader departure or arrival while paused earns credit, the crow wander jobs that fall
// due during the detour change the patrol row, or the uncredited checkpoint is never re-earned.
test('family 5: watch credit pauses through the crow jobs and completes at four', () => {
  const a = play();
  const tobin = ID['npc/tobin'];
  const talk = (choice_id: string) => {
    a.press('tobin_watch', [tobin]);
    a.choose(choice_id);
  };
  const leg = (direction: string, credit: string[], status: string) => {
    talk('continue');
    a.move(direction);
    assert.deepEqual(
      patrol(a.w).credit,
      credit.map((r) => ID[`room/${r}`]),
      direction,
    );
    assert.equal(patrol(a.w).status, status);
  };
  for (const d of ['north', 'north', 'north', 'east']) a.move(d);
  talk('start');
  // quests/watch_rounds.json route and checkpoints; required 4.
  leg('west', ['north_gate'], 'together');
  leg('south', ['north_gate', 'village_green'], 'together');
  talk('continue');
  assert.equal(roomOf(a.w, 'npc/tobin'), ID['room/east_gate']);
  assert.equal(patrol(a.w).credit.length, 2); // Tobin's own departure earns nothing
  a.move('south');
  const paused = patrol(a.w);
  assert.equal(paused.status, 'paused');
  // crow_green_1/2 wander village_green and well_lane every 3600 from 64800.
  const { before, decision } = a.elapse(68400);
  const done =
    decision.kind === 'accepted' ? decision.delta.ops.filter((o) => o.op === 'job.complete') : [];
  for (const job of ['population/crow_green_1/job', 'population/crow_green_2/job'])
    assert.ok(
      done.some((o: any) => o.job_id === ID[job]),
      job,
    );
  assert.equal(check('job_complete_owned_by_run', { before, decision }), true);
  assert.deepEqual(patrol(a.w), paused);
  a.move('north');
  a.move('east');
  assert.deepEqual(patrol(a.w), paused); // beside Tobin at an uncredited checkpoint: nothing
  talk('rejoin');
  assert.equal(patrol(a.w).status, 'together');
  assert.equal(patrol(a.w).credit.length, 2);
  leg('west', ['north_gate', 'village_green'], 'together');
  leg('north', ['north_gate', 'village_green'], 'together');
  leg('east', ['north_gate', 'village_green', 'watch_post'], 'together');
  leg('west', ['north_gate', 'village_green', 'watch_post'], 'together');
  leg('south', ['north_gate', 'village_green', 'watch_post'], 'together');
  leg('east', ['north_gate', 'village_green', 'watch_post', 'east_gate'], 'completed');
  assert.equal(quest(a, 'watch_rounds'), 'resolved');
  assert.equal(
    Object.values(a.w.state.quests!).find((q) => q.quest.key === 'watch_rounds')!.outcome,
    'completed',
  );
  assert.equal(fact(a.w, 'watch_gate_trusts_player'), true);
  const completed = patrol(a.w);
  a.move('west');
  a.move('north');
  assert.deepEqual(patrol(a.w), completed);
  assert.deepEqual(a.w.state.rng, [1, 2, 3, 4]); // patrol and wander draw nothing
});

const deers = ['population/oak_deer/slot1/deer', 'population/willow_deer/slot1/deer'];
// Breaks: the sight job and the population jobs sharing the 68400 boundary run out of
// (due_time, job_id) order, transfer a deer twice or outside its two-room area, or a
// completion leaves its own run_job; then a fatal hit leaves a second hide or refills early.
test('family 5: deer sight at a population boundary in both orders, then a fatal hit', () => {
  for (const [path, sighted] of [
    [['south', 'south', 'west'], 'willow_deer'],
    [['south', 'south', 'south', 'west'], 'oak_deer'],
  ] as const) {
    const a = play();
    for (const d of path.slice(0, -1)) a.move(d);
    a.elapse(68100);
    a.move(path.at(-1)!);
    const [sightId, sight] = Object.entries(a.w.state.jobs!).find(([, j]) => j.sight)!;
    assert.equal(sight.sight!.member_id, ID[`population/${sighted}/slot1/deer`]);
    assert.equal(sight.due_time, 68400); // 68100 + populations/*_deer.json sight delay 300
    const own = ID[`population/${sighted}/job`];
    // Willow: its population job sorts before its sight job; Oak: the sight job sorts first.
    assert.equal(sighted === 'willow_deer' ? own < sightId : sightId < own, true);
    const { before, decision } = a.elapse(68400);
    assert.equal(decision.kind, 'accepted');
    if (decision.kind !== 'accepted') return;
    const completed = decision.delta.ops
      .filter((o) => o.op === 'job.complete')
      .map((o: any) => o.job_id);
    assert.deepEqual(
      [...completed].sort(),
      [
        ...Object.entries(ID)
          .filter(([k]) => /^population\/\w+\/job$/.test(k))
          .map(([, v]) => v),
        sightId,
      ].sort(),
    );
    assert.deepEqual(completed, [...completed].sort()); // all due 68400: job_id order
    assert.equal(check('job_complete_owned_by_run', { before, decision }), true);
    for (const deer of deers)
      assert.equal(
        decision.delta.ops.filter(
          (o: any) => o.op === 'entity.transfer' && o.entity_id === ID[deer],
        ).length,
        1,
        deer,
      );
    // Each deer is in the other room of its two-room area (populations/*_deer.json).
    assert.equal(roomOf(a.w, deers[0]), ID['room/willow_shade']);
    assert.equal(roomOf(a.w, deers[1]), ID['room/drowned_oak']);
    for (const deer of ['oak_deer', 'willow_deer'])
      assert.equal(
        roomOf(a.w, `population/${deer}/slot1/hide`),
        ID[`population/${deer}/slot1/deer`],
      );
    if (sighted !== 'oak_deer') continue;

    // Follow the fled Oak deer and attack it (npcs/oak_deer.json hp 1, attack chance 0).
    const deer = ID[deers[0]];
    a.move('north');
    a.press('attack', [deer]);
    const round = a.elapse(68550).decision;
    assert.equal(round.kind, 'accepted');
    assert.equal(
      a.w.state.resources![
        key({ kind: 'resource', resource: ref('resource', 'hp'), entity_id: deer })
      ].value,
      0,
    );
    const corpse = Object.values(a.w.state.created!).find(
      (c) => c.origin.kind === 'death' && c.origin.victim_id === deer,
    )!;
    assert.equal(corpse.definition.key, 'deer_corpse');
    assert.equal(a.w.state.containers[corpse.id], ID['room/willow_shade']);
    assert.equal(roomOf(a.w, 'population/oak_deer/slot1/hide'), corpse.id);
    const slot = Object.values(a.w.state.population_slots!).find((s) => s.member_id === deer)!;
    assert.equal(slot.replacement_due, 68550 + 172800); // populations/oak_deer.json replacement_delay
    // One player hit and no deer swing (it died first): two draws, the 75% hit roll and the
    // 1-2 damage roll (cartridge.json world.combat). Regression pin: xoshiro128** from
    // [1, 2, 3, 4] advanced twice, worked by hand.
    assert.deepEqual(
      round.kind === 'accepted' &&
        round.events.flatMap((e) =>
          e.payload.type === 'attack_result' ? [[e.payload.attacker_id, e.payload.hit]] : [],
        ),
      [[a.w.body, true]],
    );
    assert.deepEqual(a.w.state.rng, [12295, 1029, 1029, 25165824]);
    const after = a.elapse(68700).decision;
    assert.equal(
      after.kind === 'accepted' && after.delta.ops.some((o) => o.op === 'entity.transfer'),
      false,
    );
    assert.equal(
      Object.values(a.w.state.created!).filter(
        (c) =>
          c.origin.kind === 'spawned' && c.origin.role === 'hide' && c.origin.member_id === deer,
      ).length,
      1,
    );
  }
});
