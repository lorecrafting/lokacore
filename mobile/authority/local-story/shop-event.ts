// The one item_acquired event a shop exchange receipt carries (save.md, B3 shop recovery).
import type { Command, EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { id } from '../../../kernel/ts/src/foundation/id_source.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import type { World, Accepted } from '../../../kernel/ts/src/runtime/decision.ts';

export function acquiredOnce(
  world: World,
  command: Command,
  d: Accepted,
  moved: EntityId,
  destination: string,
) {
  const acquired = d.events.filter((e) => e.payload.type === 'item_acquired');
  return (
    acquired.length === 1 &&
    acquired[0].id === id(world.context, command.id, 0) &&
    acquired[0].world_context_id === world.context &&
    acquired[0].position === 1 &&
    acquired[0].logical_time <= world.state.clock &&
    acquired[0].causation_id === (command.id as string) &&
    acquired[0].correlation_id === (command.id as string) &&
    acquired[0].actor_id === world.character &&
    same(acquired[0].scope, { kind: 'player', character_id: world.character }) &&
    same(acquired[0].payload, { type: 'item_acquired', item_id: moved, holder_id: destination })
  );
}
