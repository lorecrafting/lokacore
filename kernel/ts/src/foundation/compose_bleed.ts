import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { key, same, type State, type Written } from './compose.ts';

type Op = Extract<DeltaOp, { op: 'bleed.transition' }>;

function cadence(prior: Op['value'] | undefined, next: Op['value'], overlay: Map<string, Written>) {
  if (!prior?.active || !next.active) return true;
  const oldJob = prior.job_id!;
  const completed =
    oldJob &&
    (overlay.get(key({ kind: 'job', job_id: oldJob }))?.value as { status?: string } | undefined)
      ?.status === 'completed';
  return (
    same(next.effect, prior.effect) &&
    next.source_id === prior.source_id &&
    (completed
      ? next.job_id !== oldJob &&
        next.next_tick_at! > prior.next_tick_at! &&
        next.ends_at === prior.ends_at
      : next.job_id === oldJob &&
        next.next_tick_at === prior.next_tick_at &&
        next.ends_at! >= prior.ends_at)
  );
}

/** One checked body generation; no status framework or independent state writer. */
export function transitionBleed(
  op: Op,
  row: Json | undefined,
  state: State,
  now: number,
  overlay: Map<string, Written>,
) {
  const prior = row as Op['value'] | undefined;
  const next = op.value;
  const known = (state.known_entities ?? {}) as Record<string, { kind?: string }>;
  const created = (state.created ?? {}) as Record<string, { origin?: { role?: string } }>;
  const shape = next.active
    ? next.ends_at !== undefined &&
      next.next_tick_at !== undefined &&
      next.source_id !== undefined &&
      next.job_id !== undefined &&
      next.effect !== undefined &&
      next.ends_at > now &&
      next.next_tick_at >= now &&
      known[next.source_id]?.kind === 'npc' &&
      created[next.source_id]?.origin?.role === 'hound'
    : Object.keys(next).length === 2;
  const generation = prior?.active
    ? next.generation === prior.generation
    : next.generation === (prior?.generation ?? 0) + (next.active ? 1 : 0);
  if (
    known[op.body_id]?.kind !== 'body' ||
    !same(row ?? null, op.expected) ||
    !shape ||
    !generation ||
    !cadence(prior, next, overlay) ||
    (!prior?.active && !next.active)
  )
    return { code: 'precondition_failed' as const };
  return { value: next as Json };
}
