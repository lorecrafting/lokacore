// The paper's wash when a level lands, on whatever page shows.
import { useEffect } from 'react';
import { flashed, layer } from './Blow.tsx';
import { onCue } from './cues.ts';
import { useAnimatedStyle, useReducedMotion, useSharedValue } from './fade.ts';
import { usePalette } from './palette.ts';

/**
 * The level's wash under the ink, in `warning` (book-ui.md, Level wash).
 * - Use: `Page` only, as its root's first child: above its under-ink layers, below the ink.
 * - Rules: answers only a `level` with `wash`, which the Flash limit and the Flashes setting decide;
 *   no swell, which reads as impact; no layout change; a page turn remounts it, ending the wash.
 * - States: at rest; washing; reduced motion (half the wash).
 * - Story: LevelWash.stories.tsx
 */
export function LevelWash() {
  const c = usePalette();
  const still = useReducedMotion();
  const wash = useSharedValue(0);
  useEffect(
    () =>
      onCue((cue) => {
        if (cue.name === 'level' && cue.wash) wash.value = flashed(still);
      }),
    [still],
  );
  return layer(
    c.warning,
    useAnimatedStyle(() => ({ opacity: wash.value })),
  );
}
