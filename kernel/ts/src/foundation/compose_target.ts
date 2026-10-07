import type { DeltaOp, MutationTarget } from '../contracts.gen.ts';
/**
 * The MutationTarget an op writes (04 §5.1).
 * Patrol uses the exact quest instance; escort retains its actor target.
 * Writer conflicts use this identity before any precondition is checked.
 */
// size: allow 48, one dispatch covers the closed delta target union including knowledge
export function target(op: DeltaOp): MutationTarget {
  if ('instance_id' in op) return { kind: 'quest', instance_id: op.instance_id };
  if ('continuation_id' in op) return { kind: 'choice', continuation_id: op.continuation_id };
  if (op.op === 'liquid.set' || op.op === 'fuel.set')
    return { kind: op.op === 'liquid.set' ? 'liquid' : 'fuel', item_id: op.item_id };
  if (op.op === 'population.control' || op.op === 'population.slot') return populationTarget(op);
  if (op.op === 'crow.transition') return { kind: 'crow', plan: op.plan, slot: op.slot };
  if (op.op === 'bleed.transition') return { kind: 'bleed', body_id: op.body_id };
  if (op.op === 'time.advance') return { kind: 'clock' };
  switch (op.op) {
    case 'visit.record':
      return { kind: 'visit', actor_id: op.actor_id, room_id: op.room_id };
    case 'observation.record':
      return { kind: 'observation', actor_id: op.actor_id, npc_id: op.npc_id };
    case 'character.select':
      return { kind: 'character', character_id: op.character_id };
    case 'fact.assign':
      return factTarget(op);
    case 'entity.create':
      return { kind: 'entity', entity_id: op.identity.id };
    case 'entity.transfer':
      return { kind: 'containment', entity_id: op.entity_id };
    case 'job.schedule':
    case 'job.complete':
    case 'job.cancel':
      return { kind: 'job', job_id: op.job_id };
    case 'encounter.open':
    case 'encounter.advance':
    case 'encounter.close':
      return { kind: 'encounter', encounter_id: op.encounter_id };
    case 'patrol.transition':
    case 'expedition.transition':
      return {
        kind: op.op === 'patrol.transition' ? 'patrol' : 'expedition',
        quest_instance_id: op.quest_instance_id,
      };
    case 'water.transition':
    case 'escort.transition':
      return { kind: op.op === 'water.transition' ? 'water' : 'escort', actor_id: op.actor_id };
    case 'resource.adjust':
    case 'resource.initialize':
      return { kind: 'resource', resource: op.resource, entity_id: op.entity_id };
    case 'cooldown.start':
      return { kind: 'cooldown', actor_id: op.actor_id, action: op.action };
    case 'barrier.transition':
      return { kind: 'barrier', barrier: op.barrier };
  }
}

function factTarget(op: Extract<DeltaOp, { op: 'fact.assign' }>): MutationTarget {
  const t: Record<string, unknown> = { kind: 'fact', fact: op.fact, scope: op.scope };
  if (op.subject_id !== undefined) t.subject_id = op.subject_id;
  return t as MutationTarget;
}

function populationTarget(
  op: Extract<DeltaOp, { op: 'population.control' | 'population.slot' }>,
): MutationTarget {
  return op.op === 'population.control'
    ? { kind: 'population_plan', plan: op.plan }
    : { kind: 'population_slot', plan: op.plan, slot: op.slot };
}
