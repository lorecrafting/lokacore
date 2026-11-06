// The hotbar slots' drawings (book-ui.md, Combat hotbar; docs/design/icon-style-guide.md): statusGlyphs'
// frame (SVG path `d` in a 24-unit box, stroke 2.5, round caps and joins, no fill, ink inside 3 to 21),
// keyed by a scripted action's action_key or a spell word. A key with no drawing takes the neutral
// fallback at render; hotbar.test.ts fails for any showcase slot key missing here.
import { fallback, glyphs } from './statusGlyphs.ts';

export const actionGlyphs: Record<string, string> = {
  ward: glyphs['condition.warded']!,
};

// The opener's drawing: three dots on the midline (statusGlyphs.ts `dot`).
export const OPENER = [7, 12, 17].map((x) => `M${x} 12a.75.75 0 1 0 .01 0`).join('');

export const actionGlyph = (key: string) => actionGlyphs[key] ?? fallback.neutral;
