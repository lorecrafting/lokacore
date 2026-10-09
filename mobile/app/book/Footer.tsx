// The footer: the map joystick between two hairline rules (the drawing: MapDrawing.tsx; the drag
// maths: joystick.ts). Press to zoom, drag toward a path to light it, release to walk, drag back
// to the middle to cancel; a tap opens the Map page. RN Animated and PanResponder only.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { gesture, sideOf, SPOT, type Ui } from './joystick.ts';
import { MapDrawing } from './MapDrawing.tsx';
import { refused, why, type Hint } from './model.ts';
import { Control } from './pages.tsx';
import { usePalette, type Palette } from './palette.ts';
import { motion, radius, size, space, type } from './tokens.ts';

type Props = {
  keyboardEnabled: boolean;
  exits: readonly GameView['exits'][number][];
  text: (key: string) => string;
  go: (direction: string) => void; // walks to an open exit
  refused: (line: string) => void; // a drag toward a closed exit: its line for the log
  openMap: () => void;
  learned: Hint; // the shell's first-run store: the tip shows until the first walk or map tap
};
const rule = (c: Palette) => ({
  width: size.footerRule,
  height: size.rule,
  backgroundColor: c.line,
});
const keys: Record<string, string> = {
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowLeft: 'west',
  ArrowRight: 'east',
  PageUp: 'up',
  PageDown: 'down',
};

// ponytail: react-native-web's announceForAccessibility is a no-op; a web build needs a live region.
// A walk keeps the action/context from `at` (drag start); the presenter revalidates its token.
export function Footer(p: Props) {
  const c = usePalette();
  const [lit, setLit] = useState<string | null>(null);
  const [note, setNote] = useState(''); // a closed exit's reason, kept after release until the next press
  const [tip, setTip] = useState(() => !p.learned.seen());
  const zoom = useRef(new Animated.Value(0)).current;
  const [knob, setKnob] = useState({ x: 0, y: 0 }); // your dot's offset, in zoomed px
  const now = useRef(p);
  now.current = p;
  const learn = () => (p.learned.see(), setTip(false)); // a walk, or a map tap
  const walk = walker(learn, setNote);
  useEffect(() => {
    if (!p.keyboardEnabled || typeof document === 'undefined') return;
    const keydown = arrowKeys(now, walk);
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [p.keyboardEnabled]);
  const openMap = () => (now.current.openMap(), learn());
  const [pan] = useState(() => responder({ now, walk, openMap, setLit, setNote }, zoom, setKnob));
  const e = p.exits.find((x) => x.direction === lit);
  const said = e ? `${e.direction}${e.available ? '' : ` · ${why(e, p.text)}`}` : note;
  return (
    <View>
      {tip && <Tip dismiss={learn} />}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: space.sm,
        }}
      >
        <View style={rule(c)} />
        <View
          style={{ width: size.minimap, height: size.minimap, zIndex: 1 }} // above the rules: the zoomed map covers them
          {...readerActions(p.exits, (d) => walk(d, p), openMap)}
          {...pan.panHandlers}
        >
          <MapDrawing exits={p.exits} lit={lit} zoom={zoom} knob={knob} />
          <Said text={said} side={sideOf(lit)} />
        </View>
        <View style={rule(c)} />
      </View>
    </View>
  );
}

// An open exit walks (and teaches the tip); a closed one shows, announces and logs its reason.
const walker =
  (learn: () => void, setNote: (note: string) => void) => (d: string | null, at: Props) => {
    const e = at.exits.find((x) => x.direction === d);
    if (e?.available) (at.go(e.direction), learn());
    else if (e) {
      const reason = why(e, at.text); // a screen reader hears it too
      (setNote(`${e.direction}: ${reason}`), AccessibilityInfo.announceForAccessibility(reason));
      at.refused(refused(e, at.text));
    }
  };

// Arrow and Page keys walk, unless a modifier is held or focus is in a text field or dialog.
function arrowKeys(now: { current: Props }, walk: (d: string | null, at: Props) => void) {
  return (event: KeyboardEvent) => {
    const direction = keys[event.key];
    if (
      !direction ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [aria-modal="true"]',
      )
    )
      return;
    if (!now.current.exits.some((exit) => exit.direction === direction)) return;
    event.preventDefault();
    walk(direction, now.current);
  };
}

// The drag (joystick.ts `gesture`) over RN's PanResponder and the drawing's Animated values.
function responder(
  u: Omit<Ui<Props>, 'zoom' | 'knob'>,
  zoom: Animated.Value,
  setKnob: (k: { x: number; y: number }) => void,
) {
  const to = (v: number) =>
    Animated.timing(zoom, {
      toValue: v,
      duration: motion.quick.duration,
      useNativeDriver: true,
    }).start();
  return PanResponder.create(gesture({ ...u, zoom: to, knob: (x, y) => setKnob({ x, y }) }));
}

// The first-run tip: an `fg` bubble, its words in `bg`, Got it right-aligned inside it.
export function Tip({ dismiss }: { dismiss: () => void }) {
  const c = usePalette();
  return (
    <View
      style={{
        backgroundColor: c.fg,
        borderRadius: radius.card,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        alignSelf: 'center',
        marginHorizontal: space.page,
      }}
    >
      <Text style={{ ...type.small, color: c.bg }}>
        Hold the map and drag toward a path to walk; tap it to open the map.
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Control label="Got it" onPress={dismiss} onInk />
      </View>
    </View>
  );
}

// The lit exit's name (and why it is closed), or a closed exit's reason after release, on the side
// opposite the drag (joystick.ts `sideOf`, placed by `SPOT`).
function Said({ text, side }: { text: string; side: keyof typeof SPOT }) {
  const c = usePalette();
  return (
    text !== '' && (
      <Text
        pointerEvents="none"
        style={{ ...type.small, position: 'absolute', ...SPOT[side], color: c.fg }}
      >
        {text}
      </Text>
    )
  );
}

// A screen reader gets the map as one button: activate opens the Map page, and each exit is an
// action ("Go north") that walks (a closed one announces its reason). No touch targets to collide.
function readerActions(
  exits: Props['exits'],
  walk: (direction: string) => void,
  openMap: () => void,
) {
  return {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel: 'Map',
    accessibilityActions: [
      { name: 'activate' },
      ...exits.map((x) => ({ name: x.direction, label: `Go ${x.direction}` })),
    ],
    onAccessibilityAction: (a: { nativeEvent: { actionName: string } }) =>
      a.nativeEvent.actionName === 'activate' ? openMap() : walk(a.nativeEvent.actionName),
  };
}
