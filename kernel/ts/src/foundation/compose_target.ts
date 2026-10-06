import type { DeltaOp, MutationTarget } from '../contracts.gen.ts';
/** The MutationTarget an op writes (04 §5.1). */
export function target(op: DeltaOp): MutationTarget {
  if ('continuation_id' in op) return { kind: 'choice', continuation_id: op.continuation_id };
  switch (op.op) {
    case 'fact.assign':
      const t: Record<string, unknown> = { kind: 'fact', fact: op.fact, scope: op.scope };
      if (op.subject_id !== undefined) t.subject_id = op.subject_id;
      return t as MutationTarget;
    case 'entity.create':
      return { kind: 'entity', entity_id: op.identity.id };
    case 'entity.transfer':
      return { kind: 'containment', entity_id: op.entity_id };
    case 'quest.activate':
    case 'quest.retire':
    case 'quest.transition':
      return { kind: 'quest', instance_id: op.instance_id };
    case 'job.schedule':
    case 'job.complete':
    case 'job.cancel':
      return { kind: 'job', job_id: op.job_id };
    case 'encounter.open':
    case 'encounter.advance':
    case 'encounter.close':
      return { kind: 'encounter', encounter_id: op.encounter_id };
    case 'escort.transition':
      return { kind: 'escort', actor_id: op.actor_id };
    case 'time.advance':
      return { kind: 'clock' };
    case 'fuel.set':
      return { kind: 'fuel', item_id: op.item_id };
    case 'resource.adjust':
      return { kind: 'resource', resource: op.resource, entity_id: op.entity_id };
    case 'cooldown.start':
      return { kind: 'cooldown', actor_id: op.actor_id, action: op.action };
    case 'barrier.transition':
      return { kind: 'barrier', barrier: op.barrier };
  }
}
