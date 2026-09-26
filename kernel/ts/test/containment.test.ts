// Containment: take, drop, give, has_item, items and NPCs in the world, target resolution and
// examine over them (R5 S4; 21 §7, §8; 03 §23; 04 §5.3). The world is built from the items
// known answer (protocol/fixtures/cartridge_items_hash.json). Ids and the state hash are
// Python's hashlib over the IdSource input and the canonical state (numeric profile), never the
// kernel's; outcomes and rejection codes are hand-written from the rule's header.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash } from '../src/canonical.ts';
import type { Command } from '../src/contracts.gen.ts';
import { accepted, allocator } from '../src/decision.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { describe } from '../src/rules/description_variant.ts';
import { resolve } from '../src/target.ts';
import { admit, adopt, gameView, holds, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_items_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9'; // ordinal 0
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // 1
const FERRY = '1a7c3699-2844-8a55-b29f-eac079c7bf50'; // 2: rooms in ref order
const GREEN = '91fde0fc-dd14-846f-826e-245e45d16ec7'; // 3
const POST = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b'; // 4: the mooring post detail
const BRAM = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2'; // 5: NPCs, then items in ref order
const OIL = '6a70d262-b6ea-8b64-9809-ec7f79d1521e'; // 6: lamp_oil, in the satchel
const LANTERN = '0f5f2329-bcff-82f4-948a-3d22a75fb068'; // 7: on the green
const SATCHEL = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1'; // 8: at the landing, capacity 1
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const EVENT = 'e2870386-6797-8a1b-8e1a-b2c028c16c49'; // IdSource [context, CMD, 0], Python
const SEED = [1, 2, 3, 4];

const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = () => newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], SEED);
const cmd = (payload: object): Command =>
  ({ id: CMD, world_context_id: CONTEXT, payload: { actor_id: CHARACTER, ...payload } }) as Command;
const take = (item_id: string) => cmd({ type: 'take', item_id });
const drop = (item_id: string) => cmd({ type: 'drop', item_id });
const give = (item_id: string, recipient_id: string) =>
  cmd({ type: 'give', item_id, recipient_id });
const move = (direction: string) => cmd({ type: 'move', direction });
const run = (w: World, ...cs: Command[]) => cs.reduce((x, c) => step(x, c).world, w);

// Breaks: entity ids minted from other ordinals or in another order, an item placed at the
// wrong container, a capacity lost, or the GameView listing what is elsewhere.
test('a fresh world mints NPCs then items after the details and places each', () => {
  const w = fresh();
  assert.deepEqual(w.state.containers, {
    [BODY]: FERRY,
    [BRAM]: FERRY,
    [OIL]: SATCHEL,
    [LANTERN]: GREEN,
    [SATCHEL]: FERRY,
  });
  assert.deepEqual(w.capacities, { [BRAM]: 1, [SATCHEL]: 1 });
  const view = gameView(w);
  assert.deepEqual(view.entities, [
    { id: BRAM, name: 'npc.bram.short', kind: 'npc', actions: [] },
    { id: SATCHEL, name: 'item.satchel.short', kind: 'item', actions: [] },
  ]);
  assert.deepEqual(view.inventory, []);
});

// Breaks: a take that proposes another op, source or destination, a missing event, the
// contents of a container left behind (stored twice), or the change not adopted.
test('take proposes one transfer to the body and item_acquired, at the Python state hash', () => {
  const { decision, world } = step(fresh(), take(SATCHEL));
  assert.deepEqual(decision, {
    kind: 'accepted',
    outcome: 'taken',
    delta: {
      ops: [
        {
          op: 'entity.transfer',
          writer_group: 0,
          entity_id: SATCHEL,
          source_id: FERRY,
          destination_id: BODY,
        },
      ],
    },
    events: [
      {
        id: EVENT,
        world_context_id: CONTEXT,
        scope: { kind: 'player', character_id: CHARACTER },
        actor_id: CHARACTER,
        logical_time: 0,
        position: 1,
        causation_id: CMD,
        correlation_id: CMD,
        payload: { type: 'item_acquired', item_id: SATCHEL, holder_id: BODY },
      },
    ],
    effects: [],
    rng: SEED,
  });
  assert.equal(
    hash(world.state as never),
    'fb828aedb07fd77bab6905d0707c214e7dc85f0d0f067e1f118cd6b237ccf06b',
  );
  assert.deepEqual(gameView(world).inventory, [
    { id: SATCHEL, name: 'item.satchel.short', kind: 'item', actions: [] },
  ]);
});

// Breaks: a drop or give with the wrong destination or event, or a wrong event payload.
test('drop leaves the item in the room with item_dropped; give hands it to the NPC', () => {
  const held = run(fresh(), take(SATCHEL));
  const dropped = step(held, drop(SATCHEL));
  assert.equal(dropped.world.state.containers[SATCHEL], FERRY);
  assert.deepEqual(dropped.decision.kind === 'accepted' && dropped.decision.events[0].payload, {
    type: 'item_dropped',
    item_id: SATCHEL,
    room_id: FERRY,
  });
  const given = step(held, give(SATCHEL, BRAM));
  assert.equal(given.world.state.containers[SATCHEL], BRAM);
  assert.deepEqual(given.decision.kind === 'accepted' && given.decision.events[0].payload, {
    type: 'item_acquired',
    item_id: SATCHEL,
    holder_id: BRAM,
  });
});

// Breaks: a missing or wrong check, a rejection that changes the world (04 §5.0), or an
// invariant a sequence of commands can break.
test('each bad take, drop and give is rejected with its code and consumes nothing', () => {
  const holding = run(fresh(), take(SATCHEL), move('north'), take(LANTERN), move('south'));
  const full = run(holding, give(LANTERN, BRAM));
  const rows: [World, Command, string][] = [
    [fresh(), take('11111111-2222-4333-8444-555555555555'), 'not_found'],
    [fresh(), take(POST), 'not_found'], // a detail is no entity
    [fresh(), take(BRAM), 'invalid_target'],
    [fresh(), take(LANTERN), 'not_present'], // on the green
    [fresh(), take(OIL), 'not_present'], // inside the satchel, not in the room
    [holding, take(SATCHEL), 'invalid_state'], // already held
    [fresh(), drop(SATCHEL), 'not_owned'],
    [fresh(), give(SATCHEL, BRAM), 'not_owned'],
    [holding, give(SATCHEL, POST), 'not_found'],
    [holding, give(SATCHEL, LANTERN), 'invalid_target'],
    [run(holding, move('north')), give(SATCHEL, BRAM), 'not_present'],
    [full, give(SATCHEL, BRAM), 'invalid_state'], // Bram's capacity is 1
  ];
  for (const [w, c, code] of rows) {
    const r = step(w, c);
    assert.deepEqual(r.decision, { kind: 'rejected', error: { code } }, JSON.stringify(c.payload));
    assert.equal(r.world, w);
  }
  for (const w of [holding, full, run(full, drop(SATCHEL))])
    for (const id of ['one_container_per_item', 'containment_acyclic', 'player_in_one_room'])
      assert.ok(holds(id, w), id);
});

// Breaks: an invariant check that always holds.
test('the containment invariants fail on a broken world', () => {
  const w = fresh();
  const at = (containers: object) => ({ ...w, state: { ...w.state, containers } }) as World;
  const c = w.state.containers;
  assert.equal(holds('one_container_per_item', at({ ...c, [LANTERN]: CMD })), false);
  const { [LANTERN]: _, ...lost } = c;
  assert.equal(holds('one_container_per_item', at(lost)), false);
  assert.equal(holds('containment_acyclic', at({ ...c, [SATCHEL]: OIL })), false); // a cycle
  assert.equal(holds('containment_acyclic', at({ ...c, [LANTERN]: SATCHEL })), false); // 2 > 1
  assert.ok(holds('containment_acyclic', at({ ...c, [LANTERN]: BRAM })));
});

// Breaks: the declared capacities or the containment cycle check missing from the proposal
// path (compose.ts), so a transfer the rule did not guard would commit.
test('a transfer past a capacity or into its own contents faults and commits nothing', () => {
  const w = fresh();
  const transfer = (entity_id: string, source_id: string, destination_id: string) => {
    const ops = [{ op: 'entity.transfer', writer_group: 0, entity_id, source_id, destination_id }];
    const decision = admit('containment', accepted(w, 'x', ops as never, []) as never);
    return adopt(w, decision, take(SATCHEL) as never, allocator(w, take(SATCHEL)));
  };
  const target = (e: string) => ({ kind: 'containment', entity_id: e });
  for (const [r, code, e] of [
    [transfer(LANTERN, GREEN, SATCHEL), 'capacity_exceeded', LANTERN],
    [transfer(SATCHEL, FERRY, OIL), 'containment_cycle', SATCHEL],
  ] as const) {
    assert.deepEqual(r.decision, { kind: 'fault', code, target: target(e) });
    assert.equal(r.world, w);
  }
});

// Breaks: has_item reading the wrong holder, only direct contents, or another actor's body.
test('has_item holds for an item the actor carries, also inside a carried container', () => {
  const line = (w: World, actor = CHARACTER) => {
    const lantern = w.entities[LANTERN] as any;
    const of = { description: lantern.room_line, variants: lantern.room_line_variants };
    return describe(w, actor as never, of);
  };
  assert.equal(line(fresh()), 'item.lantern.room');
  const carrying = run(fresh(), take(SATCHEL));
  assert.equal(line(carrying), 'item.lantern.room_oil'); // the oil is in the satchel
  assert.equal(line(carrying, BRAM), 'item.lantern.room'); // Bram has no body here
  assert.equal(line(run(carrying, give(SATCHEL, BRAM))), 'item.lantern.room');
});

// Breaks: entities outside the room or the body resolvable, contents of a container reachable,
// or keywords not matched.
test('target resolution names items and NPCs in the room and items the actor holds', () => {
  const r = (w: World, text: string) => resolve(w, CHARACTER as never, text);
  const w = fresh();
  assert.deepEqual(r(w, 'the ferryman'), { kind: 'unique', target_id: BRAM });
  assert.deepEqual(r(w, 'leather satchel'), { kind: 'unique', target_id: SATCHEL });
  assert.deepEqual(r(w, 'lantern'), { kind: 'none' }); // on the green
  assert.deepEqual(r(w, 'flask'), { kind: 'none' }); // inside the satchel
  const away = run(w, take(SATCHEL), move('north'));
  assert.deepEqual(r(away, 'satchel'), { kind: 'unique', target_id: SATCHEL }); // held
  assert.deepEqual(r(away, 'bram'), { kind: 'none' });
});

// Breaks: examine that ignores entities, or admits one elsewhere.
test('look with a target_id examines an item or NPC here or held, else not_present', () => {
  const look = (w: World, target_id: string) => step(w, cmd({ type: 'look', target_id })).decision;
  const examined = accepted(fresh(), 'examined', [], []);
  assert.deepEqual(look(fresh(), BRAM), examined);
  assert.deepEqual(look(fresh(), SATCHEL), examined);
  assert.deepEqual(look(run(fresh(), take(SATCHEL), move('north')), SATCHEL), examined);
  assert.deepEqual(look(fresh(), LANTERN), { kind: 'rejected', error: { code: 'not_present' } });
  assert.deepEqual(look(fresh(), OIL), { kind: 'rejected', error: { code: 'not_present' } });
});
