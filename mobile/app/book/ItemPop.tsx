// The transient "+ item" under the log: the one exception to the room page anatomy.
import { useEffect, useState } from 'react';
import type { GameView } from '../../packages/game-view/session.ts';
import { onCue } from './cues.ts';
import {
  curveOf,
  InkText,
  interpolateColor,
  Reanimated,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from './fade.ts';
import { LABEL } from './labels.ts';
import { usePalette, useType } from './palette.ts';
import { motion } from './tokens.ts';

const { duration, hold, out, rise } = motion.pop;

function usePop() {
  const [ids, setIds] = useState<string[]>();
  const [first, setFirst] = useState(false);
  const up = useSharedValue(0);
  const gone = useSharedValue(0);
  useEffect(
    () =>
      onCue((cue) => {
        if (cue.name !== 'pickup') return;
        setIds(cue.ids);
        setFirst(!!cue.first);
        up.value = 0;
        // Never: under reduced motion it still appears and leaves; it only does not rise.
        const reduceMotion = ReduceMotion.Never;
        up.value = withTiming(1, { duration, easing: curveOf(motion.pop.easing), reduceMotion });
        gone.value = 0;
        gone.value = withDelay(
          duration + hold,
          withTiming(1, { duration: out, easing: curveOf(motion.pop.outEasing), reduceMotion }),
          reduceMotion,
        );
      }),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => setIds(undefined), duration + hold + out);
    return () => clearTimeout(timer);
  }, [ids]);
  return { ids, first, up, gone };
}

/**
 * What a pickup or a buy just added, under the log's last line (book-ui.md, Room page anatomy).
 * - Use: inside a plain View with LogLines, on the World page and the shop; a page turn drops it.
 * - Rules: reserves no layout, is not in the record, is hidden from assistive tech (the log line
 *   says it); the words are the view's item names. The first pickup's name is in `warning`.
 *   Reduced motion: it does not rise.
 * - States: one item; two on one line; none.
 * - Story: LogLines.stories.tsx
 */
export function ItemPop(p: { view: GameView; text: (key: string) => string }) {
  const c = usePalette();
  const t = useType();
  const still = useReducedMotion();
  const { ids, first, up, gone } = usePop();
  const place = useAnimatedStyle(() => ({
    opacity: up.value * (1 - gone.value),
    transform: [{ translateY: still ? 0 : rise * (1 - up.value) }],
  }));
  const ink = useAnimatedStyle(() => ({
    color: interpolateColor(up.value, [0, 1], [c.dim, first ? c.warning : c.action]),
  }));
  const names = (ids ?? []).flatMap((id) => {
    const item = p.view.inventory.find((e) => e.id === id);
    return item ? [p.text(item.name)] : [];
  });
  if (!names.length) return null;
  return (
    <Reanimated.View
      style={[{ position: 'absolute', top: '100%', left: 0, right: 0 }, place]}
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <InkText style={[t.small, ink]}>{LABEL.itemPop(names)}</InkText>
    </Reanimated.View>
  );
}
