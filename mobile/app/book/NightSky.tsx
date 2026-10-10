// The night sky over the page (BOOK-UI-COMPONENTS.md, Night sky): the Chapter 1 mock's moonlit
// page, a still field of faint stars and, now and then, one shooting star streaking down-left.
// Over everything, taking no touch or focus, like PageTurn's leaving leaf. Reduced motion keeps the
// stars and skips the shooting star. RN Animated only (Footer's precedent), so node tests load it.
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from './fade.ts';
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

export function NightSky() {
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [falling, setFalling] = useState<Streak>();
  useEffect(
    () => (reduced || !box.width ? undefined : meteors(box, setFalling)),
    [reduced, box.width, box.height],
  );
  const along = (from: number, by: number) =>
    falling!.k.interpolate({ inputRange: [0, 1], outputRange: [from, from + by] });
  return (
    <View
      {...over}
      onLayout={({ nativeEvent: { layout: l } }) => setBox({ width: l.width, height: l.height })}
    >
      {starViews}
      {falling && !reduced && (
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
      )}
    </View>
  );
}
