import { isDeepStrictEqual } from 'node:util';
import type { Command, DecisionResult, EntityId } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';

// ponytail: static entity IDs only; spawned wildlife and loot need separate provenance proof.
export function identityWitnesses(
  before: World,
  after: World,
  command: Command,
  decision: DecisionResult,
): string[] {
  if (decision.kind !== 'accepted') return [];
  const p = command.payload;
  if (p.type === 'choose_ancestry') {
    const next = after.state.characters?.[p.actor_id];
    return before.state.characters?.[p.actor_id] === undefined &&
      next?.ancestry === p.ancestry &&
      before.cartridge.ancestries?.[p.ancestry] !== undefined &&
      decision.delta.ops.some(
        (op) =>
          op.op === 'character.select' &&
          op.character_id === p.actor_id &&
          isDeepStrictEqual(op.value, next),
      )
      ? [`/ancestries/${p.ancestry}`]
      : [];
  }
  const refs = new Map(Object.entries(before.entityIds).map(([ref, id]) => [id, ref]));
  const path = (id: EntityId, kind: 'item' | 'npc') => {
    const ref = refs.get(id);
    return ref?.includes(`:${kind}/`) &&
      before.entities[id]?.kind === kind &&
      !before.state.created?.[id] &&
      !after.state.created?.[id]
      ? [`/${kind}s/${ref}`]
      : [];
  };
  const paths = decision.delta.ops.flatMap((op) => {
    if (
      op.op !== 'entity.transfer' ||
      op.source_id === op.destination_id ||
      before.state.containers[op.entity_id] !== op.source_id ||
      after.state.containers[op.entity_id] !== op.destination_id ||
      !decision.events.some(({ payload: e }) =>
        e.type === 'item_acquired'
          ? e.item_id === op.entity_id && e.holder_id === op.destination_id
          : e.type === 'item_dropped' &&
            e.item_id === op.entity_id &&
            e.room_id === op.destination_id,
      )
    )
      return [];
    const item = path(op.entity_id, 'item');
    return item.length
      ? [...item, ...path(op.source_id, 'npc'), ...path(op.destination_id, 'npc')]
      : [];
  });
  if (
    p.type === 'talk' &&
    Object.entries(after.state.choices ?? {}).some(
      ([id, choice]) =>
        !before.state.choices?.[id] &&
        choice.status === 'pending' &&
        choice.source.kind === 'dialogue' &&
        choice.roles.some((role) => role.entity_id === p.target_id),
    )
  )
    paths.push(...path(p.target_id, 'npc'));
  return [...new Set(paths)];
}
