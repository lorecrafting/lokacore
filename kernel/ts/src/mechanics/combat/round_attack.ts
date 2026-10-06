import { status } from '../skills.ts';
import type {
  AttackProfile,
  Command,
  DeltaOp,
  DomainEvent,
  EncounterId,
  EncounterRow,
  EntityId,
} from '../../contracts.gen.ts';
import { refString, type Mint, type World } from '../../runtime/decision.ts';
import { apply } from '../../runtime/apply.ts';
import { add, mul } from '../../foundation/int.ts';
import { KernelError } from '../../foundation/error.ts';
import { uniformCounted } from '../../foundation/rng.ts';
import { adjust, level, recoveryAdjustments, resourceRef } from '../resource.ts';
import { deathSequence } from '../death/sequence.ts';
import { clearBleed, currentBleed, wound } from '../bleed/shared.ts';
import { fact, positionOf, standing } from '../position/shared.ts';
import { assigned } from '../fact.ts';
import type { CombatEvent, Round } from './round.ts';

export function prefix(world: World, ops: readonly DeltaOp[], due = world.state.clock): World {
  const during =
    due === world.state.clock ? world : { ...world, state: { ...world.state, clock: due } };
  const result = apply(during, ops, false);
  if ('fault' in result) throw new KernelError(result.fault.code);
  return result.world;
}

function draw(r: Round, bound: number) {
  const [value, rng, spent] = uniformCounted(r.rng, bound, 8 - r.draws);
  r.rng = rng;
  r.draws += spent;
  return value;
}

export function attack(
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
  const profile = attackProfile(world, row, attacker_id, player, r);
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
  const fatalLoss = damage(world, target_id, loss, r);
  if (fatalLoss.to === 0) {
    const closing = target_id === row.body_id || !row.active_ids || row.active_ids.length === 1;
    const closingOps = [
      fatalLoss,
      ...(closing ? [close] : []),
      ...(target_id === row.body_id ? clearBleed(world, target_id) : []),
    ];
    r.ops.push(...closingOps.slice(1));
    const died = deathSequence(
      prefix(world, closingOps, r.due_time),
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
  } else {
    if (target_id === row.body_id) recordBleed(world, attacker_id, target_id, mint, r);
    if (sleeping) wake(prefix(world, [fatalLoss], r.due_time), row, r);
  }
}

function damage(world: World, target: EntityId, loss: number, r: Round) {
  const hp = resourceRef(world, 'hp');
  const op = { ...adjust(world, target, hp, -loss, {}).op, at: r.due_time };
  r.ops.push(op);
  return op;
}

function recordBleed(world: World, attacker: EntityId, body: EntityId, mint: Mint, r: Round) {
  const prior = currentBleed(world, body);
  const applied = wound(world, attacker, body, mint);
  r.ops.push(...applied);
  const effect = applied.find((op) => op.op === 'bleed.transition');
  if (effect?.op === 'bleed.transition' && effect.value.active) {
    const spec = world.cartridge.bleeds![refString(effect.value.effect!)];
    r.notes.push({ key: prior ? spec.narration.refreshed : spec.narration.applied });
  }
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

function attackProfile(
  world: World,
  row: EncounterRow,
  attacker_id: EntityId,
  player: boolean,
  r: Round,
) {
  const npc = world.entities[player ? row.npc_id : attacker_id];
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
