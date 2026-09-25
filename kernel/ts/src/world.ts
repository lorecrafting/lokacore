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
import { COMPASS, refString, rejected, type Cartridge, type Rule, type World } from './decision.ts';
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
 * Decides and, when accepted, composes and commits one command (04 §5). Rejected: the owning
 * capability is not in the lock or has no rule (unsupported_capability), or the actor is not
 * this world's player (not_found). A result over output_bytes or a failed precondition faults.
 */
export function step(world: World, command: Command): { decision: DecisionResult; world: World } {
  const [owner] = (CAPABILITY_OWNERS.command[command.payload.type] ?? '').split('@');
  const rule = RULES[owner as keyof Owned] as unknown as (w: World, c: Command) => DecisionResult;
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
  if (!rule || !Object.hasOwn(world.cartridge.lock.capabilities, owner))
    return reject('unsupported_capability');
  if (!('actor_id' in command.payload) || command.payload.actor_id !== world.character)
    return reject('not_found');
  const decision = rule(world, command);
  if (decision.kind !== 'accepted') return { decision, world };
  if (utf8(encode(decision as never)).length > LIMITS.output_bytes!)
    return { decision: { kind: 'fault', code: 'budget_exceeded' }, world };
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
