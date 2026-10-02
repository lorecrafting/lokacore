// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in rules/<capability>.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json); proposal.ts proposes, composes and adopts
// its result.
import { over } from './compose.ts';
import { KernelError } from './error.ts';
import type { Installed } from './cartridge.ts';
import {
  CAPABILITY_OWNERS,
  type Command,
  type DecisionResult,
  type ErrorCode,
  type Key,
  type Owned,
} from './contracts.gen.ts';
import { allocator, rejected, type Mint, type Rule, type Steps, type World } from './decision.ts';
import { invariants as factInvariants } from './fact.ts';
import { refusal } from './actions.ts';
import * as action_recipe from './rules/action_recipe.ts';
import * as barrier from './rules/barrier.ts';
import * as containment from './rules/containment.ts';
import * as description_variant from './rules/description_variant.ts';
import * as dialogue from './rules/dialogue.ts';
import * as movement from './rules/movement.ts';
import * as quest from './rules/quest.ts';
import * as schedule from './rules/schedule.ts';
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
  dialogue: dialogue.decide,
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
  'narration',
  'target_resolution',
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
 * Decides and, when accepted, composes and adopts one command as the commit at `revision` would
 * store it (04 §5; proposal.ts adopt): routes it to the rule
 * of the capability that owns its type (capability_registry.json), rejecting it with
 * unsupported_capability when that capability is not in the lock or has no rule here.
 */
export function step(
  world: World,
  command: Command,
  revision: number,
  // ponytail: a host trace stores the Command, not this key, so a replay re-decides unkeyed and
  // a keyed refusal (stricter) can differ there; none does while no two actions match one Command.
  action?: Key,
): Stepped {
  const owner = ownerOf(CAPABILITY_OWNERS.command, command.payload.type) ?? '';
  const rule = RULES[owner as keyof Owned] as unknown as AnyRule | undefined;
  if (!rule || !Object.hasOwn(world.cartridge.lock.capabilities, owner))
    return { decision: rejected('unsupported_capability'), world };
  return decideWith(world, command, owner, rule, revision, action);
}

type AnyRule = (w: World, c: Command, mint: Mint, steps: Steps) => DecisionResult;

/**
 * The admission boundary around one rule call. Before the rule: the nil CommandId is reserved
 * for world creation (permission_denied; R6 must keep this refusal before any receipt); a
 * command for another world (not_found) or another actor (not_found) is rejected, and so is one
 * the actor's ActionSet does not offer or offers unavailable (actions.ts refusal; 04 §19, ACT-09).
 * A KernelError thrown while deciding is an evaluator_error fault with the world unchanged. After it: admit() checks the
 * result, then its proposal (proposal.ts, quest deliveries included) composes or faults before the
 * changes are adopted. One query_steps counter spans admission, the rule and the proposal; past
 * the limit after admission and the rule, the decision faults budget_exceeded, even a refusal.
 */
function decideWith(
  world: World,
  command: Command,
  owner: string,
  rule: AnyRule,
  revision: number,
  action?: Key,
): Stepped {
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
  if (command.id === NIL) return reject('permission_denied');
  if (command.world_context_id !== world.context) return reject('not_found');
  if (!('actor_id' in command.payload) || command.payload.actor_id !== world.character)
    return reject('not_found');
  const steps = { n: 0 }; // one query_steps count: admission, the rule and the proposal (04 §5.4)
  const refused = refusal(world, command.payload, steps, action);
  const mint = allocator(world, command);
  try {
    const decided = refused ?? admit(owner, rule(world, command, mint, steps));
    // 04 §5.4: an evaluation past query_steps faults, whatever admission or the rule answered.
    const limit = over({ query_steps: steps.n });
    if (limit) return { decision: { kind: 'fault', code: 'budget_exceeded' }, world, limit };
    if (typeof decided === 'string') return reject(decided);
    return adopt(world, decided, command as Actor, mint, revision, steps);
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
