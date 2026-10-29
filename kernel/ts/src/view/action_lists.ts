// size: allow 350, food, water, practical skills, local Knock, G7 get locks and row 33 theft and the row FD7 ask share the composed view list; the viewer is threaded (loka-kgd.150.5)
import { aimedRefused, craftRefused, policyRefusal } from '../mechanics/action_recipe/shared.ts';
import { running as modalScene } from '../mechanics/scene/shared.ts';
import { foodActions } from './food.ts';
import { useActions } from './use.ts';
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
  NpcDefinition,
  TargetSpec,
} from '../contracts.gen.ts';
import { admission, detailAt, refusal, resolved, type Offered } from '../commands/actions.ts';
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';
import { MODAL, speaks, talkRefused } from '../mechanics/dialogue/shared.ts';
import { holds } from '../mechanics/policy.ts';
import * as barrier from '../mechanics/barrier/rule.ts';
import * as equipment from '../mechanics/equipment/rule.ts';
import * as position from '../mechanics/position/shared.ts';
import { cmp } from '../foundation/validate.ts';
import { carrying, giveRefused } from '../mechanics/containment/shared.ts';
import { unpaid } from '../mechanics/resource.ts';
import { itemPairs } from './item_pairs.ts';
import { theftRefused } from '../mechanics/containment/theft.ts';
import { movable as movableItem } from '../runtime/created.ts';
import { attackRefused } from '../mechanics/combat/shared.ts';
import { askRefused } from '../mechanics/speech/ask.ts';
import { combatOffered } from './combat.ts';
import * as expedition from '../mechanics/expedition/shared.ts';
import { reach } from '../mechanics/lookups.ts';
import { chainRefused } from '../mechanics/locks.ts';

// Shared query context projects exact offers in priority/key order. Recipes bind their detail (a
// use recipe, row G4, lists only its pairs on the held tool, view/use.ts);
// door/equipment/light/food helpers use the same admission as their command rules.
// An actor's current position is not offered again.
const HIDDEN = [
  'where',
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
const hidden = (world: World, actor: CharacterId, a: Offered) =>
  HIDDEN.includes(a.command) || (a.command === 'continue' && !modalScene(world, actor));
// size: allow 60, one composed ActionSet/query context projects item and exact-subject Notice offers
export function lists(world: World, actor: CharacterId, steps = { n: 0 }) {
  const set = resolved(world, actor);
  const at = position.positionOf(world, actor);
  const current = Object.keys(position.VERBS).find((v) => position.VERBS[v]![0] === at);
  const body = bodyOf(world, actor);
  const take = takeAdmission(world, actor, body, steps);
  const here = (a: Offered, d = detailAt(world, a)) =>
    [undefined, 'spell'].includes(a.recipe?.target.kind) ||
    (d !== undefined &&
      world.details[d].room === world.state.containers[body!] &&
      light.visible(world, actor, d, steps));
  const listed = (fits: (a: Offered) => boolean, id?: string, scope?: string) =>
    Object.values(set)
      .filter((a) => fits(a) && here(a) && !hidden(world, actor, a))
      .filter((a) => movable(world, a, id) && combatOffered(world, actor, body, a, id))
      .filter((a) => a.speaker === undefined || a.speaker === id)
      .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
      .flatMap((a) => {
        const shown = advertise(world, actor, a, take, steps, id, scope);
        return id && body
          ? itemPairs(world, actor, body, id as EntityId, a.command, shown, steps)
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
        useActions(world, actor, id, set, steps),
        bandageActions(world, actor, id, set, steps),
        readActions(world, actor, set, steps, id as EntityId),
      ),
    worn: (id: string) =>
      listed((a) => entityOffered(world, actor, a, 'worn', id, false, steps), id).concat(
        liquid(id),
        useActions(world, actor, id, set, steps),
      ),
    door: (direction: Key) => listed((a) => door(a) && usable(world, actor, a, { direction })),
  };
}

function takeAdmission(world: World, actor: CharacterId, body: EntityId | undefined, steps: Steps) {
  // Each item's reach and get-walk verdict, kept so a later budget fault does not undo it.
  const admitted = new Map<EntityId, boolean | 'permission_denied'>();
  let carry: ReturnType<typeof carrying> | undefined;
  return (item: EntityId) => {
    if (!body || world.entities[item]?.kind !== 'item') return 'invalid_target' as const;
    if (world.state.containers[item] === body) return 'invalid_state' as const;
    let reached = admitted.get(item) ?? reach(world, body, item, steps);
    if (reached === true && !admitted.has(item))
      reached = chainRefused(world, actor, item, 'get', steps) ?? true;
    if (typeof reached === 'boolean' || reached === 'permission_denied')
      admitted.set(item, reached);
    if (typeof reached === 'string') return reached;
    if (!reached) return theftRefused(world, actor, body, item, steps); // the take rule's twin
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
    return a.command === 'cast' // an aimed spell at the light slot's lantern (loka-x6t.109)
      ? !!a.recipe && !aimedRefused(world, actor, a.recipe, id, steps)
      : a.command === 'remove' && (fits(world, actor, a, id) || !!heldOn(world, actor, a, id));
  if (light.VERBS.includes(a.command))
    return (
      ['inventory', 'worn'].includes(scope) &&
      !nested &&
      lightOffered(world, actor, a, id as EntityId, steps)
    );
  return door(a)
    ? a.command !== 'knock' &&
        lidded(world, id) &&
        usable(world, actor, a, { target_id: id as EntityId })
    : nested
      ? !!a.engine && a.command === 'take'
      : a.target.kind === 'entity' &&
        a.target.scopes.includes(scope as never) &&
        (!equip(a) || fits(world, actor, a, id)) &&
        (a.command !== 'ask' || !!(world.entities[id] as NpcDefinition | undefined)?.ask) && // row FD7
        !aimedRefused(world, actor, a.recipe, id, steps);
}

const commanded = (a: Offered) =>
  [...light.VERBS, 'harvest', 'expedition'].includes(a.command) ||
  (a.command === 'cast' && !!a.recipe);

// `a` as listed for `actor` (on entity `id` in `scope`, if any): a door verb on an item is aimed
// at it, with the item's scope and no input, so target_ids [id] fills target_id (commands/invocation.ts).
// size: allow 60, exact detail harvest, the row FD7 ask and a recipe's reason (loka-j64e, pass-1 R1) join shared action admission and projection
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
  const target_ids = targetsFor(world, actor, a, id);
  const shown = {
    action_key: a.key,
    ...(commanded(a) && { command: a.command }),
    label: patch && !a.input.includes('method') ? patch.label : worded(world, a, id),
    target: aimed ? ({ kind: 'entity', scopes: [scope] } as TargetSpec) : a.target,
    input: aimed ? [] : a.input,
    ...(target_ids && { target_ids }),
    ...(patch && { target_ids: [id as EntityId] }),
  };
  const admitted = a.recipe && admission(world, a.recipe, actor, bodyOf(world, actor)!);
  const target = (a.recipe && a.command !== 'cast' ? detailAt(world, a) : id) as
    EntityId | undefined;
  const gathered = harvestOffered(world, actor, a, target, steps);
  const excursion = expedition.actionRefused(world, actor, a, target);
  const talk =
    a.command === 'talk' &&
    (speaks(world, target)
      ? talkRefused(world, actor, target, a.dialogue, steps) && 'invalid_state'
      : 'not_found');
  const refused = holds(world, actor, a.policy?.root, { target, steps })
    ? (heldOn(world, actor, a, target) ?? craftRefused(world, a.recipe, actor, steps)) // hs-10
    : policyRefusal(a.recipe); // the command's refusal of a failed policy, with its reason
  const code =
    refused?.code ??
    (talk ||
      (a.command === 'flee' && !escapeDirections(world, actor).length
        ? 'invalid_state'
        : undefined) ||
      (typeof admitted === 'string' ? admitted : undefined) ||
      (typeof gathered === 'string' ? gathered : undefined) ||
      excursion ||
      (a.command === 'take' && target !== undefined ? take(target) : undefined) ||
      (a.command === 'give' && target !== undefined
        ? giveRefused(world, target, steps)
        : undefined) ||
      (a.command === 'attack' && target !== undefined
        ? attackRefused(world, actor, target)
        : undefined) ||
      (a.command === 'ask' && target !== undefined
        ? askRefused(world, actor, target, steps)
        : undefined));
  // The unpaid cost names itself (pass-1 R1); an authored refusal wins.
  const short = unpaid(world, bodyOf(world, actor)!, admitted, a.recipe?.costs ?? []);
  return code
    ? { available: false, ...shown, reason: refused ?? { code, ...short } }
    : { available: true, ...shown };
}

function harvestOffered(
  world: World,
  actor: CharacterId,
  a: Offered,
  target: EntityId | undefined,
  steps: Steps,
) {
  if (a.command !== 'harvest' || target === undefined) return;
  const method = a.input.includes('method') ? ('careful' as const) : undefined;
  const code = refusal(
    world,
    { type: 'harvest', actor_id: actor, target_id: target, ...(method && { method }) },
    steps,
    a.key,
  );
  return code ?? harvest(world, actor, target, steps, method);
}

const door = (a: Offered) => a.command === 'knock' || Object.hasOwn(barrier.MOVES, a.command);
// Only an item with a barrier can take a door verb; skips usable's admission for every other entity.
const lidded = (world: World, id: string) => {
  const e = world.entities[id];
  return e?.kind === 'item' && e.barrier !== undefined;
};
// Never with the place: a targetless wear or remove is never accepted (its Command needs item_id).
const equip = (a: Offered) => equipment.VERBS.includes(a.command);
// Row 6a: an item's authored Wear or Remove label, else the engine's action.<verb>.
const worded = (world: World, a: Offered, id?: string) => {
  const e = id === undefined ? undefined : world.entities[id];
  return (a.engine && e?.kind === 'item' && e.equip?.[a.command as 'wear' | 'remove']) || a.label;
};
// Why step would refuse equipment verb `a` by `actor` on `item` now, else undefined: admission
// (refusal), then equipment@1's checks (equipment.transfer).
function equipRefused(world: World, actor: CharacterId, a: Offered, item: string) {
  const payload = { type: a.command, item_id: item, actor_id: actor } as CommandPayload;
  const t =
    refusal(world, payload, { n: 0 }, a.key) ??
    equipment.transfer(world, actor, a.command, item as EntityId);
  return Array.isArray(t) ? undefined : t;
}
const fits = (world: World, actor: CharacterId, a: Offered, item: string) =>
  !equipRefused(world, actor, a, item);
// The curse holding a worn item on (mechanics.md Held on): its Remove stays listed with it (loka-x6t.38).
function heldOn(world: World, actor: CharacterId, a: Offered, item?: string) {
  const r = a.command === 'remove' && item !== undefined && equipRefused(world, actor, a, item);
  return typeof r === 'object' && r.cause === 'cursed' ? r : undefined;
}

// True when step would accept door verb `a` by `actor` at `site` (an exit's direction or an
// item's id) now: admission (refusal), then barrier@1's checks (barrier.transition).
function usable(world: World, actor: CharacterId, a: Offered, site: barrier.Site) {
  const steps = { n: 0 };
  const payload = { type: a.command, ...site, actor_id: actor } as CommandPayload;
  return (
    !refusal(world, payload, steps, a.key) &&
    typeof (a.command === 'knock'
      ? barrier.knock(world, actor, site.direction!)
      : barrier.transition(world, actor, a.command, site, steps)) !== 'string'
  );
}

function movable(world: World, a: Offered, id?: string): boolean {
  return (
    !id ||
    movableItem(world, id as EntityId) ||
    !['take', 'drop', 'give', 'wear', 'remove'].includes(a.command)
  );
}

function noticeOffer(world: World, a: Offered, id: string) {
  return (
    (a.command === 'expedition' && expedition.atDetail(world, id)) ||
    (a.command === 'harvest' &&
      !!world.details[id]?.harvest &&
      (!a.input.includes('method') || world.details[id]?.harvest?.careful?.action === a.key)) ||
    detailAt(world, a) === id
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

function targetsFor(world: World, actor: CharacterId, a: Offered, id?: string) {
  if ((a.command === 'expedition' || a.command === 'cast') && id) return [id as EntityId];
  return id && light.VERBS.includes(a.command)
    ? [id as EntityId, ...(a.command === 'refuel' ? [light.refillSupply(world, actor, id)!] : [])]
    : undefined;
}

// A recipe aimed at a detail is its NoticeView's card only (loka-x6t.120).
const detailRecipe = (world: World, a: Offered) => detailAt(world, a) !== undefined;
