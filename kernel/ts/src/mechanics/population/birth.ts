import type { CommandId, DefinitionRef, DeltaOp, EntityId } from '../../contracts.gen.ts';
import type { Mint, World } from '../../runtime/decision.ts';
import { key } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';

/** A checked birth sequence reused by genesis and the one plan-owned job. */
export function birth(
  world: World,
  plan: DefinitionRef,
  slot: number,
  generation: number,
  occurrence_id: CommandId,
  at: number,
  mint: Mint,
  writer_group = 0,
): DeltaOp[] {
  const spec = world.populationSpecs[key(plan)];
  if (!spec) throw new KernelError('precondition_failed');
  const member_id = mint() as EntityId;
  const origin = {
    kind: 'spawned' as const,
    by: plan,
    bundle: spec.bundle,
    slot,
    generation,
    occurrence_id,
    member_id,
  };
  return [
    ...spawnPair(
      { id: member_id, definition: spec.hound, origin: { ...origin, role: 'hound' } },
      spec.home,
      writer_group,
    ),
    ...(spec.pelt
      ? spawnPair(
          { id: mint() as EntityId, definition: spec.pelt, origin: { ...origin, role: 'pelt' } },
          member_id,
          writer_group,
        )
      : []),
    hpBirth(plan, member_id, spec.hp.start, at, writer_group),
  ];
}

function hpBirth(
  plan: DefinitionRef,
  entity_id: EntityId,
  value: number,
  at: number,
  writer_group: number,
): DeltaOp {
  const resource = { ...plan, kind: 'resource' as const, key: 'hp' as DefinitionRef['key'] };
  return { op: 'resource.initialize', writer_group, resource, entity_id, value, at };
}

function spawnPair(
  identity: Extract<DeltaOp, { op: 'entity.create' }>['identity'],
  destination_id: EntityId,
  writer_group: number,
): DeltaOp[] {
  return [
    { op: 'entity.create', writer_group, identity },
    {
      op: 'entity.transfer',
      writer_group,
      entity_id: identity.id,
      source_id: null,
      destination_id,
    },
  ];
}
