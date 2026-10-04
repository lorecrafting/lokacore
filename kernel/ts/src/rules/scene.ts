// scene@1 modal subset (mechanics.md; 06 §33–§37; 21 §3.6): the actor's compiler-added
// fact remembers the shown line and the ended state; only continue is admitted while running.
import { accepted, event, rejected, values, type Rule } from '../decision.ts';
import { assigned } from '../fact.ts';
import { fact, running } from '../scene.ts';

// ponytail: fresh-id double taps advance an unseen line; add continue {line} when touch input needs it.
export const decide: Rule<'scene'> = (world, command, mint) => {
  const current = running(world, command.payload.actor_id);
  if (!current) return rejected('invalid_state');
  const scene = values(world.cartridge.scenes ?? {}).find((s) => s.key === current.scene.key)!;
  const ended = current.index === current.count;
  const { ops } = assigned(
    world,
    command.payload.actor_id,
    { ops: [], position: 0, facts: {} },
    { fact: fact(world, scene), value: ended ? -1 : current.index + 1 },
  );
  return accepted(
    world,
    ended ? 'ended' : 'continued',
    ops,
    ended ? [event(world, command, mint, 2, { type: 'scene_ended', scene: current.scene })] : [],
  );
};
