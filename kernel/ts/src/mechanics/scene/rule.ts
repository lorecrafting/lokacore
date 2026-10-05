// scene@1 modal subset (mechanics.md; 06 §33–§37; 21 §3.6): the actor's compiler-added
// fact remembers the shown line and the ended state; only continue is admitted while running.
import { accepted, event, rejected, values, type Rule } from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { assigned } from '../fact.ts';
import { fact, running } from './shared.ts';

// size: allow 50, final acknowledgement assigns memories and emits its chapter point atomically
export const decide: Rule<'scene'> = (world, command, mint) => {
  const current = running(world, command.payload.actor_id);
  if (!current) return rejected('invalid_state');
  const scene = values(world.cartridge.scenes ?? {}).find((s) => s.key === current.scene.key)!;
  // Historical scene transcripts omit the binding; action-started finales require both fields.
  if (scene.on.action || command.payload.scene !== undefined || command.payload.line !== undefined)
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
