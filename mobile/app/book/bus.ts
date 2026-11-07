// Each sound's mix bus (book-ui.md, Effects, sound and haptics; tokens.ts `mix.bus`).
import type { mix, sound } from './tokens.ts';

export type Bus = keyof typeof mix.bus;
export const busOf = (name: keyof typeof sound): Bus =>
  name === 'bed' || name === 'weather'
    ? 'ambience'
    : name === 'chapter' ||
        name === 'explore' ||
        name === 'fightIn' ||
        name === 'fightLoop' ||
        name === 'fightWon'
      ? 'music'
      : name === 'pageTurn' || name === 'pickup' || name === 'tick'
        ? 'ui'
        : 'sfx';
