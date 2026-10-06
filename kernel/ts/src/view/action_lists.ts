// size: allow 325, food, water, and practical skill offers share the composed view list
import { running as modalScene } from '../mechanics/scene/shared.ts';
import { foodActions } from './food.ts';
import { bandageActions } from './bleed.ts';
import { liquidActions } from './liquid.ts';
import { readActions } from './read_actions.ts';
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
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';
import { MODAL, speaks, talkRefused } from '../mechanics/dialogue/shared.ts';
import { holds } from '../mechanics/policy.ts';
import * as barrier from '../mechanics/barrier/rule.ts';
import * as equipment from '../mechanics/equipment/rule.ts';
import * as position from '../mechanics/position/shared.ts';
import { cmp } from '../foundation/validate.ts';
import { carrying, giveRefused, putRefused } from '../mechanics/containment/shared.ts';
import { movable as movableItem } from '../runtime/created.ts';
import { attackRefused, engaged } from '../mechanics/combat/shared.ts';
import { shooRefused } from '../mechanics/crow/behavior.ts';
import { reach } from '../mechanics/lookups.ts';

// Shared query context projects exact offers in priority/key order. Recipes bind their detail;
// door/equipment/light/food helpers use the same admission as their command rules.
// An actor's current position is not offered again.
const HIDDEN = [
  'recover_corpse',
  'eat',
  'bandage',
  'buy',
  'sell',
  'use_service',
  'read',
  'fill',
  'pour',
  'drink',
  ...MODAL,
];
// size: allow 60, one composed ActionSet/query context projects item and exact-subject Notice offers
export function lists(world: World, actor: CharacterId, steps = { n: 0 }) {
  const set = resolved(world, actor);
  const at = position.positionOf(world, actor);
  const current = Object.keys(position.VERBS).find((v) => position.VERBS[v]![0] === at);
  const body = bodyOf(world, actor);
  const take = takeAdmission(world, body, steps);
  const here = (a: Offered) =>
    !a.recipe ||
    (world.details[detailOf(world, a.recipe.target)].room === world.state.containers[body!] &&
      light.visible(world, actor, detailOf(world, a.recipe.target), steps));
  const hidden = (a: Offered) =>
    HIDDEN.includes(a.command) || (a.command === 'continue' && !modalScene(world, actor));
  const listed = (fits: (a: Offered) => boolean, id?: string, scope?: string) =>
    Object.values(set)
      .filter((a) => fits(a) && here(a) && !hidden(a))
      .filter((a) => movable(world, a, id))
      .filter((a) => combatOffered(world, actor, body, a, id))
      .filter((a) => a.speaker === undefined || a.speaker === id)
      .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
      .flatMap((a) => {
        const shown = advertise(world, actor, a, take, steps, id, scope);
        return a.command === 'put' && id && body
          ? putPairs(world, body, id as EntityId, shown, steps)
          : [shown];
      });
  const liquid = (id: string) => liquidActions(world, actor, id, set, steps);
  return {
    notice: (id: string) =>
      listed((a) => noticeOffer(world, a, id), id, 'inspectable_details').concat(liquid(id)),
    place: [
      ...listed(
        (a) =>
          a.target.kind === 'none' &&
          !detailRecipe(world, a) &&
          !door(a) &&
          !equip(a) &&
          !light.VERBS.includes(a.command) &&
          a.command !== current,
      ),
      ...readActions(world, actor, set, steps),
    ].sort(
      (a, b) =>
        set[b.action_key].priority - set[a.action_key].priority || cmp(a.action_key, b.action_key),
    ),
    of: (scope: string, id: string, nested = false) =>
      listed((a) => entityOffered(world, actor, a, scope, id, nested, steps), id, scope).concat(
        liquid(id),
        foodActions(world, actor, id, set, steps),
        bandageActions(world, actor, id, set, steps),
        readActions(world, actor, set, steps, id as EntityId),
      ),
    worn: (id: string) =>
      listed((a) => entityOffered(world, actor, a, 'worn', id, false, steps), id).concat(
        liquid(id),
      ),
    door: (direction: Key) => listed((a) => door(a) && usable(world, actor, a, { direction })),
  };
}

function takeAdmission(world: World, body: EntityId | undefined, steps: { n: number }) {
  const reachedItems = new Map<EntityId, boolean>();
  let carry: ReturnType<typeof carrying> | undefined;
  return (item: EntityId) => {
    if (!body || world.entities[item]?.kind !== 'item') return 'invalid_target' as const;
    if (world.state.containers[item] === body) return 'invalid_state' as const;
    const reached = reachedItems.get(item) ?? reach(world, body, item, steps);
    if (typeof reached === 'boolean') reachedItems.set(item, reached);
    if (typeof reached === 'string') return reached;
    if (!reached) return 'not_present' as const;
    carry ??= carrying(world, body, steps);
    return carry(item);
  };
}

function entityOffered(
  world: World,
  actor: CharacterId,
  a: Offered,
  scope: string,
  id: string,
  nested: boolean,
  steps: Steps,
) {
  if (scope === 'worn' && !light.VERBS.includes(a.command))
    return a.command === 'remove' && fits(world, actor, a, id);
  if (light.VERBS.includes(a.command))
    return (
      ['inventory', 'worn'].includes(scope) &&
      !nested &&
      lightOffered(world, actor, a, id as EntityId, steps)
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
// size: allow 50, exact detail harvest joins shared action admission and projection
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
  const target_ids = lightTargets(world, actor, a, id);
  const shown = {
    action_key: a.key,
    ...((light.VERBS.includes(a.command) || a.command === 'harvest') && { command: a.command }),
    label: patch && !a.input.includes('method') ? patch.label : a.label,
    target: aimed ? ({ kind: 'entity', scopes: [scope] } as TargetSpec) : a.target,
    input: aimed ? [] : a.input,
    ...(target_ids && { target_ids }),
    ...(patch && { target_ids: [id as EntityId] }),
  };
  const admitted = a.recipe && admission(world, a.recipe, actor, bodyOf(world, actor)!);
  // Step's order: the action's policy, then the talk rule's not_found and talkRefused.
  const target = (a.recipe ? detailOf(world, a.recipe.target) : id) as EntityId | undefined;
  const gathered =
    a.command === 'harvest' && target !== undefined
      ? harvestOffered(world, actor, a, target, steps)
      : undefined;
  const talk =
    a.command === 'talk' &&
    (speaks(world, target)
      ? talkRefused(world, actor, target, a.dialogue, steps) && 'invalid_state'
      : 'not_found');
  const code = !holds(world, actor, a.policy.root, { target, steps })
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

function harvestOffered(
  world: World,
  actor: CharacterId,
  a: Offered,
  target: EntityId,
  steps: Steps,
) {
  const method = a.input.includes('method') ? ('careful' as const) : undefined;
  const code = refusal(
    world,
    { type: 'harvest', actor_id: actor, target_id: target, ...(method && { method }) },
    steps,
    a.key,
  );
  return code ?? harvest(world, actor, target, steps, method);
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
    movableItem(world, id as EntityId) ||
    !['take', 'drop', 'give', 'wear', 'remove'].includes(a.command)
  );
}

function combatOffered(
  world: World,
  actor: CharacterId,
  body: EntityId | undefined,
  a: Offered,
  id?: string,
) {
  if (a.command === 'move' && body && engaged(world, body)) return false;
  if (a.command === 'flee') return !!body && !!engaged(world, body);
  if (a.command === 'shoo') return !!id && !shooRefused(world, actor, id as EntityId);
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

function noticeOffer(world: World, a: Offered, id: string) {
  return (
    (a.command === 'harvest' &&
      !!world.details[id]?.harvest &&
      (!a.input.includes('method') || world.details[id]?.harvest?.careful?.action === a.key)) ||
    !!(
      a.recipe &&
      (world.details[detailOf(world, a.recipe.target)]?.readable ||
        world.details[detailOf(world, a.recipe.target)]?.perception) &&
      detailOf(world, a.recipe.target) === id
    )
  );
}

function lightOffered(world: World, actor: CharacterId, a: Offered, item: EntityId, steps: Steps) {
  const supply = a.command === 'refuel' ? light.sourceSupply(world, item) : undefined;
  const payload = {
    type: a.command,
    actor_id: actor,
    item_id: item,
    ...(supply && { supply_id: supply }),
  } as CommandPayload;
  return (
    !refusal(world, payload, steps, a.key) &&
    typeof light.transition(world, actor, a.command, item, supply) !== 'string'
  );
}

function lightTargets(world: World, actor: CharacterId, a: Offered, id?: string) {
  return id && light.VERBS.includes(a.command)
    ? [id as EntityId, ...(a.command === 'refuel' ? [light.refillSupply(world, actor, id)!] : [])]
    : undefined;
}

const detailRecipe = (world: World, a: Offered) => {
  const detail = a.recipe && world.details[detailOf(world, a.recipe.target)];
  return !!detail && !!(detail.readable || detail.perception);
};
