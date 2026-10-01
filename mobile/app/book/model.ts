// How the book view sorts the controller's flat button list (smoke.ts `buttons`): the place's look,
// the exits (a move button carries input.direction), other place actions, and a thing's own actions.
import type { Button } from '../../authority/local-story/smoke.ts';

export type Exit = { direction: string; button: Button };

export function group(buttons: Button[]) {
  const dir = (b: Button) => (b.input as { direction?: string }).direction;
  const aimed = (b: Button) => b.target_ids.length > 0;
  return {
    look: buttons.find((b) => b.action_key === 'look' && !aimed(b)),
    exits: buttons.flatMap((b) => (dir(b) ? [{ direction: dir(b)!, button: b }] : [])),
    place: buttons.filter((b) => !aimed(b) && !dir(b) && b.action_key !== 'look'),
    on: (id: string) => buttons.filter((b) => b.target_ids.includes(id)),
  };
}

// Cartridge text marks touch details as [label](detail_key); the controller has no detail action
// yet, so show the label as plain prose. ponytail: details become tappable when one is offered.
export const plain = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
