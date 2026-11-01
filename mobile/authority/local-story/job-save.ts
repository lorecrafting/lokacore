import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { hourOf, scheduleOf } from '../../../kernel/ts/src/mechanics/schedule/daily.ts';
import { jobRoute } from '../../../kernel/ts/src/mechanics/schedule/rule.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';

type Job = NonNullable<World['state']['jobs']>[string];

/** The definition the routed handler reads exists; else every launch throws a TypeError. */
function runnable(world: World, row: Job) {
  const route = jobRoute(row);
  if (route === 'replenish') return !!world.cartridge.replenish?.[refString(row.job)];
  if (route === 'wage') return !!world.cartridge.world?.group?.wage;
  // A lawful job is due at an hour of its own schedule (daily.ts nextHour; placeOf reads that hour).
  if (route === 'npc') return !!scheduleOf(world, row.job)[hourOf(world.cartridge, row.due_time)];
  return true;
}

/** A job no handler can run is a damaged save (schedule/rule.ts decideAt's dispatch). */
export function jobSave(fresh: World, world: World) {
  for (const [id, row] of Object.entries(world.state.jobs ?? {}))
    if (!same(row, fresh.state.jobs?.[id]) && !runnable(world, row))
      throw new SyntaxError('malformed JSON: unrunnable job');
}
