import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, INSTALLED, loadCartridge, type World } from '../src/index.ts';
import {
  armed,
  bundle,
  coins,
  endpoint,
  entity,
  genesis,
  hound,
  open,
  prefix,
  ref,
  room,
} from './transport_fixture.ts';
import { identify } from '../src/commands/invocation.ts';

const fresh = (change = (_: any) => {}) =>
  genesis((c) => {
    open(c);
    change(c);
  });
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
const ride = (w: World, key = 'north_road', n = 1, extra = {}) =>
  run(
    w,
    {
      type: 'use_transport',
      endpoint_id: endpoint(w, key),
      route: ref('transport', key),
      quoted_fare: 3,
      ...extra,
    },
    n,
    key === 'north_road' ? 'ride_south' : 'ride_north',
  );
const accepted = (r: ReturnType<typeof run>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const startCoins = (n: number) => (c: any) => (c.resources[`${prefix}:resource/coins`].start = n);
// Breaks: a ride consumes walking MV or skips the body entry event (fares and clock: fast_travel.test.ts).
test('a ride spends no MV and enters the body into the destination', () => {
  const w = fresh();
  const mv = gameView(w).resources!.find((r) => r.resource.key === 'mv')!.current;
  const outbound = ride(w);
  const after = accepted(outbound);
  assert.equal(after.state.containers[after.body], room(after, 'south_post'));
  assert.equal(
    outbound.decision.kind === 'accepted' && outbound.decision.events[0].payload.type,
    'entity_entered_room',
  );
  assert.equal(gameView(after).resources!.find((r) => r.resource.key === 'mv')!.current, mv);
});
// Breaks: missing fare admission, standing check or endpoint/quote/client-waiver substitution allows
// free, seated or remote passage.
test('unaffordable and forged endpoint offers refuse atomically', () => {
  const w = fresh(startCoins(1));
  const notice = gameView(w).notices!.find((n) => n.transport)!;
  assert.equal(notice.transport!.action.available, false);
  const unfunded = ride(w);
  assert.equal(unfunded.decision.kind, 'rejected');
  assert.equal(unfunded.world, w);
  const funded = fresh();
  for (const extra of [{ quoted_fare: 0 }, { endpoint_id: endpoint(funded, 'south_road') }]) {
    const r = ride(funded, 'north_road', 1, extra);
    assert.equal(r.decision.kind, 'rejected');
    assert.equal(r.world, funded);
  }
  const lying = accepted(run(fresh(armed), { type: 'rest' }));
  const seated = ride(lying, 'north_road', 2);
  assert.equal(seated.decision.kind, 'rejected', 'a resting rider must stand first');
  assert.equal(seated.world, lying);
  assert.equal(
    identify('transport-test', funded.character, {
      invocation_id: 'dddddddd-0000-4000-8000-000000000001',
      actor_id: funded.character,
      action_key: 'ride_south',
      target_ids: [endpoint(funded, 'north_road')],
      input: { route: ref('transport', 'north_road'), quoted_fare: 3, recovery: true },
    }).kind,
    'invalid',
  );
  assert.deepEqual(coins(funded), [10, 0]);
  assert.deepEqual(coins(w), [1, 0]);
});
// Breaks: a wrong-owner, origin-room or empty corpse waives payment, the reverse route borrows
// this route's recovery rooms, or an actual contained belonging cannot waive it.
test('recovery waiver uses actual death owner, recovery room and contained roots', () => {
  const corpseDef = `${prefix}:item/player_corpse`;
  const base = fresh((c) => {
    armed(c);
    startCoins(0)(c);
    c.items[`${prefix}:item/pack`] = {
      key: 'pack',
      keywords: ['pack'],
      short: 'item.pack.short',
      description: 'item.pack.description',
      room_line: 'item.pack.room',
      mass_grams: 10,
      location: { in: 'room', room: ref('room', 'lane') },
    };
    Object.assign(c.text, {
      'item.pack.short': 'a pack',
      'item.pack.description': 'A pack.',
      'item.pack.room': 'A [pack](pack) lies here.',
    });
  });
  const corpse = 'dddddddd-0000-4000-8000-000000000001' as never,
    pack = entity(base, 'item', 'pack');
  for (const [owner, at, nonempty, success] of [
    [base.character, room(base, 'south_post'), true, true],
    ['eeeeeeee-0000-4000-8000-000000000001', room(base, 'south_post'), true, false],
    [base.character, room(base, 'north_post'), true, false],
    [base.character, room(base, 'south_post'), false, false],
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
          ...(nonempty ? { [pack]: corpse } : {}),
        },
      },
      entities: {
        ...base.entities,
        [corpse]: { ...base.cartridge.items![corpseDef], kind: 'item' },
      },
    } as World;
    const r = ride(w);
    assert.equal(r.decision.kind, success ? 'accepted' : 'rejected');
    if (success) {
      assert.deepEqual(coins(r.world), [0, 0]);
      assert.equal(gameView(w).notices!.find((n) => n.transport)!.transport!.waived, true);
      // south_road recovers only at north_post: the corpse here does not waive the return fare.
      assert.equal(ride(r.world, 'south_road', 2).decision.kind, 'rejected');
    }
  }
});
// Breaks: a one-way route, missing or unpaired recipient, recipient without a currency
// balance, walking bypass to the destination, or a reshaped action loads.
test('loader rejects invalid endpoint, funding, action and bypass bindings', () => {
  const route = `.cartridge.transports["${prefix}:transport/north_road"]`;
  for (const [change, path] of [
    [
      (c: any) => delete c.transports[`${prefix}:transport/south_road`],
      `.cartridge.rooms["${prefix}:room/south_post"].details.post.transport`,
    ],
    [
      (c: any) =>
        (c.transports[`${prefix}:transport/north_road`].recipient = ref('npc', 'missing')),
      route,
    ],
    [(c: any) => delete c.npcs[`${prefix}:npc/carter`].resource_starts, `${route}.currency`],
    [
      (c: any) =>
        (c.rooms[`${prefix}:room/north_post`].exits.east = { to: ref('room', 'south_post') }),
      `${route}.destination`,
    ],
    [(c: any) => (c.actions[`${prefix}:action/ride_south`].input = []), `${route}.action`],
  ] as const) {
    const b = bundle((c) => {
      open(c);
      change(c);
    });
    const loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok)
      assert.deepEqual(
        [loaded.diagnostic.code, loaded.diagnostic.path],
        ['SCHEMA_VIOLATION', path],
      );
  }
});

// Breaks: combat removes the keyed ride action, and boarding projection dereferences that missing action instead of disabling it.
test('boarding remains inspectable with a disabled offer during a real encounter', () => {
  const w = fresh(hound);
  const fighting = accepted(run(w, { type: 'attack', target_id: entity(w, 'npc', 'hound') }));
  const notice = gameView(fighting).notices!.find((n) => n.transport)!;
  assert.equal(notice.transport!.action.available, false);
  assert.equal(ride(fighting).decision.kind, 'rejected');
});

// Break: the transport page replaces its actions with the ride, dropping the recipe card aimed at
// the post (offered nowhere, since view.actions never lists a detail recipe; loka-x6t.120).
test('a recipe aimed at a transport detail keeps its card beside the ride', () => {
  const w = fresh((c) => {
    c.lock.capabilities.action_recipe = c.manifest.requires.capabilities.action_recipe = 1;
    c.recipes = {
      [`${prefix}:recipe/polish_post`]: {
        key: 'polish_post',
        aliases: ['polish'],
        label: 'actions.polish_post',
        priority: 5,
        policy: { policy_version: 1, root: { op: 'all', items: [] } },
        target: { kind: 'detail', room: ref('room', 'north_post'), detail: 'post' },
        outcomes: {
          success: {
            narration: { actor: 'narration.polish_post' },
            sequence: [{ op: 'resource.adjust', resource: ref('resource', 'coins'), by: 1 }],
          },
        },
      },
    };
    Object.assign(c.text, {
      'actions.polish_post': 'Polish the post',
      'narration.polish_post': 'You polish the post.',
    });
  });
  const notice = gameView(w).notices!.find((n) => n.transport)!;
  assert.deepEqual(
    notice.actions!.map((a) => a.action_key),
    [notice.transport!.action.action_key, 'polish_post'],
  );
});
