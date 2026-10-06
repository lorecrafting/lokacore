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
  const loot_id = mint() as EntityId;
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
      identity(member_id, spec[spec.member_role]!, spec.member_role, origin),
      spec.home,
      writer_group,
    ),
    ...spawnPair(
      identity(loot_id, spec[spec.loot_role]!, spec.loot_role, origin),
      member_id,
      writer_group,
    ),
    hpBirth(plan, member_id, spec.hp.start, at, writer_group),
  ];
}

function identity(
  id: EntityId,
  definition: DefinitionRef,
  role: 'deer' | 'hide' | 'hound' | 'pelt',
  origin: Omit<
    Extract<Extract<DeltaOp, { op: 'entity.create' }>['identity']['origin'], { kind: 'spawned' }>,
    'role'
  >,
) {
  return { id, definition, origin: { ...origin, role } };
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
