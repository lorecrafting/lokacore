// What rule modules (rules/<capability>.ts) see: the World they read, the typed Rule and
// Decision contract that limits each capability to its own commands and events
// (capability_registry.json, through contracts.gen.ts Owned), and pure helpers. The router,
// commit and GameView are in world.ts.
import {
  DEFS,
  type CharacterId,
  type Command,
  type CommandPayload,
  type CompiledCartridge,
  type DecisionResult,
  type DefinitionRef,
  type DomainEvent,
  type EntityId,
  type ErrorCode,
  type EventPayload,
  type Key,
  type Owned,
  type RoomDefinition,
  type StateDelta,
  type WorldContextId,
} from './contracts.gen.ts';
import { id } from './id_source.ts';
import type { RngState } from './rng.ts';

export type Cartridge = Extract<CompiledCartridge, { format: 'loka-cartridge-v2' }>;

/** The mutable, hashed part of a world: logical time, containment (03 §23) and the RNG. */
export type State = {
  readonly clock: number;
  readonly containers: Readonly<Record<string, EntityId>>;
  readonly rng: RngState;
};

/** The runtime world: immutable definitions and ids, shared between steps, plus State. */
export type World = {
  readonly cartridge: Cartridge;
  readonly context: WorldContextId;
  readonly character: CharacterId;
  readonly body: EntityId;
  readonly rooms: Readonly<Record<string, RoomDefinition>>; // by room EntityId
  readonly roomIds: Readonly<Record<string, EntityId>>; // by DefinitionRefString
  readonly state: State;
};

type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;
type Event<E> = Omit<DomainEvent, 'payload'> & {
  readonly payload: Extract<EventPayload, { type: E }>;
};
/** A DecisionResult whose events are only the given types. */
export type Decision<E> =
  | Exclude<DecisionResult, { kind: 'accepted' }>
  | (Omit<Accepted, 'events'> & { readonly events: readonly Event<E>[] });
/** A rule of capability C: only C's commands in, only C's events out (typecheck enforces). */
export type Rule<C extends keyof Owned> = (
  world: World,
  command: Omit<Command, 'payload'> & {
    readonly payload: Extract<CommandPayload, { type: Owned[C]['command'] }>;
  },
) => Decision<Owned[C]['event']>;

/** The six compass directions, in RoomDefinition exits order (room.schema.json). */
export const COMPASS: readonly Key[] = Object.keys(
  (DEFS.RoomDefinition as { properties: { exits: { properties: object } } }).properties.exits
    .properties,
) as Key[];

export const refString = (r: DefinitionRef) =>
  `${r.cartridge_id}@${r.cartridge_version}:${r.kind}/${r.key}`;

export const rejected = (code: ErrorCode) => ({ kind: 'rejected', error: { code } }) as const;

/** The DomainEvent at `position` of the command's decision (04 §8, §11). */
export function event<P extends EventPayload>(
  world: World,
  command: { readonly id: Command['id'] },
  position: number,
  payload: P,
): Omit<DomainEvent, 'payload'> & { payload: P } {
  return {
    id: id(world.context, command.id, position) as DomainEvent['id'],
    world_context_id: world.context,
    scope: { kind: 'player', character_id: world.character },
    actor_id: world.character,
    logical_time: world.state.clock,
    position,
    causation_id: command.id as string as DomainEvent['causation_id'],
    correlation_id: command.id as string as DomainEvent['correlation_id'],
    payload,
  };
}

/** An accepted decision with its typed outcome (04 §5): no effects, the RNG untouched. */
export const accepted = <E>(
  world: World,
  outcome: string,
  ops: StateDelta['ops'],
  events: readonly Event<E>[],
): Decision<E> => ({
  kind: 'accepted',
  outcome: outcome as Key,
  delta: { ops },
  events,
  effects: [],
  rng: world.state.rng,
});

/** The room a direction's exit leads to, if the room has that exit. */
export const exitTo = (room: RoomDefinition, direction: string): DefinitionRef | undefined =>
  (room.exits as Readonly<Record<string, { to: DefinitionRef }>>)[direction]?.to;
