// The experience rule under the status row (book-ui.md, Levelling details).
import { useEffect } from 'react';
import { View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import {
  curveOf,
  interpolateColor,
  Reanimated,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from './fade.ts';
import { usePalette } from './palette.ts';
import { motion, size } from './tokens.ts';

/** What the rule last drew: kept by its caller, since the status line unmounts on a detail page. */
export type RuleDrawn = { current?: { level: number; at: number } };

export type ExperienceRuleProps = {
  levelling: NonNullable<GameView['levelling']>;
  drawn: RuleDrawn;
};

const dryCurve = curveOf(motion.dry.easing);
const CUT = 0; // the turn to `warning` has no width
const reduceMotion = ReduceMotion.Never; // the hold is a colour, so each timing decides for itself
const fraction = ({ experience, from, next }: NonNullable<GameView['levelling']>) =>
  next === undefined ? 1 : (experience - from) / (next - from);

/**
 * A thin rule of progress to the next level, read from the view (book-ui.md, Levelling details).
 * - Use: StatusLine only, directly below its row.
 * - Rules: no touch target, no accessible element (the gained line is read, the number is on
 *   Character), no layout change as it fills. Never flashes. Full at the top level.
 * - States: at rest; gain (grows over `motion.dry`); loss (falls); a level, one or more (full,
 *   `warning` for `motion.settle.hold`, then `fg` at the new fraction); first draw (no animation);
 *   return from a page without the status line (runs from the value last drawn); reduced motion
 *   (the width cuts, the hold stays).
 * - Story: ExperienceRule.stories.tsx
 */
export function ExperienceRule(p: ExperienceRuleProps) {
  const c = usePalette();
  const still = useReducedMotion();
  const { level } = p.levelling;
  const at = fraction(p.levelling);
  const fill = useSharedValue(p.drawn.current?.at ?? at);
  const gilt = useSharedValue(0);
  useEffect(() => {
    const last = p.drawn.current;
    p.drawn.current = { level, at };
    if (!last || (last.level === level && last.at === at)) return;
    const duration = still ? 0 : motion.dry.duration;
    const move = (to: number) => withTiming(to, { duration, easing: dryCurve, reduceMotion });
    if (level > last.level) {
      fill.value = withSequence(
        reduceMotion,
        move(1),
        withDelay(motion.settle.hold, move(at), reduceMotion),
      );
      gilt.value = withSequence(
        reduceMotion,
        withDelay(duration, withTiming(1, { duration: CUT, reduceMotion }), reduceMotion),
        withDelay(motion.settle.hold, move(0), reduceMotion),
      );
    } else {
      fill.value = move(at);
      gilt.value = move(0); // a change landing inside a level's hold ends it
    }
  }, [level, at, still]);
  const ink = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
    backgroundColor: interpolateColor(gilt.value, [0, 1], [c.fg, c.warning]),
  }));
  return (
    <View style={{ backgroundColor: c.line }} pointerEvents="none" aria-hidden>
      <Reanimated.View style={[{ height: size.experienceRule, transformOrigin: 'left' }, ink]} />
    </View>
  );
}
