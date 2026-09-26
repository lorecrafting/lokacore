// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in rules/<capability>.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json), composes the delta and commits it.
import { encode } from './canonical.ts';
import { KernelError } from './error.ts';
import type { Installed } from './cartridge.ts';
import { compose, key, target } from './compose.ts';
import {
  CAPABILITY_OWNERS,
  LIMITS,
  type CharacterId,
  type Command,
  type DecisionResult,
  type DefinitionRef,
  type DeltaOp,
  type EntityId,
  type EntityView,
  type ErrorCode,
  type FactValue,
  type GameView,
  type Key,
  type Owned,
  type TextKey,
  type WorldContextId,
} from './contracts.gen.ts';
import {
  allocator,
  COMPASS,
  COMPOSES,
  event,
  refString,
  rejected,
  type Cartridge,
  type Detail,
  type Entity,
  type Mint,
  type Rule,
  type World,
} from './decision.ts';
import { factChanged, invariants as factInvariants, typedFact } from './fact.ts';
import { id } from './id_source.ts';
import type { RngState } from './rng.ts';
import { utf8 } from './sha256.ts';
import { lists, refusal } from './actions.ts';
import * as action_recipe from './rules/action_recipe.ts';
import * as containment from './rules/containment.ts';
import * as description_variant from './rules/description_variant.ts';
import * as movement from './rules/movement.ts';
import * as schedule from './rules/schedule.ts';
import { cmp } from './validate.ts';

// Each capability's rule; the key binds a module to the capability whose commands reach it.
const RULES: { readonly [C in keyof Owned]?: Rule<C> } = {
  movement: movement.decide,
  description_variant: description_variant.decide,
  containment: containment.decide,
  action_recipe: action_recipe.decide,
  schedule: schedule.decide,
};

// Capabilities that own no command, so no rule: what the rules and the GameView call implements
// them (fact.ts, policy.ts; details in target.ts and look; a recipe's check in
// rules/action_recipe.ts). Each has feature map cells.
const RULELESS = ['fact', 'policy', 'inspectable_detail', 'check'];

/** What this kernel implements, for the loader (05 §3, §6): each capability above, at 1. */
export const INSTALLED: Installed = {
  kernel_api: '1.0',
  capabilities: Object.fromEntries([...Object.keys(RULES), ...RULELESS].map((k) => [k, [1]])),
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};

const NIL = '00000000-0000-0000-0000-000000000000';

/**
 * A fresh world: IdSource ids under the nil CommandId (ordinal 0 the player's CharacterId, 1 its
 * body entity, then each room in DefinitionRefString order, then each room's details in the same
 * room order and detail-key order, then each NPC, then each item, both in DefinitionRefString
 * order: numeric profile, Initial world ids), the body in the entry room, each NPC in its room
 * and each item at its location, time 0, each fact's default by its canonical DefinitionRef text
 * and no fact set.
 */
export function newWorld(cartridge: Cartridge, context: WorldContextId, seed: RngState): World {
  let ordinal = 0;
  const mint = () => id(context, NIL, ordinal++) as EntityId;
  const [character, body] = [mint() as string as CharacterId, mint()];
  const refs = Object.keys(cartridge.rooms).sort(cmp);
  const roomIds = Object.fromEntries(refs.map((r) => [r, mint()]));
  const details: Record<string, Detail> = {};
  for (const r of refs)
    for (const [key, d] of Object.entries(cartridge.rooms[r].details ?? {}).sort(([a], [b]) =>
      cmp(a, b),
    ))
      details[mint()] = { ...d, room: roomIds[r], key };
  const { entities, entityIds, containers, capacities } = place(cartridge, roomIds, mint);
  containers[body] = roomIds[refString(cartridge.entry)];
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  const factDefaults = Object.fromEntries(
    Object.values(cartridge.facts).map((f) => [
      key({ cartridge_id, cartridge_version, kind: 'fact', key: f.key }),
      f.value_type.default,
    ]),
  );
  return {
    cartridge,
    context,
    character,
    body,
    rooms: Object.fromEntries(refs.map((r) => [roomIds[r], cartridge.rooms[r]])),
    roomIds,
    details,
    entities,
    entityIds,
    capacities,
    factDefaults,
    state: { clock: 0, containers, rng: seed },
  };
}

// Each NPC, then each item, in DefinitionRefString order, with its minted id, its container (an
// NPC's room, an item's location) and its declared capacity.
function place(
  cartridge: Cartridge,
  roomIds: Readonly<Record<string, EntityId>>,
  mint: () => EntityId,
) {
  const sorted = <T>(m?: Readonly<Record<string, T>>) =>
    Object.entries(m ?? {}).sort(([a], [b]) => cmp(a, b));
  const defs: [string, Entity][] = [
    ...sorted(cartridge.npcs).map(([r, d]): [string, Entity] => [r, { ...d, kind: 'npc' }]),
    ...sorted(cartridge.items).map(([r, d]): [string, Entity] => [r, { ...d, kind: 'item' }]),
  ];
  const entityIds = Object.fromEntries(defs.map(([r]) => [r, mint()]));
  const ids = { ...roomIds, ...entityIds };
  const containers: Record<string, EntityId> = {};
  for (const [r, e] of defs) {
    const l = e.kind === 'item' ? e.location : { in: 'room' as const, room: e.room };
    containers[entityIds[r]] =
      ids[refString(l.in === 'room' ? l.room : l.in === 'npc' ? l.npc : l.item)];
  }
  return {
    entities: Object.fromEntries(defs.map(([r, e]) => [entityIds[r], e])),
    entityIds,
    containers,
    capacities: Object.fromEntries(
      defs.flatMap(([r, e]) => (e.capacity === undefined ? [] : [[entityIds[r], e.capacity]])),
    ),
  };
}

/**
 * Decides and, when accepted, composes and commits one command (04 §5): routes it to the rule
 * of the capability that owns its type (capability_registry.json), rejecting it with
 * unsupported_capability when that capability is not in the lock or has no rule here.
 */
export function step(world: World, command: Command): Stepped {
  const [owner] = (CAPABILITY_OWNERS.command[command.payload.type] ?? '').split('@');
  const rule = RULES[owner as keyof Owned] as unknown as AnyRule | undefined;
  if (!rule || !Object.hasOwn(world.cartridge.lock.capabilities, owner))
    return { decision: rejected('unsupported_capability'), world };
  return decideWith(world, command, owner, rule);
}

type Stepped = { decision: DecisionResult; world: World };
type Actor = Parameters<typeof event>[1];
type AnyRule = (w: World, c: Command, mint: Mint) => DecisionResult;

/**
 * The admission boundary around one rule call. Before the rule: the nil CommandId is reserved
 * for world creation (permission_denied; R6 must keep this refusal before any receipt); a
 * command for another world (not_found) or another actor (not_found) is rejected, and so is one
 * the actor's ActionSet does not offer or offers unavailable (actions.ts refusal; 04 §19, ACT-09).
 * A KernelError thrown while deciding is an evaluator_error fault with the world unchanged. After it: admit() checks the
 * result, then the delta composes or faults before the changes are adopted.
 */
function decideWith(world: World, command: Command, owner: string, rule: AnyRule): Stepped {
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
  if (command.id === NIL) return reject('permission_denied');
  if (command.world_context_id !== world.context) return reject('not_found');
  if (!('actor_id' in command.payload) || command.payload.actor_id !== world.character)
    return reject('not_found');
  const refused = refusal(world, command.payload);
  if (refused) return reject(refused);
  const mint = allocator(world, command);
  try {
    return adopt(world, admit(owner, rule(world, command, mint)), command as Actor, mint);
  } catch (e) {
    // 04 §5.2 step 7: a numeric-profile error is a typed fault; any other throw is a bug.
    if (!(e instanceof KernelError)) throw e;
    return { decision: { kind: 'fault', code: 'evaluator_error' }, world };
  }
}

/**
 * Composes an admitted decision's delta over the state, the fact defaults and the declared
 * capacities and adopts its containment, fact and clock changes; only admit() makes an Admitted. A
 * fact.assign whose fact, scope kind or value its FactSpec does not allow faults
 * precondition_failed (03 §7; 04 §5.1). Each that changes its fact adds a fact_changed at its
 * causal position (fact.ts factChanged). A result, these events included, over output_bytes
 * faults budget_exceeded (04 §5.4). A fault discards the whole proposal.
 */
export function adopt(world: World, decision: Admitted, command: Actor, mint: Mint): Stepped {
  if (decision.kind !== 'accepted') return { decision, world };
  const assigns = decision.delta.ops.filter((o) => o.op === 'fact.assign') as Assign[];
  const bad = assigns.find((o) => !typedFact(world, o.fact, o.scope.kind, o.value));
  if (bad)
    return { decision: { kind: 'fault', code: 'precondition_failed', target: target(bad) }, world };
  const base = { ...world.state, fact_defaults: world.factDefaults, capacities: world.capacities };
  const result = compose(base as unknown as Parameters<typeof compose>[0], decision.delta);
  if ('fault' in result) return { decision: result.fault, world };
  // ponytail: copies the containers and facts maps per step (O(rows)); persistent maps when big.
  const containers = { ...world.state.containers };
  const facts: Record<string, FactValue> = { ...world.state.facts };
  let clock = world.state.clock;
  for (const { target, value } of result.changes)
    if (target.kind === 'containment') containers[target.entity_id] = value as EntityId;
    else if (target.kind === 'fact') facts[key(target)] = value as FactValue;
    else if (target.kind === 'clock') clock = value as number;
  const state = { ...world.state, clock, containers, rng: decision.rng };
  const events = factChanged(world, command, mint, assigns, decision.events);
  const out = events === decision.events ? decision : { ...decision, events };
  if (utf8(encode(out as never)).length > LIMITS.output_bytes!)
    return { decision: { kind: 'fault', code: 'budget_exceeded' }, world };
  // No facts key until one is set, so a world without facts keeps its pre-fact state hash.
  return {
    decision: out,
    world: { ...world, state: Object.keys(facts).length ? { ...state, facts } : state },
  };
}

type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;

/**
 * An accepted rule result as the host admits it (04 §5.2 step 7): an event type neither the
 * owning capability nor one it COMPOSES owns faults unowned_event, which discards the whole
 * proposal. adopt() checks the output budget once the host's events are added.
 */
export function admit(owner: string, decision: DecisionResult): Admitted {
  const fault = (code: ErrorCode) => ({ kind: 'fault', code }) as Admitted;
  if (decision.kind !== 'accepted') return decision as Admitted;
  const owners = CAPABILITY_OWNERS.event;
  const may: readonly string[] = [owner, ...(COMPOSES[owner as keyof typeof COMPOSES] ?? [])];
  if (decision.events.some((e) => !may.includes(owners[e.payload.type]?.split('@')[0])))
    return fault('unowned_event');
  return decision as Admitted;
}

declare const ADMITTED: unique symbol;
/** A DecisionResult that passed admit(); adopt() takes only this, so step cannot skip admit. */
export type Admitted = DecisionResult & { readonly [ADMITTED]: true };

const INVARIANTS = { ...movement.invariants, ...factInvariants, ...containment.invariants };

/** True when the registered invariant holds for the world; throws for an unknown id. */
export function holds(id: string, world: World): boolean {
  if (!Object.hasOwn(INVARIANTS, id)) throw new Error(`unknown invariant ${id}`);
  return INVARIANTS[id](world);
}

/**
 * The player's GameView of the current place (04 §14; 00 §4.10): its description the variant
 * the player sees (description_variant.describe), exits in compass order, the place's actions,
 * the NPCs and items in the room and the items the player's body holds (03 §23), each named by
 * its short description with its actions (actions.ts lists: an item here by the room_contents
 * scope, an NPC by room_occupants, a held item by inventory), NPCs first, then in
 * DefinitionRefString order.
 */
export function gameView(world: World): GameView {
  const here = world.state.containers[world.body];
  const actions = lists(world, world.character);
  const scope = { item: 'room_contents', npc: 'room_occupants' } as const;
  const within = (holder: EntityId): EntityView[] =>
    Object.entries(world.entities)
      .filter(([id]) => world.state.containers[id] === holder)
      .map(([id, e]) => ({
        id: id as EntityId,
        name: e.short,
        kind: e.kind as Key,
        actions: actions.of(holder === world.body ? 'inventory' : scope[e.kind]),
      }));
  const room = world.rooms[here];
  const text = (key: TextKey) => ({ key });
  const description = text(description_variant.describe(world, world.character, room));
  return {
    actor_id: world.character,
    place: { id: here, title: text(room.title), description },
    exits: COMPASS.filter((d) => Object.hasOwn(room.exits, d)).map((direction) => ({
      available: true,
      direction,
    })),
    actions: actions.place,
    entities: within(here),
    inventory: within(world.body),
    journal: [],
    time: world.state.clock,
  };
}
