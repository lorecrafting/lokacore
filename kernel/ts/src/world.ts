// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in rules/<capability>.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json); proposal.ts proposes, composes and adopts
// its result.
import { KernelError } from './error.ts';
import type { Installed } from './cartridge.ts';
import {
  CAPABILITY_OWNERS,
  type CharacterId,
  type Command,
  type DecisionResult,
  type EntityId,
  type ErrorCode,
  type Owned,
  type WorldContextId,
} from './contracts.gen.ts';
import {
  allocator,
  refString,
  rejected,
  type Cartridge,
  type Detail,
  type Entity,
  type Mint,
  type Rule,
  type World,
} from './decision.ts';
import { invariants as factInvariants } from './fact.ts';
import type { RngState } from './rng.ts';
import { refusal } from './actions.ts';
import * as action_recipe from './rules/action_recipe.ts';
import * as barrier from './rules/barrier.ts';
import * as containment from './rules/containment.ts';
import * as description_variant from './rules/description_variant.ts';
import * as movement from './rules/movement.ts';
import * as quest from './rules/quest.ts';
import * as schedule from './rules/schedule.ts';
import { deliver } from './quest.ts';
import { admit, adopt, ownerOf, type Actor, type Stepped } from './proposal.ts';
import { newWorld, NIL } from './fresh.ts';

// Each capability's rule; the key binds a module to the capability whose commands reach it.
const RULES: { readonly [C in keyof Owned]?: Rule<C> } = {
  movement: movement.decide,
  description_variant: description_variant.decide,
  containment: containment.decide,
  action_recipe: action_recipe.decide,
  schedule: schedule.decide,
  barrier: barrier.decide,
  quest: quest.decide,
};

// Capabilities that own no command, so no rule: what the rules and the GameView call implements
// them (fact.ts, policy.ts, resource.ts, reaction.ts; details in target.ts and look; a recipe's
// check in rules/action_recipe.ts). Each has feature map cells.
const RULELESS = [
  'fact',
  'policy',
  'inspectable_detail',
  'check',
  'resource',
  'behavior',
  'calendar',
  'reaction',
];

/** What this kernel implements, for the loader (05 §3, §6): each capability above, at 1. */
export const INSTALLED: Installed = {
  kernel_api: '1.0',
  capabilities: Object.fromEntries([...Object.keys(RULES), ...RULELESS].map((k) => [k, [1]])),
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};

/**
 * Decides and, when accepted, composes and commits one command (04 §5): routes it to the rule
 * of the capability that owns its type (capability_registry.json), rejecting it with
 * unsupported_capability when that capability is not in the lock or has no rule here.
 */
export function step(world: World, command: Command): Stepped {
  const owner = ownerOf(CAPABILITY_OWNERS.command, command.payload.type) ?? '';
  const rule = RULES[owner as keyof Owned] as unknown as AnyRule | undefined;
  if (!rule || !Object.hasOwn(world.cartridge.lock.capabilities, owner))
    return { decision: rejected('unsupported_capability'), world };
  return decideWith(world, command, owner, rule);
}

type AnyRule = (w: World, c: Command, mint: Mint) => DecisionResult;

/**
 * The admission boundary around one rule call. Before the rule: the nil CommandId is reserved
 * for world creation (permission_denied; R6 must keep this refusal before any receipt); a
 * command for another world (not_found) or another actor (not_found) is rejected, and so is one
 * the actor's ActionSet does not offer or offers unavailable (actions.ts refusal; 04 §19, ACT-09).
 * A KernelError thrown while deciding is an evaluator_error fault with the world unchanged. After it: admit() checks the
 * result, quest delivery adds the objective transitions its events earn (quest.ts deliver; no
 * event, so it stays admitted), then the delta composes or faults before the changes are adopted.
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
    const decided = deliver(world, admit(owner, rule(world, command, mint)));
    return adopt(world, decided, command as Actor, mint);
  } catch (e) {
    // 04 §5.2 step 7: a numeric-profile error is a typed fault; any other throw is a bug.
    if (!(e instanceof KernelError)) throw e;
    return { decision: { kind: 'fault', code: 'evaluator_error' }, world };
  }
}

const INVARIANTS = { ...movement.invariants, ...factInvariants, ...containment.invariants };

/** True when the registered invariant holds for the world; throws for an unknown id. */
export function holds(id: string, world: World): boolean {
  if (!Object.hasOwn(INVARIANTS, id)) throw new Error(`unknown invariant ${id}`);
  return INVARIANTS[id](world);
}

export { admit, adopt, type Admitted } from './proposal.ts';
export { gameView } from './view.ts';
export { newWorld };
export { row } from './decision.ts';
