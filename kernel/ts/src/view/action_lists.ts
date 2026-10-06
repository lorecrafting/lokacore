// size: allow 325, exact light offers join existing item action projection
import * as light from '../mechanics/light/shared.ts';
import { harvest } from '../mechanics/containment/harvest.ts';
import { escapeDirections } from '../mechanics/combat/flee.ts';
// The GameView lists of an actor's ActionSet (commands/actions.ts resolved; 04 §14, §19; 00 §4.10).
import { LIMITS } from '../contracts.gen.ts';
import type {
  AdvertisedAction,
  CharacterId,
  CommandPayload,
  EntityId,
  ErrorCode,
  Key,
  TargetSpec,
} from '../contracts.gen.ts';
import { admission, detailOf, refusal, resolved, type Offered } from '../commands/actions.ts';
import { bodyOf, type World } from '../runtime/decision.ts';
import { MODAL, speaks, talkRefused } from '../mechanics/dialogue/shared.ts';
import { holds } from '../mechanics/policy.ts';
import * as barrier from '../mechanics/barrier/rule.ts';
import * as equipment from '../mechanics/equipment/rule.ts';
import * as position from '../mechanics/position/shared.ts';
import { cmp } from '../foundation/validate.ts';
import { carrying, giveRefused, putRefused } from '../mechanics/containment/shared.ts';
import { attackRefused, engaged } from '../mechanics/combat/shared.ts';
import { readRefused } from '../mechanics/readable/rule.ts';
import { KernelError } from '../foundation/error.ts';
import { reach } from '../mechanics/lookups.ts';

/**
 * The GameView lists of `actor`'s set: `listed(fits)` is each action that `fits` in presentation
 * order (highest priority first, then key), available when its policy holds and, for a recipe,
 * its admission passes, else shown with invalid_state or admission's code (00 §4.10); a talk in
 * step's order: invalid_state when its policy fails, not_found when its target speaks no
 * dialogue, invalid_state when talkRefused. A recipe is listed with the place while its detail is
 * in the actor's room. The door verbs (barrier@1) are listed not with the place but on an exit,
 * `door(direction)`, and on an item with a barrier (a container, c1-locks): only those step would
 * accept there now (refusal, then barrier.transition).
 * Likewise wear and remove (equipment@1) are listed on an item only when step would accept them
 * (refusal, then equipment.transfer), never with the place; `worn(id)` lists only those that
 * resolve to remove. The place never lists an action resolving to the verb of the actor's current
 * position (position@1), which step refuses invalid_state.
 */
// size: allow 60, one ActionSet projects item, worn light and exact-subject Notice offers
export function lists(world: World, actor: CharacterId, steps = { n: 0 }) {
  const set = resolved(world, actor);
  const at = position.positionOf(world, actor);
  const current = Object.keys(position.VERBS).find((v) => position.VERBS[v]![0] === at);
  const body = bodyOf(world, actor);
  const reachedItems = new Map<EntityId, boolean>();
  let carry: ReturnType<typeof carrying> | undefined;
  const take = (item: EntityId) => {
    if (!body || world.entities[item]?.kind !== 'item') return 'invalid_target' as const;
    if (world.state.containers[item] === body) return 'invalid_state' as const;
    const reached = reachedItems.get(item) ?? reach(world, body, item, steps);
    if (typeof reached === 'boolean') reachedItems.set(item, reached);
    if (typeof reached === 'string') return reached;
    if (!reached) return 'not_present' as const;
    carry ??= carrying(world, body, steps);
    return carry(item);
  };
  const here = (a: Offered) =>
    !a.recipe ||
    (world.details[detailOf(world, a.recipe.target)].room === world.state.containers[body!] &&
      light.visible(world, actor, detailOf(world, a.recipe.target), steps));
  const listed = (fits: (a: Offered) => boolean, id?: string, scope?: string) =>
    Object.values(set)
      .filter((a) => fits(a) && here(a) && a.command !== 'read' && !MODAL.includes(a.command))
      .filter((a) => movable(world, a, id))
      .filter((a) => combatOffered(world, body, a, id))
      .filter((a) => a.speaker === undefined || a.speaker === id)
      .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
      .flatMap((a) => {
        const shown = advertise(world, actor, a, take, steps, id, scope);
        return a.command === 'put' && id && body
          ? putPairs(world, body, id as EntityId, shown, steps)
          : [shown];
      });
  const readableRecipe = (a: Offered) =>
    !!a.recipe && !!world.details[detailOf(world, a.recipe.target)].readable;
  return {
    notice: (id: string) => listed((a) => noticeOffer(world, a, id), id, 'inspectable_details'),
    place: [
      ...listed(
        (a) =>
          a.target.kind === 'none' &&
          !readableRecipe(a) &&
          !door(a) &&
          !equip(a) &&
          a.command !== current,
      ),
      ...readActions(world, actor, set, steps),
    ].sort(
      (a, b) =>
        set[b.action_key].priority - set[a.action_key].priority || cmp(a.action_key, b.action_key),
    ),
    of: (scope: string, id: string, nested = false) =>
      listed((a) => entityOffered(world, actor, a, scope, id, nested), id, scope),
    worn: (id: string) => listed((a) => entityOffered(world, actor, a, 'worn', id, false), id),
    door: (direction: Key) => listed((a) => door(a) && usable(world, actor, a, { direction })),
  };
}

function entityOffered(
  world: World,
  actor: CharacterId,
  a: Offered,
  scope: string,
  id: string,
  nested: boolean,
) {
  if (scope === 'worn' && !light.VERBS.includes(a.command))
    return a.command === 'remove' && fits(world, actor, a, id);
  if (light.VERBS.includes(a.command))
    return (
      ['inventory', 'worn'].includes(scope) &&
      !nested &&
      typeof light.transition(
        world,
        actor,
        a.command,
        id as EntityId,
        a.command === 'refuel' ? light.refillSupply(world, actor, id) : undefined,
      ) !== 'string'
    );
  return door(a)
    ? lidded(world, id) && usable(world, actor, a, { target_id: id as EntityId })
    : nested
      ? !!a.engine && a.command === 'take'
      : a.target.kind === 'entity' &&
        a.target.scopes.includes(scope as never) &&
        (!equip(a) || fits(world, actor, a, id));
}

// `a` as listed for `actor` (on entity `id` in `scope`, if any): a door verb on an item is aimed
// at it, with the item's scope and no input, so target_ids [id] fills target_id (commands/invocation.ts).
// size: allow 52, exact detail harvest and refuel targets share action projection
function advertise(
  world: World,
  actor: CharacterId,
  a: Offered,
  take: (item: EntityId) => ErrorCode | undefined,
  steps: { n: number },
  id?: string,
  scope?: string,
): AdvertisedAction {
  const aimed = scope !== undefined && door(a);
  const patch = id && a.command === 'harvest' && world.details[id]?.harvest;
  const shown = {
    action_key: a.key,
    label: a.label,
    target: aimed ? ({ kind: 'entity', scopes: [scope] } as TargetSpec) : a.target,
    input: aimed ? [] : a.input,
    ...(id &&
      light.VERBS.includes(a.command) && {
        target_ids: [
          id as EntityId,
          ...(a.command === 'refuel' ? [light.refillSupply(world, actor, id)!] : []),
        ],
      }),
    ...(patch && { label: patch.label, target_ids: [id as EntityId] }),
  };
  const admitted = a.recipe && admission(world, a.recipe, actor, bodyOf(world, actor)!);
  // Step's order: the action's policy, then the talk rule's not_found and talkRefused.
  const target = (a.recipe ? detailOf(world, a.recipe.target) : id) as EntityId | undefined;
  const gathered =
    a.command === 'harvest' && target !== undefined
      ? harvest(world, actor, target, steps)
      : undefined;
  const talk =
    a.command === 'talk' &&
    (speaks(world, target) ? talkRefused(world, actor, target) && 'invalid_state' : 'not_found');
  const code = !holds(world, actor, a.policy.root, { target, steps: { n: 0 } })
    ? 'invalid_state'
    : talk ||
      (a.command === 'flee' && !escapeDirections(world, actor).length
        ? 'invalid_state'
        : undefined) ||
      (typeof admitted === 'string' ? admitted : undefined) ||
      (typeof gathered === 'string' ? gathered : undefined) ||
      (a.command === 'take' && target !== undefined ? take(target) : undefined) ||
      (a.command === 'give' && target !== undefined
        ? giveRefused(world, target, steps)
        : undefined) ||
      (a.command === 'attack' && target !== undefined
        ? attackRefused(world, actor, target)
        : undefined);
  return code ? { available: false, ...shown, reason: { code } } : { available: true, ...shown };
}

const door = (a: Offered) => Object.hasOwn(barrier.MOVES, a.command);
// Only an item with a barrier can take a door verb; skips usable's admission for every other entity.
const lidded = (world: World, id: string) => {
  const e = world.entities[id];
  return e?.kind === 'item' && e.barrier !== undefined;
};
// Never with the place: a targetless wear or remove is never accepted (its Command needs item_id).
const equip = (a: Offered) => equipment.VERBS.includes(a.command);

// True when step would accept equipment verb `a` by `actor` on `item` now: admission (refusal),
// then equipment@1's checks (equipment.transfer).
function fits(world: World, actor: CharacterId, a: Offered, item: string) {
  const payload = { type: a.command, item_id: item, actor_id: actor } as CommandPayload;
  return (
    !refusal(world, payload, { n: 0 }, a.key) &&
    typeof equipment.transfer(world, actor, a.command, item as EntityId) !== 'string'
  );
}

// True when step would accept door verb `a` by `actor` at `site` (an exit's direction or an
// item's id) now: admission (refusal), then barrier@1's checks (barrier.transition).
function usable(world: World, actor: CharacterId, a: Offered, site: barrier.Site) {
  const steps = { n: 0 };
  const payload = { type: a.command, ...site, actor_id: actor } as CommandPayload;
  return (
    !refusal(world, payload, steps, a.key) &&
    typeof barrier.transition(world, actor, a.command, site, steps) !== 'string'
  );
}

function movable(world: World, a: Offered, id?: string): boolean {
  return (
    !id ||
    !world.state.created?.[id] ||
    !['take', 'drop', 'give', 'wear', 'remove'].includes(a.command)
  );
}

function combatOffered(world: World, body: EntityId | undefined, a: Offered, id?: string) {
  if (a.command === 'move' && body && engaged(world, body)) return false;
  if (a.command === 'flee') return !!body && !!engaged(world, body);
  const entity = id && world.entities[id];
  return a.command !== 'attack' || (entity && entity.kind === 'npc' && !!entity.attack);
}

// Enumerate bounded concrete pairs; exhaustion replaces the whole source offer, never a prefix.
function putPairs(
  world: World,
  body: EntityId,
  item: EntityId,
  shown: AdvertisedAction,
  steps: { n: number },
): AdvertisedAction[] {
  if (world.state.containers[item] !== body) return [];
  const pairs: AdvertisedAction[] = [];
  for (const id in world.entities) {
    if (!Object.hasOwn(world.entities, id)) continue;
    if (++steps.n > LIMITS.query_steps)
      return [{ ...shown, available: false, reason: { code: 'budget_exceeded' } }];
    if (world.entities[id].kind !== 'item' || id === item) continue;
    const code = putRefused(world, body, item, id as EntityId, steps);
    if (code === 'budget_exceeded') return [{ ...shown, available: false, reason: { code } }];
    if (!code) pairs.push({ ...shown, target_ids: [item, id as EntityId] });
  }
  return pairs;
}

// ponytail: reuse the flat detail table used by target resolution; index only if measured.
function readActions(
  world: World,
  actor: CharacterId,
  set: ReturnType<typeof resolved>,
  steps: { n: number },
): AdvertisedAction[] {
  const actions = Object.values(set).filter(
    (a) =>
      a.command === 'read' &&
      a.target.kind === 'entity' &&
      a.target.scopes.includes('inspectable_details'),
  );
  if (!actions.length) return [];
  const result: AdvertisedAction[] = [];
  for (const id in world.details) {
    if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
    const target_id = id as EntityId;
    if (readRefused(world, actor, target_id) || !light.visible(world, actor, target_id, steps))
      continue;
    for (const a of actions) {
      if (result.length >= LIMITS.selector_cardinality) throw new KernelError('budget_exceeded');
      const code = refusal(world, { type: 'read', actor_id: actor, target_id }, steps, a.key, set);
      const shown = {
        action_key: a.key,
        label: world.details[id].readable!.label,
        target: a.target,
        input: a.input,
        target_ids: [target_id],
      };
      result.push(
        code ? { ...shown, available: false, reason: { code } } : { ...shown, available: true },
      );
    }
  }
  return result;
}

function noticeOffer(world: World, a: Offered, id: string) {
  return (
    (a.command === 'harvest' && !!world.details[id]?.harvest) ||
    !!(
      a.recipe &&
      world.details[detailOf(world, a.recipe.target)]?.readable &&
      detailOf(world, a.recipe.target) === id
    )
  );
}
