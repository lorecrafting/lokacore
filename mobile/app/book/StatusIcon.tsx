// The status icon row above the status line (BOOK-UI-COMPONENTS.md, Status icon): one round,
// graphic-only icon per condition, five then a +N disc. A tap opens Character; a hold (a hover on
// web) shows the label and time left in the Tip's look. Locked (scene, combat, chapter page), the
// discs are pictures, not buttons.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { useReducedMotion } from './fade.ts';
import { glyph } from './glyphs.ts';
import { statusTip } from './model.ts';
import { usePalette, type Palette } from './palette.ts';
import { motion, radius, size, space, type } from './tokens.ts';

type Say = (key: string) => string;
type Look = 'buff' | 'debuff' | 'neutral';
type Condition = NonNullable<GameView['conditions']>[number];
type Props = {
  conditions: readonly Condition[];
  time: number;
  text: Say;
  open?: () => void; // absent while locked
};

const SHOWN = 5; // icons before the +N disc

// The share of a timed status's duration still to run, 0 to 1, on each render; none when permanent.
export const ringFraction = (c: Condition, time: number) =>
  c.ends_at === undefined || c.duration === undefined
    ? undefined
    : Math.min(1, Math.max(0, (c.ends_at - time) / c.duration));

export function StatusIcons(p: Props) {
  // The held icon's label, so the tip follows the clock and goes with the icon or the lock.
  const [held, setHeld] = useState<string>();
  const shown = p.conditions.slice(0, SHOWN);
  const key = (x: Condition, i: number) => `${x.label}-${i}`;
  const tip = p.open ? shown.find((x, i) => key(x, i) === held) : undefined;
  // An icon that unmounts (locked, expired, moved) never blurs, so its hold is let go here.
  if (held !== undefined && !tip) setHeld(undefined);
  const more = p.conditions.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', columnGap: space.sm }}>
      {shown.map((x, i) => (
        <Icon
          key={key(x, i)}
          look={x.kind ?? 'neutral'}
          name={[statusTip(x, p.time, p.text), x.kind].filter(Boolean).join(', ')}
          fraction={ringFraction(x, p.time)}
          hold={(on) => setHeld((h) => (on ? key(x, i) : h === key(x, i) ? undefined : h))}
          open={p.open}
        >
          {glyph(x.label, x.kind)}
        </Icon>
      ))}
      {more > 0 && (
        <Icon look="neutral" name={`+${more} more`} open={p.open}>
          {`+${more}`}
        </Icon>
      )}
      {tip && <Tooltip text={statusTip(tip, p.time, p.text)} />}
    </View>
  );
}

const looks = (c: Palette) => ({
  buff: { fill: c.card, border: c.line, ink: c.fg },
  debuff: { fill: c.fg, border: c.danger, ink: c.bg },
  neutral: { fill: c.card, border: c.line, ink: c.dim },
});

const box = {
  width: size.touch,
  height: size.touch,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

// Locked, the disc goes dim like the Contents button (neutral: dim glyph; dim on a debuff's fg fill
// would not read).
function Icon(p: {
  look: Look;
  name: string;
  fraction?: number; // the countdown ring's remaining arc; absent, no ring
  hold?: (on: boolean) => void;
  open?: () => void;
  children: string;
}) {
  const face = <Disc look={p.open ? p.look : 'neutral'}>{p.children}</Disc>;
  const disc = ringed(p.fraction, !p.open, face);
  if (!p.open)
    return (
      <View accessibilityRole="image" accessibilityLabel={p.name} style={box}>
        {disc}
      </View>
    );
  const show = () => p.hold?.(true);
  const hide = () => p.hold?.(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, opens Character`}
      onPress={p.open}
      onLongPress={show}
      onPressOut={hide}
      onHoverIn={show}
      onHoverOut={hide}
      onFocus={show}
      onBlur={hide}
      style={box}
    >
      {disc}
    </Pressable>
  );
}

// The countdown ring (loka-x6t.65): a dim track and the remaining arc in fg (locked: a line track
// and a dim arc), clockwise from 12, a space.hair gap round the disc and inside the size.touch box,
// so row spacing stays. Two clipped halves turn a half ring each: the right shows 0-180 degrees,
// the left the rest.
const ringed = (fraction: number | undefined, locked: boolean, face: ReactNode) =>
  fraction === undefined ? face : <Ring {...{ fraction, locked }}>{face}</Ring>;
const RING = size.statusIcon + 2 * (space.hair + size.rule);
function Ring(p: { fraction: number; locked: boolean; children: ReactNode }) {
  const c = usePalette();
  const deg = 360 * p.fraction;
  const [track, arc] = p.locked ? [c.line, c.dim] : [c.dim, c.fg];
  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ ...circle, borderColor: track }} />
      {deg > 0 && <Half right turn={Math.min(deg, 180) - 180} color={arc} />}
      {deg > 180 && <Half turn={deg - 180} color={arc} />}
      {p.children}
    </View>
  );
}
const circle = {
  position: 'absolute',
  width: RING,
  height: RING,
  borderRadius: RING / 2,
  borderWidth: size.rule,
} as const;

// One half of the box, clipping a right half ring turned about the ring's centre.
function Half(p: { right?: boolean; turn: number; color: string }) {
  const half = RING / 2;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: p.right ? half : 0,
        width: half,
        height: RING,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: p.right ? -half : 0,
          width: RING,
          height: RING,
          transform: [{ rotate: `${p.turn}deg` }],
        }}
      >
        <View
          style={{
            ...circle,
            left: half,
            width: half,
            borderLeftWidth: 0,
            borderRadius: 0,
            borderTopRightRadius: half,
            borderBottomRightRadius: half,
            borderColor: p.color,
          }}
        />
      </View>
    </View>
  );
}

// The disc alone, so the countdown ring can wrap it.
function Disc(p: { look: Look; children: string }) {
  const l = looks(usePalette())[p.look];
  return (
    <View
      style={{
        width: size.statusIcon,
        height: size.statusIcon,
        borderRadius: size.statusIcon / 2,
        borderWidth: size.rule,
        borderColor: l.border,
        backgroundColor: l.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text aria-hidden style={{ ...type.label, color: l.ink }}>
        {p.children}
      </Text>
    </View>
  );
}

// The Tip's bubble (Footer.tsx Tip) without Got it, over the row; it fades in, cut under reduced
// motion, and never takes a touch.
export function Tooltip({ text }: { text: string }) {
  const c = usePalette();
  const reduced = useReducedMotion();
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced)
      shown.setValue(1); // also when reduced motion turns on mid-fade
    else
      Animated.timing(shown, {
        toValue: 1,
        duration: motion.fade.duration,
        useNativeDriver: true,
      }).start();
  }, [reduced, shown]);
  return (
    <Animated.View
      aria-hidden // the icon's name already carries the text
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: size.touch,
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity: shown,
      }}
    >
      <View
        style={{
          backgroundColor: c.fg,
          borderRadius: radius.card,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
        }}
      >
        <Text style={{ ...type.small, color: c.bg }}>{text}</Text>
      </View>
    </Animated.View>
  );
}
