// size: allow 310, bound quest, job and scene rows join the runtime decision model
// What rule modules (mechanics/<capability>/rule.ts) see: the World they read, the typed Rule and
// Decision contract that limits each capability to its own commands and events
// (capability_registry.json, through contracts.gen.ts Owned), and pure helpers. The router,
// commit and GameView are in world.ts.
import {
  DEFS,
  type BarrierState,
  type CharacterId,
  type Command,
  type CommandPayload,
  type CompiledCartridge,
  type DecisionResult,
  type DefinitionRef,
  type DomainEvent,
  type EncounterId,
  type EncounterRow,
  type EntityId,
  type EntityIdentity,
  type EscortRelation,
  type ErrorCode,
  type EventPayload,
  type FactValue,
  type InspectableDetail,
  type ItemDefinition,
  type Key,
  type LiquidRow,
  type MutationTarget,
  type NpcDefinition,
  type Owned,
  type QuestState,
  type QuestInstanceId,
  type ResourceSpec,
  type RoleBinding,
  type RoomDefinition,
  type StateDelta,
  type StateScope,
  type Text,
  type WorldContextId,
} from '../contracts.gen.ts';
import { key, type Stored } from '../foundation/compose.ts';
import { id } from '../foundation/id_source.ts';
import type { RngState } from '../foundation/rng.ts';

export type Cartridge = Extract<CompiledCartridge, { format: 'loka-cartridge-v2' }>;

export type State = {
  readonly liquids?: Readonly<Record<string, LiquidRow>>;
  readonly escorts?: Readonly<Record<string, EscortRelation>>; // by CharacterId
  readonly encounters?: Readonly<Record<string, EncounterRow>>;
  readonly created?: Readonly<Record<string, EntityIdentity>>;
  readonly clock: number;
  readonly containers: Readonly<Record<string, EntityId>>;
  readonly rng: RngState;
  readonly facts?: Readonly<Record<string, FactValue>>;
  readonly resources?: Readonly<Record<string, Stored>>;
  readonly cooldowns?: Readonly<Record<string, number>>;
  readonly barriers?: Readonly<Record<string, BarrierState>>;
  readonly quests?: Readonly<Record<string, QuestRow>>; // by QuestInstanceId
  readonly jobs?: Readonly<Record<string, JobRow>>; // by JobId
  readonly choices?: Readonly<Record<string, ChoiceRow>>; // by ContinuationId
};

/**
 * A pending choice's continuation as composition stores it (foundation/compose.ts choice; 04 §5.3), with the
 * revision of the commit that opened it, which adopt() stamps (runtime/proposal.ts) and choose expects.
 */
export type ChoiceRow = {
  readonly actor_id: CharacterId;
  readonly source: DefinitionRef;
  readonly beat: Key;
  readonly roles: readonly RoleBinding[];
  readonly choice_ids: readonly Key[];
  readonly status: 'pending' | 'resolved' | 'closed';
  readonly opened_revision: number;
  readonly choice_id?: Key;
  readonly quest_instance_id?: QuestInstanceId;
};

/** A scheduled job as composition stores it (foundation/compose.ts job.schedule; 03 §13; 04 §5.4). */
export type JobRow = {
  readonly job: DefinitionRef;
  readonly due_time: number;
  readonly status: 'pending' | 'completed' | 'cancelled';
  readonly encounter_id?: EncounterId;
  readonly quest_instance_id?: QuestInstanceId;
  readonly actor_id?: CharacterId;
};

// The State section each written MutationTarget kind lives in (the clock is State.clock).
const SECTIONS: Readonly<
  Record<
    string,
    | 'containers'
    | 'facts'
    | 'resources'
    | 'cooldowns'
    | 'barriers'
    | 'quests'
    | 'jobs'
    | 'choices'
    | 'created'
    | 'encounters'
    | 'escorts'
    | 'liquids'
  >
> = {
  liquid: 'liquids',
  encounter: 'encounters',
  escort: 'escorts',
  entity: 'created',
  containment: 'containers',
  fact: 'facts',
  resource: 'resources',
  cooldown: 'cooldowns',
  barrier: 'barriers',
  quest: 'quests',
  job: 'jobs',
  choice: 'choices',
};

export const row = (t: MutationTarget) =>
  SECTIONS[t.kind] &&
  ([
    SECTIONS[t.kind]!,
    t.kind === 'liquid'
      ? t.item_id
      : t.kind === 'containment' || t.kind === 'entity'
        ? t.entity_id
        : t.kind === 'escort'
          ? t.actor_id
          : t.kind === 'encounter'
            ? t.encounter_id
            : t.kind === 'quest'
              ? t.instance_id
              : t.kind === 'job'
                ? t.job_id
                : t.kind === 'choice'
                  ? t.continuation_id
                  : key(t),
  ] as const);

/** A QuestInstance as composition stores it (foundation/compose.ts quest; 03 §12, 06 §4). */
export type QuestRow = {
  readonly quest: DefinitionRef;
  readonly scope: StateScope;
  readonly state: QuestState;
  readonly outcome?: Key;
  readonly bindings?: readonly RoleBinding[];
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
  readonly knownEntities: Readonly<Record<string, { kind: string; owner_id?: CharacterId }>>;
  readonly corpseTemplates: Readonly<Record<string, 'player' | 'npc'>>;
  readonly liquidSpecs: Readonly<
    Record<string, { capacity: number; kinds: readonly DefinitionRef[] }>
  >;
  readonly capacities: Readonly<Record<string, number>>; // by EntityId: declared limit, or zero for noncontainer items
  readonly slots: Readonly<Record<string, EntityId>>; // each slot holder, by SlotKey (equipment@1)
  readonly factDefaults: Readonly<Record<string, FactValue>>; // by canonical DefinitionRef text
  readonly resourceSpecs: Readonly<Record<string, ResourceSpec>>; // by canonical DefinitionRef text
  readonly entityResourceSpecs: Readonly<Record<string, ResourceSpec>>; // by canonical resource target
  readonly barrierInitial: Readonly<Record<string, BarrierState>>; // by canonical DefinitionRef text
  readonly attributes: Readonly<Record<string, number>>; // each attribute's start, by DefinitionRef text
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
 * The capabilities whose events a capability's rule also emits, because it runs them inside its
 * own decision: a recipe resolves its check (check@1) in the perform decision (21 §7: costs,
 * checks and outcomes join one proposal); a scheduled NPC's run_job moves it and reports its
 * entity_entered_room (movement@1's) as a move does; reactions activate quest-owned instances;
 * a choice resolves its dialogue's quest
 * (quest@1's quest_resolved) and hands a bound item over (containment@1's item_acquired, as give).
 */
export const COMPOSES = {
  action_recipe: ['check'],
  schedule: ['movement', 'combat', 'death'],
  combat: ['movement'],
  dialogue: ['quest', 'containment'],
  commerce: ['containment'],
  scene: ['dialogue'],
  reaction: ['quest'],
} as const;
type Composed<C> = C extends keyof typeof COMPOSES
  ? Owned[(typeof COMPOSES)[C][number]]['event']
  : never;
/**
 * A rule of capability C: only C's commands in, only C's events (and those of the capabilities
 * it COMPOSES) out. Typecheck enforces it for typed code; step() re-checks event ownership at
 * admission, and lint/rules/ts-rule-module-*.yml ban the untyped and mutating escapes.
 */
export type Rule<C extends keyof Owned> = (
  world: World,
  command: Omit<Command, 'payload'> & {
    readonly payload: Extract<CommandPayload, { type: Owned[C]['command'] }>;
  },
  mint: Mint,
  steps?: Steps, // the decision's query_steps counter (04 §5.4), for a rule that reads a policy
) => Decision<Owned[C]['event'] | Composed<C>>;
/** A decision's count of evaluated policy leaves (04 §5.4 query_steps), shared by all its parts. */
export type Steps = { n: number };

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
 * §43): no effects, the RNG `rng` (by default untouched).
 */
export const accepted = <E>(
  world: World,
  outcome: string,
  ops: StateDelta['ops'],
  events: readonly Event<E>[],
  narration?: readonly Text[],
  rng: RngState = world.state.rng,
): Decision<E> => ({
  kind: 'accepted',
  outcome: outcome as Key,
  delta: { ops },
  events,
  effects: [],
  rng,
  ...(narration && { narration }),
});

/** Own-key test, values and entries for rule modules, which may not name Object (ts-rule-module-pure). */
export const has = (o: object, key: string): boolean => Object.hasOwn(o, key);
export const values = <T>(o: Readonly<Record<string, T>>): T[] => Object.values(o);
export const keys = (o: object): string[] => Object.keys(o);
export const entries = <T>(o: Readonly<Record<string, T>>) => Object.entries(o) as [Key, T][];
