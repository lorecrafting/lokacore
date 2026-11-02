import { jobId } from '../schedule/daily.ts';
import {
  accepted,
  bodyOf,
  rejected,
  type Mint,
  type Rule,
  type World,
} from '../../runtime/decision.ts';
import type { CharacterId, Command, DeltaOp, EntityId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { attackRefused, npcRef, encounterId, retarget } from './shared.ts';
import { flee } from './flee.ts';
import { admission, packPlan } from './behavior.ts';
import { attacked } from '../crow/behavior.ts';
import { openingRound } from '../combat/round.ts'; // the allowed path to the round helper

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
  return engage(world, command, payload, job, roster, mint, steps);
};

// size: allow 55, Diku rounds (loka-kgd.197) resolve round 1 in the Attack's own proposal
function engage(
  world: World,
  command: Pick<Command, 'id'>,
  payload: { actor_id: CharacterId; target_id: EntityId },
  job: NonNullable<ReturnType<typeof npcRef>>,
  roster: EntityId[] | undefined,
  mint: Mint,
  steps: { n: number },
) {
  const encounter_id = encounterId(mint);
  const job_id = jobId(mint);
  const open: DeltaOp[] = [
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
  ];
  const notes = helperNotes(world, payload.target_id, roster) ?? [];
  const opened = [...open, ...attacked(world, payload.target_id, encounter_id)];
  if (world.cartridge.world!.combat!.initiative) {
    const round = openingRound(world, opened, command, job_id, job, encounter_id, mint, steps);
    if (round.kind !== 'accepted') return round;
    return accepted(
      world,
      'engaged',
      [...opened, ...round.delta.ops],
      round.events,
      [...notes, ...(round.narration ?? [])],
      round.rng,
    );
  }
  const schedule: DeltaOp = {
    op: 'job.schedule',
    writer_group: 0,
    job_id,
    job,
    encounter_id,
    due_time: add(world.state.clock, world.cartridge.world!.combat!.interval),
  };
  return accepted<never>(
    world,
    'engaged',
    [...open, schedule, ...attacked(world, payload.target_id, encounter_id)],
    [],
    roster && notes,
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
