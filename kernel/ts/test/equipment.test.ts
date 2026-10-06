// equipment@1 (c1-equipment; mechanics.md equipment@1; numeric profile, Slot holder ids): slot
// holders in a fresh world, wear and remove by invocation (identify, resolve, step), the GameView's
// equipment and wear/remove listing, and a worn item under containment@1. Worlds are the wear known
// answer (protocol/fixtures/cartridge_wear_hash.json) and the items one relocked with equipment@1
// (re-hashed with node:crypto over the canonical encoding). Expected ids are Python hashlib over
// the IdSource input (the wear fixture's description holds the code), never the kernel's; codes
// and ops are hand-derived from mechanics.md.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef, EntityId, GameView } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { resolved } from '../src/commands/actions.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';
import { holds as policyHolds } from '../src/mechanics/policy.ts';
import { gameView, holds, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const ID = [
  'bd595711-ea5f-89a5-abb0-046cd349d2f9', // 0 the character
  '3d4829ad-9e43-81ef-bc10-66b1b267e157', // 1 the body
  '1a7c3699-2844-8a55-b29f-eac079c7bf50', // 2 the first room in ref order
  '91fde0fc-dd14-846f-826e-245e45d16ec7',
  '953a909b-3a29-8c5c-9e3f-4105b9a47c4b',
  'ff864ad5-cd56-80c8-9392-dc88bdc28fd2',
  '6a70d262-b6ea-8b64-9809-ec7f79d1521e',
  '0f5f2329-bcff-82f4-948a-3d22a75fb068',
  'd530207e-b845-8be5-9d53-b44b2cf5d8a1',
  '2ef35eee-f837-8b28-bea7-9748a332940a',
  '470b4175-5b92-89c1-bdac-645a128dc72f', // 10 wear: bram's first job
  'f34698e2-c92c-841a-b0bd-da6883e9c111', // 11 wear: the cloak holder
  '15349791-fa65-81f7-b378-bb8212b808d2', // 12 the head holder
  'e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2', // 13 the light holder
];
const [BODY, KEY, LANTERN, CAP, HAT, CLOAK] = [ID[1], ID[5], ID[6], ID[7], ID[8], ID[9]];
const [BRAM, HEAD] = [ID[4], ID[12]];
const W = 'ashmere_wear@0.0.1';

// The fixture's artifact, or its value changed by `f` and re-hashed over its canonical encoding.
const world = (fixture: string, f?: (c: any) => void): World => {
  const kat = read(`protocol/fixtures/${fixture}`);
  let [text, h] = [kat.canonical, kat.sha256];
  if (f) {
    const c = structuredClone(kat.value);
    f(c);
    text = encode(c);
    h = createHash('sha256').update(text).digest('hex');
  }
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const wear = () => world('cartridge_wear_hash.json');
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

// One invocation of `action_key` on `target_ids` through identify, resolve and step, with the
// containment invariants and gameview_agrees_with_admission checked against the view before it.
function invoke(w: World, action_key: string, ...target_ids: string[]) {
  const value = { invocation_id: ID[0], actor_id: w.character, action_key, target_ids, input: {} };
  const id = identify('scope', w.character, value);
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') throw new Error('unreachable');
  const command = resolve(w, id) as Command;
  assert.ok(!('kind' in command), JSON.stringify(command));
  const s = step(w, command, 0, action_key as never);
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const observation = { view: gameView(w), command, decision: s.decision, resolves };
  assert.ok(check('gameview_agrees_with_admission', observation), action_key);
  for (const i of ['one_container_per_item', 'containment_acyclic'])
    assert.ok(holds(i, s.world), `${i} after ${action_key}`);
  return s;
}
const accepted = (w: World, key: string, ...ids: string[]) => {
  const s = invoke(w, key, ...ids);
  assert.equal(s.decision.kind, 'accepted', `${key}: ${JSON.stringify(s.decision)}`);
  return s;
};
const refused = (w: World, key: string, id: string, code: string) => {
  const s = invoke(w, key, id);
  assert.deepEqual(s.decision, { kind: 'rejected', error: { code } }, `${key} ${id}`);
  assert.equal(s.world, w);
};
const transfer = (entity_id: string, source_id: string, destination_id: string) => [
  { op: 'entity.transfer', writer_group: 0, entity_id, source_id, destination_id },
];
const keys = (v: GameView['inventory']) =>
  Object.fromEntries(
    v.map((e) => [
      e.id,
      e.actions.filter((a) => ['wear', 'remove'].includes(a.action_key)).map((a) => a.action_key),
    ]),
  );

// Breaks: holders minted before the jobs or the items, in ref or 00 §4.4 order instead of
// slot-key order, outside the body, without capacity 1, or as targetable, listed entities.
test('a fresh world mints one holder per declared slot after the job, in slot-key order', () => {
  const w = wear();
  assert.deepEqual([w.character, w.body], [ID[0], ID[1]]);
  assert.deepEqual(plain(w.roomIds), {
    [`${W}:room/inn_attic`]: ID[2],
    [`${W}:room/inn_rooms`]: ID[3],
  });
  assert.deepEqual(plain(w.entityIds), {
    [`${W}:npc/bram`]: ID[4],
    [`${W}:item/cellar_key`]: ID[5],
    [`${W}:item/lantern`]: ID[6],
    [`${W}:item/leather_cap`]: ID[7],
    [`${W}:item/straw_hat`]: ID[8],
    [`${W}:item/wool_cloak`]: ID[9],
  });
  assert.deepEqual(Object.keys(w.state.jobs!), [ID[10]]);
  assert.deepEqual(plain(w.slots), { cloak: ID[11], head: ID[12], light: ID[13] });
  const view = gameView(w);
  const listed = [...view.entities, ...view.inventory].map((e) => e.id);
  for (const h of ID.slice(11)) {
    assert.equal(w.state.containers[h], BODY);
    assert.equal(w.capacities[h], 1);
    assert.ok(!Object.hasOwn(w.entities, h) && !listed.includes(h as never));
  }
});

// Breaks: holders made for a lock without any slotted item (all twelve, or any), which shifts no
// earlier id but changes the fresh state hash of every equipment@1 cartridge.
test('a cartridge with equipment@1 but no slot keeps its ids and fresh state', () => {
  const lock = (c: any) => {
    c.manifest.requires.capabilities.equipment = 1;
    c.lock.capabilities.equipment = 1;
  };
  const [before, after] = [
    world('containers_cartridge_items_hash.json'),
    world('containers_cartridge_items_hash.json', lock),
  ];
  const I = 'ashmere_items@0.0.1';
  assert.deepEqual([after.character, after.body], [ID[0], ID[1]]);
  assert.deepEqual(plain(after.roomIds), {
    [`${I}:room/ferry_landing`]: ID[2],
    [`${I}:room/village_green`]: ID[3],
  });
  assert.deepEqual(Object.keys(after.details), [ID[4]]);
  assert.deepEqual(plain(after.entityIds), {
    [`${I}:npc/bram`]: ID[5],
    [`${I}:item/lamp_oil`]: ID[6],
    [`${I}:item/lantern`]: ID[7],
    [`${I}:item/satchel`]: ID[8],
  });
  assert.deepEqual(plain(after.slots), {});
  assert.deepEqual(after.state, before.state);
  assert.equal(gameView(after).equipment, undefined);
});

// Breaks: a wear or remove branch lost or reordered (not held, no slot, slot taken, not worn), the
// transfer's ends swapped, or TARGETS missing for either command (unsupported_capability).
test('wear and remove by invocation, with their refusals', () => {
  let w = wear();
  for (const item of [CAP, HAT, KEY]) w = accepted(w, 'take', item).world;
  const worn = accepted(w, 'wear', CAP);
  assert.deepEqual(plain(worn.decision), {
    kind: 'accepted',
    outcome: 'worn',
    delta: { ops: transfer(CAP, BODY, HEAD) },
    events: [],
    effects: [],
    rng: [1, 2, 3, 4],
  });
  w = worn.world;
  assert.equal(w.state.containers[CAP], HEAD);
  refused(w, 'wear', HAT, 'invalid_state'); // the head slot is taken
  refused(w, 'wear', KEY, 'invalid_target'); // no slot
  refused(w, 'wear', CLOAK, 'not_owned'); // in the room
  refused(w, 'wear', CAP, 'invalid_state'); // already worn
  refused(w, 'remove', HAT, 'invalid_state'); // held, not worn
  refused(w, 'remove', CLOAK, 'not_owned'); // in the room
  const cloaked = accepted(accepted(w, 'take', CLOAK).world, 'wear', CLOAK).world;
  const item = {
    cartridge_id: 'ashmere_wear',
    cartridge_version: '0.0.1',
    kind: 'item',
    key: 'leather_cap',
  } as DefinitionRef;
  assert.ok(policyHolds(cloaked, cloaked.character, { op: 'has_item', item }, { steps: { n: 0 } }));
  const removed = accepted(w, 'remove', CAP);
  assert.equal(removed.decision.kind === 'accepted' && removed.decision.outcome, 'removed');
  assert.deepEqual(
    plain(removed.decision.kind === 'accepted' && removed.decision.delta.ops),
    transfer(CAP, HEAD, BODY),
  );
  assert.equal(removed.world.state.containers[CAP], BODY);
});

// Breaks: the view listing a worn item in the inventory, wear on a taken slot or an unslotted item,
// remove on a held item, drop or give on a worn one, slots out of slot-key order, or descriptions
// omitted/derived from short names rather than carried from explicit room/held/worn definitions,
// or an equipped item's authored slot lost from its item projection.
test('the GameView lists the slots in order and wear and remove only where step accepts them', () => {
  let w = world('cartridge_wear_hash.json', (c) => {
    c.items[`${W}:item/leather_cap`].description = 'catalog.cap_body';
    c.text['catalog.cap_body'] = c.text['item.leather_cap.description'];
  });
  assert.equal(
    gameView(w).entities.find((e) => e.id === BRAM)!.description,
    'npc.bram.description',
  );
  for (const item of [CAP, HAT, KEY, LANTERN]) w = accepted(w, 'take', item).world;
  assert.deepEqual(keys(gameView(w).inventory), {
    [KEY]: [],
    [LANTERN]: ['wear'],
    [CAP]: ['wear'],
    [HAT]: ['wear'],
  });
  assert.equal(gameView(w).inventory.find((e) => e.id === CAP)!.description, 'catalog.cap_body');
  w = accepted(w, 'wear', CAP).world;
  const view = gameView(w);
  assert.deepEqual(keys(view.inventory), {
    [KEY]: [],
    [LANTERN]: ['wear'],
    [HAT]: [],
  });
  const remove = {
    available: true,
    action_key: 'remove',
    label: 'action.remove',
    target: { kind: 'entity', scopes: ['inventory'] },
    input: [],
  };
  assert.deepEqual(plain(view.equipment), [
    { slot: 'cloak' },
    {
      slot: 'head',
      item: {
        id: CAP,
        name: 'item.leather_cap.short',
        description: 'catalog.cap_body',
        kind: 'item',
        slot: 'head',
        actions: [remove],
      },
    },
    { slot: 'light' },
  ]);
});

// Breaks: containment@1 treating a worn item as held (it is in a holder, not the body): drop or
// give would move it out of its slot, take would report invalid_state.
test('a worn item cannot be dropped, given or taken', () => {
  let w = wear();
  w = accepted(accepted(w, 'take', CAP).world, 'wear', CAP).world;
  const cmd = (payload: object) =>
    ({
      id: ID[13],
      world_context_id: CONTEXT,
      payload: { actor_id: w.character, ...payload },
    }) as Command;
  for (const [payload, code] of [
    [{ type: 'drop', item_id: CAP }, 'not_owned'],
    [{ type: 'give', item_id: CAP, recipient_id: BRAM }, 'not_owned'],
    [{ type: 'take', item_id: CAP }, 'not_present'],
  ] as const) {
    const s = step(w, cmd(payload), 0);
    assert.deepEqual(s.decision, { kind: 'rejected', error: { code } }, payload.type);
    assert.equal(s.world, w);
  }
});

// Breaks: containment_acyclic not holding a holder's capacity of 1 (two items worn in one slot).
test('two items in one holder fail containment_acyclic', () => {
  const w = wear();
  const containers = { ...w.state.containers, [CAP]: HEAD as EntityId, [HAT]: HEAD as EntityId };
  assert.equal(holds('containment_acyclic', { ...w, state: { ...w.state, containers } }), false);
});

// A cartridge action `key` resolving to `command` with `target`, always true (protocol.md ActionSet).
const action = (c: any, key: string, command: string, target: object) => {
  c.text[`action.${key}`] = key;
  c.lock.capabilities.policy = c.manifest.requires.capabilities.policy = 1;
  c.actions[`${W}:action/${key}`] = {
    key,
    command,
    target,
    input: [],
    label: `action.${key}`,
    accessibility: `action.${key}`,
    priority: 0,
    policy: { policy_version: 1, root: { op: 'all', items: [] } },
  };
};
const inventory = { kind: 'entity', scopes: ['inventory'] };

// Breaks (C1E-01): admission's inventory scope excluding a worn item for an action resolving to
// remove, so an override or alias of remove is neither listed on the worn item nor accepted.
test('a cartridge remove and its alias list on and remove a worn item', () => {
  let w = world('cartridge_wear_hash.json', (c) => {
    action(c, 'remove', 'remove', inventory);
    action(c, 'doff', 'remove', inventory);
  });
  w = accepted(accepted(w, 'take', CAP).world, 'wear', CAP).world;
  const head = gameView(w).equipment!.find((s) => s.slot === 'head')!;
  assert.deepEqual(
    head.item!.actions.map((a) => a.action_key),
    ['doff', 'remove'],
  );
  for (const key of ['remove', 'doff'])
    assert.equal(accepted(w, key, CAP).world.state.containers[CAP], BODY, key);
});

// Breaks (C1E-02): a targetless wear alias listed with the place (its Command lacks item_id, so it
// is never accepted), and gameview_agrees_with_admission not flagging such a view.
test('a targetless wear alias is not listed, and the invariant refuses a view listing it', () => {
  const w = world('cartridge_wear_hash.json', (c) => action(c, 'dress', 'wear', { kind: 'none' }));
  const view = gameView(w);
  assert.deepEqual(
    view.actions.map((a) => a.action_key),
    ['move', 'scan', 'wait'],
  );
  const s = invoke(w, 'take', CAP); // the invariant holds on the real view
  const dress = {
    available: true,
    action_key: 'dress',
    label: 'action.dress',
    target: { kind: 'none' },
    input: [],
  };
  const listed = { ...view, actions: [...view.actions, dress] };
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const command = { payload: { type: 'take', item_id: CAP } };
  assert.equal(
    check('gameview_agrees_with_admission', {
      view: listed,
      command,
      decision: s.decision,
      resolves,
    }),
    false,
  );
});

// Breaks: omitting/duplicating worn mass, charging neutral equipment transfers, or counting a
// Remove as weight loss. Lantern 2000 + cloak 3000 = 5000, worn or held; a 100g key exceeds it.
test('worn gear counts once and Remove then Drop provides a carrying escape', () => {
  const base = wear();
  const mass: Record<string, number> = {
    cellar_key: 100,
    lantern: 2000,
    leather_cap: 0,
    straw_hat: 0,
    wool_cloak: 3000,
  };
  let w: World = {
    ...base,
    cartridge: {
      ...base.cartridge,
      world: { ...base.cartridge.world, carry: { max_grams: 5000 } },
    },
    entities: Object.fromEntries(
      Object.entries(base.entities).map(([id, e]) => [
        id,
        e.kind === 'item' ? { ...e, mass_grams: mass[e.key] } : e,
      ]),
    ),
  };
  w = accepted(accepted(w, 'take', LANTERN).world, 'take', CLOAK).world;
  w = accepted(w, 'wear', CLOAK).world;
  refused(w, 'drop', CLOAK, 'not_owned');
  refused(w, 'take', KEY, 'too_heavy');
  const equality: World = {
    ...w,
    cartridge: { ...w.cartridge, world: { ...w.cartridge.world, carry: { max_grams: 5100 } } },
  };
  accepted(equality, 'take', KEY); // 5100 including the worn cloak exactly once
  w = accepted(w, 'remove', CLOAK).world;
  refused(w, 'take', KEY, 'too_heavy');
  w = accepted(w, 'drop', CLOAK).world;
  w = accepted(w, 'take', KEY).world; // 2100, below 5000
  assert.equal(w.state.containers[KEY], BODY);
});
