// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in rules/<capability>.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json), composes the delta and commits it.
import { encode } from './canonical.ts';
import type { Installed } from './cartridge.ts';
import { compose, key } from './compose.ts';
import {
  CAPABILITY_OWNERS,
  LIMITS,
  type CharacterId,
  type Command,
  type DecisionResult,
  type EntityId,
  type ErrorCode,
  type FactValue,
  type GameView,
  type Owned,
  type TextKey,
  type WorldContextId,
} from './contracts.gen.ts';
import {
  allocator,
  COMPASS,
  refString,
  rejected,
  type Cartridge,
  type Detail,
  type Mint,
  type Rule,
  type World,
} from './decision.ts';
import { invariants as factInvariants } from './fact.ts';
import { id } from './id_source.ts';
import type { RngState } from './rng.ts';
import { utf8 } from './sha256.ts';
import * as description_variant from './rules/description_variant.ts';
import * as movement from './rules/movement.ts';
import { cmp } from './validate.ts';

// Each capability's rule; the key binds a module to the capability whose commands reach it.
const RULES: { readonly [C in keyof Owned]?: Rule<C> } = {
  movement: movement.decide,
  description_variant: description_variant.decide,
};

// Capabilities that own no command, so no rule: what the rules and the GameView call implements
// them (fact.ts, policy.ts; details in target.ts and look). Each has feature map cells.
const RULELESS = ['fact', 'policy', 'inspectable_detail'];

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
 * room order and detail-key order: numeric profile, Initial world ids), the body in the entry
 * room, time 0, each fact's default by its canonical DefinitionRef text and no fact set.
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
    factDefaults,
    state: { clock: 0, containers: { [body]: roomIds[refString(cartridge.entry)] }, rng: seed },
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
type AnyRule = (w: World, c: Command, mint: Mint) => DecisionResult;

/**
 * The admission boundary around one rule call. Before the rule: the nil CommandId is reserved
 * for world creation (permission_denied; R6 must keep this refusal before any receipt); a
 * command for another world (not_found) or another actor (not_found) is rejected. After it:
 * admit() checks the result, then the delta composes or faults before the changes are adopted.
 */
function decideWith(world: World, command: Command, owner: string, rule: AnyRule): Stepped {
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
  if (command.id === NIL) return reject('permission_denied');
  if (command.world_context_id !== world.context) return reject('not_found');
  if (!('actor_id' in command.payload) || command.payload.actor_id !== world.character)
    return reject('not_found');
  return adopt(world, admit(owner, rule(world, command, allocator(world, command))));
}

/**
 * Composes an admitted decision's delta over the state and the fact defaults and adopts its
 * containment and fact changes; only admit() makes an Admitted.
 */
export function adopt(world: World, decision: Admitted): Stepped {
  if (decision.kind !== 'accepted') return { decision, world };
  const base = { ...world.state, fact_defaults: world.factDefaults };
  const result = compose(base as unknown as Parameters<typeof compose>[0], decision.delta);
  if ('fault' in result) return { decision: result.fault, world };
  // ponytail: copies the containers and facts maps per step (O(rows)); persistent maps when big.
  const containers = { ...world.state.containers };
  const facts: Record<string, FactValue> = { ...world.state.facts };
  for (const { target, value } of result.changes)
    if (target.kind === 'containment') containers[target.entity_id] = value as EntityId;
    else if (target.kind === 'fact') facts[key(target)] = value as FactValue;
  const state = { ...world.state, containers, rng: decision.rng };
  // No facts key until one is set, so a world without facts keeps its pre-fact state hash.
  return {
    decision,
    world: { ...world, state: Object.keys(facts).length ? { ...state, facts } : state },
  };
}

/**
 * An accepted rule result as the host admits it (04 §5.2 step 7): an event type the owning
 * capability does not own faults unowned_event, and a result over output_bytes faults
 * budget_exceeded; both discard the whole proposal.
 */
export function admit(owner: string, decision: DecisionResult): Admitted {
  const fault = (code: ErrorCode) => ({ kind: 'fault', code }) as Admitted;
  if (decision.kind !== 'accepted') return decision as Admitted;
  const owners = CAPABILITY_OWNERS.event;
  if (decision.events.some((e) => owners[e.payload.type]?.split('@')[0] !== owner))
    return fault('unowned_event');
  // ponytail: unreachable with look and move (fixed-size results); tested with the first rule
  // whose output size varies (S5, ActionRecipe).
  if (utf8(encode(decision as never)).length > LIMITS.output_bytes!)
    return fault('budget_exceeded');
  return decision as Admitted;
}

declare const ADMITTED: unique symbol;
/** A DecisionResult that passed admit(); adopt() takes only this, so step cannot skip admit. */
export type Admitted = DecisionResult & { readonly [ADMITTED]: true };

const INVARIANTS = { ...movement.invariants, ...factInvariants };

/** True when the registered invariant holds for the world; throws for an unknown id. */
export function holds(id: string, world: World): boolean {
  if (!Object.hasOwn(INVARIANTS, id)) throw new Error(`unknown invariant ${id}`);
  return INVARIANTS[id](world);
}

/**
 * The player's GameView of the current place (04 §14; 00 §4.10): its description the variant
 * the player sees (description_variant.describe), exits in compass order.
 */
export function gameView(world: World): GameView {
  const here = world.state.containers[world.body];
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
    actions: [],
    entities: [],
    inventory: [],
    journal: [],
    time: world.state.clock,
  };
}
