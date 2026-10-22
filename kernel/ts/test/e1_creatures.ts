// E1 creature witnesses (docs/system/e1-certification.md).
import type { DecisionResult, DefinitionRef } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { key, same } from '../src/foundation/compose.ts';
import { refString } from '../src/runtime/decision.ts';

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
  return [...new Set(paths)];
}
