import { jobId } from '../schedule/behavior.ts';
import { accepted, bodyOf, rejected, type Rule } from '../../runtime/decision.ts';
import { add } from '../../foundation/int.ts';
import { attackRefused, npcRef, encounterId } from './shared.ts';
import { flee } from './flee.ts';

export const decide: Rule<'combat'> = (world, command, mint, steps = { n: 0 }) => {
  const { payload } = command;
  if (payload.type === 'flee') return flee(world, { ...command, payload }, mint, steps);
  const refused = attackRefused(world, payload.actor_id, payload.target_id);
  if (refused) return rejected(refused);
  const body_id = bodyOf(world, payload.actor_id)!;
  const job = npcRef(world, payload.target_id);
  if (!job) return rejected('invalid_target');
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
        body_id,
        npc_id: payload.target_id,
        room_id: world.state.containers[body_id],
        job_id,
      },
      {
        op: 'job.schedule',
        writer_group: 0,
        job_id,
        job,
        encounter_id,
        due_time: add(world.state.clock, world.cartridge.world!.combat!.interval),
      },
    ],
    [],
  );
};
