// The GameView lists of an actor's ActionSet (actions.ts resolved; 04 §14, §19; 00 §4.10).
import type { AdvertisedAction, CharacterId, EntityId, TargetSpec } from './contracts.gen.ts';
import { admission, detailOf, resolved, type Offered } from './actions.ts';
import { bodyOf, type World } from './decision.ts';
import { MODAL, speaks, talkRefused } from './dialogue.ts';
import { holds } from './policy.ts';
import { cmp } from './validate.ts';

/**
 * The GameView lists of `actor`'s set: `listed(fits)` is each action that `fits` in presentation
 * order (highest priority first, then key), available when its policy holds and, for a recipe,
 * its admission passes, else shown with invalid_state or admission's code (00 §4.10); a talk in
 * step's order: invalid_state when its policy fails, not_found when its target speaks no
 * dialogue, invalid_state when talkRefused. A recipe is listed with the place while its detail is
 * in the actor's room.
 */
export function lists(world: World, actor: CharacterId) {
  const set = resolved(world, actor);
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
  const listed = (fits: (t: TargetSpec) => boolean, id?: string) =>
    Object.values(set)
      .filter((a) => fits(a.target) && here(a) && !MODAL.includes(a.command))
      .filter((a) => a.speaker === undefined || a.speaker === id)
      .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
      .map((a) => advertise(a, id));
  return {
    place: listed((t) => t.kind === 'none'),
    of: (scope: string, id: string) =>
      listed((t) => t.kind === 'entity' && t.scopes.includes(scope as never), id),
  };
}
