// The shown palette (tokens.ts `color`), provided once by the Book; every component reads it here.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { color, motion, type } from './tokens.ts';

export type Palette = typeof color.light;
export const PaletteContext = createContext<Palette>(color.light);
export const usePalette = () => useContext(PaletteContext);

export const prose = (c: Palette) => ({ ...type.body, color: c.fg });
export const note = (c: Palette) => ({ ...type.body, color: c.dim });

// The confirmed GameView solar phase's palette (docs/system/book-ui.md#world-and-status-entry):
// the Book reads the cartridge's phase name and computes no hours. Confirmed: the Book passes
// game.view(), which a pending attempt never changes.
const byPhase = new Map([
  ['day', color.light],
  ['dawn', color.dawn],
  ['dusk', color.dusk],
  ['night', color.dark],
]);
export const paletteOf = (solar?: string) => byPhase.get(solar!) ?? color.light;

// The palette to show for `target`: at once on mount and without a curve (reduced motion), else
// cross-faded along `curve` over motion.palette from whatever is shown (a cut-short fade included).
// ponytail: the cross-fade re-renders the Book each frame for motion.palette; fine for
// a few phase changes a game day, revisit if it stutters on a device.
export function useShownPalette(target: Palette, curve?: (t: number) => number): Palette {
  const [shown, setShown] = useState(target);
  const now = useRef(shown);
  now.current = shown;
  useEffect(() => {
    if (now.current === target) return;
    if (!curve) return setShown(target);
    const from = now.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step() {
      // One clock for start and now (a frame's timestamp may not be performance.now's).
      const t = Math.min(1, Math.max(0, (performance.now() - start) / motion.palette.duration));
      setShown(t < 1 ? mix(from, target, curve(t)) : target);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, curve]);
  return shown;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
function mix(a: Palette, b: Palette, t: number): Palette {
  const out = { ...b };
  for (const role of Object.keys(b) as (keyof Palette)[]) {
    const [x, y] = [rgb(a[role]), rgb(b[role])];
    out[role] = `#${x.map((v, i) => hex(v + (y[i] - v) * t)).join('')}`;
  }
  return out;
}
