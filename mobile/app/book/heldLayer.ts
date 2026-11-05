// Which under-ink layer shows (book-ui.md, Room page anatomy): one at a time, highest first;
// together they would break the 4.5:1 rule (BOOK-UI-COMPONENTS.md#design-tokens).
import type { GameView } from '../../packages/game-view/session.ts';
import { dark, type Palette } from './palette.ts';
import { color, motion, opacity, reverie, spirit } from './tokens.ts';

/** The named Book treatments (book-ui.md, Book treatments): each a held layer's ink and peak, by polarity. */
export const TREATMENTS = {
  spirit: { ink: spirit, peak: { day: opacity.spirit, night: opacity.spirit } },
  reverie: { ink: reverie, peak: opacity.reverie },
} as const;
export type Treatment = keyof typeof TREATMENTS;

export type HeldLayer = Treatment | 'fatal' | 'vignette' | 'glow' | undefined;

export const heldLayer = (f: {
  treatment?: Treatment;
  fatal: boolean;
  low: boolean;
  lit: boolean;
}): HeldLayer =>
  f.treatment ?? (f.fatal ? 'fatal' : f.low ? 'vignette' : f.lit ? 'glow' : undefined);

/** A treatment's layer on this paper, `[ink, peak]`: the night form on the dark palettes, as the blow wash splits. */
export const treatmentInk = (name: Treatment, p: Palette) => {
  const { ink, peak } = TREATMENTS[name];
  return dark(p) ? ([ink.night, peak.night] as const) : ([ink.day, peak.day] as const);
};

const cutters = new Set<() => void>();
/** Storm's light fell: the held layer leaves for the strike, so the afterimage's exemption stays true. */
export const cutHeld = () => cutters.forEach((cut) => cut());
export const onCut = (cut: () => void) => {
  cutters.add(cut);
  return () => void cutters.delete(cut);
};

/** Random steps of the lamp's glow, as a share of it, until stopped; held still in the background. */
export function flickerClock(step: (share: number) => void) {
  const { min, max, depth } = motion.flicker;
  let timer: ReturnType<typeof setTimeout>;
  const next = () => {
    if (!globalThis.document?.hidden) step(1 - Math.random() * depth);
    timer = setTimeout(next, min + Math.random() * (max - min));
  };
  next();
  return () => clearTimeout(timer);
}

export const lowHealth = (view: GameView) =>
  !!view.resources?.some((r) => r.resource.key === 'hp' && 'tone' in r && r.tone === 'danger');

// Any row of the view carrying a lit flame, held or in the room, on a paper dark enough to show it.
export const lampLit = (view: GameView, paper: string) =>
  (paper === color.dusk.bg || paper === color.dark.bg) &&
  [...view.inventory, ...(view.equipment ?? []).map((s) => s.item), ...view.entities].some(
    (row) => row && 'fuel' in row && row.fuel?.lit,
  );
