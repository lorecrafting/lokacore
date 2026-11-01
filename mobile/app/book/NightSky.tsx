// The night sky over the page. RN Animated only (Footer's precedent), so node tests load it.
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { curveOf, useReducedMotion } from './fade.ts';
import { motion, nightSky, size } from './tokens.ts';

// A drawing, not spacing (the catalogue's map exemption): the mock's meteor, 315 px/s down-left
// for motion.meteor, its tail .18 s long (the streak's left end is the head, the tail trails
// up-right); a new one on average every 9 s (the mock's dt/9 chance).
const streak = { dx: -220, dy: 88, tail: 60, angle: '-22deg', every: 9000 };
const stars = 36;

const over = {
  style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  'aria-hidden': true,
  importantForAccessibility: 'no-hide-descendants',
  accessibilityElementsHidden: true,
  ...({ inert: true } as object),
} as const;

// The same sky every night: a fixed pseudo-random scatter (LCG), as a fraction of the page.
const field = (() => {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: stars }, () => ({
    x: next(),
    y: next(),
    size: 1 + next(),
    opacity: 0.2 + 0.45 * next(),
  }));
})();

type Streak = { x: number; y: number; k: Animated.Value }; // one shooting star: its start and progress

// Shows a shooting star now and then until the returned stop (the effect's cleanup: dawn's
// unmount or a new size), which also keeps the one in flight from scheduling the next.
export function meteors(box: { width: number; height: number }, show: (s: Streak) => void) {
  let live = true;
  let timer: ReturnType<typeof setTimeout>;
  const later = () => (timer = setTimeout(fall, -streak.every * Math.log(1 - Math.random())));
  const fall = () => {
    const k = new Animated.Value(0);
    show({ x: (0.2 + 0.9 * Math.random()) * box.width, y: 0.3 * Math.random() * box.height, k });
    Animated.timing(k, {
      toValue: 1,
      duration: motion.meteor.duration,
      // ast-grep-ignore: mobile-book-effects-literals -- predates the check; a meteor's constant speed has no token
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => live && later());
  };
  later();
  return () => {
    live = false;
    clearTimeout(timer);
  };
}

// Two groups in opposed phase: each star's own opacity, carried from 1 to .6 of it by its group.
const low = 0.6; // mutate-skip: uncalibrated design value
const starViews = field.map((s, i) => (
  <View
    key={i}
    style={{
      position: 'absolute',
      left: `${s.x * 100}%`,
      top: `${s.y * 100}%`,
      width: s.size,
      height: s.size,
      borderRadius: s.size / 2,
      backgroundColor: nightSky.star,
      opacity: s.opacity,
    }}
  />
));

const groups = [starViews.filter((_, i) => i % 2 === 0), starViews.filter((_, i) => i % 2 === 1)];

function useTwinkle(still: boolean) {
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const to = (toValue: number) =>
      Animated.timing(phase, {
        toValue,
        duration: motion.breathe.duration,
        easing: curveOf(motion.breathe.easing),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([to(1), to(0)]));
    loop.start();
    return () => loop.stop();
  }, [still, phase]);
  return [
    phase.interpolate({ inputRange: [0, 1], outputRange: [1, low] }),
    phase.interpolate({ inputRange: [0, 1], outputRange: [low, 1] }),
  ];
}

function Meteor({ falling }: { falling: Streak }) {
  const along = (from: number, by: number) =>
    falling.k.interpolate({ inputRange: [0, 1], outputRange: [from, from + by] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: streak.tail,
        height: size.rule,
        backgroundColor: nightSky.star,
        transformOrigin: '0% 50%',
        opacity: along(0.9, -0.9),
        transform: [
          { translateX: along(falling.x, streak.dx) },
          { translateY: along(falling.y, streak.dy) },
          { rotate: streak.angle },
        ],
      }}
    />
  );
}

/**
 * Faint fixed stars and, on average every 9 s, one shooting star over the whole Book.
 * - Use: while the shown palette is `dark`.
 * - Rules: decoration, never information; takes no touch, focus or screen-reader node. The star
 *   field is a drawing: the same sky every night.
 * - States: night (two star groups twinkle in opposed phase); reduced motion (still stars only).
 * - Story: NightSky.stories.tsx
 */
export function NightSky() {
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [falling, setFalling] = useState<Streak>();
  const twinkle = useTwinkle(reduced);
  useEffect(
    () => (reduced || !box.width ? undefined : meteors(box, setFalling)),
    [reduced, box.width, box.height],
  );
  return (
    <View
      {...over}
      onLayout={({ nativeEvent: { layout: l } }) => setBox({ width: l.width, height: l.height })}
    >
      {groups.map((stars, i) => (
        <Animated.View key={i} style={[over.style, !reduced && { opacity: twinkle[i] }]}>
          {stars}
        </Animated.View>
      ))}
      {falling && !reduced && <Meteor falling={falling} />}
    </View>
  );
}
