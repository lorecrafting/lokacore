import type { BleedRow, DefinitionRef, DeltaOp, EntityId, JobId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { same } from '../../foundation/compose.ts';
import { type Mint, refString, type World } from '../../runtime/decision.ts';

export const currentBleed = (world: World, body: EntityId) => {
  const row = world.state.bleeds?.[body];
  return row?.active ? row : undefined;
};

export function clearBleed(world: World, body: EntityId): DeltaOp[] {
  const row = currentBleed(world, body);
  return row
    ? [
        {
          op: 'bleed.transition',
          writer_group: 0,
          body_id: body,
          expected: row,
          value: { generation: row.generation, active: false },
        },
        {
          op: 'job.cancel',
          writer_group: 0,
          job_id: row.job_id!,
          bleed_body_id: body,
          bleed_generation: row.generation,
        },
      ]
    : [];
}

function scheduleBleed(
  body: EntityId,
  effect: DefinitionRef,
  job_id: JobId,
  generation: number,
  next_tick_at: number,
  ends_at: number,
): DeltaOp {
  return {
    op: 'job.schedule',
    writer_group: 0,
    job_id,
    job: effect,
    bleed_body_id: body,
    bleed_generation: generation,
    due_time: Math.min(next_tick_at, ends_at),
  };
}

/** Called only after an actual surviving positive hound HP loss. */
export function wound(world: World, source_id: EntityId, body: EntityId, mint: Mint): DeltaOp[] {
  const spawned = world.state.created?.[source_id];
  const npc = world.entities[source_id];
  const effect =
    npc?.kind === 'npc' &&
    spawned?.origin.kind === 'spawned' &&
    spawned.origin.role === 'hound' &&
    spawned.origin.member_id === source_id
      ? npc.attack?.on_positive_hit?.effect
      : undefined;
  if (!effect) return [];
  const spec = world.cartridge.bleeds?.[refString(effect)];
  if (!spec) return [];
  const prior = world.state.bleeds?.[body];
  const active = prior?.active ? prior : undefined;
  const now = world.state.clock;
  const generation = active?.generation ?? (prior?.generation ?? 0) + 1;
  const job_id = active?.job_id ?? (mint() as JobId);
  const next_tick_at = active?.next_tick_at ?? add(now, spec.tick_every);
  const ends_at = add(now, spec.duration);
  const value: BleedRow = {
    active: true,
    generation,
    effect,
    source_id,
    ends_at,
    next_tick_at,
    job_id,
  };
  const change: DeltaOp = {
    op: 'bleed.transition',
    writer_group: 0,
    body_id: body,
    expected: prior ?? null,
    value,
  };
  return active
    ? [change]
    : [change, scheduleBleed(body, effect, job_id, generation, next_tick_at, ends_at)];
}

export function matching(world: World, body: EntityId, effect: DefinitionRef, generation: number) {
  const row = currentBleed(world, body);
  return row && row.generation === generation && same(row.effect, effect) ? row : undefined;
}
