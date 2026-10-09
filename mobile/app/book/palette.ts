// The shown palette (tokens.ts `color`), provided once by the Book; every component reads it here.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { color, motion, size, type } from './tokens.ts';

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

// The palette to show for `target`: at once on mount, without a curve (reduced motion) and on a
// polarity flip (ink and paper cross, so no fade keeps text readable: BOOK-UI-COMPONENTS.md
// #design-tokens), else cross-faded along `curve` over motion.palette from whatever is shown (a
// cut-short fade included).
// ponytail: the cross-fade re-renders the Book each frame for motion.palette; fine for
// a few phase changes a game day, revisit if it stutters on a device.
export function useShownPalette(target: Palette, curve?: (t: number) => number): Palette {
  const [shown, setShown] = useState(target);
  const now = useRef(shown);
  now.current = shown;
  useEffect(() => {
    if (now.current === target) return;
    if (!curve || dark(now.current) !== dark(target)) return setShown(target);
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
// Relative luminance (WCAG 2), enough to order ink against paper.
const lum = (hex: string) =>
  rgb(hex)
    .map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const dark = (p: Palette) => lum(p.fg) > lum(p.bg); // light ink on dark paper
// WCAG 2 contrast ratio of two #rrggbb colours (the token test and the Tokens story).
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
function mix(a: Palette, b: Palette, t: number): Palette {
  const out = { ...b };
  for (const role of Object.keys(b) as (keyof Palette)[]) {
    const [x, y] = [rgb(a[role]), rgb(b[role])];
    out[role] = `#${x.map((v, i) => hex(v + (y[i] - v) * t)).join('')}`;
  }
  return out;
}

// The web keyboard focus ring (BOOK-UI-COMPONENTS.md#design-tokens): `size.focus` `action` outline,
// `size.focus` out, on `:focus-visible` only, so a tap or a click draws none. One document-wide rule
// (the Book is the web document), its colour reset in place as the shown palette changes; a device
// has no ring.
let ring: HTMLStyleElement | undefined;
export function useFocusRing(c: Palette) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    ring ??= document.head.appendChild(document.createElement('style'));
    ring.textContent = `:focus-visible{outline:${size.focus}px solid ${c.action};outline-offset:${size.focus}px}`;
  }, [c.action]);
}

// The Book's palette: the shown one, with the web focus ring in its colour.
export function useBookPalette(target: Palette, curve?: (t: number) => number): Palette {
  const shown = useShownPalette(target, curve);
  useFocusRing(shown);
  return shown;
}
