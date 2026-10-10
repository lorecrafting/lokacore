import { jobId } from '../schedule/behavior.ts';
import {
  accepted,
  bodyOf,
  rejected,
  type Mint,
  type Rule,
  type World,
} from '../../runtime/decision.ts';
import type { CharacterId, EntityId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { attackRefused, npcRef, encounterId, retarget } from './shared.ts';
import { flee } from './flee.ts';
import { admission, packPlan } from './behavior.ts';
import { attacked } from '../crow/behavior.ts';

export const decide: Rule<'combat'> = (world, command, mint, steps = { n: 0 }) => {
  const { payload } = command;
  if (payload.type === 'flee') return flee(world, { ...command, payload }, mint, steps);
  const refused = attackRefused(world, payload.actor_id, payload.target_id);
  if (refused) return rejected(refused);
  const fight = retarget(world, bodyOf(world, payload.actor_id)!, payload.target_id);
  if (fight) return switched(world, fight, payload.target_id);
  const job = npcRef(world, payload.target_id);
  if (!job) return rejected('invalid_target');
  const roster = admission(world, payload.target_id, steps);
  if (roster && !roster.includes(payload.target_id)) return rejected('invalid_state');
  return engage(world, payload, job, roster, mint);
};

function engage(
  world: World,
  payload: { actor_id: CharacterId; target_id: EntityId },
  job: NonNullable<ReturnType<typeof npcRef>>,
  roster: EntityId[] | undefined,
  mint: Mint,
) {
  const encounter_id = encounterId(mint);
  const job_id = jobId(mint);
  return accepted<never>(
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
}

// Toolbox row 6a: no round, RNG or job; the next round's player blow lands on the new primary.
function switched(world: World, fight: NonNullable<ReturnType<typeof retarget>>, target: EntityId) {
  const { id: encounter_id, row } = fight;
  return accepted<never>(
    world,
    'engaged',
    [
      {
        op: 'encounter.target',
        writer_group: 0,
        encounter_id,
        job_id: row.job_id,
        expected: row,
        npc_id: target,
      },
    ],
    [],
    [{ key: packPlan(world, target)!.narration.primary_changed, participants: { enemy: target } }],
  );
}

function helperNotes(world: World, target: EntityId, roster?: readonly EntityId[]) {
  return roster
    ?.filter((id) => id !== target)
    .map((id) => ({
      key: packPlan(world, target)!.narration.helper_joined,
      participants: { enemy: id },
    }));
}
