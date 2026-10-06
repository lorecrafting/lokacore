// M5-B foundation, consumed by the first M6 fatal encounter. No public death command.
import type { CharacterId, Command, DeltaOp, DomainEvent, EntityId } from '../../contracts.gen.ts';
import { bodyOf, refString, type Mint, type World } from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { level, resourceRef, recoveryAdjustments, adjust } from '../resource.ts';
import { fact, positionOf } from '../position/shared.ts';
import { wornIn } from '../equipment/rule.ts';
import { fail } from '../patrol/sequence.ts';
import { separate } from '../escort/shared.ts';
import { cmp } from '../../foundation/validate.ts';
import { key } from '../../foundation/compose.ts';

import { leave } from '../water/shared.ts';

type DeathEvent = DomainEvent & {
  payload: Extract<DomainEvent['payload'], { type: 'entity_died' }>;
};
type Loss = Extract<DeltaOp, { op: 'resource.adjust' }>;
export type Fatal = {
  cause?: 'drowning';
  loss: Loss;
  owner_id: CharacterId | null;
  killer_id: EntityId | null;
  credited_character_id: CharacterId | null;
};

/** `world` includes the fatal HP loss and producer's encounter closure at the fatal clock. */
export function deathSequence(
  world: World,
  command: Pick<Command, 'id'>,
  fatal: Fatal,
  mint: Mint,
) {
  validateFatal(world, fatal);
  const { loss, owner_id } = fatal;
  const victim_id = loss.entity_id;
  const player = owner_id !== null;
  const room_id = world.state.containers[victim_id];
  const id = mint() as DomainEvent['id'];
  const corpse_id = mint() as EntityId;
  const definition = corpseDefinition(world, victim_id, player);
  const writer_group = loss.writer_group;
  const ops: DeltaOp[] = [
    {
      op: 'entity.create',
      writer_group,
      identity: {
        id: corpse_id,
        definition,
        origin: { kind: 'death', victim_id, event_id: id, owner_id },
      },
    },
    {
      op: 'entity.transfer',
      writer_group,
      entity_id: corpse_id,
      source_id: null,
      destination_id: room_id,
    },
  ];
  ops.push(...transferRoots(world, victim_id, corpse_id, player, writer_group));
  ops.push(...populationLoss(world, loss));
  if (player) ops.push(...returnBody(world, fatal));
  const died = deathEvent(world, command, fatal, id, corpse_id, player);
  return { ops, events: [died], corpse_id };
}

function corpseDefinition(world: World, victim_id: EntityId, player: boolean) {
  const settings = world.cartridge.world!.death!;
  const spawned = world.state.created?.[victim_id];
  const population =
    spawned?.origin.kind === 'spawned' && ['hound', 'deer'].includes(spawned.origin.role)
      ? world.populationSpecs[key(spawned.origin.by)]
      : undefined;
  return player ? settings.player_corpse : (population?.corpse ?? settings.npc_corpse);
}

function populationLoss(world: World, loss: Loss): DeltaOp[] {
  const spawned = world.state.created?.[loss.entity_id];
  if (spawned?.origin.kind !== 'spawned' || !['hound', 'deer'].includes(spawned.origin.role))
    return [];
  const plan = spawned.origin.by;
  const population = world.populationSpecs[key(plan)];
  const slot = spawned.origin.slot;
  const before = world.state.population_slots?.[key({ kind: 'population_slot', plan, slot })];
  if (
    !population ||
    !before ||
    before.member_id !== loss.entity_id ||
    before.replacement_due !== null
  )
    throw new KernelError('precondition_failed');
  return [
    ...(before.sight_job_id
      ? [
          {
            op: 'job.cancel' as const,
            writer_group: loss.writer_group,
            job_id: before.sight_job_id,
            sight_member_id: loss.entity_id,
          },
        ]
      : []),
    {
      op: 'population.slot',
      writer_group: loss.writer_group,
      plan,
      slot,
      expected: before,
      value: {
        ...before,
        replacement_due: (loss.at ?? world.state.clock) + population.plan.replacement_delay,
        ...(population.plan.sight && { sight_job_id: null }),
      },
    },
  ];
}

function validateFatal(world: World, fatal: Fatal) {
  const { loss, owner_id, killer_id, credited_character_id } = fatal;
  const victim_id = loss.entity_id;
  const settings = world.cartridge.world?.death;
  const player = owner_id !== null && bodyOf(world, owner_id) === victim_id;
  const npc = world.entities[victim_id];
  const room_id = world.state.containers[victim_id];
  if (
    !settings ||
    world.cartridge.lock.capabilities.death !== 1 ||
    !same(loss.resource, resourceRef(world, 'hp')) ||
    !(loss.from > 0) ||
    loss.to !== 0 ||
    level(world, victim_id, loss.resource) !== 0 ||
    !world.rooms[room_id] ||
    !(player || (owner_id === null && npc?.kind === 'npc' && npc.hp)) ||
    (killer_id !== null && !world.knownEntities[killer_id]) ||
    (credited_character_id !== null && !bodyOf(world, credited_character_id))
  )
    throw new KernelError('precondition_failed');
}

function transferRoots(
  world: World,
  victim_id: EntityId,
  corpse_id: EntityId,
  player: boolean,
  writer_group: number,
): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const roots = Object.keys(world.entities).filter(
    (item) =>
      world.entities[item].kind === 'item' &&
      (world.state.containers[item] === victim_id ||
        (player && wornIn(world, world.state.containers[item], victim_id))),
  );
  for (const item of roots.sort(cmp))
    ops.push({
      op: 'entity.transfer',
      writer_group,
      entity_id: item as EntityId,
      source_id: world.state.containers[item],
      destination_id: corpse_id,
    });
  return ops;
}

function returnBody(world: World, fatal: Fatal): DeltaOp[] {
  const settings = world.cartridge.world!.death!;
  const victim_id = fatal.loss.entity_id;
  const owner_id = fatal.owner_id!;
  const writer_group = fatal.loss.writer_group;
  const room_id = world.state.containers[victim_id];
  const ops: DeltaOp[] = [
    ...leave(world, owner_id, writer_group),
    ...separate(world, owner_id, writer_group),
    ...fail(world, owner_id, writer_group),
  ];
  ops.push({
    op: 'entity.transfer',
    writer_group,
    entity_id: victim_id,
    source_id: room_id,
    destination_id: world.roomIds[refString(settings.shrine)],
  });
  const restored = restoredPools(world, victim_id);
  ops.push(...restored.map((op) => ({ ...op, writer_group })));
  const expected = positionOf(world, owner_id)!;
  if (expected !== 'standing')
    ops.push({
      op: 'fact.assign',
      writer_group,
      fact: fact(world),
      scope: { kind: 'player', character_id: owner_id },
      expected,
      value: 'standing' as never,
    });
  return ops;
}

function restoredPools(world: World, victim_id: EntityId) {
  const settings = world.cartridge.world!.death!;
  const restored = recoveryAdjustments(world, victim_id, 'standing').map((op) => ({ ...op }));
  for (const pool of ['hp', 'mv'] as const) {
    const resource = resourceRef(world, pool);
    const existing = restored.find((op) => same(op.resource, resource));
    if (existing) existing.to = settings.restore[pool];
    else
      restored.push(
        adjust(
          world,
          victim_id,
          resource,
          settings.restore[pool] - level(world, victim_id, resource)!,
          {},
        ).op,
      );
  }
  return restored;
}

function deathEvent(
  world: World,
  command: Pick<Command, 'id'>,
  fatal: Fatal,
  id: DomainEvent['id'],
  corpse_id: EntityId,
  player: boolean,
): DeathEvent {
  const { killer_id, credited_character_id } = fatal;
  const victim_id = fatal.loss.entity_id;
  const room_id = world.state.containers[victim_id];
  const npc = world.entities[victim_id];
  const victim_definition = player
    ? undefined
    : {
        cartridge_id: world.cartridge.manifest.id,
        cartridge_version: world.cartridge.manifest.version,
        kind: 'npc' as const,
        key: npc.key,
      };
  return {
    id,
    world_context_id: world.context,
    scope: { kind: 'instance', world_context_id: world.context },
    logical_time: world.state.clock,
    position: 1,
    causation_id: command.id as string as DomainEvent['causation_id'],
    correlation_id: command.id as string as DomainEvent['correlation_id'],
    payload: {
      type: 'entity_died',
      ...(fatal.cause && { cause: fatal.cause }),
      victim_id,
      room_id,
      killer_id,
      credited_character_id,
      corpse_id,
      ...(victim_definition && { victim_definition }),
    },
  };
}
