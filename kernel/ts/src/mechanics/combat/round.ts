import { status } from '../skills.ts';
import type {
  AttackProfile,
  Command,
  DeltaOp,
  DomainEvent,
  EncounterId,
  EncounterRow,
  EntityId,
  JobId,
  Text,
} from '../../contracts.gen.ts';
import { accepted, bodyOf, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { apply } from '../../runtime/apply.ts';
import { add, mul } from '../../foundation/int.ts';
import { encode } from '../../foundation/canonical.ts';
import { same } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { uniformCounted, type RngState } from '../../foundation/rng.ts';
import { adjust, level, recoveryAdjustments, resourceRef } from '../resource.ts';
import { deathSequence } from '../death/sequence.ts';
import { living } from '../death/shared.ts';
import { fact, positionOf, standing } from '../position/shared.ts';
import { assigned } from '../fact.ts';
import { npcRef, participantsPresent } from './shared.ts';
import { eligible, flight, next, packPlan } from './behavior.ts';
import { attack, prefix } from './round_attack.ts';
import { packRound, successor, narrate } from './round_flow.ts';
import { suppressed } from '../population/shared.ts';

export type CombatEvent = DomainEvent & {
  payload: Extract<DomainEvent['payload'], { type: 'attack_result' | 'entity_died' }>;
};
export type Round = {
  ops: DeltaOp[];
  events: CombatEvent[];
  rng: RngState;
  draws: number;
  position: number;
  steps: { n: number };
  due_time: number;
  notes: Text[];
};

/** Current encounter occurrence only; an obsolete callback has no gameplay result. */
export function currentRound(world: World, job_id: JobId, job: JobRow) {
  const row = job.encounter_id && world.state.encounters?.[job.encounter_id];
  return row && row.status === 'open' && row.job_id === job_id ? row : undefined;
}

// size: allow 45, one due round checks suppression before existing attack delivery
export function roundSequence(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
  steps = { n: 0 },
) {
  const row = currentRound(world, job_id, job);
  if (!row) return accepted<never>(world, 'job_ran', [], []);
  const encounter_id = job.encounter_id!;
  const r: Round = {
    ops: [{ op: 'job.complete', writer_group: 0, job_id }],
    events: [],
    rng: world.state.rng,
    draws: 0,
    position: 0,
    steps,
    due_time: job.due_time,
    notes: [],
  };
  if (bodyOf(world, row.character_id) !== row.body_id || !same(npcRef(world, row.npc_id), job.job))
    throw new KernelError('precondition_failed');
  const close: DeltaOp = {
    op: 'encounter.close',
    writer_group: 0,
    encounter_id,
    job_id,
    ...(row.active_ids && { expected: row }),
  };
  const origin = world.state.created?.[row.npc_id]?.origin;
  if (
    origin?.kind === 'spawned' &&
    origin.role === 'hound' &&
    suppressed(world, origin.by, job.due_time)
  )
    return accepted<never>(world, 'job_ran', [...r.ops, close], []);
  if (row.active_ids) return packRound(world, command, job, row, encounter_id, r, close, mint);
  ordinaryRound(world, command, job, row, encounter_id, r, close, mint);
  const narration = narrate(world, row, r.events);
  const timed = r.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: job.due_time } : op));
  return accepted(world, 'job_ran', timed, r.events, narration, r.rng);
}

function ordinaryRound(
  world: World,
  command: Pick<Command, 'id'>,
  job: JobRow,
  row: EncounterRow,
  encounter_id: EncounterId,
  r: Round,
  close: DeltaOp,
  mint: Mint,
) {
  if (!participantsPresent(world, row)) r.ops.push(close);
  else {
    const order = row.round % 2 ? [row.body_id, row.npc_id] : [row.npc_id, row.body_id];
    for (const attacker of order) {
      const at = prefix(world, r.ops, r.due_time);
      if (!participantsPresent(at, row) || at.state.encounters![encounter_id].status !== 'open')
        break;
      if (attacker === row.body_id && !standing(at, row.character_id)) continue;
      attack(at, command, mint, encounter_id, row, attacker, r, close);
    }
    if (prefix(world, r.ops, r.due_time).state.encounters![encounter_id].status === 'open')
      r.ops.push(...successor(world, row, job, mint));
  }
}
