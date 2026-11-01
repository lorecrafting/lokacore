import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { CLOCK_JOB, hourOf } from '../../../kernel/ts/src/mechanics/schedule/daily.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';

type Job = NonNullable<World['state']['jobs']>[string];

/** The definition the schedule rule's handler reads exists; else every launch throws a TypeError. */
function runnable(world: World, row: Job) {
  // Dispatched on row fields or on a kind whose handler answers a missing definition itself.
  if (
    row.water_generation !== undefined ||
    row.encounter_id ||
    row.bleed_body_id ||
    row.quest_instance_id ||
    row.crow_phase !== undefined ||
    row.sight ||
    [CLOCK_JOB, 'status', 'population', 'order', 'reaction'].includes(row.job.kind)
  )
    return true;
  const ref = refString(row.job);
  if (row.job.kind === 'replenish') return !!world.cartridge.replenish?.[ref];
  if (row.job.kind === 'wage') return !!world.cartridge.world?.group?.wage;
  const npc = world.entities[world.entityIds[ref]];
  // A lawful job is due at an hour of its own schedule (daily.ts nextHour; placeOf reads that hour).
  return npc?.kind === 'npc' && !!npc.daily_schedule?.[hourOf(world.cartridge, row.due_time)];
}

/** A job no handler can run is a damaged save (schedule/rule.ts decideAt's dispatch). */
export function jobSave(fresh: World, world: World) {
  for (const [id, row] of Object.entries(world.state.jobs ?? {}))
    if (!same(row, fresh.state.jobs?.[id]) && !runnable(world, row))
      throw new SyntaxError('malformed JSON: unrunnable job');
}
