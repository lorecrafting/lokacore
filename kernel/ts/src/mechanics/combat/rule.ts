import { jobId } from '../schedule/behavior.ts';
import { accepted, bodyOf, rejected, type Rule, type World } from '../../runtime/decision.ts';
import type { EntityId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { attackRefused, npcRef, encounterId } from './shared.ts';
import { flee } from './flee.ts';
import { admission, packPlan } from './behavior.ts';
import { attacked } from '../crow/behavior.ts';

export const decide: Rule<'combat'> = (world, command, mint, steps = { n: 0 }) => {
  const { payload } = command;
  if (payload.type === 'flee') return flee(world, { ...command, payload }, mint, steps);
  const refused = attackRefused(world, payload.actor_id, payload.target_id);
  if (refused) return rejected(refused);
  const job = npcRef(world, payload.target_id);
  if (!job) return rejected('invalid_target');
  const roster = admission(world, payload.target_id, steps);
  if (roster && !roster.includes(payload.target_id)) return rejected('invalid_state');
  const encounter_id = encounterId(mint);
  const job_id = jobId(mint);
  return accepted(
    world,
    'engaged',
    [
      {
        op: 'encounter.open',
        writer_group: 0,
        encounter_id,
        character_id: payload.actor_id,
        body_id: bodyOf(world, payload.actor_id)!,
        npc_id: payload.target_id,
        room_id: world.state.containers[bodyOf(world, payload.actor_id)!],
        job_id,
        ...(roster && { active_ids: roster, next_opponent_id: payload.target_id }),
      },
      {
        op: 'job.schedule',
        writer_group: 0,
        job_id,
        job,
        encounter_id,
        due_time: add(world.state.clock, world.cartridge.world!.combat!.interval),
      },
      ...attacked(world, payload.target_id, encounter_id),
    ],
    [],
    helperNotes(world, payload.target_id, roster),
  );
};

function helperNotes(world: World, target: EntityId, roster?: readonly EntityId[]) {
  return roster
    ?.filter((id) => id !== target)
    .map((id) => ({
      key: packPlan(world, target)!.narration.helper_joined,
      participants: { enemy: id },
    }));
}
