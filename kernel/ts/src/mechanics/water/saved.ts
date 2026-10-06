import type { WaterOccupancy, WaterSettings } from '../../contracts.gen.ts';
import { validate } from '../../foundation/validate.ts';
import { refString, bodyOf, type World } from '../../runtime/decision.ts';

export function waterValid(world: World) {
  const settings = world.cartridge.world?.water,
    rows = world.state.water ?? {};
  if (!settings)
    return (
      Object.keys(rows).length === 0 &&
      !Object.values(world.state.jobs ?? {}).some(
        (j) =>
          !j ||
          typeof j !== 'object' ||
          j.water_generation !== undefined ||
          j.water_body_id !== undefined,
      )
    );
  for (const [actor, row] of Object.entries(rows))
    if (!occupancyValid(world, actor, row, settings)) return false;
  for (const [id, j] of Object.entries(world.state.jobs ?? {})) {
    if (!j || typeof j !== 'object') return false;
    if (j.water_generation === undefined && j.water_body_id === undefined) continue;
    if (
      validate('WaterJob', j).length ||
      validate('JobId', id).length ||
      !settings.routes.some((r) => refString(r.bottom) === refString(j.job))
    )
      return false;
    if (j.status === 'pending' && rows[j.actor_id!]?.job_id !== id) return false;
  }
  const below = settings.routes.some(
    (r) => world.roomIds[refString(r.bottom)] === world.state.containers[world.body],
  );
  return below === (rows[world.character]?.room_id != null);
}

function occupancyValid(world: World, actor: string, row: WaterOccupancy, settings: WaterSettings) {
  if (
    validate('CharacterId', actor).length ||
    validate('WaterOccupancy', row).length ||
    bodyOf(world, actor as never) !== row.body_id
  )
    return false;
  if (row.room_id === null)
    return row.entered_at === null && row.deadline === null && row.job_id === null;
  const job = world.state.jobs?.[row.job_id!],
    route = settings.routes.find((r) => world.roomIds[refString(r.bottom)] === row.room_id);
  return (
    !!route &&
    world.state.containers[row.body_id] === row.room_id &&
    row.entered_at !== null &&
    row.deadline !== null &&
    row.deadline === row.entered_at + settings.duration &&
    row.entered_at <= world.state.clock &&
    row.deadline > world.state.clock &&
    validate('WaterJob', job).length === 0 &&
    job?.status === 'pending' &&
    job.actor_id === actor &&
    job.water_body_id === row.body_id &&
    job.water_generation === row.generation &&
    job.due_time === row.deadline &&
    refString(job.job) === refString(route.bottom)
  );
}
