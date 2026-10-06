// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in mechanics/<capability>/rule.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json); runtime/proposal.ts proposes, composes and adopts
// its result.
import { over } from '../foundation/compose.ts';
import { KernelError } from '../foundation/error.ts';
import { elapsedCommandId } from '../foundation/id_source.ts';
import { validate } from '../foundation/validate.ts';
import type { Installed } from '../content/cartridge.ts';
import {
  CAPABILITY_OWNERS,
  type Command,
  type DecisionResult,
  type ErrorCode,
  type Key,
  type Owned,
} from '../contracts.gen.ts';
import { allocator, rejected, type Mint, type Rule, type Steps, type World } from './decision.ts';
import { invariants as factInvariants } from '../mechanics/fact.ts';
import { refusal } from '../commands/actions.ts';
import * as action_recipe from '../mechanics/action_recipe/rule.ts';
import * as barrier from '../mechanics/barrier/rule.ts';
import * as liquid from '../mechanics/liquid/rule.ts';
import * as commerce from '../mechanics/commerce/rule.ts';
import * as containment from '../mechanics/containment/rule.ts';
import * as description_variant from '../mechanics/description_variant/rule.ts';
import * as dialogue from '../mechanics/dialogue/rule.ts';
import * as light from '../mechanics/light/rule.ts';
import * as equipment from '../mechanics/equipment/rule.ts';
import * as combat from '../mechanics/combat/rule.ts';
import * as movement from '../mechanics/movement/rule.ts';
import * as position from '../mechanics/position/rule.ts';
import * as readable from '../mechanics/readable/rule.ts';
import * as quest from '../mechanics/quest/rule.ts';
import * as scene from '../mechanics/scene/rule.ts';
import * as schedule from '../mechanics/schedule/rule.ts';
import { admit, adopt, ownerOf, type Actor, type Stepped } from './proposal.ts';
import { newWorld, NIL } from './fresh.ts';

// Each capability's rule; the key binds a module to the capability whose commands reach it.
const RULES: { readonly [C in keyof Owned]?: Rule<C> } = {
  movement: movement.decide,
  combat: combat.decide,
  description_variant: description_variant.decide,
  containment: containment.decide,
  commerce: commerce.decide,
  liquid: liquid.decide,
  action_recipe: action_recipe.decide,
  schedule: schedule.decide,
  barrier: barrier.decide,
  quest: quest.decide,
  dialogue: dialogue.decide,
  light: light.decide,
  equipment: equipment.decide,
  position: position.decide,
  scene: scene.decide,
  readable: readable.decide,
};

// Capabilities that own no command, so no rule: what the rules and the GameView call implements
// them (mechanics/fact.ts, mechanics/policy.ts, mechanics/resource.ts, mechanics/reaction.ts; details in commands/target.ts and look; a recipe's
// check in mechanics/action_recipe/rule.ts). Each has feature map cells.
const RULELESS = [
  'fact',
  'policy',
  'inspectable_detail',
  'check',
  'resource',
  'death',
  'escort',
  'behavior',
  'calendar',
  'reaction',
  'narration',
  'target_resolution',
  'attributes',
  'skills',
  'topics',
];

/** What this kernel implements, for the loader (05 §3, §6): each capability above, at 1. */
export const INSTALLED: Installed = {
  kernel_api: '1.21',
  capabilities: Object.fromEntries([...Object.keys(RULES), ...RULELESS].map((k) => [k, [1]])),
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};

/**
 * Decides and, when accepted, composes and adopts one command as the commit at `revision` would
 * store it (04 §5; runtime/proposal.ts adopt): routes it to the rule
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
  if (command.payload.type === 'elapsed') return { decision: rejected('permission_denied'), world };
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
 * the actor's ActionSet does not offer or offers unavailable (commands/actions.ts refusal; 04 §19, ACT-09).
 * A KernelError thrown while deciding is an evaluator_error fault with the world unchanged. After it: admit() checks the
 * result, then its proposal (runtime/proposal.ts, quest deliveries included) composes or faults before the
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
  const bad = identity(world, command);
  if (bad) return { decision: rejected(bad), world };
  const steps = { n: 0 }; // one count spans admission, rule and proposal
  const refused = refusal(world, command.payload, steps, action);
  return evaluated(world, command, owner, rule, revision, steps, refused);
}

/** Only an authority may deliver this typed elapsed command; player step always refuses it. */
export function stepElapsed(world: World, command: Command, revision: number): Stepped {
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
  if (validate('Command', command).length || command.payload.type !== 'elapsed')
    return reject('permission_denied');
  const bad = identity(world, command);
  if (bad) return reject(bad);
  const p = command.payload;
  if (command.id !== elapsedCommandId(p.run_id, world.context, p.from, p.until))
    return reject('permission_denied');
  const owner = ownerOf(CAPABILITY_OWNERS.command, p.type);
  if (owner !== 'schedule' || !Object.hasOwn(world.cartridge.lock.capabilities, owner))
    return reject('unsupported_capability');
  return evaluated(world, command, owner, RULES.schedule as unknown as AnyRule, revision, { n: 0 });
}

function identity(world: World, command: Command): ErrorCode | undefined {
  if (command.id === NIL) return 'permission_denied';
  if (command.world_context_id !== world.context) return 'not_found';
  if (!('actor_id' in command.payload) || command.payload.actor_id !== world.character)
    return 'not_found';
  return undefined;
}

function evaluated(
  world: World,
  command: Command,
  owner: string,
  rule: AnyRule,
  revision: number,
  steps: Steps,
  refused?: ErrorCode,
): Stepped {
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
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
export { gameView } from '../view/view.ts';
export { newWorld };
export { row } from './decision.ts';
