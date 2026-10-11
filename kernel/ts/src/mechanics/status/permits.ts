// Status reader 4, apart from status/shared.ts: dialogue/shared.ts reaches status/shared.ts through
// death and resources, so importing MODAL there made a require cycle that broke the Metro bundle.
import type { EntityId, Key } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { MODAL } from '../dialogue/shared.ts';
import { activeStatuses } from './shared.ts';

/**
 * Status reader 4: the Command types `body`'s active statuses let it issue: none a status blocks,
 * and, where statuses declare allows, only those every such list names. A modal answer (dialogue's
 * choose and close_choice, a scene's continue) and wait are always admitted, so no status traps the
 * player in a conversation or a scene, or stops time where only wait moves it.
 */
export function permits(world: World, body: EntityId | undefined) {
  const bars = Object.values(world.cartridge.statuses ?? {}).some((s) => s.blocks || s.allows);
  const specs = !bars || !body ? [] : activeStatuses(world, body).map(({ spec }) => spec);
  return (command: string) =>
    [...MODAL, 'continue', 'wait'].includes(command) ||
    specs.every(
      (s) => !s.blocks?.includes(command as Key) && (s.allows?.includes(command as Key) ?? true),
    );
}
