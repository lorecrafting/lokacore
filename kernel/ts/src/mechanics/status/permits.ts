// Status reader 4, apart from status/shared.ts: dialogue/shared.ts reaches status/shared.ts through
// death and resources, so importing MODAL there made a require cycle that broke the Metro bundle.
// This file still sits in a cycle (permits -> dialogue/shared -> commands/actions -> permits); it
// is safe only because MODAL is read inside permits(), never at load (Beads loka-g53x).
import type { EntityId } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { MODAL } from '../dialogue/shared.ts';
import { statusAllows } from './shared.ts';

/**
 * Status reader 4: the Command types `body`'s active statuses let it issue (`statusAllows`). A modal
 * answer (dialogue's choose and close_choice, a scene's continue) and wait are always admitted, so no
 * status traps the player in a conversation or a scene, or stops time where only wait moves it.
 */
export function permits(world: World, body: EntityId | undefined) {
  const free = body ? statusAllows(world, body) : () => true;
  return (command: string) => [...MODAL, 'continue', 'wait'].includes(command) || free(command);
}
