// The page's held under-ink layers (book-ui.md, Room page anatomy): the lamp glow and the low-health
// vignette, one at a time with the fatal hold and the spirit layer above them (heldLayer.ts).
import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import type { GameView } from '../../packages/game-view/session.ts';
import { onCue } from './cues.ts';
import {
  curveOf,
  Reanimated,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
} from './fade.ts';
import {
  flickerClock,
  heldLayer,
  lampLit,
  lowHealth,
  onCut,
  spiritInk,
  type HeldLayer,
} from './heldLayer.ts';
import { usePalette, type Palette } from './palette.ts';
import { color, motion, opacity } from './tokens.ts';

const Gradient = lazy(() => import('./Gradient.tsx'));
// No CanvasKit on the web (no WebAssembly, a story without its loader): no layer, the page unchanged.
const canDraw = () => 'CanvasKit' in globalThis || globalThis.navigator?.product === 'ReactNative';

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const; // mutate-skip: layout
const reach = { glow: 0.4, vignetteFrom: 0.6 }; // of the page's width; of the vignette's radius -- mutate-skip: uncalibrated design value
const breathe = { duration: motion.breathe.duration, easing: curveOf(motion.breathe.easing) };

// A page turn remounts the page: a layer already showing stays at its value and never fades in again.
let shown: HeldLayer;

/** The foot's height below the page: a layer reaches on under the transparent foot to the Book's edge. */
export const footContext = createContext(0);

function Layer(p: { style: object; children: React.ReactNode }) {
  const foot = useContext(footContext);
  return (
    <Reanimated.View style={[fill, { bottom: -foot }, p.style]} pointerEvents="none" aria-hidden>
      <Suspense>{p.children}</Suspense>
    </Reanimated.View>
  );
}

function useFlicker(flickers: boolean) {
  const flick = useSharedValue(1);
  useEffect(() => {
    flick.value = 1;
    if (flickers) return flickerClock((share) => (flick.value = share));
  }, [flickers]);
  return flick;
}

function useCut() {
  const cut = useSharedValue(1);
  useEffect(
    () =>
      onCut(() => {
        cut.value = 0;
        cut.value = withDelay(
          motion.afterimage.duration + motion.afterimage.out,
          withTiming(1, { duration: motion.settle.duration }),
        );
      }),
    [],
  );
  return cut;
}

// Never: under reduced motion Reanimated would cut the rise; it is ruled a plain fade.
const riseFade = (still: boolean) => ({
  duration: (still ? motion.fade : motion.palette).duration,
  reduceMotion: ReduceMotion.Never,
});

function useLayers(view: GameView, c: Palette, spirit: boolean) {
  const still = useReducedMotion();
  const [fatal, setFatal] = useState(false);
  useEffect(
    () =>
      onCue((cue) => {
        if (cue.name === 'death' && cue.fight) setFatal(true);
      }),
    [],
  );
  const held = heldLayer({ spirit, fatal, low: lowHealth(view), lit: lampLit(view, c.bg) });
  const glow = useSharedValue(shown === 'glow' && held === 'glow' ? opacity.glow : 0);
  const edge = useSharedValue(shown === 'vignette' && held === 'vignette' ? opacity.faint : 0);
  const ghost = useSharedValue(spirit ? opacity.spirit : 0); // set with the page turn, in every mode
  useEffect(() => {
    shown = held;
    if (held === 'spirit') ghost.value = opacity.spirit;
    else if (ghost.value) ghost.value = withTiming(0, riseFade(still));
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
  const flick = useFlicker(held === 'glow' && !still && !view.place?.exposed);
  const cut = useCut();
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * flick.value * cut.value }));
  const edgeStyle = useAnimatedStyle(() => ({ opacity: edge.value * cut.value }));
  const ghostStyle = useAnimatedStyle(() => ({ opacity: ghost.value }));
  const spiritStyle = [{ backgroundColor: spiritInk(c) }, ghostStyle];
  return { glowStyle, edgeStyle, spiritStyle };
}

/**
 * The spirit layer, the lamp glow and the low-health vignette under a page's ink.
 * - Use: behind a `paperless` Page, on World and Combat.
 * - Rules: paper, not a part: draws no block, holds no words, takes no touch. Only the highest of
 *   the fatal hold, the vignette and the glow shows; a lower one fades out over `motion.settle` and
 *   returns the same way. Storm's light cuts it for the strike; it returns over `motion.settle`.
 *   The glow flickers by `motion.flicker` away from an exposed room, steady under reduced motion.
 *   The spirit layer (`spirit`, book-ui.md Spirit state) is a flat wash in `spiritInk` at
 *   `opacity.spirit`, set as the page lands in every mode and fading out at the rise over
 *   `motion.palette` (`motion.fade` under reduced motion, still a fade; Flashes off the same); a
 *   plain view, so it draws on the web too.
 * - States: none; glow (in `motion.palette`, by cut under reduced motion); vignette (breathes;
 *   steady at `opacity.faint` under reduced motion); under a fatal hold; spirit.
 * - Story: UnderInk.stories.tsx
 */
export function UnderInk({ view, spirit = false }: { view: GameView; spirit?: boolean }) {
  const c = usePalette();
  const { glowStyle, edgeStyle, spiritStyle } = useLayers(view, c, spirit);
  // Once drawn a layer stays, at no opacity, so it can fade out over the settle.
  const drawn = useRef({ lit: false, low: false, spirit: false }).current;
  drawn.lit ||= lampLit(view, c.bg);
  drawn.low ||= lowHealth(view);
  const ghost = (drawn.spirit ||= spirit) && <Layer style={spiritStyle}>{null}</Layer>;
  if (!canDraw()) return ghost || null;
  return (
    <>
      {ghost}
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
