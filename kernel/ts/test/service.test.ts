import { identify, resolve } from '../src/commands/invocation.ts';
import { read } from './read.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, stepElapsed } from '../src/index.ts';
import { assigned, value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import { transition } from '../src/mechanics/service/shared.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { LIMITS } from '../src/contracts.gen.ts';
import type { Command } from '../src/contracts.gen.ts';
import { gameview_agrees_with_admission } from '../src/view/invariants_view.ts';
import {
  fresh,
  ref,
  entity,
  prefix,
  run,
  amounts,
  mv,
  stock,
  ale,
  resourceKey,
} from './service_fixture.ts';

// Breaks: a foreign actor's or nil-ID service command is mistaken for the observed player's
// available meal, so the GameView invariant rejects the authority's correct envelope refusal.
test('service view compares only a current-actor, nonnil invocation with its offer', () => {
  const w = fresh();
  const view = gameView(w);
  const provider_id = entity(w, 'npc', 'maud');
  const offer = view.entities
    .find((e) => e.id === provider_id)
    ?.services?.find((s) => s.service.key === 'lantern_meal');
  assert.ok(offer && offer.action.available);
  const command = {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    world_context_id: w.context,
    payload: {
      type: 'use_service',
      actor_id: w.character,
      provider_id,
      service: ref('service', 'lantern_meal'),
      quoted_price: 2,
    },
  } as Command;
  const agrees = (c: Command) => {
    const decision = step(w, c, 1).decision;
    return {
      decision,
      agrees: gameview_agrees_with_admission({
        view,
        command: c,
        decision,
        world_context_id: w.context,
      }),
    };
  };
  assert.equal(agrees(command).decision.kind, 'accepted');
  assert.equal(agrees(command).agrees, true);
  const foreign = {
    ...command,
    payload: { ...command.payload, actor_id: 'bbbbbbbb-0000-4000-8000-000000000001' },
  } as Command;
  assert.deepEqual(agrees(foreign).decision, { kind: 'rejected', error: { code: 'not_found' } });
  assert.equal(agrees(foreign).agrees, true);
  const nil = {
    ...foreign,
    id: '00000000-0000-0000-0000-000000000000',
    world_context_id: 'bbbbbbbb-0000-4000-8000-000000000002',
  } as Command;
  assert.deepEqual(agrees(nil).decision, {
    kind: 'rejected',
    error: { code: 'permission_denied' },
  });
  assert.equal(agrees(nil).agrees, true);
});

// Breaks: rental performs Rest/recovery, repeats charge, or immediate meal/drink lose conserved payment/stock.
test('literal room/meal/ale outcomes conserve exact money, stock and capped MV', () => {
  let w = fresh();
  const room = run(w, 'lantern_room');
  assert.equal(room.decision.kind, 'accepted');
  w = room.world;
  assert.deepEqual(amounts(w), [17, 13]);
  assert.equal(mv(w), 50);
  assert.equal(value(w, w.character, ref('fact', 'lantern_bed_paid')), true);
  assert.equal(value(w, w.character, ref('fact', 'position')), 'standing');
  assert.equal(w.state.clock, 0);
  assert.equal(w.state.quests, undefined);
  const repeat = run(w, 'lantern_room', 2);
  assert.equal(repeat.decision.kind, 'rejected');
  assert.equal(repeat.world, w);
  const meal = run(w, 'lantern_meal', 3);
  assert.equal(meal.decision.kind, 'accepted');
  w = meal.world;
  assert.deepEqual(amounts(w), [15, 15]);
  assert.equal(stock(w), 3);
  assert.equal(mv(w), 62);
  const drink = run(w, 'lantern_ale', 4);
  assert.equal(drink.decision.kind, 'accepted');
  w = drink.world;
  assert.deepEqual(amounts(w), [14, 16]);
  assert.equal(mv(w), 66);
  assert.equal(ale(w).quantity, 3);
  assert.deepEqual(w.state.rng, [1, 2, 3, 4]);
  assert.equal(gameView(w).resources!.find((r) => r.resource.key === 'hp')!.current, 10);
  for (const [name, start, answer] of [
    ['lantern_room', 100, 100],
    ['lantern_meal', 95, 100],
    ['lantern_ale', 96, 100],
  ] as const) {
    const x = fresh((c) => (c.resources[`${prefix}:resource/mv`].start = start)),
      r = run(x, name);
    assert.equal(r.decision.kind, 'accepted');
    assert.equal(mv(r.world), answer);
  }
});

// Breaks: strict last serving buys partial ale, full MV charges, overflow saturates payment, or unavailable stock changes anything.
test('service refusal rolls back every row and respects exact provider, quote and complete serving', () => {
  const cases: [string, string, (w: ReturnType<typeof fresh>) => void, object?][] = [
    [
      'meal full',
      'lantern_meal',
      (w) => (w.state.resources![resourceKey(w, w.body, 'mv')].value = 100),
    ],
    [
      'drink full',
      'lantern_ale',
      (w) => (w.state.resources![resourceKey(w, w.body, 'mv')].value = 100),
    ],
    [
      'unfunded',
      'lantern_meal',
      (w) => (w.state.resources![resourceKey(w, w.body, 'pennies')].value = 1),
    ],
    [
      'credit overflow',
      'lantern_meal',
      (w) => (w.state.resources![resourceKey(w, entity(w, 'npc', 'maud'), 'pennies')].value = 999),
    ],
    [
      'sold out',
      'lantern_meal',
      (w) =>
        (w.state.resources![resourceKey(w, entity(w, 'npc', 'maud'), 'lantern_meals')].value = 0),
    ],
    [
      'foreign vessel',
      'lantern_ale',
      (w) => (w.state.containers[entity(w, 'item', 'lantern_ale_cask')] = w.body),
    ],
    [
      'ground vessel',
      'lantern_ale',
      (w) =>
        (w.state.containers[entity(w, 'item', 'lantern_ale_cask')] = w.state.containers[w.body]),
    ],
    [
      'empty vessel',
      'lantern_ale',
      (w) =>
        (w.state.liquids![entity(w, 'item', 'lantern_ale_cask')] = { kind: null, quantity: 0 }),
    ],
    [
      'wrong liquid',
      'lantern_ale',
      (w) =>
        (w.state.liquids![entity(w, 'item', 'lantern_ale_cask')].kind = ref('liquid', 'water')),
    ],
    [
      'departed provider',
      'lantern_meal',
      (w) => (w.state.containers[entity(w, 'npc', 'maud')] = w.roomIds[`${prefix}:room/well_lane`]),
    ],
    ['stale quote', 'lantern_meal', () => {}, { quoted_price: 1 }],
    [
      'wrong provider',
      'lantern_meal',
      () => {},
      { provider_id: 'bbbbbbbb-0000-4000-8000-000000000001' },
    ],
    ['wrong ref', 'lantern_meal', () => {}, { service: ref('service', 'absent') }],
  ];
  for (const [label, name, change, input] of cases) {
    const w = fresh();
    change(w);
    const before = JSON.stringify(w.state);
    const result = run(w, name, 1, input);
    assert.notEqual(result.decision.kind, 'accepted', label);
    assert.equal(JSON.stringify(result.world.state), before, label);
  }
  let w = fresh();
  w.state.liquids![entity(w, 'item', 'lantern_ale_cask')].quantity = 1;
  const last = run(w, 'lantern_ale');
  assert.equal(last.decision.kind, 'accepted');
  assert.deepEqual(ale(last.world), { kind: null, quantity: 0 });
  assert.ok(last.world.entities[entity(w, 'item', 'lantern_ale_cask')]);
  assert.equal(run(last.world, 'lantern_ale', 2).decision.kind, 'rejected');
  w = fresh((c) => (c.liquids[`${prefix}:liquid/ale`].drink_amount = 2));
  w.state.liquids![entity(w, 'item', 'lantern_ale_cask')].quantity = 1;
  assert.equal(run(w, 'lantern_ale').decision.kind, 'rejected');
  assert.equal(ale(w).quantity, 1);
  const p = {
    type: 'use_service',
    actor_id: w.character,
    provider_id: entity(w, 'npc', 'maud'),
    service: ref('service', 'lantern_meal'),
    quoted_price: 2,
  } as const;
  assert.deepEqual(transition(w, p, { n: LIMITS.query_steps }), { code: 'budget_exceeded' });
});

// Breaks: view uses command==key filtering or bypasses the authored alias's target/input/policy contract.
test('loaded differently named service keys project exactly the captured invocation admission', () => {
  for (const changed of [
    undefined,
    (a: any) => (a.target = { kind: 'none' }),
    (a: any) => (a.input = ['service']),
    (a: any) => (a.policy.root = { op: 'not', item: { op: 'all', items: [] } }),
  ]) {
    const w = fresh((c) => changed?.(c.actions[`${prefix}:action/eat_lantern_meal`]));
    const offers = gameView(w).entities.find((e) => e.id === entity(w, 'npc', 'maud'))!.services!;
    assert.deepEqual(
      offers.map((s) => [s.action.action_key, s.action.command]),
      [
        ['rent_lantern_room', 'use_service'],
        ['eat_lantern_meal', 'use_service'],
        ['drink_lantern_ale', 'use_service'],
      ],
    );
    const meal = offers.find((s) => s.service.key === 'lantern_meal')!;
    const captured = {
      invocation_id: 'cccccccc-0000-4000-8000-000000000001',
      actor_id: w.character,
      action_key: meal.action.action_key,
      target_ids: meal.action.target_ids ?? [],
      input: { service: meal.service, quoted_price: meal.price },
    };
    const identified = identify('service-proof', w.character, captured);
    assert.equal(identified.kind, 'identified');
    if (identified.kind !== 'identified') throw new Error('service identity');
    const command = resolve(w, identified);
    assert.ok(!('kind' in command));
    const result = step(w, command as never, 1, captured.action_key);
    assert.equal(meal.action.available, !changed);
    if (!meal.action.available) {
      assert.equal(result.decision.kind, 'rejected');
      if (result.decision.kind === 'rejected')
        assert.equal(result.decision.error.code, meal.action.reason.code);
      assert.equal(result.world, w);
    }
  }
});

// Breaks: service drops old-rate settlement, rental gates walking/unpaid Rest, or paid bed sends a detail gameplay target.
test('old-rate elapsed settlement precedes meal and actual targetless bed Rest', () => {
  let w = fresh((c) => (c.resources[`${prefix}:resource/mv`].start = 5));
  const from = 0,
    until = 1800,
    run_id = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
  const elapsed = () =>
    stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, w.state.clock, w.state.clock + 1800),
        world_context_id: w.context,
        payload: {
          type: 'elapsed',
          actor_id: w.character,
          run_id,
          from: w.state.clock,
          until: w.state.clock + 1800,
        },
      } as never,
      1,
    );
  w = elapsed().world;
  assert.equal(w.state.clock, 1800);
  assert.equal(mv(w), 14);
  w = run(w, 'lantern_meal').world;
  assert.equal(mv(w), 26);
  assert.equal(w.state.resources![resourceKey(w, w.body, 'mv')].remainder, 0);
  const rest = () =>
    step(
      w,
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000099',
        world_context_id: w.context,
        payload: { type: 'rest', actor_id: w.character },
      } as never,
      2,
    );
  w = rest().world;
  assert.equal(value(w, w.character, ref('fact', 'position')), 'resting');
  w = elapsed().world;
  assert.equal(mv(w), 44);
  assert.equal(rest().decision.kind, 'rejected');
  w = fresh();
  w.state.containers[w.body] = w.roomIds[`${prefix}:room/inn_rooms`];
  const unpaid = gameView(w).notices!.find((n) => n.bed)!;
  assert.deepEqual(unpaid.actions, undefined);
  assert.equal(rest().decision.kind, 'accepted');
  w = fresh();
  w = run(w, 'lantern_room').world;
  w.state.containers[w.body] = w.roomIds[`${prefix}:room/inn_rooms`];
  const bed = gameView(w).notices!.find((n) => n.bed)!;
  assert.equal(bed.description, 'detail.bed.paid');
  assert.deepEqual(bed.actions![0].target_ids, []);
  assert.equal(bed.actions![0].available, true);
});

// Breaks: a service secretly reads original Maud instead of the bound provider, or an unowned fact writer grants free bed truth.
test('bound second provider pays and consumes its own stock; only service can assign entitlement', () => {
  const w = fresh((c) => {
    c.services[`${prefix}:service/lantern_meal`].provider = ref('npc', 'peg');
    c.npcs[`${prefix}:npc/maud`].services = c.npcs[`${prefix}:npc/maud`].services.filter(
      (r: any) => r.key !== 'lantern_meal',
    );
    Object.assign(c.npcs[`${prefix}:npc/peg`], {
      room: ref('room', 'drowned_lantern'),
      services: [ref('service', 'lantern_meal')],
      resource_starts: { pennies: 10, lantern_meals: 4 },
    });
  });
  const peg = entity(w, 'npc', 'peg'),
    r = run(w, 'lantern_meal', 1, { provider_id: peg });
  assert.equal(r.decision.kind, 'accepted');
  assert.deepEqual(amounts(r.world), [18, 10]);
  assert.equal(r.world.state.resources![resourceKey(w, peg, 'pennies')].value, 12);
  assert.equal(r.world.state.resources![resourceKey(w, peg, 'lantern_meals')].value, 3);
  assert.equal(mv(r.world), 62);
  assert.throws(
    () =>
      assigned(
        w,
        w.character,
        { ops: [], position: 0, facts: {} },
        { fact: ref('fact', 'lantern_bed_paid'), value: true },
      ),
    { code: 'precondition_failed' },
  );
});

// Breaks: the new detail/vessel shifts or aliases initial identities differently from the independently derived integrated answer.
test('the complete integrated B8 initial identities match the Python known answer', () => {
  const w = fresh(),
    answers = read('protocol/fixtures/missing_child_v025_ids.json');
  for (const [label, expected] of Object.entries(answers)) {
    const [kind, name, detail] = label.split('/');
    const actual =
      kind === 'character'
        ? w.character
        : kind === 'body'
          ? w.body
          : kind === 'room'
            ? w.roomIds[`${prefix}:room/${name}`]
            : kind === 'detail'
              ? Object.entries(w.details).find(
                  ([, d]) => d.key === detail && d.room === w.roomIds[`${prefix}:room/${name}`],
                )?.[0]
              : kind === 'slot'
                ? w.slots[name]
                : kind === 'job'
                  ? Object.entries(w.state.jobs ?? {}).find(([, j]: any) => j.job.key === name)?.[0]
                  : entity(w, kind, name);
    assert.equal(actual, expected, label);
  }
});
