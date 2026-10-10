import type { DeltaOp, DomainEvent } from '../../contracts.gen.ts';
import { bodyOf, refString, type World } from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { jobCommandId } from '../../foundation/id_source.ts';
import { resourceRef } from '../resource.ts';
import { value } from '../fact.ts';
import { grant } from '../levelling/shared.ts';

type Death = DomainEvent & { payload: Extract<DomainEvent['payload'], { type: 'entity_died' }> };
type Attack = Extract<DomainEvent['payload'], { type: 'attack_result' }>;
type Create = Extract<DeltaOp, { op: 'entity.create' }>;

/** A real fatal delivery consumes its newly hydrated corpse before final adoption. */
export function deathCredit(
  world: World,
  event: DomainEvent,
  ops: readonly DeltaOp[],
  events: readonly DomainEvent[],
): DeltaOp[] {
  const p = event.payload;
  if (p.type !== 'entity_died' || !p.victim_definition || !p.credited_character_id) return [];
  const mapping = world.cartridge.world?.death_credit?.find(
    (m) =>
      same(m.npc, p.victim_definition) &&
      world.entityIds[refString(m.npc)] === p.victim_id &&
      world.roomIds[refString(m.room)] === p.room_id,
  );
  const fact = mapping && value(world, p.credited_character_id, mapping.fact) === false;
  // Toolbox row 4: a credited kill of a listed NPC definition grants its experience.
  const kill = world.cartridge.world?.levelling?.kills?.find((k) =>
    same(k.npc, p.victim_definition),
  );
  if (!fact && !kill) return [];
  const group = fatalGroup(world, { ...event, payload: p }, ops, events);
  if (group === undefined) return [];
  const credited: DeltaOp[] = fact
    ? [
        {
          op: 'fact.assign',
          writer_group: group,
          fact: mapping.fact,
          scope: { kind: 'player', character_id: p.credited_character_id },
          expected: false,
          value: true,
        },
      ]
    : [];
  return kill
    ? [...credited, ...grant(world, p.credited_character_id, kill.experience, group)]
    : credited;
}

function fatalGroup(
  world: World,
  event: Death,
  ops: readonly DeltaOp[],
  events: readonly DomainEvent[],
) {
  const p = event.payload;
  const creation = ops.find((o) => o.op === 'entity.create' && o.identity.id === p.corpse_id);
  if (!creation || creation.op !== 'entity.create' || !corpseValid(world, event, creation)) return;
  const attack = attackOf(event, events);
  if (
    !attack ||
    attack.payload.type !== 'attack_result' ||
    !occurrenceValid(world, event, attack.payload)
  )
    return;
  const { encounter_id } = attack.payload;
  const fatal = ops.some(
    (o) =>
      o.op === 'resource.adjust' &&
      o.writer_group === creation.writer_group &&
      o.entity_id === p.victim_id &&
      same(o.resource, resourceRef(world, 'hp')) &&
      o.from > 0 &&
      o.to === 0,
  );
  const closed = ops.some(
    (o) =>
      o.op === 'encounter.close' &&
      o.writer_group === creation.writer_group &&
      o.encounter_id === encounter_id,
  );
  return fatal && closed ? creation.writer_group : undefined;
}

function occurrenceValid(world: World, event: Death, attack: Attack) {
  const p = event.payload;
  const encounter = world.state.encounters?.[attack.encounter_id];
  const job = encounter && world.state.jobs?.[encounter.job_id];
  return (
    !!encounter &&
    encounter.status === 'closed' &&
    encounter.character_id === p.credited_character_id &&
    encounter.body_id === p.killer_id &&
    p.credited_character_id !== null &&
    bodyOf(world, p.credited_character_id) === p.killer_id &&
    encounter.npc_id === p.victim_id &&
    encounter.room_id === p.room_id &&
    !!job &&
    job.status === 'completed' &&
    job.encounter_id === attack.encounter_id &&
    job.due_time === event.logical_time &&
    jobCommandId(encounter.job_id, job.due_time) === (event.causation_id as string)
  );
}

function corpseValid(world: World, event: Death, creation: Create) {
  const p = event.payload;
  const corpse = world.entities[p.corpse_id];
  const identity = world.state.created?.[p.corpse_id];
  return (
    corpse?.kind === 'item' &&
    !!identity &&
    same(identity, creation.identity) &&
    same(identity.definition, world.cartridge.world?.death?.npc_corpse) &&
    identity.origin.kind === 'death' &&
    identity.origin.event_id === event.id &&
    identity.origin.victim_id === p.victim_id &&
    identity.origin.owner_id === null &&
    world.state.containers[p.corpse_id] === p.room_id
  );
}

function attackOf(event: Death, events: readonly DomainEvent[]) {
  const p = event.payload;
  return events.find(
    (e) =>
      e.payload.type === 'attack_result' &&
      e.causation_id === event.causation_id &&
      e.position < event.position &&
      e.payload.target_id === p.victim_id &&
      e.payload.attacker_id === p.killer_id &&
      e.payload.loss > 0,
  );
}
