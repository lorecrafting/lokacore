import { identify, resolve } from '../src/commands/invocation.ts';
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
  const provider_id = entity(w, 'npc', 'cook');
  const offer = view.entities
    .find((e) => e.id === provider_id)
    ?.services?.find((s) => s.service.key === 'kitchen_meal');
  assert.ok(offer && offer.action.available);
  const command = {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    world_context_id: w.context,
    payload: {
      type: 'use_service',
      actor_id: w.character,
      provider_id,
      service: ref('service', 'kitchen_meal'),
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
  assert.equal(
    gameview_agrees_with_admission({
      view,
      command: foreign,
      decision: { kind: 'accepted', receipt_id: 'counterfeit' },
      world_context_id: w.context,
    }),
    false,
  );
  assert.equal(
    gameview_agrees_with_admission({
      view,
      command: foreign,
      decision: { kind: 'rejected', error: { code: 'permission_denied' } },
      world_context_id: w.context,
    }),
    false,
  );
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
  assert.equal(
    gameview_agrees_with_admission({ view, command: nil, decision: agrees(command).decision }),
    false,
  );
  assert.equal(
    gameview_agrees_with_admission({ view, command: nil, decision: agrees(foreign).decision }),
    false,
  );
});

// Breaks: removing pre-choice precedence makes a nil-ID foreign invocation accept permission_denied instead of Step's invalid_state.
test('pre-choice service envelope agrees only with Step invalid_state before identity checks', () => {
  const w = fresh((c: any) => {
    c.attributes[`${prefix}:attribute/str`] = { key: 'str', start: 10 };
    c.text['ancestry.hill.label'] = 'Hill';
    c.text['ancestry.hill.description'] = 'Hill folk.';
    c.ancestries = {
      hill: {
        attribute: ref('attribute', 'str'),
        description: 'ancestry.hill.description',
        name: 'ancestry.hill.label',
        modifier: 1,
      },
    };
  });
  const view = gameView(w);
  assert.equal(view.ancestry_choices?.length, 1);
  const command = {
    id: '00000000-0000-0000-0000-000000000000',
    world_context_id: w.context,
    payload: {
      type: 'use_service',
      actor_id: w.character,
      provider_id: entity(w, 'npc', 'cook'),
      service: ref('service', 'kitchen_meal'),
      quoted_price: 2,
    },
  } as Command;
  const decision = step(w, command, 1).decision;
  assert.deepEqual(decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(gameview_agrees_with_admission({ view, command, decision }), true);
  for (const code of ['permission_denied', 'not_found'] as const)
    assert.equal(
      gameview_agrees_with_admission({
        view,
        command,
        decision: { kind: 'rejected', error: { code } },
      }),
      false,
    );
});

// Breaks: a benefit op outside the service context (steps.ex refuses it) reaches recovery and
// grants MV instead of failing the precondition.
test('a benefit op the service context does not run fails the precondition', () => {
  const w = fresh((c) => {
    c.services[`${prefix}:service/kitchen_meal`].benefit = {
      op: 'fact.assign',
      fact: ref('fact', 'bed_paid'),
      value: true,
    };
  });
  assert.throws(() => run(w, 'kitchen_meal'), { code: 'precondition_failed' });
});

// Breaks: rental performs Rest/recovery, repeats charge, or immediate meal/drink lose conserved payment/stock.
test('literal room/meal/ale outcomes conserve exact money, stock and capped MV', () => {
  let w = fresh();
  const room = run(w, 'kitchen_room');
  assert.equal(room.decision.kind, 'accepted');
  w = room.world;
  assert.deepEqual(amounts(w), [17, 13]);
  assert.equal(mv(w), 50);
  assert.equal(value(w, w.character, ref('fact', 'bed_paid')), true);
  assert.equal(value(w, w.character, ref('fact', 'position')), 'standing');
  assert.equal(w.state.clock, 0);
  assert.equal(w.state.quests, undefined);
  const repeat = run(w, 'kitchen_room', 2);
  assert.equal(repeat.decision.kind, 'rejected');
  assert.equal(repeat.world, w);
  const meal = run(w, 'kitchen_meal', 3);
  assert.equal(meal.decision.kind, 'accepted');
  w = meal.world;
  assert.deepEqual(amounts(w), [15, 15]);
  assert.equal(stock(w), 3);
  assert.equal(mv(w), 62);
  const drink = run(w, 'kitchen_ale', 4);
  assert.equal(drink.decision.kind, 'accepted');
  w = drink.world;
  assert.deepEqual(amounts(w), [14, 16]);
  assert.equal(mv(w), 66);
  assert.equal(ale(w).quantity, 3);
  assert.deepEqual(w.state.rng, [1, 2, 3, 4]);
  assert.equal(gameView(w).resources!.find((r) => r.resource.key === 'hp')!.current, 10);
  for (const [name, start, answer] of [
    ['kitchen_room', 100, 100],
    ['kitchen_meal', 95, 100],
    ['kitchen_ale', 96, 100],
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
      'kitchen_meal',
      (w) => (w.state.resources![resourceKey(w, w.body, 'mv')].value = 100),
    ],
    [
      'drink full',
      'kitchen_ale',
      (w) => (w.state.resources![resourceKey(w, w.body, 'mv')].value = 100),
    ],
    [
      'unfunded',
      'kitchen_meal',
      (w) => (w.state.resources![resourceKey(w, w.body, 'pennies')].value = 1),
    ],
    [
      'credit overflow',
      'kitchen_meal',
      (w) => (w.state.resources![resourceKey(w, entity(w, 'npc', 'cook'), 'pennies')].value = 99),
    ],
    [
      'sold out',
      'kitchen_meal',
      (w) => (w.state.resources![resourceKey(w, entity(w, 'npc', 'cook'), 'meal_stock')].value = 0),
    ],
    [
      'foreign vessel',
      'kitchen_ale',
      (w) => (w.state.containers[entity(w, 'item', 'kitchen_cask')] = w.body),
    ],
    [
      'ground vessel',
      'kitchen_ale',
      (w) => (w.state.containers[entity(w, 'item', 'kitchen_cask')] = w.state.containers[w.body]),
    ],
    [
      'empty vessel',
      'kitchen_ale',
      (w) => (w.state.liquids![entity(w, 'item', 'kitchen_cask')] = { kind: null, quantity: 0 }),
    ],
    [
      'wrong liquid',
      'kitchen_ale',
      (w) => (w.state.liquids![entity(w, 'item', 'kitchen_cask')].kind = ref('liquid', 'water')),
    ],
    [
      'departed provider',
      'kitchen_meal',
      (w) => (w.state.containers[entity(w, 'npc', 'cook')] = w.roomIds[`${prefix}:room/farm_yard`]),
    ],
    ['stale quote', 'kitchen_meal', () => {}, { quoted_price: 1 }],
    [
      'wrong provider',
      'kitchen_meal',
      () => {},
      { provider_id: 'bbbbbbbb-0000-4000-8000-000000000001' },
    ],
    ['wrong ref', 'kitchen_meal', () => {}, { service: ref('service', 'absent') }],
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
  w.state.liquids![entity(w, 'item', 'kitchen_cask')].quantity = 1;
  const last = run(w, 'kitchen_ale');
  assert.equal(last.decision.kind, 'accepted');
  assert.deepEqual(ale(last.world), { kind: null, quantity: 0 });
  assert.ok(last.world.entities[entity(w, 'item', 'kitchen_cask')]);
  assert.equal(run(last.world, 'kitchen_ale', 2).decision.kind, 'rejected');
  w = fresh((c) => (c.liquids[`${prefix}:liquid/draught`].drink_amount = 2));
  w.state.liquids![entity(w, 'item', 'kitchen_cask')].quantity = 1;
  assert.equal(run(w, 'kitchen_ale').decision.kind, 'rejected');
  assert.equal(ale(w).quantity, 1);
  const p = {
    type: 'use_service',
    actor_id: w.character,
    provider_id: entity(w, 'npc', 'cook'),
    service: ref('service', 'kitchen_meal'),
    quoted_price: 2,
  } as const;
  assert.deepEqual(transition(w, p, { n: LIMITS.query_steps }), { code: 'budget_exceeded' });
  // The pure transition, called past the command-level presence check, names its own refusals.
  const gone = fresh();
  gone.state.containers[entity(gone, 'npc', 'cook')] = gone.roomIds[`${prefix}:room/farm_yard`];
  assert.deepEqual(transition(gone, p), { code: 'not_present' });
  const dry = fresh();
  dry.state.resources![resourceKey(dry, entity(dry, 'npc', 'cook'), 'meal_stock')].value = 0;
  assert.deepEqual(transition(dry, p), {
    code: 'insufficient_resource',
    message: { key: 'service.sold_out' },
  });
});

// Breaks: view uses command==key filtering or bypasses the authored alias's target/input/policy contract.
test('loaded differently named service keys project exactly the captured invocation admission', () => {
  for (const changed of [
    undefined,
    (a: any) => (a.target = { kind: 'none' }),
    (a: any) => (a.input = ['service']),
    (a: any) => (a.policy = { op: 'not', item: { op: 'all', items: [] } }),
  ]) {
    const w = fresh((c) => changed?.(c.actions[`${prefix}:action/eat_kitchen_meal`]));
    const offers = gameView(w).entities.find((e) => e.id === entity(w, 'npc', 'cook'))!.services!;
    assert.deepEqual(
      offers
        .filter((s) => s.service.key.startsWith('kitchen_'))
        .map((s) => [s.action.action_key, s.action.command]),
      [
        ['eat_kitchen_meal', 'use_service'],
        ['drink_kitchen_ale', 'use_service'],
        ['rent_kitchen_room', 'use_service'],
      ],
    );
    const meal = offers.find((s) => s.service.key === 'kitchen_meal')!;
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

// Breaks: service drops old-rate settlement before the meal, or Rest stops switching MV to the resting rate / is accepted again while resting.
test('old-rate elapsed settlement precedes meal; Rest switches to the resting rate and is refused again', () => {
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
  w = run(w, 'kitchen_meal').world;
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
});

// Breaks: a service secretly reads original cook instead of the bound provider, or an unowned fact writer grants free bed truth.
test('bound second provider pays and consumes its own stock; only service can assign entitlement', () => {
  const w = fresh((c) => {
    c.services[`${prefix}:service/kitchen_meal`].provider = ref('npc', 'hob');
    c.npcs[`${prefix}:npc/cook`].services = c.npcs[`${prefix}:npc/cook`].services.filter(
      (r: any) => r.key !== 'kitchen_meal',
    );
    Object.assign(c.npcs[`${prefix}:npc/hob`], {
      room: ref('room', 'farm_kitchen'),
      services: [ref('service', 'kitchen_meal')],
      resource_starts: { pennies: 10, meal_stock: 4 },
    });
  });
  const hob = entity(w, 'npc', 'hob'),
    r = run(w, 'kitchen_meal', 1, { provider_id: hob });
  assert.equal(r.decision.kind, 'accepted');
  assert.deepEqual(amounts(r.world), [18, 10]);
  assert.equal(r.world.state.resources![resourceKey(w, hob, 'pennies')].value, 12);
  assert.equal(r.world.state.resources![resourceKey(w, hob, 'meal_stock')].value, 3);
  assert.equal(mv(r.world), 62);
  assert.throws(
    () =>
      assigned(
        w,
        w.character,
        { ops: [], position: 0, facts: {} },
        { fact: ref('fact', 'bed_paid'), value: true },
      ),
    { code: 'precondition_failed' },
  );
});
