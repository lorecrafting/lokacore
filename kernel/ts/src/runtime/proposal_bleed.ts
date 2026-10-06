import type { JobId } from '../contracts.gen.ts';
import { same } from '../foundation/compose.ts';
import { currentBleed } from '../mechanics/bleed/shared.ts';
import { currentRound } from '../mechanics/combat/round.ts';
import { living } from '../mechanics/death/shared.ts';
import type { World } from './decision.ts';

/** Only current bleed and encounter occurrences of the same living body at one due time pair. */
export function bleedRoundPair(
  world: World,
  job_id: JobId,
  job: NonNullable<World['state']['jobs']>[string],
) {
  const round = job.encounter_id && currentRound(world, job_id, job);
  const body = round?.body_id ?? job.bleed_body_id;
  if (!body || !living(world, body)) return;
  const bleed = currentBleed(world, body);
  if (!bleed || !bleed.job_id || !bleed.effect || !bleed.source_id) return;
  const bleedId = bleed.job_id;
  const bleedJob = world.state.jobs?.[bleedId];
  const encounter =
    round ??
    Object.values(world.state.encounters ?? {}).find(
      (r) => r.status === 'open' && r.body_id === body,
    );
  const roundId = encounter?.job_id;
  const roundJob = roundId && world.state.jobs?.[roundId];
  if (
    !roundId ||
    !roundJob ||
    !bleedJob ||
    !currentRound(world, roundId, roundJob) ||
    bleedJob.status !== 'pending' ||
    roundJob.status !== 'pending' ||
    bleedJob.bleed_body_id !== body ||
    bleedJob.bleed_generation !== bleed.generation ||
    !same(bleedJob.job, bleed.effect) ||
    bleedJob.due_time !== roundJob.due_time ||
    job.due_time !== bleedJob.due_time ||
    (job_id !== bleedId && job_id !== roundId)
  )
    return;
  return job_id === bleedId ? roundId : bleedId;
}
