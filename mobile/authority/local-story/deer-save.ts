import { jobCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

type Any = any;
const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent deer sight receipt');
};

/** The durable job is justified by its exact checked entry or population transfer receipt. */
export function deerSave(world: World, db: Db, meta: Meta) {
  const jobs = world.state.jobs ?? {};
  const found = new Set<string>();
  const scope = `story/${meta.lineage_id}/${world.character}`;
  for (const row of db.getAllSync<{ command_id: string; response: string }>(
    "SELECT command_id, response FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted'",
    scope,
  )) {
    const response = JSON.parse(row.response) as Any;
    const ops: Any[] = response?.delta?.ops;
    if (!Array.isArray(ops)) invalid();
    for (const op of ops) {
      if (op.op !== 'job.schedule' || !op.sight) continue;
      const sight = op.sight;
      const saved = jobs[op.job_id];
      const spec = world.populationSpecs[key(op.job)];
      if (
        found.has(op.job_id) ||
        !saved ||
        !spec?.plan.sight ||
        validate('DeltaOp', op).length ||
        !same(saved.job, op.job) ||
        saved.due_time !== op.due_time ||
        !same(saved.sight, sight) ||
        sight.player_id !== world.character ||
        op.due_time !== sight.seen_at + spec.plan.sight.delay
      )
        invalid();
      found.add(op.job_id);
      const slot = ops.find(
        (x) =>
          x.op === 'population.slot' &&
          x.writer_group === op.writer_group &&
          same(x.plan, op.job) &&
          x.slot === sight.slot &&
          x.value?.sight_job_id === op.job_id &&
          x.value?.member_id === sight.member_id &&
          x.value?.generation === sight.generation,
      );
      const transfer = ops.find(
        (x) =>
          x.op === 'entity.transfer' &&
          x.writer_group === op.writer_group &&
          x.source_id === sight.source_id &&
          x.destination_id === sight.destination_id &&
          x.entity_id === (sight.cause_kind === 'player_entry' ? world.body : sight.member_id),
      );
      if (!slot || !transfer) invalid();
      if (sight.cause_kind === 'player_entry') {
        if (
          row.command_id !== sight.cause_id ||
          !response.events?.some(
            (e: Any) =>
              e.payload?.type === 'entity_entered_room' &&
              e.payload.entity_id === world.body &&
              e.payload.room_id === sight.destination_id &&
              e.logical_time === sight.seen_at &&
              e.causation_id === sight.cause_id,
          )
        )
          invalid();
      } else {
        const cause = ops.find(
          (x) =>
            x.op === 'job.complete' &&
            x.writer_group === op.writer_group &&
            jobs[x.job_id]?.job?.kind === 'population' &&
            jobs[x.job_id].due_time === sight.seen_at &&
            jobCommandId(x.job_id, sight.seen_at) === sight.cause_id,
        );
        if (!cause) invalid();
      }
    }
    // A receipt may lend its round group only to the matching sight closure and successor cancel.
    let high = -1;
    const reused = ops.filter((x) => {
      const lower = x.writer_group < high;
      high = Math.max(high, x.writer_group);
      return lower;
    });
    if (reused.length) {
      const [close, cancel] = reused;
      if (
        reused.length !== 2 ||
        close.op !== 'encounter.close' ||
        cancel.op !== 'job.cancel' ||
        close.writer_group !== cancel.writer_group ||
        close.encounter_id !== cancel.encounter_id ||
        close.job_id !== cancel.job_id
      )
        invalid();
      const advance = ops.find(
        (x) =>
          x.op === 'encounter.advance' &&
          x.writer_group === close.writer_group &&
          x.encounter_id === close.encounter_id &&
          x.next_job_id === close.job_id,
      );
      const sightDone = ops.find(
        (x) =>
          x.op === 'job.complete' && x.writer_group > close.writer_group && jobs[x.job_id]?.sight,
      );
      const sight = sightDone && jobs[sightDone.job_id]?.sight;
      if (
        !advance ||
        !sight ||
        !jobs[advance.job_id] ||
        jobs[advance.job_id].due_time !== jobs[sightDone.job_id].due_time ||
        !ops.some(
          (x) =>
            x.op === 'job.schedule' &&
            x.writer_group === close.writer_group &&
            x.job_id === close.job_id &&
            x.encounter_id === close.encounter_id,
        ) ||
        !ops.some(
          (x) =>
            x.op === 'entity.transfer' &&
            x.writer_group === sightDone.writer_group &&
            x.entity_id === sight.member_id,
        ) ||
        !ops.some(
          (x) =>
            x.op === 'population.slot' &&
            x.writer_group === sightDone.writer_group &&
            x.value?.member_id === sight.member_id &&
            x.value?.last_flight_at === jobs[sightDone.job_id].due_time,
        )
      )
        invalid();
    }
  }
  for (const [id, job] of Object.entries(jobs)) if (job.sight && !found.has(id)) invalid();
}
