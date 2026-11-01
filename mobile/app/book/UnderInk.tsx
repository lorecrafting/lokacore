// The page's held under-ink layers (book-ui.md, Room page anatomy): the lamp glow and the low-health
// vignette, one at a time with the fatal hold above them (heldLayer.ts).
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GameView } from '../../packages/game-view/session.ts';
import { onCue } from './cues.ts';
import {
  curveOf,
  Reanimated,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from './fade.ts';
import { heldLayer, lampLit, lowHealth, type HeldLayer } from './heldLayer.ts';
import { usePalette } from './palette.ts';
import { color, motion, opacity } from './tokens.ts';

const Gradient = lazy(() => import('./Gradient.tsx'));
// No CanvasKit on the web (no WebAssembly, a story without its loader): no layer, the page unchanged.
const canDraw = () => 'CanvasKit' in globalThis || globalThis.navigator?.product === 'ReactNative';

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const; // mutate-skip: layout
const reach = { glow: 0.4, vignetteFrom: 0.6 }; // of the page's width; of the vignette's radius -- mutate-skip: uncalibrated design value
const breathe = { duration: motion.breathe.duration, easing: curveOf(motion.breathe.easing) };

// A page turn remounts the page: a layer already showing stays at its value and never fades in again.
let shown: HeldLayer;

function Layer(p: { style: object; children: React.ReactNode }) {
  return (
    <Reanimated.View style={[fill, p.style]} pointerEvents="none" aria-hidden>
      <Suspense>{p.children}</Suspense>
    </Reanimated.View>
  );
}

function useLayers(view: GameView, paper: string) {
  const still = useReducedMotion();
  const [fatal, setFatal] = useState(false);
  useEffect(
    () =>
      onCue((cue) => {
        if (cue.name === 'death' && cue.fight) setFatal(true);
      }),
    [],
  );
  const held = heldLayer({ fatal, low: lowHealth(view), lit: lampLit(view, paper) });
  const glow = useSharedValue(shown === 'glow' && held === 'glow' ? opacity.glow : 0);
  const edge = useSharedValue(shown === 'vignette' && held === 'vignette' ? opacity.faint : 0);
  useEffect(() => {
    shown = held;
    glow.value = withTiming(held === 'glow' ? opacity.glow : 0, {
      duration: held === 'glow' ? motion.palette.duration : motion.settle.duration,
    });
    if (held !== 'vignette') edge.value = withTiming(0, { duration: motion.settle.duration });
    else if (still) edge.value = opacity.faint;
    else
      edge.value = withRepeat(
        withSequence(withTiming(opacity.faint, breathe), withTiming(0, breathe)),
        -1,
      );
  }, [held, still]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const edgeStyle = useAnimatedStyle(() => ({ opacity: edge.value }));
  return { glowStyle, edgeStyle };
}

/**
 * The lamp glow and the low-health vignette under a page's ink.
 * - Use: behind a `paperless` Page, on World and Combat.
 * - Rules: paper, not a part: draws no block, holds no words, takes no touch. Only the highest of
 *   the fatal hold, the vignette and the glow shows; a lower one fades out over `motion.settle` and
 *   returns the same way.
 * - States: none; glow (in `motion.palette`, by cut under reduced motion); vignette (breathes;
 *   steady at `opacity.faint` under reduced motion); under a fatal hold.
 * - Story: UnderInk.stories.tsx
 */
export function UnderInk({ view }: { view: GameView }) {
  const c = usePalette();
  const { glowStyle, edgeStyle } = useLayers(view, c.bg);
  // Once drawn a layer stays, at no opacity, so it can fade out over the settle.
  const drawn = useRef({ lit: false, low: false }).current;
  drawn.lit ||= lampLit(view, c.bg);
  drawn.low ||= lowHealth(view);
  if (!canDraw()) return null;
  return (
    <>
      {drawn.lit && (
        <Layer style={glowStyle}>
          <Gradient
            shape={({ width, height }) => ({
              x: width,
              y: height,
              r: Math.max(width * reach.glow, 1),
            })}
            colors={[color.dark.action, `${color.dark.action}00`]}
          />
        </Layer>
      )}
      {drawn.low && (
        <Layer style={edgeStyle}>
          <Gradient
            shape={({ width, height }) => ({
              x: width / 2,
              y: height / 2,
              r: Math.max(Math.hypot(width, height) / 2, 1),
            })}
            colors={[`${c.fg}00`, c.fg]}
            stops={[reach.vignetteFrom, 1]}
          />
        </Layer>
      )}
    </>
  );
}
