// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in rules/<capability>.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json), composes the delta and commits it.
import { encode } from './canonical.ts';
import type { Installed } from './cartridge.ts';
import { compose } from './compose.ts';
import {
  CAPABILITY_OWNERS,
  LIMITS,
  type CharacterId,
  type Command,
  type DecisionResult,
  type EntityId,
  type ErrorCode,
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
  type Mint,
  type Rule,
  type World,
} from './decision.ts';
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

/** What this kernel implements, for the loader (05 §3, §6): each capability with a rule, at 1. */
export const INSTALLED: Installed = {
  kernel_api: '1.0',
  capabilities: Object.fromEntries(Object.keys(RULES).map((k) => [k, [1]])),
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};

const NIL = '00000000-0000-0000-0000-000000000000';

/**
 * A fresh world: IdSource ids under the nil CommandId (ordinal 0 the player's CharacterId, 1 its
 * body entity, then each room in DefinitionRefString order), the body in the entry room, time 0.
 */
export function newWorld(cartridge: Cartridge, context: WorldContextId, seed: RngState): World {
  const mint = (n: number) => id(context, NIL, n);
  const refs = Object.keys(cartridge.rooms).sort(cmp);
  const roomIds = Object.fromEntries(refs.map((r, i) => [r, mint(i + 2) as EntityId]));
  const body = mint(1) as EntityId;
  return {
    cartridge,
    context,
    character: mint(0) as CharacterId,
    body,
    rooms: Object.fromEntries(refs.map((r) => [roomIds[r], cartridge.rooms[r]])),
    roomIds,
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

/** Composes an admitted decision's delta and adopts the changes; only admit() makes one. */
function adopt(world: World, decision: Admitted): Stepped {
  if (decision.kind !== 'accepted') return { decision, world };
  const result = compose(world.state as unknown as Parameters<typeof compose>[0], decision.delta);
  if ('fault' in result) return { decision: result.fault, world };
  // ponytail: copies the containers map per move (O(entities)); a persistent map when big.
  const containers = { ...world.state.containers };
  for (const { target, value } of result.changes)
    if (target.kind === 'containment') containers[target.entity_id] = value as EntityId;
  return {
    decision,
    world: { ...world, state: { ...world.state, containers, rng: decision.rng } },
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

const INVARIANTS = { ...movement.invariants };

/** True when the registered invariant holds for the world; throws for an unknown id. */
export function holds(id: string, world: World): boolean {
  if (!Object.hasOwn(INVARIANTS, id)) throw new Error(`unknown invariant ${id}`);
  return INVARIANTS[id](world);
}

/** The player's GameView of the current place (04 §14; 00 §4.10): exits in compass order. */
export function gameView(world: World): GameView {
  const here = world.state.containers[world.body];
  const room = world.rooms[here];
  const text = (key: TextKey) => ({ key });
  return {
    actor_id: world.character,
    place: { id: here, title: text(room.title), description: text(room.description) },
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
