import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { bundle, fresh, ref, room, entity, endpoint, pennies } from './transport_fixture.ts';
import { identify } from '../src/commands/invocation.ts';
import { membership } from '../src/mechanics/skills.ts';
import { INSTALLED, loadCartridge } from '../src/index.ts';

function run(w: World, payload: object, n = 1, action?: string) {
  return step(
    w,
    {
      id: `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
    action as never,
  );
}
const ferry = (w: World, key = 'fen_outbound', n = 1, extra = {}) =>
  run(
    w,
    {
      type: 'use_transport',
      endpoint_id: endpoint(w, key),
      route: ref('transport', key),
      quoted_fare: key === 'fen_outbound' ? 2 : 0,
      ...extra,
    },
    n,
    key === 'fen_outbound' ? 'board_ferry' : 'return_ferry',
  );
const accepted = (r: ReturnType<typeof run>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
// Breaks: a paid crossing debits without moving, free return charges, or transport consumes walking MV/time.
test('paid outbound and free return join exact conserved balances and body entry', () => {
  let w = fresh();
  const mv = gameView(w).resources!.find((r) => r.resource.key === 'mv')!.current;
  const outbound = ferry(w);
  w = accepted(outbound);
  assert.deepEqual(pennies(w), [1, 2]);
  assert.equal(w.state.containers[w.body], room(w, 'fen_isle_landing'));
  assert.equal(
    outbound.decision.kind === 'accepted' && outbound.decision.events[0].payload.type,
    'entity_entered_room',
  );
  w = accepted(ferry(w, 'fen_return', 2));
  assert.deepEqual(pennies(w), [1, 2]);
  assert.equal(w.state.containers[w.body], room(w, 'boathouse'));
  assert.equal(gameView(w).resources!.find((r) => r.resource.key === 'mv')!.current, mv);
  assert.equal(w.state.clock, 0);
});
// Breaks: missing fare admission or endpoint/quote/client-waiver substitution allows free or remote passage.
test('unaffordable and forged endpoint offers refuse atomically', () => {
  const w = fresh(
    (c) => (c.resources[`${c.manifest.id}@${c.manifest.version}:resource/pennies`].start = 1),
  );
  const notice = gameView(w).notices!.find((n) => n.transport)!;
  assert.equal(notice.transport!.action.available, false);
  const unfunded = ferry(w);
  assert.equal(unfunded.decision.kind, 'rejected');
  assert.equal(unfunded.world, w);
  const funded = fresh();
  for (const extra of [{ quoted_fare: 0 }, { endpoint_id: endpoint(funded, 'fen_return') }]) {
    const r = ferry(funded, 'fen_outbound', 1, extra);
    assert.equal(r.decision.kind, 'rejected');
    assert.equal(r.world, funded);
  }
  assert.equal(
    identify('transport-test', funded.character, {
      invocation_id: 'dddddddd-0000-4000-8000-000000000001',
      actor_id: funded.character,
      action_key: 'board_ferry',
      target_ids: [endpoint(funded, 'fen_outbound')],
      input: { route: ref('transport', 'fen_outbound'), quoted_fare: 2, recovery: true },
    }).kind,
    'invalid',
  );
  assert.deepEqual(pennies(funded), [3, 0]);
  assert.deepEqual(pennies(w), [1, 0]);
});
// Breaks: a wrong-owner, mainland or empty corpse waives payment, or actual nested belongings cannot waive it.
test('recovery waiver uses actual death owner, isle room and contained roots', () => {
  const base = fresh(
    (c) => (c.resources[`${c.manifest.id}@${c.manifest.version}:resource/pennies`].start = 0),
  );
  const corpse = 'dddddddd-0000-4000-8000-000000000001' as never,
    bag = entity(base, 'item', 'satchel'),
    torch = entity(base, 'item', 'torch');
  for (const [owner, at, nonempty, success] of [
    [base.character, room(base, 'hut_loft'), true, true],
    ['eeeeeeee-0000-4000-8000-000000000001', room(base, 'hut_loft'), true, false],
    [base.character, room(base, 'boathouse'), true, false],
    [base.character, room(base, 'hut_loft'), false, false],
  ] as const) {
    const w = {
      ...base,
      state: {
        ...base.state,
        created: {
          [corpse]: {
            definition: ref('item', 'player_corpse'),
            origin: { kind: 'death', owner_id: owner },
          },
        },
        containers: {
          ...base.state.containers,
          [corpse]: at,
          ...(nonempty ? { [bag]: corpse, [torch]: bag } : {}),
        },
      },
      entities: {
        ...base.entities,
        [corpse]: {
          ...base.cartridge.items![
            `${ref('item', 'player_corpse').cartridge_id}@${ref('item', 'player_corpse').cartridge_version}:item/player_corpse`
          ],
          kind: 'item',
        },
      },
    } as World;
    const r = ferry(w);
    assert.equal(r.decision.kind, success ? 'accepted' : 'rejected');
    if (success) {
      assert.deepEqual(pennies(r.world), [0, 0]);
      assert.equal(gameView(w).notices![0].transport!.waived, true);
      assert.deepEqual(pennies(accepted(ferry(r.world, 'fen_return', 2))), [0, 0]);
    }
  }
});
// Breaks: a free lesson remains forbidden, grants twice, charges, or allows a remote teacher.
test('Sedge teaches swim once freely through the original present dialogue', () => {
  let w = accepted(ferry(fresh()));
  w = accepted(run(w, { type: 'move', direction: 'east' }, 2));
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(gameView(w).entities.find((e) => e.id === entity(w, 'npc', 'sedge'))!.lessons),
    ),
    [ref('skill', 'swim')],
  );
  const before = gameView(w).skills!.find((s) => s.skill.key === 'swim')!;
  assert.deepEqual([before.acquired, before.qualified], [false, true]);
  w = accepted(
    run(
      w,
      {
        type: 'talk',
        target_id: entity(w, 'npc', 'sedge'),
        dialogue: ref('dialogue', 'sedge_swim'),
      },
      3,
    ),
  );
  const continuation_id = gameView(w).choice!.continuation_id;
  w = accepted(run(w, { type: 'choose', continuation_id, choice_id: 'learn' }, 4));
  assert.equal(membership(w, w.character, ref('skill', 'swim')), true);
  const learned = gameView(w).skills!.find((s) => s.skill.key === 'swim')!;
  assert.deepEqual([learned.acquired, learned.qualified], [true, true]);
  assert.deepEqual(pennies(w), [1, 2]);
  assert.equal(
    run(w, { type: 'choose', continuation_id, choice_id: 'learn' }, 5).decision.kind,
    'rejected',
  );
  w = accepted(run(w, { type: 'move', direction: 'west' }, 6));
  assert.equal(
    run(
      w,
      {
        type: 'talk',
        target_id: entity(w, 'npc', 'sedge'),
        dialogue: ref('dialogue', 'sedge_swim'),
      },
      7,
    ).decision.kind,
    'rejected',
  );
});
// Breaks: compiler-shaped endpoint omissions, nonreciprocal routes, bypass exits or a gift disguised as a free skill lesson loads.
test('loader rejects invalid endpoint, funding, action and free lesson bindings', () => {
  for (const change of [
    (c: any) => (c.manifest.requires.kernel_api.at_least = '1.25'),
    (c: any) => delete c.transports[`${c.manifest.id}@${c.manifest.version}:transport/fen_return`],
    (c: any) =>
      (c.transports[`${c.manifest.id}@${c.manifest.version}:transport/fen_outbound`].recipient =
        ref('npc', 'missing')),
    (c: any) => delete c.npcs[`${c.manifest.id}@${c.manifest.version}:npc/sedge`].resource_starts,
    (c: any) =>
      (c.rooms[`${c.manifest.id}@${c.manifest.version}:room/boathouse`].exits.west = {
        to: ref('room', 'fen_isle_landing'),
      }),
    (c: any) => (c.actions[`${c.manifest.id}@${c.manifest.version}:action/board_ferry`].input = []),
    (c: any) =>
      (c.dialogues[
        `${c.manifest.id}@${c.manifest.version}:dialogue/sedge_swim`
      ].choices.learn.payment = {
        from: 'teacher',
        resource: ref('resource', 'pennies'),
        amount: 1,
      }),
  ]) {
    const b = bundle(change);
    assert.equal(
      loadCartridge(
        new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
        INSTALLED,
      ).ok,
      false,
    );
  }
});

// Breaks: combat removes the keyed ferry action, and boarding projection dereferences that missing action instead of disabling it.
test('boarding remains inspectable with a disabled offer during a real encounter', () => {
  const w = fresh((c) => {
    const rat = structuredClone(c.npcs[`${c.manifest.id}@${c.manifest.version}:npc/cellar_rat_1`]);
    rat.key = 'boarding_test_rat';
    rat.room = ref('room', 'boathouse');
    c.npcs[`${c.manifest.id}@${c.manifest.version}:npc/boarding_test_rat`] = rat;
  });
  const fighting = accepted(
    run(w, { type: 'attack', target_id: entity(w, 'npc', 'boarding_test_rat') }),
  );
  const notice = gameView(fighting).notices!.find((n) => n.transport)!;
  assert.equal(notice.transport!.action.available, false);
  assert.equal(ferry(fighting).decision.kind, 'rejected');
});
