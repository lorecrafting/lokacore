// The ActionSet algebra (06 §19; ADR-016; action.schema.json ActionContribution): an actor's
// actions are the contributions of its sources composed by stable action key, then each
// action's policy is evaluated for the actor and the lists are sorted for the GameView (04 §14,
// §19). Sources today, in this order: the engine verbs of the capabilities the cartridge locks
// (union), the cartridge's actions and recipes (override: a cartridge may redefine a verb), and
// the actor's room's contributions (each with its authored op). Later sources (equipment, status
// effects, skills, quest grants, scripts, modal state) are further contributions in this order.
import {
  CAPABILITY_OWNERS,
  type ActionContribution,
  type ActionInputParameter,
  type ActionRecipe,
  type AdvertisedAction,
  type CharacterId,
  type CommandPayload,
  type EntityId,
  type ErrorCode,
  type Key,
  type RecipeTarget,
  type TargetSpec,
  type TextKey,
  type VersionedPolicy,
} from './contracts.gen.ts';
import { bodyOf, refString, type World } from './decision.ts';
import { holds } from './policy.ts';
import { cmp } from './validate.ts';

/**
 * One action of a set: what the GameView advertises, the Command type it resolves to, the
 * recipe when it is one (whose invocation needs no target: the recipe names its own), and
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

const ALWAYS: VersionedPolicy = { policy_version: 1, root: { op: 'all', items: [] } };
const entity = (scope: 'room_contents' | 'inventory'): TargetSpec => ({
  kind: 'entity',
  scopes: [scope],
});
// ponytail: every engine verb has priority 0, so they list in key order; give them priorities
// when a host's presentation needs one first. ponytail: this table names other capabilities'
// verbs (schedule's wait joined in R5 S6, per the brief); each verb's target and input move onto
// its command's registry entry when dialogue's talk lands, and that slice decides how choose and
// close_choice (answers to a pending choice, not ActionSet actions) pass admission.
const VERBS: Readonly<Record<string, [TargetSpec, ActionInputParameter[]]>> = {
  look: [{ kind: 'none' }, []],
  move: [{ kind: 'none' }, ['direction']],
  take: [entity('room_contents'), []],
  drop: [entity('inventory'), []],
  give: [entity('inventory'), []],
  wait: [{ kind: 'none' }, ['until']],
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

// The cartridge's actions and recipes by key: disjoint, since the compiler and the loader reject
// a recipe whose key is an action's or a registered command's (DUPLICATE_DEFINITION), so no key
// has two definitions here.
function cartridge(world: World): ActionSet {
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
  return Object.fromEntries([...actions, ...recipes]);
}

/** `actor`'s ActionSet before any policy is evaluated: every source composed, in order. */
export function resolved(world: World, actor: CharacterId): ActionSet {
  const [verbs, own] = [engine(world), cartridge(world)];
  const all = { ...verbs, ...own };
  const body = bodyOf(world, actor);
  const room = body === undefined ? undefined : world.rooms[world.state.containers[body]];
  return (room?.actions ?? []).reduce(
    (set, c) =>
      apply(
        set,
        c.op,
        Object.fromEntries(c.actions.filter((k) => Object.hasOwn(all, k)).map((k) => [k, all[k]])),
      ),
    apply(apply({}, 'union', verbs), 'override', own),
  );
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
 * perform a key that names no recipe of the cartridge (not_found), or none that does is
 * available, its policy failing (invalid_state).
 */
export function refusal(world: World, payload: CommandPayload): ErrorCode | undefined {
  const perform = payload.type === 'perform';
  const actor = (payload as { actor_id: CharacterId }).actor_id;
  const matching = Object.values(resolved(world, actor)).filter((a) =>
    perform ? a.recipe && a.key === payload.action : accepts(world, actor, a, payload),
  );
  if (!matching.length)
    return perform && !recipeKeys(world).includes(payload.action)
      ? 'not_found'
      : 'unsupported_capability';
  return matching.some((a) => holds(world, actor, a.policy.root)) ? undefined : 'invalid_state';
}

const recipeKeys = (world: World) => Object.values(world.cartridge.recipes ?? {}).map((r) => r.key);

// Payload fields that are ActionInput parameters (action.schema.json ActionInput).
const INPUTS: readonly string[] = ['direction', 'choice_id', 'continuation_id', 'until'];

/**
 * True when action `a` resolves to `payload`'s Command and accepts its target and input. An
 * engine verb's contract is its rule, which re-validates the target with typed codes (a held
 * item's take is invalid_state, not refused here). Another action's is its TargetSpec: none
 * takes no target id, an entity one the id (target_id or item_id) of an entity in one of its
 * scopes for the actor (a room's detail is in none); and its input lists exactly the payload's
 * input parameters.
 */
function accepts(world: World, actor: CharacterId, a: Offered, payload: CommandPayload): boolean {
  if (a.command !== payload.type) return false;
  if (a.engine) return true;
  const p = payload as { target_id?: EntityId; item_id?: EntityId };
  const id = p.target_id ?? p.item_id;
  const inputs = Object.keys(payload).filter((k) => INPUTS.includes(k));
  if (inputs.length !== a.input.length || !a.input.every((i) => inputs.includes(i))) return false;
  if (a.target.kind === 'none') return id === undefined;
  const body = bodyOf(world, actor);
  const at = id === undefined ? undefined : world.state.containers[id];
  const kind = id === undefined ? undefined : world.entities[id]?.kind;
  const scope = {
    self: id !== undefined && id === body,
    inventory: at !== undefined && at === body,
    room_contents: kind === 'item' && at === world.state.containers[body!],
    room_occupants: kind === 'npc' && at === world.state.containers[body!],
  };
  return a.target.scopes.some((s) => scope[s]);
}

/**
 * The GameView lists of `actor`'s set: `listed(fits)` is each action that `fits` in presentation
 * order (highest priority first, then key), available when its policy holds, else shown with
 * invalid_state (00 §4.10). A recipe is listed with the place while its detail is in the actor's
 * room.
 */
export function lists(world: World, actor: CharacterId) {
  const set = resolved(world, actor);
  const body = bodyOf(world, actor);
  const here = (a: Offered) =>
    !a.recipe ||
    world.details[detailOf(world, a.recipe.target)].room === world.state.containers[body!];
  const advertise = (a: Offered): AdvertisedAction => {
    const shown = { action_key: a.key, label: a.label, target: a.target, input: a.input };
    return holds(world, actor, a.policy.root)
      ? { available: true, ...shown }
      : { available: false, ...shown, reason: { code: 'invalid_state' } };
  };
  const listed = (fits: (t: TargetSpec) => boolean) =>
    Object.values(set)
      .filter((a) => fits(a.target) && here(a))
      .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
      .map(advertise);
  return {
    place: listed((t) => t.kind === 'none'),
    of: (scope: string) => listed((t) => t.kind === 'entity' && t.scopes.includes(scope as never)),
  };
}
