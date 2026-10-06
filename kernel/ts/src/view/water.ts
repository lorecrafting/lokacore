import type { GameView, EntityId, Key, CorpseRecoveryView } from '../contracts.gen.ts';
import { refString, type World, type Steps } from '../runtime/decision.ts';
import { recovery } from '../mechanics/containment/recovery.ts';
import { refusal } from '../commands/actions.ts';
import { LIMITS } from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';

function corpseViews(world: World, steps: Steps): CorpseRecoveryView[] {
  const corpse_recovery: CorpseRecoveryView[] = [];
  // Empty corpse history needs only one holder scan; shared admission still validates each offer.
  const nonempty = new Set<string>();
  for (const holder of Object.values(world.state.containers)) {
    if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
    nonempty.add(holder);
  }
  for (const id of Object.keys(world.state.created ?? {})) {
    if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
    if (!nonempty.has(id)) continue;
    const corpse_id = id as EntityId;
    const plan = recovery(world, world.character, corpse_id, steps);
    if (
      typeof plan === 'string' ||
      refusal(
        world,
        { type: 'recover_corpse', actor_id: world.character, corpse_id },
        steps,
        'recover_corpse' as Key,
      )
    )
      continue;
    corpse_recovery.push({
      corpse_id,
      room_id: plan.room_id,
      room_title: world.rooms[plan.room_id].title,
      roots: plan.roots.map((id) => ({ id, name: world.entities[id].short })),
    });
  }
  return corpse_recovery;
}

export function waterViews(
  world: World,
  steps: Steps,
): Pick<GameView, 'water' | 'corpse_recovery'> {
  if (!world.cartridge.world?.water) return {};
  const current = world.state.water?.[world.character],
    corpse_recovery = corpseViews(world, steps);
  return {
    ...(current?.deadline !== null &&
      current?.deadline !== undefined && {
        water: {
          deadline: current.deadline,
          remaining: Math.max(0, current.deadline - world.state.clock),
          remaining_seconds: Math.ceil(
            Math.max(0, current.deadline - world.state.clock) /
              world.cartridge.manifest.time_policy!.rate,
          ),
        },
      }),
    ...(corpse_recovery.length && { corpse_recovery }),
  };
}
