import { continued } from './sequence.ts';
import type { DefinitionRef } from '../../contracts.gen.ts';
// scene@1 modal subset (mechanics.md; 06 §33–§37; 21 §3.6): the actor's compiler-added
// fact remembers the shown line and the ended state; only continue is admitted while running.
import {
  accepted,
  event,
  rejected,
  refString,
  type World,
  type Rule,
} from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { assigned } from '../fact.ts';
import { fact, running } from './shared.ts';

const modal: Rule<'scene'> = (world, command, mint, steps = { n: 0 }) => {
  const current = running(world, command.payload.actor_id);
  if (!current) return rejected('invalid_state');
  const scene = modalDefinition(world, current.scene)!;
  if (!same(command.payload.scene, current.scene) || command.payload.line !== current.index)
    return rejected('invalid_state');
  const ended = current.index === current.count;
  let run = assigned(
    world,
    command.payload.actor_id,
    { ops: [], position: 0, facts: {} },
    { fact: fact(world, scene), value: ended ? -1 : current.index + 1 },
  );
  const end = ended ? scene.on_end : undefined;
  if (end) {
    for (const assign of end.assign) run = assigned(world, command.payload.actor_id, run, assign);
    run = assigned(world, command.payload.actor_id, run, {
      fact: { ...end.story_point, kind: 'fact', key: `story_point_${end.story_point.key}` },
      value: end.outcome,
    });
  }
  const events = ended
    ? [
        event(world, command, mint, run.position + 1, {
          type: 'scene_ended',
          scene: current.scene,
        }),
        ...(end
          ? [
              event(world, command, mint, run.position + 2, {
                type: 'story_point_reached',
                story_point: end.story_point,
                outcome: end.outcome,
              }),
            ]
          : []),
      ]
    : [];
  return accepted(world, ended ? 'ended' : 'continued', run.ops, events);
};

export const decide: Rule<'scene'> = (world, command, mint, steps = { n: 0 }) =>
  command.payload.scene &&
  world.cartridge.scenes?.[refString(command.payload.scene)]?.control === 'presentation_only'
    ? continued(world, command, mint, steps)
    : modal(world, command, mint, steps);

function modalDefinition(world: World, ref: DefinitionRef) {
  const s = world.cartridge.scenes?.[refString(ref)];
  return s?.control === 'modal' ? s : undefined;
}
