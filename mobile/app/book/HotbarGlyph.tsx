// A hotbar slot's drawing on its own canvas, and the Inked drawing itself (docs/design/icon-style-guide.md);
// apart so a page without CanvasKit never loads Skia (Hotbar.tsx loads it lazily, as StatusIcon does).
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { usePalette, type Palette } from './palette.ts';
import { drainMs } from './StatusIcon.tsx';
import { opacity, size, space } from './tokens.ts';

const DISC = size.touch; // the button: one touch target
const SIDE = DISC + space.md; // the canvas, room for a bleed
const MID = SIDE / 2;
const R = DISC / 2;
const INK = DISC - 2 * space.md; // the glyph's box, scaled from statusGlyphs' 24
const BOX = 24;
const W = 2.5; // the status glyphs' stroke

// How long the wedge grows to a new share: the Ring's drain rule on the time left, so reduced motion
// and a fresh cooldown (a smaller share) step.
export const wedgeMs = (from: number, to: number, gap: number, reduced: boolean) =>
  drainMs(1 - from, 1 - to, gap, reduced);

// The drawing's measures, for the exploration sheets (one lowercase export: the catalogue reads capitals as
// components).
export const frame = { SIDE, MID, R, W };
export const glyph = (d: string, ink: string, w = W, effect?: ReactNode) => (
  <Group
    transform={[{ translateX: MID - INK / 2 }, { translateY: MID - INK / 2 }, { scale: INK / BOX }]}
  >
    <Path path={d} style="stroke" strokeWidth={w} strokeCap="round" strokeJoin="round" color={ink}>
      {effect}
    </Path>
  </Group>
);
export const disc = (r: number, color: string, effect?: ReactNode) => (
  <Circle cx={MID} cy={MID} r={r} color={color}>
    {effect}
  </Circle>
);
export const ring = (r: number, w: number, color: string, effect?: ReactNode) => (
  <Circle cx={MID} cy={MID} r={r} style="stroke" strokeWidth={w} strokeCap="round" color={color}>
    {effect}
  </Circle>
);
// A clockwise arc from 12 o'clock over `f` of the turn (the Ring's countdown direction, StatusIcon);
// `wedge` closes it through the centre. Worklets: the cooling wedge redraws on the UI thread.
export const arc = (r: number, f: number, wedge = false) => {
  'worklet';
  const a = 2 * Math.PI * f;
  const sweep = `A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${MID + r * Math.sin(a)} ${MID - r * Math.cos(a)}`;
  return wedge ? `M${MID} ${MID}L${MID} ${MID - r}${sweep}Z` : `M${MID} ${MID - r}${sweep}`;
};
const radii = (f: number) => {
  'worklet';
  const a = 2 * Math.PI * f;
  return `M${MID} ${MID}L${MID} ${MID - R}M${MID} ${MID}L${MID + R * Math.sin(a)} ${MID - R * Math.cos(a)}`;
};

// The Inked rule (icon-style-guide.md, States): fg disc and bg glyph; pressed thins by opacity.press;
// cooling is a dim disc with a fg wedge from 12 whose radii are seamed in bg (fg on dim is under 3:1);
// barred is the dim disc with no wedge; empty is a line hairline ring; focused adds the document ring's
// size and offset in action (drawn by the exploration sheet only: the real one is palette.ts useFocusRing).
export type State = 'ready' | 'pressed' | 'cooling' | 'barred' | 'focused' | 'empty';
type Wedge = {
  fill: ComponentProps<typeof Path>['path'];
  seams: ComponentProps<typeof Path>['path'];
};
// A still wedge over `f` of the turn (the exploration sheets' frames).
export const still = (f: number): Wedge => ({ fill: arc(R, f, true), seams: radii(f) });
export const inked = (c: Palette, d: string, state: State, wedge?: Wedge): ReactNode => {
  if (state === 'empty') return ring(R - size.rule / 2, size.rule, c.line);
  const off = state === 'cooling' || state === 'barred';
  return (
    <Group opacity={state === 'pressed' ? 1 - opacity.press : 1}>
      {disc(R, off ? c.dim : c.fg)}
      {state === 'cooling' && wedge && <Path path={wedge.fill} color={c.fg} />}
      {state === 'cooling' && wedge && (
        <Path path={wedge.seams} style="stroke" strokeWidth={size.rule} color={c.bg} />
      )}
      {glyph(d, c.bg)}
      {state === 'focused' && ring(R + size.focus + size.focus / 2, size.focus, c.action)}
    </Group>
  );
};

/**
 * One hotbar slot's Inked drawing: ready, cooling (its wedge at `share`), barred or empty.
 * - Use: Hotbar's slots only.
 * - Rules: aria-hidden; the slot's name carries the label. The wedge grows to each view's share over
 *   the real time since the last view (at most a second); reduced motion steps it. Pressing thins the
 *   slot (Hotbar), not the drawing.
 * - Story: CombatPage.stories.tsx
 */
export default function HotbarGlyph(p: { d: string; state: State; share?: number }) {
  const c = usePalette();
  const share = p.share ?? 0;
  const reduced = useReducedMotion();
  const shown = useSharedValue(share);
  const last = useRef({ share, at: 0 });
  // Before paint, so a jump never shows the old wedge for a frame (as StatusIcon's Ring).
  useLayoutEffect(() => {
    const at = performance.now();
    const ms = wedgeMs(last.current.share, share, at - last.current.at, reduced);
    last.current = { share, at };
    // ast-grep-ignore: mobile-book-effects-literals -- a clock hand's constant speed has no token (as the Ring)
    shown.value = ms ? withTiming(share, { duration: ms, easing: Easing.linear }) : share;
  }, [share, reduced, shown]);
  const fill = useDerivedValue(() => arc(R, shown.value, true));
  const seams = useDerivedValue(() => radii(shown.value));
  const cooling = p.state === 'cooling';
  return (
    // A still slot draws once and releases its WebGL context (the browser keeps about 16 live).
    <Canvas
      key={String(cooling)}
      aria-hidden
      __destroyWebGLContextAfterRender={!cooling}
      style={{ width: SIDE, height: SIDE }}
    >
      {inked(c, p.d, p.state, { fill, seams })}
    </Canvas>
  );
}
