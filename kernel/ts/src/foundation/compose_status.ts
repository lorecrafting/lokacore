import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same, type State } from './compose.ts';

type Op = Extract<DeltaOp, { op: 'status.transition' }>;
const HOLDERS = ['body', 'npc', 'item'];

/** One checked status generation on a body, NPC or item (rows 1, G3): the holder and status pair is the target. */
export function transitionStatus(op: Op, row: Json | undefined, state: State, now: number) {
  const prior = row as Op['value'] | undefined;
  const next = op.value;
  const known = (state.known_entities ?? {}) as Record<string, { kind?: string }>;
  const shape = next.active
    ? next.ends_at !== undefined &&
      next.next_tick_at !== undefined &&
      next.job_id !== undefined &&
      next.ends_at > now &&
      next.next_tick_at >= now &&
      // An active row keeps its generation; a refresh or successor never shortens the end.
      (!prior?.active || next.ends_at >= prior.ends_at!)
    : Object.keys(next).length === 2;
  const generation = prior?.active
    ? next.generation === prior.generation
    : next.generation === (prior?.generation ?? 0) + (next.active ? 1 : 0);
  if (
    !HOLDERS.includes(known[op.body_id]?.kind as string) ||
    !same(row ?? null, op.expected) ||
    !shape ||
    !generation ||
    (!prior?.active && !next.active)
  )
    return { code: 'precondition_failed' as const };
  return { value: next as Json };
}
