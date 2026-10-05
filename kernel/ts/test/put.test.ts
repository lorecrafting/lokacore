import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ready, run, ok, entity, choose, moveTo } from './reward_storage_fixture.ts';
import { gameView } from '../src/runtime/world.ts';
import { putRefused } from '../src/mechanics/containment/shared.ts';
import { lists } from '../src/view/action_lists.ts';

const unlocked = () => {
  const w = ready();
  let next = moveTo(ok(w, choose(w)), 'inn_rooms');
  next = ok(next, { type: 'unlock', target_id: entity(next, 'item', 'reward_chest') });
  return ok(next, { type: 'open', target_id: entity(next, 'item', 'reward_chest') });
};

// Breaks: Put creates another item, consumes the key, skips lid guards or emits an acquisition to body.
test('earned key unlocks the empty chest; Put/Close/Open/Take preserves the stored identity', () => {
  const w = ready();
  let next = moveTo(ok(w, choose(w)), 'inn_rooms');
  const chest = entity(next, 'item', 'reward_chest');
  const item = entity(next, 'item', 'brass_key');
  next = ok(next, { type: 'take', item_id: item });
  const put = { type: 'put', item_id: item, container_id: chest };
  assert.deepEqual(run(next, put).decision, { kind: 'rejected', error: { code: 'exit_locked' } });
  next = ok(next, { type: 'unlock', target_id: chest });
  assert.deepEqual(run(next, put).decision, { kind: 'rejected', error: { code: 'exit_closed' } });
  next = ok(next, { type: 'open', target_id: chest });
  const offer = gameView(next)
    .inventory.find((i) => i.id === item)!
    .actions.find((a) => a.action_key === 'put' && a.target_ids?.[1] === chest);
  assert.equal(offer?.available, true);
  assert.deepEqual(offer?.target_ids, [item, chest]);
  const result = run(next, put);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  assert.equal(result.decision.outcome, 'put');
  assert.deepEqual(
    result.decision.events.map((e) => e.payload),
    [{ type: 'item_acquired', item_id: item, holder_id: chest }],
  );
  next = result.world;
  assert.equal(next.state.containers[item], chest);
  next = ok(next, { type: 'close', target_id: chest });
  next = ok(next, { type: 'open', target_id: chest });
  next = ok(next, { type: 'take', item_id: item });
  assert.equal(next.state.containers[item], next.body);
  assert.equal(next.entities[item], w.entities[item]);
});

// Breaks: immediate capacity ignored, unlimited omitted capacity refused, or deposits blocked by overload.
test('capacity one accepts one deposit only; an unlimited own bag permits overloaded rearrangement', () => {
  let w = unlocked();
  const chest = entity(w, 'item', 'reward_chest');
  const key = entity(w, 'item', 'reward_key');
  const brass = entity(w, 'item', 'brass_key');
  w = { ...w, capacities: { ...w.capacities, [chest]: 1 } };
  w = ok(w, { type: 'take', item_id: brass });
  w = ok(w, { type: 'put', item_id: brass, container_id: chest });
  const r = run(w, { type: 'put', item_id: key, container_id: chest });
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(r.world, w);
  const bag = entity(w, 'item', 'lantern');
  const bagDefinition = w.entities[bag];
  assert.ok(bagDefinition.kind === 'item');
  w = {
    ...w,
    entities: { ...w.entities, [bag]: { ...bagDefinition, mass_grams: 12001 } },
    state: { ...w.state, containers: { ...w.state.containers, [bag]: w.body } },
  };
  w = ok(w, { type: 'put', item_id: key, container_id: bag });
  assert.equal(w.state.containers[key], bag);
  w = ok(w, { type: 'take', item_id: key });
  assert.equal(w.state.containers[key], w.body);
});

// Breaks: source/body check, item destination check, reach or ancestor guard omitted.
test('Put refuses worn/nonheld, missing/non-item, inaccessible, self and descendant destinations', () => {
  let w = unlocked();
  const key = entity(w, 'item', 'reward_key');
  const chest = entity(w, 'item', 'reward_chest');
  const cloak = entity(w, 'item', 'wool_cloak');
  w = ok(w, { type: 'take', item_id: cloak });
  w = ok(w, { type: 'wear', item_id: cloak });
  for (const [item, dest, code] of [
    [cloak, chest, 'not_owned'],
    [entity(w, 'item', 'brass_key'), chest, 'not_owned'],
    [key, entity(w, 'npc', 'maud'), 'invalid_target'],
    [key, 'aaaaaaaa-1111-4111-8111-111111111111', 'not_found'],
    [key, entity(w, 'item', 'trunk'), 'not_present'],
  ])
    assert.deepEqual(run(w, { type: 'put', item_id: item, container_id: dest }).decision, {
      kind: 'rejected',
      error: { code },
    });
  assert.equal(run(w, { type: 'put', item_id: key, container_id: key }).decision.kind, 'fault');
  assert.equal(putRefused(w, w.body, key, key, { n: 0 }), 'containment_cycle');
  const child = entity(w, 'item', 'brass_key');
  w = { ...w, state: { ...w.state, containers: { ...w.state.containers, [child]: key } } };
  assert.equal(run(w, { type: 'put', item_id: key, container_id: child }).decision.kind, 'fault');
});

// Breaks: pair enumeration performs uncharged work or offers a usable prefix after exhaustion.
test('Put enumeration and pair admission obey the shared query limit with no partial pair list', () => {
  let w = unlocked();
  const item = entity(w, 'item', 'reward_key');
  const chest = entity(w, 'item', 'reward_chest');
  assert.equal(putRefused(w, w.body, item, chest, { n: 32768 }), 'budget_exceeded');
  const entities = { ...w.entities };
  for (let i = 0; i < 33000; i++)
    entities[`bbbbbbbb-0000-4000-8000-${String(i).padStart(12, '0')}`] =
      entities[entity(w, 'npc', 'maud')];
  w = { ...w, entities };
  const offers = lists(w, w.character)
    .of('inventory', item)
    .filter((a) => a.action_key === 'put');
  assert.equal(offers.length, 1);
  assert.equal(offers[0].available, false);
  assert.deepEqual(offers[0].reason, { code: 'budget_exceeded' });
  assert.equal(offers[0].target_ids, undefined);
});
