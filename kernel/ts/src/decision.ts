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
  type FactValue,
  type InspectableDetail,
  type ItemDefinition,
  type Key,
  type NpcDefinition,
  type Owned,
  type RoomDefinition,
  type StateDelta,
  type Text,
  type WorldContextId,
} from './contracts.gen.ts';
import { id } from './id_source.ts';
import type { RngState } from './rng.ts';

export type Cartridge = Extract<CompiledCartridge, { format: 'loka-cartridge-v2' }>;

/**
 * The mutable, hashed part of a world: logical time, containment (03 §23), the RNG and the facts
 * set so far, by canonical fact MutationTarget text (compose.ts); absent until one is set, as an
 * unset fact has its default and no record (fact.schema.json ScopedFact).
 */
export type State = {
  readonly clock: number;
  readonly containers: Readonly<Record<string, EntityId>>;
  readonly rng: RngState;
  readonly facts?: Readonly<Record<string, FactValue>>;
};

/** The runtime world: immutable definitions and ids, shared between steps, plus State. */
export type World = {
  readonly cartridge: Cartridge;
  readonly context: WorldContextId;
  readonly character: CharacterId;
  readonly body: EntityId;
  readonly rooms: Readonly<Record<string, RoomDefinition>>; // by room EntityId
  readonly roomIds: Readonly<Record<string, EntityId>>; // by DefinitionRefString
  readonly details: Readonly<Record<string, Detail>>; // by detail target id
  readonly entities: Readonly<Record<string, Entity>>; // items and NPCs, by EntityId
  readonly entityIds: Readonly<Record<string, EntityId>>; // by DefinitionRefString
  readonly capacities: Readonly<Record<string, number>>; // by EntityId, where declared
  readonly factDefaults: Readonly<Record<string, FactValue>>; // by canonical DefinitionRef text
  readonly state: State;
};

/** A room's InspectableDetail, with the room and key its target id stands for (21 §6). */
export type Detail = InspectableDetail & { readonly room: EntityId; readonly key: string };

/** An item or NPC definition, tagged with its kind (entity.schema.json). */
export type Entity =
  (ItemDefinition & { readonly kind: 'item' }) | (NpcDefinition & { readonly kind: 'npc' });

/**
 * The body entity `actor` acts through, if it has one here (21 §9). One body per world until
 * admission accepts a second actor; puppeting changes this lookup, not the rules (contract
 * lessons).
 */
export const bodyOf = (world: World, actor: CharacterId): EntityId | undefined =>
  actor === world.character ? world.body : undefined;

type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;
type Event<E> = Omit<DomainEvent, 'payload'> & {
  readonly payload: Extract<EventPayload, { type: E }>;
};
/** A DecisionResult whose events are only the given types. */
export type Decision<E> =
  | Exclude<DecisionResult, { kind: 'accepted' }>
  | (Omit<Accepted, 'events'> & { readonly events: readonly Event<E>[] });
/** The command's IdSource allocator: each call is the next ordinal, from 0 (numeric profile). */
export type Mint = () => string;
/**
 * A rule of capability C: only C's commands in, only C's events out. Typecheck enforces it for
 * typed code; step() re-checks event ownership at admission, and lint/rules/ts-rule-module-*.yml
 * ban the untyped and mutating escapes.
 */
export type Rule<C extends keyof Owned> = (
  world: World,
  command: Omit<Command, 'payload'> & {
    readonly payload: Extract<CommandPayload, { type: Owned[C]['command'] }>;
  },
  mint: Mint,
) => Decision<Owned[C]['event']>;

/** The six compass directions, in RoomDefinition exits order (room.schema.json). */
export const COMPASS: readonly Key[] = Object.keys(
  (DEFS.RoomDefinition as { properties: { exits: { properties: object } } }).properties.exits
    .properties,
) as Key[];

export const refString = (r: DefinitionRef) =>
  `${r.cartridge_id}@${r.cartridge_version}:${r.kind}/${r.key}`;

export const rejected = (code: ErrorCode) => ({ kind: 'rejected', error: { code } }) as const;

/**
 * The IdSource allocator of one command's decision: ordinals 0, 1, 2, ... each used once, shared
 * by every id the decision creates (events now; entities and effects later).
 */
export function allocator(world: World, command: { readonly id: Command['id'] }): Mint {
  let ordinal = 0;
  return () => id(world.context, command.id, ordinal++);
}

/**
 * The DomainEvent at one-based causal `position` (04 §5.2, §8, §11), its id from `mint`, for
 * the command's actor.
 */
export function event<P extends EventPayload>(
  world: World,
  command: { readonly id: Command['id']; readonly payload: { readonly actor_id: CharacterId } },
  mint: Mint,
  position: number,
  payload: P,
): Omit<DomainEvent, 'payload'> & { payload: P } {
  return {
    id: mint() as DomainEvent['id'],
    world_context_id: world.context,
    scope: { kind: 'player', character_id: command.payload.actor_id },
    actor_id: command.payload.actor_id,
    logical_time: world.state.clock,
    position,
    causation_id: command.id as string as DomainEvent['causation_id'],
    correlation_id: command.id as string as DomainEvent['correlation_id'],
    payload,
  };
}

/**
 * An accepted decision with its typed outcome and, when it has any, its narration (04 §5; 06
 * §43): no effects, the RNG untouched.
 */
export const accepted = <E>(
  world: World,
  outcome: string,
  ops: StateDelta['ops'],
  events: readonly Event<E>[],
  narration?: readonly Text[],
): Decision<E> => ({
  kind: 'accepted',
  outcome: outcome as Key,
  delta: { ops },
  events,
  effects: [],
  rng: world.state.rng,
  ...(narration && { narration }),
});

/** The room a direction's exit leads to, if the room has that exit. */
export const exitTo = (room: RoomDefinition, direction: string): DefinitionRef | undefined =>
  (room.exits as Readonly<Record<string, { to: DefinitionRef }>>)[direction]?.to;

/** Own-key test and values for rule modules, which may not name Object (ts-rule-module-pure). */
export const has = (o: object, key: string): boolean => Object.hasOwn(o, key);
export const values = <T>(o: Readonly<Record<string, T>>): T[] => Object.values(o);
export const keys = (o: object): string[] => Object.keys(o);
