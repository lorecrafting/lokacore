// NPC emotes (G9, emote@1; docs/system/mechanics.md#npc-emotes-g9): one emote step's line. The emoter is
// the step's npc, else the reaction's subject; the line is told only when the emoter is a living NPC in the
// reader's room and the reader sees it. `to: "subject"` names the subject as the target. Writes nothing.
import type { CharacterId, EntityId, ReactionRule, Text } from '../../contracts.gen.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { visible } from '../light/shared.ts';
import { describeEntity } from '../description_variant/rule.ts';
import { engineLine } from '../line.ts';

type Step = ReactionRule['steps'][number];
type Told = Extract<Step, { op: 'narrate' | 'emote' }>;
export const isTold = (s: Step): s is Told => s.op === 'narrate' || s.op === 'emote';

/** A narrate or emote step's lines (one place, so reaction@1's sequence stays in its size cap). */
export function told(
  world: World,
  actor: CharacterId,
  step: Told,
  { subject, steps }: { subject?: EntityId; steps: Steps },
): Text[] {
  if (step.op === 'narrate') return [{ key: step.text }];
  const emoter = step.npc ? world.entityIds[refString(step.npc)] : subject;
  const body = bodyOf(world, actor);
  const here = body && world.state.containers[body];
  if (!emoter || world.entities[emoter]?.kind !== 'npc' || !living(world, emoter)) return [];
  if (!here || world.state.containers[emoter] !== here || !visible(world, actor, emoter, steps))
    return [];
  // The target: the reader's own body (worded `to.you`, so it binds no name), or another NPC the reader
  // sees in the room (`to.others`, bound by its short); any other subject drops it (`others`).
  const target = step.to === 'subject' && subject !== emoter ? subject : undefined;
  const mine = target === body;
  const seen =
    !mine &&
    target !== undefined &&
    world.entities[target] !== undefined &&
    world.state.containers[target] === here &&
    visible(world, actor, target, steps);
  return [
    engineLine(
      'emote.performed',
      { actor: emoter, ...((mine || seen) && { target }) },
      {
        emote: step.emote.key,
        ...(seen && { target: describeEntity(world, actor, target, 'short', steps) }),
      },
    ),
  ];
}
