// The dev pulse: a haptic seen where no phone can be felt.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import { onPulse, type HapticKind } from './haptic';
import { usePalette, useType } from './palette.ts';
import { motion, size } from './tokens.ts';

/**
 * A ring round the Book column naming the haptic kind that just fired.
 * - Use: the Book column, outside the page turn.
 * - Rules: preview and Storybook only: a player build never notifies it. No touch or focus; hidden
 *   from screen readers.
 * - States: hidden; showing a kind.
 * - Story: HapticPulse.stories.tsx
 */
export function HapticPulse() {
  const [c, t] = [usePalette(), useType()];
  const [kind, setKind] = useState<HapticKind>();
  useEffect(() => onPulse(setKind), []);
  useEffect(() => {
    if (!kind) return;
    const done = setTimeout(() => setKind(undefined), motion.fade.duration);
    return () => clearTimeout(done);
  }, [kind]);
  if (!kind) return null;
  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        borderWidth: size.focus,
        borderColor: c.action,
      }}
    >
      <Text style={{ ...t.small, color: c.action }}>{kind}</Text>
    </View>
  );
}
