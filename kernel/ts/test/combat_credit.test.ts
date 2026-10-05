import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatWorld, attack, elapsed, hp, rat, room } from './combat_fixture.ts';
import { deathCredit } from '../src/mechanics/combat/credit.ts';
import { value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import type { DeltaOp, DomainEvent } from '../src/contracts.gen.ts';

// Breaks: matching an unvalidated event/definition alone credits the wrong person or occurrence.
test('credit delivery rejects counterfeit attribution and missing fatal/corpse provenance', () => {
  const initial = combatWorld();
  const result = elapsed(attack(hp(initial, rat(initial, 3), 1), 3).world, 150);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  const { events, delta } = result.decision;
  const event = events.find((e) => e.payload.type === 'entity_died')!;
  const payload = event.payload;
  assert.equal(payload.type, 'entity_died');
  if (payload.type !== 'entity_died') return;
  const fact = initial.cartridge.world!.death_credit![2].fact;
  const facts = { ...result.world.state.facts };
  delete facts[
    key({ kind: 'fact', fact, scope: { kind: 'player', character_id: initial.character } })
  ];
  const world = { ...result.world, state: { ...result.world.state, facts } };
  assert.equal(deathCredit(world, event, delta.ops, events).length, 1);
  const counterfeit = [
    { ...payload, victim_id: rat(world, 2) },
    { ...payload, room_id: room(world, 'drowned_lantern') },
    { ...payload, credited_character_id: null },
    { ...payload, credited_character_id: '00000000-0000-4000-8000-000000000099' },
    { ...payload, killer_id: rat(world, 2) },
    { ...payload, corpse_id: world.body },
  ];
  for (const p of counterfeit)
    assert.deepEqual(
      deathCredit(world, { ...event, payload: p } as DomainEvent, delta.ops, events),
      [],
    );
  assert.deepEqual(deathCredit(world, event, [], events), []);
  const noLoss = delta.ops.map((o) => (o.op === 'resource.adjust' ? { ...o, from: 0 } : o));
  assert.deepEqual(deathCredit(world, event, noLoss, events), []);
  const corpse = world.state.created![payload.corpse_id];
  const changed = { ...corpse, origin: { ...corpse.origin, event_id: events[0].id } };
  const wrongOccurrence = {
    ...world,
    state: { ...world.state, created: { ...world.state.created, [payload.corpse_id]: changed } },
  };
  const matchingOps = delta.ops.map((o) =>
    o.op === 'entity.create' ? { ...o, identity: changed } : o,
  ) as DeltaOp[];
  assert.deepEqual(deathCredit(wrongOccurrence, event, matchingOps, events), []);
  const displaced = {
    ...world,
    state: {
      ...world.state,
      containers: { ...world.state.containers, [payload.corpse_id]: room(world, 'chapel_nave') },
    },
  };
  assert.deepEqual(deathCredit(displaced, event, delta.ops, events), []);
});

// Breaks: counting repeated deaths as different rats or awarding/creating the later quest now.
test('five distinct preacceptance lethal occurrences set exactly five facts without quest rewards', () => {
  let world = combatWorld();
  world = {
    ...world,
    cartridge: {
      ...world.cartridge,
      world: {
        ...world.cartridge.world,
        combat: {
          ...world.cartridge.world!.combat!,
          player_attack: { chance: 100, damage_min: 1, damage_max: 1 },
        },
      },
    },
  };
  for (let n = 1; n <= 5; n++) {
    world = hp(world, rat(world, n), 1);
    const begun = attack(world, n);
    assert.equal(begun.decision.kind, 'accepted');
    const next = elapsed(begun.world, n * 150, n + 1);
    assert.equal(next.decision.kind, 'accepted');
    world = next.world;
    assert.deepEqual(
      world.cartridge.world!.death_credit!.map((m) => value(world, world.character, m.fact)),
      Array.from({ length: 5 }, (_, i) => i < n),
    );
    assert.equal(attack(world, n).decision.kind, 'rejected');
  }
  assert.deepEqual(world.state.quests ?? {}, {});
  assert.equal(Object.keys(world.state.created!).length, 5);
  assert.ok(!Object.keys(world.state.facts ?? {}).some((k) => k.includes('trust')));
});
