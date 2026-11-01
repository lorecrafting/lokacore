// Which under-ink layer shows (book-ui.md, Room page anatomy): one at a time, highest first;
// together they would break the 4.5:1 rule (BOOK-UI-COMPONENTS.md#design-tokens).
import type { GameView } from '../../packages/game-view/session.ts';
import { color } from './tokens.ts';

export type HeldLayer = 'fatal' | 'vignette' | 'glow' | undefined;

export const heldLayer = (f: { fatal: boolean; low: boolean; lit: boolean }): HeldLayer =>
  f.fatal ? 'fatal' : f.low ? 'vignette' : f.lit ? 'glow' : undefined;

export const lowHealth = (view: GameView) =>
  !!view.resources?.some((r) => r.resource.key === 'hp' && 'tone' in r && r.tone === 'danger');

// Any row of the view carrying a lit flame, held or in the room, on a paper dark enough to show it.
export const lampLit = (view: GameView, paper: string) =>
  (paper === color.dusk.bg || paper === color.dark.bg) &&
  [...view.inventory, ...(view.equipment ?? []).map((s) => s.item), ...view.entities].some(
    (row) => row && 'fuel' in row && row.fuel?.lit,
  );
