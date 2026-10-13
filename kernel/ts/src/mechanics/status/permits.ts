// Status reader 4, apart from status/shared.ts: dialogue/shared.ts reaches status/shared.ts through
// death and resources, so importing MODAL there made a require cycle that broke the Metro bundle.
// This file still sits in a cycle (permits -> dialogue/shared -> commands/actions -> permits); it
// is safe only because MODAL is read inside permits(), never at load (Beads loka-g53x).
import type { CharacterId } from '../../contracts.gen.ts';
import { bodyOf, keys, type World } from '../../runtime/decision.ts';
import { MODAL } from '../dialogue/shared.ts';
import { positionOf, VERBS } from '../position/shared.ts';
import { statusAllows } from './shared.ts';

/**
 * Status reader 4: the Command types `actor`'s body's active statuses let it issue (`statusAllows`);
 * a sleeper (toolbox row W9) only the position verbs, look and move, which movement@1 refuses short
 * of standing but for water's free Up. A modal answer (dialogue's choose and close_choice, a scene's
 * continue) and wait are always admitted, so nothing traps the player in a conversation or a scene,
 * or stops time where only wait moves it.
 */
export function permits(world: World, actor: CharacterId) {
  const body = bodyOf(world, actor);
  const free = body ? statusAllows(world, body) : () => true;
  const asleep = positionOf(world, actor) === 'sleeping';
  return (command: string) =>
    [...MODAL, 'continue', 'wait'].includes(command) ||
    ((!asleep || [...keys(VERBS), 'move', 'look'].includes(command)) && free(command));
}
