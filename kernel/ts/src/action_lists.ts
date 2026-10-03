// The GameView lists of an actor's ActionSet (actions.ts resolved; 04 §14, §19; 00 §4.10).
import type {
  AdvertisedAction,
  CharacterId,
  CommandPayload,
  EntityId,
  Key,
} from './contracts.gen.ts';
import { admission, detailOf, refusal, resolved, type Offered } from './actions.ts';
import { bodyOf, type World } from './decision.ts';
import { MODAL, speaks, talkRefused } from './dialogue.ts';
import { holds } from './policy.ts';
import * as barrier from './rules/barrier.ts';
import * as equipment from './rules/equipment.ts';
import { cmp } from './validate.ts';

/**
 * The GameView lists of `actor`'s set: `listed(fits)` is each action that `fits` in presentation
 * order (highest priority first, then key), available when its policy holds and, for a recipe,
 * its admission passes, else shown with invalid_state or admission's code (00 §4.10); a talk in
 * step's order: invalid_state when its policy fails, not_found when its target speaks no
 * dialogue, invalid_state when talkRefused. A recipe is listed with the place while its detail is
 * in the actor's room. The door verbs (barrier@1) are listed not with the place but on an exit,
 * `door(direction)`: only those step would accept there now (refusal, then barrier.transition).
 * Likewise wear and remove (equipment@1) are listed on an item only when step would accept them
 * (refusal, then equipment.transfer), never with the place; `worn(id)` lists only those that
 * resolve to remove.
 */
export function lists(world: World, actor: CharacterId) {
  const set = resolved(world, actor);
  const door = (a: Offered) => Object.hasOwn(barrier.MOVES, a.command);
  const body = bodyOf(world, actor);
  const here = (a: Offered) =>
    !a.recipe ||
    world.details[detailOf(world, a.recipe.target)].room === world.state.containers[body!];
  const advertise = (a: Offered, id?: string): AdvertisedAction => {
    const shown = { action_key: a.key, label: a.label, target: a.target, input: a.input };
    const admitted = a.recipe && admission(world, a.recipe, actor, body!);
    // Step's order: the action's policy, then the talk rule's not_found and talkRefused.
    const target = (a.recipe ? detailOf(world, a.recipe.target) : id) as EntityId | undefined;
    const talk =
      a.command === 'talk' &&
      (speaks(world, target) ? talkRefused(world, actor, target) && 'invalid_state' : 'not_found');
    const code = !holds(world, actor, a.policy.root, { target, steps: { n: 0 } })
      ? 'invalid_state'
      : talk || (typeof admitted === 'string' ? admitted : undefined);
    return code ? { available: false, ...shown, reason: { code } } : { available: true, ...shown };
  };
  const listed = (fits: (a: Offered) => boolean, id?: string) =>
    Object.values(set)
      .filter((a) => fits(a) && here(a) && !MODAL.includes(a.command))
      .filter((a) => a.speaker === undefined || a.speaker === id)
      .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
      .map((a) => advertise(a, id));
  return {
    place: listed((a) => a.target.kind === 'none' && !door(a) && !equip(a)),
    of: (scope: string, id: string) =>
      listed(
        (a) =>
          a.target.kind === 'entity' &&
          a.target.scopes.includes(scope as never) &&
          (!equip(a) || fits(world, actor, a, id)),
        id,
      ),
    worn: (id: string) => listed((a) => a.command === 'remove' && fits(world, actor, a, id), id),
    door: (direction: Key) => listed((a) => door(a) && usable(world, actor, a, direction)),
  };
}

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

// True when step would accept door verb `a` by `actor` through `direction` now: admission
// (refusal), then barrier@1's checks (barrier.transition).
function usable(world: World, actor: CharacterId, a: Offered, direction: Key) {
  const payload = { type: a.command, direction, actor_id: actor } as CommandPayload;
  const steps = { n: 0 };
  return (
    !refusal(world, payload, steps, a.key) &&
    typeof barrier.transition(world, actor, a.command, direction, steps) !== 'string'
  );
}
