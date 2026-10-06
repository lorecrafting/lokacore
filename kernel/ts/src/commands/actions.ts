// ActionSet: engine, cartridge, room, choice; combat restricts admission/projection (06 §19).
import {
  CAPABILITY_OWNERS,
  type ActionContribution,
  type ActionInputParameter,
  type ActionRecipe,
  type CharacterId,
  type CommandPayload,
  type ContinuationId,
  type DefinitionRef,
  type EntityId,
  type Key,
  type RecipeTarget,
  type TargetSpec,
  type TextKey,
  type VersionedPolicy,
} from '../contracts.gen.ts';
import { key, same } from '../foundation/compose.ts';
import { bodyOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { questOf } from '../mechanics/lookups.ts';
import { ALWAYS, modal, talks } from '../mechanics/dialogue/shared.ts';
import { sub } from '../foundation/int.ts';
import { pay } from '../mechanics/resource.ts';
import { accepts, primaryTarget } from './action_input.ts';
import * as scene from '../mechanics/scene/shared.ts';
import { holds } from '../mechanics/policy.ts';
import { VERBS } from './verbs.ts';
import { engaged } from '../mechanics/combat/shared.ts';

/**
 * One action of a set: what the GameView advertises, the Command type it resolves to, the
 * recipe when it is one (whose invocation needs no target: the recipe names its own), the quest
 * when it is a quest's offer (accept_quest of that quest), the speaker when it is a dialogue's
 * talk (its only target), the continuation when it is close_choice of the pending choice, and
 * whether it is an engine verb, whose rule is its target and input contract (see accepts).
 */
export type Offered = {
  readonly key: Key;
  readonly label: TextKey;
  readonly target: TargetSpec;
  readonly input: readonly ActionInputParameter[];
  readonly priority: number;
  readonly policy: VersionedPolicy;
  readonly command: Key;
  readonly recipe?: ActionRecipe;
  readonly quest?: DefinitionRef;
  readonly speaker?: EntityId;
  readonly dialogue?: DefinitionRef;
  readonly continuation?: ContinuationId;
  readonly engine?: true;
};
export type ActionSet = Readonly<Record<string, Offered>>;

/** `set` with contribution `c` applied by one of ADR-016's operations. */
export function apply(set: ActionSet, op: ActionContribution['op'], c: ActionSet): ActionSet {
  const keep = (inC: boolean) =>
    Object.fromEntries(Object.entries(set).filter(([k]) => Object.hasOwn(c, k) === inC));
  switch (op) {
    case 'union':
      return { ...c, ...set };
    case 'override':
      return { ...set, ...c };
    case 'replace':
      return c;
    case 'subtract':
      return keep(false);
    case 'intersect':
      return keep(true);
  }
}

// The engine verbs whose owning capability the cartridge locks, labelled action.<verb>.
function engine(world: World): ActionSet {
  const locked = (verb: string) =>
    Object.hasOwn(world.cartridge.lock.capabilities, CAPABILITY_OWNERS.command[verb].split('@')[0]);
  return Object.fromEntries(
    Object.entries(VERBS)
      .filter(
        ([verb]) => locked(verb) && !(verb === 'wait' && world.cartridge.manifest.time_policy),
      )
      .map(([verb, [target, input]]): [string, Offered] => {
        const key = verb as Key;
        const label = `action.${verb}` as TextKey;
        const verb_ = { key, label, target, input, priority: 0, policy: ALWAYS, command: key };
        return [key, { ...verb_, engine: true }];
      }),
  );
}

// The cartridge's actions, recipes, the offers of the quests `actor` has no instance of (a quest
// may have none) and the talks of the dialogues whose speaker is in the actor's room (several per
// speaker), by key: disjoint, since the
// compiler and the loader reject a recipe, quest or dialogue whose key is an action's, a recipe's,
// a quest's or a registered command's (DUPLICATE_DEFINITION), so no key has two definitions here.
function cartridge(world: World, actor: CharacterId): ActionSet {
  const recipes = Object.values(world.cartridge.recipes ?? {}).map((recipe): [string, Offered] => {
    const { key, label, priority, policy } = recipe;
    const target = { kind: 'none' } as const;
    const command = 'perform' as Key;
    return [key, { key, label, target, input: [], priority, policy, command, recipe }];
  });
  const actions = Object.values(world.cartridge.actions).map((a): [string, Offered] => [
    a.key,
    { ...a, label: a.label as TextKey },
  ]);
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const quests = Object.values(world.cartridge.quests ?? {}).flatMap(({ key, offer }) => {
    const quest = { cartridge_id, cartridge_version, kind: 'quest', key } as DefinitionRef;
    if (!offer || questOf(world, actor, quest)) return [];
    const command = 'accept_quest' as Key;
    const o = { key, ...offer, target: { kind: 'none' }, input: [], priority: 0, command, quest };
    return [[key, o] as [string, Offered]];
  });
  return Object.fromEntries([...actions, ...recipes, ...quests, ...talks(world, actor)]);
}

/**
 * `actor`'s ActionSet before any policy is evaluated: every source composed, in order, then the
 * answers to a pending choice (modal state, mechanics/dialogue/shared.ts modal; 06 §37: no room contribution
 * removes them; combat filters the result afterward), which lists never renders directly.
 */
export function composed(world: World, actor: CharacterId): ActionSet {
  if (scene.running(world, actor)) return scene.modal();
  const [verbs, own] = [engine(world), cartridge(world, actor)];
  const all = { ...verbs, ...own };
  const body = bodyOf(world, actor);
  const room = body === undefined ? undefined : world.rooms[world.state.containers[body]];
  const set = (room?.actions ?? []).reduce(
    (set, c) =>
      apply(
        set,
        c.op,
        Object.fromEntries(c.actions.filter((k) => Object.hasOwn(all, k)).map((k) => [k, all[k]])),
      ),
    apply(apply({}, 'union', verbs), 'override', own),
  );
  return { ...set, ...modal(world, actor) };
}

const fighting = (world: World, actor: CharacterId) => {
  const body = bodyOf(world, actor);
  return body && engaged(world, body);
};

/** Final actor restriction; only internal escape policy reads the pre-combat composed set. */
export function resolved(world: World, actor: CharacterId): ActionSet {
  const set = composed(world, actor);
  return fighting(world, actor)
    ? Object.fromEntries(
        Object.entries(set).filter(([, a]) =>
          ['flee', 'stand', 'look', 'scan'].includes(a.command),
        ),
      )
    : set;
}

/** The target id of a recipe's detail (the loader checks it exists). */
export const detailOf = (world: World, t: RecipeTarget): EntityId =>
  Object.keys(world.details).find(
    (id) =>
      world.details[id].room === world.roomIds[refString(t.room)] &&
      world.details[id].key === t.detail,
  ) as EntityId;

/**
 * Why `actor` may not issue `payload` now, if it may not (04 §19; ACT-09): no action of its set
 * resolves to that Command and accepts its target and input (unsupported_capability), or for
 * perform a key that names no recipe of the cartridge or for accept_quest a quest it does not
 * declare (not_found), or none that does is available, its policy failing (invalid_state). Each
 * policy leaf it evaluates adds one to the decision's `steps` (04 §5.4 query_steps). Given the
 * invoked `action`, only that action of the set is matched. A projection may supply the already
 * composed `set` to reuse it across targets.
 */
import { visible } from '../mechanics/light/shared.ts';

export function refusal(
  world: World,
  payload: CommandPayload,
  steps: Steps,
  action?: Key,
  set?: ActionSet,
) {
  if (
    payload.type === 'wait' &&
    world.cartridge.manifest.time_policy &&
    !fighting(world, payload.actor_id)
  )
    return 'permission_denied';
  if (hiddenTarget(world, payload, steps)) return 'not_present';
  const perform = payload.type === 'perform';
  const actor = (payload as { actor_id: CharacterId }).actor_id;
  const matching = Object.values(set ?? resolved(world, actor)).filter(
    (a) =>
      (action === undefined || a.key === action) &&
      (perform ? a.recipe && a.key === payload.action : accepts(world, actor, a, payload, steps)),
  );
  const unknown =
    (perform && !recipeKeys(world).includes(payload.action)) ||
    (payload.type === 'accept_quest' && !world.cartridge.quests?.[refString(payload.quest)]);
  if (!matching.length)
    return unknown
      ? 'not_found'
      : fighting(world, actor)
        ? 'invalid_state'
        : 'unsupported_capability';
  const target = (a: Offered) =>
    a.recipe ? detailOf(world, a.recipe.target) : primaryTarget(payload);
  const ok = (a: Offered) =>
    (!a.recipe || visible(world, actor, detailOf(world, a.recipe.target), steps)) &&
    holds(world, actor, a.policy.root, { target: target(a), steps });
  return matching.some(ok) ? undefined : 'invalid_state';
}

const recipeKeys = (world: World) => Object.values(world.cartridge.recipes ?? {}).map((r) => r.key);

/**
 * A recipe's admission for `actor_id` acting through `body`, after its policy and target, shared
 * by the rule and the GameView: cooldown while the time since the actor's last admitted attempt
 * is below the recipe's cooldown (never overflows: 0 <= last <= now), then insufficient_resource
 * when the body cannot pay the costs (mechanics/resource.ts pay); else the paid ops and levels, the last
 * attempt's time and now. Read-only, before any draw.
 */
export function admission(
  world: World,
  recipe: ActionRecipe,
  actor_id: CharacterId,
  body: EntityId,
) {
  const from = world.state.clock;
  const last = world.state.cooldowns?.[key({ kind: 'cooldown', actor_id, action: recipe.key })];
  if (recipe.cooldown && last !== undefined && sub(from, last) < recipe.cooldown)
    return 'cooldown' as const;
  const paid = pay(world, body, recipe.costs ?? []);
  return paid ? { paid, last, from } : ('insufficient_resource' as const);
}

function hiddenTarget(world: World, payload: CommandPayload, steps: Steps) {
  const p = payload as { actor_id: CharacterId } & Partial<
    Record<
      'target_id' | 'item_id' | 'recipient_id' | 'container_id' | 'provider_id' | 'crow_id',
      EntityId
    >
  >;
  const ids = [p.target_id, p.item_id, p.recipient_id, p.container_id, p.provider_id, p.crow_id];
  if (payload.type === 'fill') ids.push(payload.source_id, payload.vessel_id);
  if (payload.type === 'pour') ids.push(payload.source_id, payload.receiver_id);
  if (payload.type === 'drink') ids.push(payload.vessel_id);
  return ids.some((id) => id && !visible(world, p.actor_id, id, steps));
}
