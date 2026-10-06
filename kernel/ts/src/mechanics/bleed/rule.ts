import type {
  CommandPayload,
  DeltaOp,
  EntityId,
  ErrorCode,
  Key,
  TextKey,
} from '../../contracts.gen.ts';
import { refusal } from '../../commands/actions.ts';
import {
  accepted,
  bodyOf,
  rejected,
  type Rule,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { level, resourceRef } from '../resource.ts';
import { status } from '../skills.ts';
import { engaged } from '../combat/shared.ts';
import { matching } from './shared.ts';

type Payload = Extract<CommandPayload, { type: 'bandage' }>;

function bandageOps(
  world: World,
  p: Payload,
  body: EntityId,
  row: NonNullable<ReturnType<typeof matching>>,
): DeltaOp[] {
  return [
    {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: p.item_id,
      source_id: body,
      destination_id: world.consumed!,
      consumption: 'bandaged',
    },
    {
      op: 'bleed.transition',
      writer_group: 0,
      body_id: body,
      expected: row,
      value: { active: false, generation: row.generation },
    },
    {
      op: 'job.cancel',
      writer_group: 0,
      job_id: row.job_id!,
      bleed_body_id: body,
      bleed_generation: row.generation,
    },
  ];
}

/** Shared keyed/raw/Book availability for the exact current item and generation. */
export function availability(world: World, p: Payload, steps: Steps, action?: Key) {
  const code = refusal(world, p, steps, action);
  return code ? { code } : transition(world, p, steps);
}

export function transition(
  world: World,
  p: Payload,
  steps: Steps,
): { code: ErrorCode } | { ops: DeltaOp[]; narration: TextKey } {
  const body = bodyOf(world, p.actor_id);
  if (!body || (level(world, body, resourceRef(world, 'hp')) ?? 0) <= 0)
    return { code: 'invalid_state' };
  const item = world.entities[p.item_id];
  if (!item) return { code: 'not_found' };
  if (item.kind !== 'item' || !item.bandage) return { code: 'invalid_target' };
  if (world.state.containers[p.item_id] !== body) return { code: 'not_owned' };
  if (!world.consumed) return { code: 'precondition_failed' };
  if (!status(world, p.actor_id, item.bandage.skill, steps).usable)
    return { code: 'invalid_state' };
  const row = matching(world, body, item.bandage.effect, p.effect_generation);
  if (!row) return { code: 'invalid_state' };
  return { ops: bandageOps(world, p, body, row), narration: item.bandage.narration };
}

export const decide: Rule<'bleed'> = (world, command, _mint, steps = { n: 0 }) => {
  const result = transition(world, command.payload, steps);
  if ('code' in result) {
    const code = result.code;
    return code === 'budget_exceeded' || code === 'precondition_failed'
      ? { kind: 'fault', code }
      : rejected(code);
  }
  const fight = engaged(world, bodyOf(world, command.payload.actor_id)!);
  return {
    ...accepted(world, 'bandaged', result.ops, [], [{ key: result.narration }]),
    item_id: command.payload.item_id,
    effect_generation: command.payload.effect_generation,
    ...(fight && { encounter_id: fight.id }),
  };
};
