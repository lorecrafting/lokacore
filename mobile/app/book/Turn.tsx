// The page turn: each new page swings in from its spine, built-in Animated only (no curl shader).
// ponytail: only the arriving page moves; the leaving page just goes. dir 1 forward, -1 back.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

export function Turn({ turn, dir, children }: { turn: number; dir: 1 | -1; children: ReactNode }) {
  const t = useRef(new Animated.Value(1)).current;
  const [turning, setTurning] = useState(false);
  useEffect(() => {
    setTurning(true);
    t.setValue(0);
    const animation = Animated.timing(t, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setTurning(false);
    });
    return () => animation.stop();
  }, [turn, t]);
  const angle = t.interpolate({ inputRange: [0, 1], outputRange: [`${70 * dir}deg`, '0deg'] });
  return (
    <Animated.View
      style={{
        flex: 1,
        ...(turning && {
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
          transformOrigin: dir === 1 ? 'left center' : 'right center',
          transform: [{ perspective: 900 }, { rotateY: angle }],
        }),
      }}
    >
      {children}
    </Animated.View>
  );
}
