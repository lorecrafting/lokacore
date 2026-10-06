import { validate } from '../../foundation/validate.ts';
import { key, same } from '../../foundation/compose.ts';
import { refString, type World } from '../../runtime/decision.ts';

/** Cold-load the current sight bindings without trusting a job row on its own. */
export function sightsValid(world: World): boolean {
  const pending = new Set<string>();
  for (const [planKey, spec] of Object.entries(world.populationSpecs)) {
    if (!spec.plan.sight) continue;
    const ref = {
      cartridge_id: world.cartridge.manifest.id,
      cartridge_version: world.cartridge.manifest.version,
      kind: 'population' as const,
      key: spec.plan.key,
    };
    if (key(ref) !== planKey) return false;
    for (let index = 1; index <= spec.cap; index++) {
      const slot =
        world.state.population_slots?.[key({ kind: 'population_slot', plan: ref, slot: index })];
      if (
        !slot ||
        validate('PopulationSlot', slot).length ||
        slot.last_flight_at === undefined ||
        slot.sight_job_id === undefined
      )
        return false;
      if (!slot.member_id) {
        if (slot.sight_job_id !== null) return false;
        continue;
      }
      const identity = world.state.created?.[slot.member_id];
      const origin = identity?.origin;
      if (
        origin?.kind !== 'spawned' ||
        origin.role !== 'deer' ||
        origin.member_id !== slot.member_id ||
        origin.slot !== index ||
        origin.generation !== slot.generation ||
        !same(origin.by, ref) ||
        !spec.plan.area.some(
          (area) => world.roomIds[refString(area)] === world.state.containers[slot.member_id!],
        )
      )
        return false;
      if (slot.replacement_due !== null && slot.sight_job_id !== null) return false;
      if (slot.sight_job_id !== null) {
        const job = world.state.jobs?.[slot.sight_job_id];
        if (
          !job ||
          job.status !== 'pending' ||
          !job.sight ||
          job.sight.member_id !== slot.member_id ||
          job.sight.slot !== index ||
          job.sight.generation !== slot.generation ||
          !same(job.job, ref) ||
          pending.has(slot.sight_job_id)
        )
          return false;
        pending.add(slot.sight_job_id);
      }
    }
  }
  for (const [id, job] of Object.entries(world.state.jobs ?? {})) {
    if (!job.sight) continue;
    const { sight } = job;
    const spec = world.populationSpecs[key(job.job)];
    const origin = world.state.created?.[sight.member_id]?.origin;
    const row =
      world.state.population_slots?.[
        key({ kind: 'population_slot', plan: job.job, slot: sight.slot })
      ];
    if (
      !spec?.plan.sight ||
      spec.member_role !== 'deer' ||
      validate('DeltaOp', {
        op: 'job.schedule',
        writer_group: 0,
        job_id: id,
        job: job.job,
        due_time: job.due_time,
        sight,
      }).length ||
      sight.player_id !== world.character ||
      sight.generation < 1 ||
      sight.seen_at + spec.plan.sight.delay !== job.due_time ||
      origin?.kind !== 'spawned' ||
      origin.role !== 'deer' ||
      origin.member_id !== sight.member_id ||
      origin.slot !== sight.slot ||
      origin.generation !== sight.generation ||
      !same(origin.by, job.job) ||
      (job.status === 'pending' && row?.sight_job_id !== id) ||
      !['pending', 'completed', 'cancelled'].includes(job.status)
    )
      return false;
  }
  return true;
}
