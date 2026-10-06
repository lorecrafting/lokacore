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
} from '../../contracts.gen.ts';
import { accepted, bodyOf, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { apply } from '../../runtime/apply.ts';
import { add, mul } from '../../foundation/int.ts';
import { same } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { uniformCounted, type RngState } from '../../foundation/rng.ts';
import { adjust, level, recoveryAdjustments, resourceRef } from '../resource.ts';
import { deathSequence } from '../death/sequence.ts';
import { fact, positionOf, standing } from '../position/shared.ts';
import { assigned } from '../fact.ts';
import { npcRef, participantsPresent } from './shared.ts';

type CombatEvent = DomainEvent & {
  payload: Extract<DomainEvent['payload'], { type: 'attack_result' | 'entity_died' }>;
};
type Round = {
  ops: DeltaOp[];
  events: CombatEvent[];
  rng: RngState;
  draws: number;
  position: number;
  steps: { n: number };
  due_time: number;
};

/** Current encounter occurrence only; an obsolete callback has no gameplay result. */
export function currentRound(world: World, job_id: JobId, job: JobRow) {
  const row = job.encounter_id && world.state.encounters?.[job.encounter_id];
  return row && row.status === 'open' && row.job_id === job_id ? row : undefined;
}

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
  };
  if (bodyOf(world, row.character_id) !== row.body_id || !same(npcRef(world, row.npc_id), job.job))
    throw new KernelError('precondition_failed');
  const close: DeltaOp = { op: 'encounter.close', writer_group: 0, encounter_id, job_id };
  if (!participantsPresent(world, row)) r.ops.push(close);
  else {
    const order = row.round % 2 ? [row.body_id, row.npc_id] : [row.npc_id, row.body_id];
    for (const attacker of order) {
      const at = prefix(world, r.ops);
      if (!participantsPresent(at, row) || at.state.encounters![encounter_id].status !== 'open')
        break;
      if (attacker === row.body_id && !standing(at, row.character_id)) continue;
      attack(at, command, mint, encounter_id, row, attacker, r, close);
    }
    if (prefix(world, r.ops).state.encounters![encounter_id].status === 'open')
      r.ops.push(...successor(world, row, job, mint));
  }
  const narration = narrate(world, row, r.events);
  const timed = r.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: job.due_time } : op));
  return accepted(world, 'job_ran', timed, r.events, narration, r.rng);
}

function successor(world: World, row: EncounterRow, job: JobRow, mint: Mint): DeltaOp[] {
  const next_job_id = mint() as JobId;
  const encounter_id = job.encounter_id!;
  return [
    {
      op: 'encounter.advance',
      writer_group: 0,
      encounter_id,
      job_id: row.job_id,
      round: row.round,
      next_job_id,
    },
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id: next_job_id,
      job: job.job,
      encounter_id,
      due_time: add(job.due_time, world.cartridge.world!.combat!.interval),
    },
  ];
}

function narrate(world: World, row: EncounterRow, events: readonly CombatEvent[]) {
  const words = world.cartridge.world!.combat!.narration;
  return events.map(({ payload: e }) => ({
    key:
      e.type === 'entity_died'
        ? words[e.victim_id === row.body_id ? 'player_died' : 'npc_died']
        : 'prevented_by' in e && e.prevented_by
          ? words[e.prevented_by]!
          : words[
              e.attacker_id === row.body_id
                ? e.hit
                  ? 'player_hit'
                  : 'player_miss'
                : e.hit
                  ? 'npc_hit'
                  : 'npc_miss'
            ],
  }));
}

function prefix(world: World, ops: readonly DeltaOp[]): World {
  const result = apply(world, ops);
  if ('fault' in result) throw new KernelError(result.fault.code);
  return result.world;
}

function draw(r: Round, bound: number) {
  const [value, rng, spent] = uniformCounted(r.rng, bound, 8 - r.draws);
  r.rng = rng;
  r.draws += spent;
  return value;
}

function attack(
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  encounter_id: EncounterId,
  row: EncounterRow,
  attacker_id: EntityId,
  r: Round,
  close: DeltaOp,
) {
  const player = attacker_id === row.body_id;
  const target_id = player ? row.npc_id : row.body_id;
  const settings = world.cartridge.world!.combat!;
  const profile = attackProfile(world, row, player, r);
  const accurate = draw(r, 100) < profile.chance;
  const prevented_by = accurate && !player ? defend(world, row, r) : undefined;
  const hit = accurate && !prevented_by;
  const sleeping = !player && positionOf(world, row.character_id) === 'sleeping';
  const damage = hit ? damageRoll(r, profile) : 0;
  const hp = resourceRef(world, 'hp');
  const loss = Math.min(
    level(world, target_id, hp)!,
    mul(damage, sleeping ? settings.sleep_multiplier : 1),
  );
  r.events.push(
    attackEvent(world, command, mint, ++r.position, {
      type: 'attack_result',
      encounter_id,
      attacker_id,
      target_id,
      hit,
      loss,
      ...(prevented_by && { prevented_by }),
    }),
  );
  if (!loss) return;
  injure(world, command, mint, row, attacker_id, target_id, loss, sleeping, r, close);
}

function damageRoll(r: Round, profile: AttackProfile) {
  return add(
    profile.damage_min,
    profile.damage_min === profile.damage_max
      ? 0
      : draw(r, add(profile.damage_max - profile.damage_min, 1)),
  );
}

function attackEvent(
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  position: number,
  payload: Extract<DomainEvent['payload'], { type: 'attack_result' }>,
): CombatEvent {
  return {
    id: mint() as DomainEvent['id'],
    world_context_id: world.context,
    scope: { kind: 'instance', world_context_id: world.context },
    logical_time: world.state.clock,
    position,
    causation_id: command.id as string as DomainEvent['causation_id'],
    correlation_id: command.id as string as DomainEvent['correlation_id'],
    payload,
  };
}

function injure(
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  row: EncounterRow,
  attacker_id: EntityId,
  target_id: EntityId,
  loss: number,
  sleeping: boolean,
  r: Round,
  close: DeltaOp,
) {
  const player = attacker_id === row.body_id;
  const hp = resourceRef(world, 'hp');
  const fatalLoss = { ...adjust(world, target_id, hp, -loss, {}).op, at: r.due_time };
  r.ops.push(fatalLoss);
  if (fatalLoss.to === 0) {
    r.ops.push(close);
    const died = deathSequence(
      prefix(world, [fatalLoss, close]),
      command,
      {
        loss: fatalLoss,
        owner_id: player ? null : row.character_id,
        killer_id: attacker_id,
        credited_character_id: player ? row.character_id : null,
      },
      mint,
    );
    r.ops.push(...died.ops);
    r.events.push(...died.events.map((e) => ({ ...e, position: ++r.position })));
  } else if (sleeping) wake(prefix(world, [fatalLoss]), row, r);
}

function wake(at: World, row: EncounterRow, r: Round) {
  const wake = assigned(
    at,
    row.character_id,
    { ops: recoveryAdjustments(at, row.body_id, 'standing'), position: r.position, facts: {} },
    { fact: fact(at), value: 'standing' as never },
  );
  r.ops.push(...wake.ops);
  r.position = wake.position;
}

function equipped(world: World, body: EntityId, slot: string) {
  const holder = world.slots[slot];
  if (!holder || world.state.containers[holder] !== body) return;
  const id = Object.keys(world.entities).find((id) => world.state.containers[id] === holder);
  const item = id && world.entities[id];
  return item && item.kind === 'item' ? item : undefined;
}

function attackProfile(world: World, row: EncounterRow, player: boolean, r: Round) {
  const npc = world.entities[row.npc_id];
  if (npc.kind !== 'npc' || !npc.attack) throw new KernelError('precondition_failed');
  if (!player) return npc.attack;
  const weapon = equipped(world, row.body_id, 'wield')?.weapon;
  return weapon && status(world, row.character_id, weapon.skill, r.steps).usable
    ? weapon.attack
    : world.cartridge.world!.combat!.player_attack;
}

function defend(world: World, row: EncounterRow, r: Round): 'dodge' | 'block' | undefined {
  if (!standing(world, row.character_id)) return;
  const dodge = world.cartridge.world!.combat!.dodge;
  if (
    dodge &&
    status(world, row.character_id, dodge.skill, r.steps).usable &&
    draw(r, 100) < dodge.chance
  )
    return 'dodge';
  const shield = equipped(world, row.body_id, 'off_hand');
  if (shield?.block_chance !== undefined && draw(r, 100) < shield.block_chance) return 'block';
}
