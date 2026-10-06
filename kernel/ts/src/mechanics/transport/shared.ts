// One live admission for exact endpoint offers and execution; destinations never come from clients.
import {
  LIMITS,
  type CommandPayload,
  type DeltaOp,
  type Key,
  type ErrorCode,
  type DefinitionRef,
  type TextKey,
  type EntityId,
  type TransportDefinition,
  type UnavailableReason,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import { refusal } from '../../commands/actions.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { standing } from '../position/shared.ts';
import { level, resourceRef, transfer } from '../resource.ts';
import { travel } from '../escort/shared.ts';

type Quote = { waived: boolean; charge: number };
type Unavailable = UnavailableReason & Partial<Quote>;
type Passage = {
  ops: DeltaOp[];
  route: TransportDefinition;
  body: EntityId;
  there: EntityId;
  waived: boolean;
  charge: number;
};
type Payload = Extract<CommandPayload, { type: 'use_transport' }>;
export function availability(world: World, p: Payload, steps: Steps, action: Key) {
  const blocked = refusal(world, p, steps, action);
  if (!blocked) return transition(world, p, steps);
  const route = world.cartridge.transports?.[refString(p.route)];
  if (!route) return { code: blocked as ErrorCode };
  const price = quote(world, p.actor_id, route, steps);
  return 'code' in price ? price : { code: blocked as ErrorCode, ...price };
}

// size: allow 50, exact transport admission joins conserved fare with body and bound follower custody
export function transition(
  world: World,
  p: Payload,
  steps: Steps = { n: 0 },
): Unavailable | Passage {
  if (++steps.n > LIMITS.query_steps) return { code: 'budget_exceeded' as const };
  const route = boundRoute(world, p);
  if ('code' in route) return route;
  const price = quote(world, p.actor_id, route, steps);
  if ('code' in price) return price;
  const body = bodyOf(world, p.actor_id),
    endpoint = world.details[p.endpoint_id];
  if (
    !body ||
    !standing(world, p.actor_id) ||
    (level(world, body, resourceRef(world, 'hp')) ?? 0) <= 0 ||
    engaged(world, body)
  )
    return { code: 'invalid_state' as const, ...price };
  const here = world.state.containers[body],
    there = world.roomIds[refString(route.destination)];
  if (here !== endpoint.room) return { code: 'not_present' as const };
  const recipient = world.entityIds[refString(route.recipient)];
  if (
    !there ||
    world.entities[recipient]?.kind !== 'npc' ||
    level(world, recipient, route.currency) === undefined
  )
    return { code: 'precondition_failed' as const };
  const { charge, waived } = price;
  const paid = charge > 0 ? transfer(world, body, recipient, route.currency, charge) : { ops: [] };
  if (!paid)
    return {
      ...price,
      code: 'insufficient_resource' as const,
      message: { key: 'transport.unaffordable' as TextKey },
    };
  const ops: DeltaOp[] = [
    ...paid.ops,
    {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: body,
      source_id: here,
      destination_id: there,
    },
    ...travel(world, p.actor_id, here, there),
  ];
  return { ops, route, body, there, waived, charge };
}

function quote(
  world: World,
  actor: Payload['actor_id'],
  route: TransportDefinition,
  steps: Steps,
): Quote | UnavailableReason {
  const recovery = ownedCorpse(world, actor, route.recovery_rooms, steps);
  if (typeof recovery === 'string') return { code: recovery };
  const waived = route.fare > 0 && recovery;
  return { waived, charge: waived ? 0 : route.fare };
}

function boundRoute(world: World, p: Payload) {
  const route = world.cartridge.transports?.[refString(p.route)],
    endpoint = world.details[p.endpoint_id];
  if (
    !route ||
    !endpoint?.transport ||
    !same(endpoint.transport.route, p.route) ||
    endpoint.key !== route.detail ||
    endpoint.room !== world.roomIds[refString(route.room)] ||
    p.quoted_fare !== route.fare
  )
    return { code: 'invalid_target' as const };
  return route;
}

/** Death-origin ownership and current room custody prove recovery; client input carries no waiver. */
function ownedCorpse(
  world: World,
  actor: Payload['actor_id'],
  rooms: readonly DefinitionRef[],
  steps: Steps,
) {
  if (!rooms.length) return false;
  const isle = new Set(rooms.map((r) => world.roomIds[refString(r)]));
  const roots = new Set(
    Object.entries(world.state.containers).flatMap(([id, holder]) => {
      if (++steps.n > LIMITS.query_steps) return [];
      return world.entities[id]?.kind === 'item' ? [holder] : [];
    }),
  );
  for (const [id, row] of Object.entries(world.state.created ?? {})) {
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
    if (
      row.origin.kind === 'death' &&
      row.origin.owner_id === actor &&
      isle.has(world.state.containers[id]) &&
      roots.has(id as EntityId)
    )
      return true;
  }
  return steps.n > LIMITS.query_steps ? ('budget_exceeded' as const) : false;
}
