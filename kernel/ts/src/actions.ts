// The ActionSet algebra (06 §19; ADR-016; action.schema.json ActionContribution): an actor's
// actions are the contributions of its sources composed by stable action key, then each
// action's policy is evaluated for the actor and the lists are sorted for the GameView (04 §14,
// §19). Sources today, in this order: the engine verbs of the capabilities the cartridge locks
// (union), the cartridge's actions, recipes and quest offers (override: a cartridge may redefine a
// verb), and
// the actor's room's contributions (each with its authored op). Later sources (equipment, status
// effects, skills, quest grants, scripts, modal state) are further contributions in this order.
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
} from './contracts.gen.ts';
import { key, same } from './compose.ts';
import { bodyOf, refString, type Steps, type World } from './decision.ts';
import { questOf } from './lookups.ts';
import { ALWAYS, modal, talks } from './dialogue.ts';
import { sub } from './int.ts';
import { pay } from './resource.ts';
import { wornIn } from './rules/equipment.ts';
import * as scene from './scene.ts';
import { holds } from './policy.ts';

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

const entity = (scope: 'room_contents' | 'inventory'): TargetSpec => ({
  kind: 'entity',
  scopes: [scope],
});
// ponytail: every engine verb has priority 0, so they list in key order; give them priorities
// when a host's presentation needs one first. ponytail: this table names other capabilities'
// verbs (schedule's wait joined in R5 S6, barrier's open, close, lock and unlock in S7,
// movement's scan in S8, per the briefs); each verb's target and input move onto its command's
// registry entry when a second capability contributes a verb outside VERBS (dialogue's talk,
// choose and close_choice come from dialogue.ts).
const VERBS: Readonly<Record<string, [TargetSpec, ActionInputParameter[]]>> = {
  look: [{ kind: 'none' }, []],
  move: [{ kind: 'none' }, ['direction']],
  scan: [{ kind: 'none' }, []],
  take: [entity('room_contents'), []],
  drop: [entity('inventory'), []],
  give: [entity('inventory'), []],
  wait: [{ kind: 'none' }, ['until']],
  open: [{ kind: 'none' }, ['direction']],
  close: [{ kind: 'none' }, ['direction']],
  lock: [{ kind: 'none' }, ['direction']],
  unlock: [{ kind: 'none' }, ['direction']],
  wear: [entity('inventory'), []],
  remove: [entity('inventory'), []],
  stand: [{ kind: 'none' }, []],
  sit: [{ kind: 'none' }, []],
  rest: [{ kind: 'none' }, []],
  sleep: [{ kind: 'none' }, []],
};

// The engine verbs whose owning capability the cartridge locks, labelled action.<verb>.
function engine(world: World): ActionSet {
  const locked = (verb: string) =>
    Object.hasOwn(world.cartridge.lock.capabilities, CAPABILITY_OWNERS.command[verb].split('@')[0]);
  return Object.fromEntries(
    Object.entries(VERBS)
      .filter(([verb]) => locked(verb))
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
 * answers to a pending choice (modal state, dialogue.ts modal; 06 §37: no room contribution
 * removes them, so the actor is never trapped), which the GameView never lists (lists).
 */
export function resolved(world: World, actor: CharacterId): ActionSet {
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
 * invoked `action`, only that action of the set is matched.
 */
export function refusal(world: World, payload: CommandPayload, steps: Steps, action?: Key) {
  const perform = payload.type === 'perform';
  const actor = (payload as { actor_id: CharacterId }).actor_id;
  const matching = Object.values(resolved(world, actor)).filter(
    (a) =>
      (action === undefined || a.key === action) &&
      (perform ? a.recipe && a.key === payload.action : accepts(world, actor, a, payload)),
  );
  const unknown =
    (perform && !recipeKeys(world).includes(payload.action)) ||
    (payload.type === 'accept_quest' && !world.cartridge.quests?.[refString(payload.quest)]);
  if (!matching.length) return unknown ? 'not_found' : 'unsupported_capability';
  const p = payload as { target_id?: EntityId; item_id?: EntityId };
  const target = (a: Offered) =>
    a.recipe ? detailOf(world, a.recipe.target) : (p.target_id ?? p.item_id);
  const ok = (a: Offered) => holds(world, actor, a.policy.root, { target: target(a), steps });
  return matching.some(ok) ? undefined : 'invalid_state';
}

const recipeKeys = (world: World) => Object.values(world.cartridge.recipes ?? {}).map((r) => r.key);

// Payload fields that are ActionInput parameters (action.schema.json ActionInput).
const INPUTS: readonly string[] = ['direction', 'choice_id', 'continuation_id', 'until'];

/**
 * True when action `a` resolves to `payload`'s Command and accepts its target and input. An
 * engine verb's contract is its rule, which re-validates the target with typed codes (a held
 * item's take is invalid_state, not refused here). Another action's is its TargetSpec: none
 * takes no target id, an entity one the id (target_id or item_id) of an entity in one of its
 * scopes for the actor (a room's detail is in none; a worn item is in inventory for an action
 * resolving to remove, equipment@1); and its input lists exactly the payload's
 * input parameters. accept_quest resolves only through the offer of the quest it names (an
 * action of the cartridge's with command accept_quest names no quest, so it never does), a talk
 * only to its dialogue's speaker, and close_choice only through the close_choice of the pending
 * continuation it names.
 */
function accepts(world: World, actor: CharacterId, a: Offered, payload: CommandPayload): boolean {
  if (a.command !== payload.type) return false;
  if (payload.type === 'accept_quest') return a.quest !== undefined && same(a.quest, payload.quest);
  if (payload.type === 'close_choice') return payload.continuation_id === a.continuation;
  if (a.engine) return true;
  const p = payload as { target_id?: EntityId; item_id?: EntityId };
  const id = p.target_id ?? p.item_id;
  if (a.speaker !== undefined && id !== a.speaker) return false;
  const inputs = Object.keys(payload).filter((k) => INPUTS.includes(k));
  if (inputs.length !== a.input.length || !a.input.every((i) => inputs.includes(i))) return false;
  if (a.target.kind === 'none') return id === undefined;
  const body = bodyOf(world, actor);
  const at = id === undefined ? undefined : world.state.containers[id];
  const kind = id === undefined ? undefined : world.entities[id]?.kind;
  const scope = {
    self: id !== undefined && id === body,
    inventory:
      at !== undefined && (at === body || (a.command === 'remove' && wornIn(world, at, body))),
    room_contents: kind === 'item' && at === world.state.containers[body!],
    room_occupants: kind === 'npc' && at === world.state.containers[body!],
  };
  return a.target.scopes.some((s) => scope[s]);
}

/**
 * A recipe's admission for `actor_id` acting through `body`, after its policy and target, shared
 * by the rule and the GameView: cooldown while the time since the actor's last admitted attempt
 * is below the recipe's cooldown (never overflows: 0 <= last <= now), then insufficient_resource
 * when the body cannot pay the costs (resource.ts pay); else the paid ops and levels, the last
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
