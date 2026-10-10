// Layer hues for the System pages: dev chrome, not Book UI, so not in tokens.ts (spec §2). Each pair
// is [on a light page, on a dark page], at least 3:1 on tokens.ts light.bg and dark.bg: light 4.5-7.2,
// dark 8.0-12.6 (checked 2026-10-09). Used for rules and borders only, never text. The only hex
// colours under stories/system/ (system.test.ts).
import { contrast, type Palette } from '../../book/palette.ts';

const hues: Record<string, [string, string]> = {
  Content: ['#8a5a1e', '#e0a35a'],
  Capabilities: ['#2e6b4f', '#7fc9a4'],
  Change: ['#5a4b9c', '#b3a4e6'],
  State: ['#1f6a8a', '#7cc4e0'],
  Save: ['#7a2f4a', '#e08cb0'],
  View: ['#6b6b1f', '#d4d47a'],
};

// The pair member that stands out more on this page (dawn takes the light one, dusk the dark).
export const hue = (layer: string, c: Palette) => {
  const [light, dark] = hues[layer] ?? [c.line, c.line];
  return contrast(light, c.bg) >= contrast(dark, c.bg) ? light : dark;
};
