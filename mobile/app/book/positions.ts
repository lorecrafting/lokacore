// The existing position cycle over captured, available controls.
import type { GameView } from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
const POSITIONS = ['standing', 'sitting', 'resting', 'sleeping'];
export const POSITION_ACTIONS = ['stand', 'sit', 'rest', 'sleep'];
export function nextPosition(position: GameView['position'], actions: Button[]) {
  const at = POSITIONS.indexOf(position ?? '');
  if (at < 0) return;
  for (let step = 1; step < 4; step++) {
    const next = POSITION_ACTIONS[(at + step) % 4];
    const offered = actions.find((b) => b.action_key === next);
    if (offered) return offered;
  }
}
