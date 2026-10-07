// Fixed v042 creature route; corpse, loot and shrine answers from cartridges/ashmere_missing_child/{population_bundles,cartridge}.json.
import assert from 'node:assert/strict';
import type { DecisionResult, DefinitionRef } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { holds } from '../src/mechanics/policy.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { key, same } from '../src/foundation/compose.ts';
import { refString } from '../src/runtime/decision.ts';
import type { CaseHost } from './e1_case_host.ts';

export function creatures(a: CaseHost) {
  const world = () => a.story.world(),
    created = () => Object.entries(world().state.created ?? {}),
    here = () => world().state.containers[world().body];
  const member = (plan: string) =>
    created().find(
      ([id, c]) =>
        c.definition.kind === 'npc' &&
        c.origin.kind === 'spawned' &&
        c.origin.by.key === plan &&
        world().state.containers[id] === here(),
    )![0];
  const corpse = (victim: string) =>
    created().find(([, c]) => c.origin.kind === 'death' && c.origin.victim_id === victim);
  const fight = (id: string) => {
    a.invoke('attack', [id]);
    for (let round = 0; round < 40 && a.view().combat; round++) a.elapsed(3_000);
  };
  const hunt = (plan: string, kind: string) => {
    const id = member(plan);
    fight(id);
    assert.equal(corpse(id)?.[1].definition.key, kind, `${plan} member must leave its corpse`);
    return id;
  };
  const loot = (victim: string) =>
    created().find(
      ([, c]) =>
        c.definition.kind === 'item' &&
        c.origin.kind === 'spawned' &&
        c.origin.member_id === victim,
    )![0];
  const take = (item: string) => {
    a.invoke('take', [item]);
    assert.equal(world().state.containers[item], world().body);
  };

  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'north');
  hunt('crow_green_1', 'crow_corpse');
  hunt('crow_green_2', 'crow_corpse');
  a.move('south', 'south', 'south', 'south', 'west', 'south');
  hunt('oak_deer', 'deer_corpse');
  hunt('crow_oak', 'crow_corpse');
  a.move('up');
  hunt('crow_branches', 'crow_corpse');
  a.move('down', 'north');
  hunt('willow_deer', 'deer_corpse');
  a.move('east', 'north', 'north', 'north', 'north', 'west', 'west');
  const hide = loot(hunt('orchard_deer', 'deer_corpse'));
  take(hide);
  a.move('east', 'east', 'south', 'south', 'south', 'south', 'east');
  const hound = member('fen_hounds'),
    pelt = loot(hound);
  fight(hound);
  // The pack kills the player first: shrine return with the authored restore.
  assert.equal(a.view().place.title.key, 'room.chapel_nave.title');
  assert.equal(level(world(), world().body, resourceRef(world(), 'hp')), 10);
  assert.equal(corpse(hound), undefined);
  a.move('south', 'south', 'south', 'south', 'south', 'south', 'south', 'east');
  fight(hound);
  assert.equal(world().state.containers[pelt], corpse(hound)![0]);
  a.move('south', 'south', 'south', 'south', 'south', 'south', 'south', 'east');
  take(pelt);
  take(hide); // recovered from the player's own corpse
  a.reopen();
  assert.equal(world().state.containers[hide], world().body);
  assert.equal(world().state.containers[pelt], world().body);
  const corpses: Record<string, number> = {};
  for (const [, c] of created())
    if (c.origin.kind === 'death') corpses[c.definition.key] = (corpses[c.definition.key] ?? 0) + 1;
  return corpses;
}

// ponytail: spawned-member deaths, their corpse/loot, created-source bleeds and suppress reactions only.
export function creatureWitnesses(before: World, after: World, decision: DecisionResult): string[] {
  if (decision.kind !== 'accepted') return [];
  const ops = decision.delta.ops,
    events = decision.events,
    path = (r: DefinitionRef) => `/${r.kind}s/${refString(r)}`,
    receipt = (op: object) =>
      ops.some((o) => same({ ...o, writer_group: 0 }, { ...op, writer_group: 0 }));
  const paths = ops.flatMap((op) => {
    if (op.op !== 'entity.create' || op.identity.origin.kind !== 'death') return [];
    const { id, origin, definition } = op.identity,
      victim = origin.victim_id;
    const died = events.find((e) => e.id === origin.event_id);
    if (died?.payload.type !== 'entity_died') return [];
    const room = died.payload.room_id;
    if (
      died.payload.victim_id !== victim ||
      died.payload.corpse_id !== id ||
      !same(after.state.created?.[id], op.identity) ||
      after.state.containers[id] !== room ||
      before.state.containers[victim] !== room
    )
      return [];
    const row = before.state.created?.[victim],
      spawned = row?.origin.kind === 'spawned' ? row.origin : undefined,
      plan = spawned && before.cartridge.populations?.[refString(spawned.by)],
      bundle = plan && before.cartridge.population_bundles?.[refString(plan.bundle)],
      death = before.cartridge.world?.death;
    const corpse = bundle
      ? bundle.corpse
      : victim === before.body
        ? death?.player_corpse
        : death?.npc_corpse;
    if (!same(definition, corpse)) return [];
    if (!spawned || !bundle) return [path(definition)];
    const slot = key({ kind: 'population_slot', plan: spawned.by, slot: spawned.slot }),
      prior = before.state.population_slots?.[slot],
      next = after.state.population_slots?.[slot];
    const replaced =
      same(row!.definition, bundle.npc) &&
      prior?.member_id === victim &&
      prior.generation === spawned.generation &&
      next?.replacement_due === died.logical_time + plan!.replacement_delay &&
      receipt({
        op: 'population.slot',
        plan: spawned.by,
        slot: spawned.slot,
        expected: prior,
        value: next,
      });
    const loot = Object.entries(before.state.created ?? {}).flatMap(([item, c]) =>
      c.origin.kind === 'spawned' &&
      c.origin.member_id === victim &&
      same(c.definition, bundle.item) &&
      before.state.containers[item] === victim &&
      after.state.containers[item] === id &&
      receipt({ op: 'entity.transfer', entity_id: item, source_id: victim, destination_id: id })
        ? [path(c.definition)]
        : [],
    );
    return [
      path(definition),
      ...(replaced ? [path(spawned.by), path(row!.definition), ...loot] : []),
    ];
  });
  for (const op of ops) {
    if (op.op !== 'bleed.transition' || !op.value.active || op.expected?.active) continue;
    const value = op.value,
      effect = value.effect,
      bleed = before.cartridge.bleeds?.[refString(effect)],
      source = before.state.created?.[value.source_id];
    const hit = events.find(
      ({ payload: e }) =>
        e.type === 'attack_result' &&
        e.attacker_id === value.source_id &&
        e.target_id === op.body_id &&
        e.hit &&
        e.loss > 0,
    );
    if (
      bleed &&
      hit &&
      source &&
      same(
        before.cartridge.npcs?.[refString(source.definition)]?.attack?.on_positive_hit?.effect,
        effect,
      ) &&
      same(op.expected, before.state.bleeds?.[op.body_id]) &&
      same(value, after.state.bleeds?.[op.body_id]) &&
      value.ends_at === hit.logical_time + bleed.duration &&
      value.next_tick_at === hit.logical_time + bleed.tick_every
    )
      paths.push(path(effect));
  }
  for (const [ref, rule] of Object.entries(before.cartridge.reactions ?? {})) {
    const cause = events.find(
      ({ payload: e }) =>
        rule.on.event === 'fact_changed' && e.type === 'fact_changed' && same(e.fact, rule.on.fact),
    );
    if (!cause || !rule.when || !holds(after, after.character, rule.when.root)) continue;
    const applied = rule.apply.map((step, i) => {
      if (step.op !== 'population.suppress') return undefined;
      const prior = before.state.population_plans?.[key(step.plan)],
        next = after.state.population_plans?.[key(step.plan)];
      return prior &&
        !prior.suppression &&
        next?.suppression?.cause_event_id === cause.id &&
        next.suppression.ends_at === cause.logical_time + step.duration &&
        receipt({ op: 'population.control', plan: step.plan, expected: prior, value: next })
        ? `/reactions/${ref}/apply/${i}`
        : undefined;
    });
    if (applied.length && applied.every(Boolean))
      paths.push(`/reactions/${ref}`, `/reactions/${ref}/when/root`, ...(applied as string[]));
  }
  return [...new Set(paths)];
}
