// size: allow 435, the icon, its arrival, its ring and its tooltip are one component's parts
// The status icon row below the status line.
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { canDraw } from './canDraw.ts';
import { onCue } from './cues.ts';
import {
  curveOf,
  Easing,
  FadeOut,
  Reanimated,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from './fade.ts';
import { bleedingParts, statusTip } from './model.ts';
import { usePress, useThin } from './press.ts';
import { usePalette, useType, type Palette } from './palette.ts';
import { fallback, glyphs } from './statusGlyphs.ts';
import { motion, radius, size, space, type } from './tokens.ts';

const StatusGlyph = lazy(() => import('./StatusGlyph.tsx'));

type Say = (key: string) => string;
type Look = 'buff' | 'debuff' | 'neutral';
// The drawing for a label text key, else its polarity's sign (statusGlyphs.ts).
export const drawingOf = (label: string, look: Look) => glyphs[label] ?? fallback[look];
type Condition = NonNullable<GameView['conditions']>[number];
type Props = {
  conditions: readonly Condition[];
  bleeding?: NonNullable<GameView['bleeding']>;
  time: number;
  text: Say;
  open?: () => void; // absent while locked
};

const CAP = 6; // icons that show whole; past it, one fewer and the +N disc
const MORE = 'more'; // the disc's hold key: no icon key lacks a "-count"

// One icon of the row: its key, label word, look, hold tip, name and ring share.
type Item = {
  key: string;
  label: string;
  word: string;
  look: Look;
  tip: string;
  name: string;
  fraction?: number;
};

// Bleeding (no ring until it carries a duration), then debuffs, neutral and buffs, each group in
// projected order: the threats stay in view when the disc takes the rest.
const itemsOf = (p: Props) => {
  const bleed = p.bleeding && bleedingParts(p.bleeding, p.time, p.text);
  const of = (look: Look) =>
    p.conditions
      .filter((c) => (c.kind ?? 'neutral') === look)
      .map((c) => {
        const tip = statusTip(c, p.time, p.text);
        const name = [tip, c.kind].filter(Boolean).join(', ');
        return {
          label: c.label,
          word: p.text(c.label),
          look,
          tip,
          name,
          fraction: ringFraction(c, p.time),
        };
      });
  const all: Omit<Item, 'key'>[] = [
    ...(p.bleeding && bleed
      ? [
          {
            label: p.bleeding.label,
            word: bleed[0]!,
            look: 'debuff' as const,
            tip: bleed.slice(0, 2).join(', '),
            name: [...bleed, 'debuff'].join(', '),
          },
        ]
      : []),
    ...of('debuff'),
    ...of('neutral'),
    ...of('buff'),
  ];
  // A label and its count so far, not the place: an icon going must not remount those after it.
  return all.map((x, i): Item => ({
    ...x,
    key: `${x.label}-${all.slice(0, i).filter((y) => y.label === x.label).length}`,
  }));
};

// The share of a timed status's duration still to run, 0 to 1, on each render; none when permanent.
export const ringFraction = (c: Condition, time: number) =>
  c.ends_at === undefined || c.duration === undefined
    ? undefined
    : Math.min(1, Math.max(0, (c.ends_at - time) / c.duration));

/**
 * The status icon row: one round, graphic-only icon per status (book-ui.md, Conditions details).
 * - Use: below the status line and its experience rule; no height while no icon shows.
 * - Rules: a tap opens Character; a hold, hover or focus shows a Tooltip; cap, order and ring are
 *   Conditions details. A 22 px disc in a 44 px box, boxes abutting (no gap, no hitSlop). Its
 *   drawing, keyed by label (statusGlyphs.ts), is a Skia stroke path in the look's ink: viewBox 24,
 *   drawn in the centred 14 px area (size.statusIcon − space.md), stroke 2.5 units, round caps
 *   and joins, no fill, inside 3 to 21, aria-hidden; no letters or emoji. No drawing: the polarity fallback (status-line-rulings.md).
 * - States: bleeding (first, debuff look, no ring); buff; debuff; neutral; permanent; overflow
 *   (six show, seven or more show five and a +N disc whose tip lists the rest); held; focused; locked
 *   (pictures, not pressable); ring full, near empty, draining. Pops on arrival, fades on expiry;
 *   behind the disc neither (arriving, pushed or revealed); ticks are silent.
 * - Story: StatusIcon.stories.tsx
 */
export function StatusIcons(p: Props) {
  const [held, setHeld] = useState<string>(); // the held icon's label: its tip follows the clock
  const items = itemsOf(p);
  const shown = items.length > CAP ? CAP - 1 : items.length;
  const hidden = items.slice(shown).map((x) => x.word);
  const hold = (k: string) => (on: boolean) => setHeld((h) => (on ? k : h === k ? undefined : h));
  const tips = new Map(items.slice(0, shown).map((x) => [x.key, x.tip]));
  const tip =
    p.open && held ? (held === MORE ? hidden.join(', ') || undefined : tips.get(held)) : undefined;
  // An icon that unmounts or hides (locked, expired, pushed) never blurs: its hold is let go here.
  if (held !== undefined && !tip) setHeld(undefined);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {/* First: a Reanimated exit whose next sibling unmounts with it stays on web (Focused story) */}
      {tip && <Tooltip text={tip} />}
      {items.map((x, i) => (
        <Arrival key={x.key} label={x.label} hidden={i >= shown}>
          <Icon
            look={x.look}
            name={x.name}
            fraction={x.fraction}
            hold={hold(x.key)}
            open={p.open}
            d={drawingOf(x.label, x.look)}
          />
        </Arrival>
      ))}
      {hidden.length > 0 && (
        <Icon
          look="neutral"
          name={[`+${hidden.length} more`, ...hidden].join(', ')}
          hold={hold(MORE)}
          open={p.open}
        >
          {`+${hidden.length}`}
        </Icon>
      )}
    </View>
  );
}

const popCurve = curveOf(motion.pop.easing);

// Pops on its `status_in` cue (so a tick or a page return does not), appears under reduced motion
// or behind the disc, and fades on expiry. Behind the disc it stays mounted, hidden: pushed there it
// does not fade, back it does not pop.
function Arrival(p: { label: string; hidden: boolean; children: ReactNode }) {
  const still = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(
    () =>
      onCue((cue) => {
        if (still || p.hidden || cue.name !== 'status_in' || !cue.ids?.includes(p.label)) return;
        scale.value = motion.pop.from;
        scale.value = withTiming(1, { duration: motion.pop.duration, easing: popCurve });
      }),
    [still, p.label, p.hidden], // eslint-disable-line
  );
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Reanimated.View
      style={[style, p.hidden && { display: 'none' }]}
      aria-hidden={p.hidden}
      exiting={FadeOut.duration(motion.fade.duration).reduceMotion(ReduceMotion.Never)}
    >
      {p.children}
    </Reanimated.View>
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
// size: allow 45, the drawing and the +N text are both a disc's face
function Icon(p: {
  look: Look;
  name: string;
  fraction?: number; // the countdown ring's remaining arc; absent, no ring
  hold?: (on: boolean) => void;
  open?: () => void;
  d?: string; // the drawing; absent, the text (the +N disc)
  children?: string;
}) {
  const face = (
    <Disc look={p.open ? p.look : 'neutral'} d={p.d}>
      {p.children}
    </Disc>
  );
  const disc = ringed(p.fraction, !p.open, face);
  const press = usePress();
  const ink = useThin(press, false);
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
      onPress={() => p.open?.()} // no press event: open takes none
      onLongPress={show}
      onPressIn={press.handlers.onPressIn}
      onPressOut={() => (press.handlers.onPressOut(), hide())}
      onHoverIn={show}
      onHoverOut={hide}
      onFocus={show}
      onBlur={hide}
      style={box}
    >
      <Reanimated.View style={ink}>{disc}</Reanimated.View>
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

// How long the arc drains to a new value, display only (book-ui.md Conditions): the real time since
// the last view change, capped at a second; the first view, a refresh (more left) and reduced motion
// jump (0).
export const drainMs = (from: number, to: number, gap: number, reduced: boolean) =>
  reduced || to >= from ? 0 : Math.min(gap, 1000);
// Each half's turn for an arc of `deg`: the right half covers 0-180, the left the rest.
export const turns = (deg: number) => {
  'worklet';
  return { right: Math.min(deg, 180) - 180, left: Math.max(deg - 180, 0) };
};

/**
 * A condition's ring, draining as its time runs out.
 * - Use: StatusIcons, and Unavailable's rise card (book-ui.md, Spirit state).
 * - Story: StatusIcon.stories.tsx
 */
export function Ring(p: { fraction: number; locked: boolean; children?: ReactNode }) {
  const c = usePalette();
  const deg = 360 * p.fraction;
  const reduced = useReducedMotion();
  const shown = useSharedValue(deg);
  const last = useRef({ deg, at: 0 }); // the previous view's arc and when it came
  // Before paint, so a jump never shows the old arc for a frame (as PageTurn.tsx).
  useLayoutEffect(() => {
    const at = performance.now();
    const ms = drainMs(last.current.deg, deg, at - last.current.at, reduced);
    last.current = { deg, at };
    // ast-grep-ignore: mobile-book-effects-literals -- predates the check; a clock hand's constant speed has no token
    shown.value = ms ? withTiming(deg, { duration: ms, easing: Easing.linear }) : deg;
  }, [deg, reduced, shown]);
  const [track, arc] = p.locked ? [c.line, c.dim] : [c.dim, c.fg];
  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ ...circle, borderColor: track }} />
      <Half right shown={shown} color={arc} />
      <Half shown={shown} color={arc} />
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

// One half of the box, clipping a right half ring turned about the ring's centre; drawn only while
// the shown arc reaches into it, read per frame so a re-render mid-drain keeps it.
function Half(p: { right?: boolean; shown: { value: number }; color: string }) {
  const half = RING / 2;
  const right = !!p.right;
  const turn = useAnimatedStyle(() => {
    const t = turns(p.shown.value);
    // An empty half's ring rests on its clip edge; hide it so no antialiased seam shows there.
    const drawn = p.shown.value > (right ? 0 : 180);
    return { opacity: drawn ? 1 : 0, transform: [{ rotate: `${right ? t.right : t.left}deg` }] };
  });
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: right ? half : 0,
        width: half,
        height: RING,
        overflow: 'hidden',
      }}
    >
      <Reanimated.View
        style={[{ position: 'absolute', left: right ? -half : 0, width: RING, height: RING }, turn]}
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
      </Reanimated.View>
    </View>
  );
}

// The disc alone, so the countdown ring can wrap it.
function Disc(p: { look: Look; d?: string; children?: string }) {
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
      {p.d === undefined ? (
        // Fixed size, not useType(): "+N" sits in the fixed size.statusIcon disc, like the drawings.
        <Text aria-hidden style={{ ...type.label, color: l.ink }}>
          {p.children}
        </Text>
      ) : (
        canDraw() && (
          <Suspense fallback={null}>
            <StatusGlyph d={p.d} ink={l.ink} />
          </Suspense>
        )
      )}
    </View>
  );
}

/**
 * The Tip's bubble without Got it, over the icon row.
 * - Use: StatusIcons only.
 * - Rules: fades in (cut under reduced motion); never takes a touch.
 * - Story: StatusIcon.stories.tsx
 */
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
        <Text style={{ ...useType().small, color: c.bg }}>{text}</Text>
      </View>
    </Animated.View>
  );
}
