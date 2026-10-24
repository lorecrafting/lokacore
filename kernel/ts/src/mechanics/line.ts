import type { CharacterId, EntityId, TextKey } from '../contracts.gen.ts';
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';
import { describeEntity } from './description_variant/rule.ts';

/** An engine narration line (loka-kgd.185): `key`, each named entity bound to its short as the actor
 * sees it (a status variant, "a notched sword", as on the page), the actor's body and `role` as
 * participants. Words: mobile/packages/game-view/line_words.ts. */
export const actorLine = (
  world: World,
  actor: CharacterId,
  key: string,
  named: Record<string, EntityId>,
  steps: Steps,
  role: Record<string, EntityId> = {},
) => ({
  key: key as TextKey,
  bindings: Object.fromEntries(
    Object.entries(named).map(([slot, id]) => [
      slot,
      describeEntity(world, actor, id, 'short', steps),
    ]),
  ),
  participants: { actor: bodyOf(world, actor)!, ...role },
});

/** An engine narration line from a computed key (`barrier.opened`) and plain bindings; the casts live
 * here because a rule module may not cast (ts-rule-module-pure). */
export const engineLine = (
  key: string,
  participants: Record<string, EntityId>,
  bindings?: Record<string, string>,
) => ({
  key: key as TextKey,
  ...(bindings && { bindings: bindings as Record<string, TextKey> }),
  participants,
});
