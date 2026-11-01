// The footer: the map joystick between two hairline rules (the drawing: MapDrawing.tsx; the drag
// maths: joystick.ts). Press to zoom, drag toward a path to light it, release to walk, drag back
// to the middle to cancel; a tap opens the Map page. RN Animated and PanResponder only.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { gesture, sideOf, SPOT, type Ui } from './joystick.ts';
import { MapDrawing } from './MapDrawing.tsx';
import { refused, why, type Hint } from './model.ts';
import type { Button, DetailLine } from './presenter.ts';
import { commandOf } from './buttons.ts';
import { InkText } from './fade.ts';
import { haptic } from './haptic';
import { useDry } from './press.ts';
import { Control } from './pages.tsx';
import { usePalette, useType, type Palette } from './palette.ts';
import { motion, radius, size, space } from './tokens.ts';
import { LABEL } from './labels.ts';

type Props = {
  keyboardEnabled: boolean;
  exits: readonly GameView['exits'][number][];
  text: (key: string) => string;
  go: (direction: string) => void; // walks to an open exit
  door: (direction: string) => Button[]; // the offered verbs on that exit's door
  press: (b: Button) => void;
  refused: (line: DetailLine) => void; // a drag toward a closed exit: its line for the log
  openMap: () => void;
  learned: Hint; // the shell's first-run store: the tip shows until the first walk or map tap
};
const rule = (c: Palette) => ({
  width: size.footerRule,
  height: size.rule,
  backgroundColor: c.line,
});
const row = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  columnGap: space.sm,
} as const;
const keys: Record<string, string> = {
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowLeft: 'west',
  ArrowRight: 'east',
  PageUp: 'up',
  PageDown: 'down',
};

// ponytail: announceForAccessibility is a no-op on web, where the live region (lines.tsx Heard)
// reads the refused line; where native maps aria-live too, the reason may be read twice (check on device).
/**
 * The map joystick between two hairline rules (book-ui.md, Minimap, map and presentation
 * controls).
 * - Use: under every page; its flanking rules are the World page's only divider above it, no rule over
 *   the footer.
 * - Rules: press to zoom, drag toward a path to light it, release to walk, drag back to the middle
 *   to cancel; a tap opens the Map page. Release toward a shut door presses its offered Unlock, else
 *   Open; with neither it logs the refusal ("The door to the south is locked."). Close and Lock are
 *   not drawn (owner 2026-10-30; book-ui.md, Verbs the Book does not draw). A walk keeps the action
 *   and context from the drag start; the presenter revalidates its token.
 * - States: at rest; held; an exit barred by a closed or a locked door.
 * - Story: Footer.stories.tsx
 */
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
      <View style={row}>
        <View style={rule(c)} />
        <View
          style={{ width: size.minimap, height: size.minimap, zIndex: 1 }} // above the rules: the zoomed map covers them
          {...readerActions(p, said, (d) => walk(d, p), openMap)}
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

// A shut door's way through on release: its offered Unlock, else Open (owner 2026-10-23).
export const doorPick = (door: Button[]) =>
  ['unlock', 'open'].flatMap((c) => door.filter((x) => commandOf(x) === c))[0];
export const pressDoor = (door: Button[], press: (b: Button) => void) => {
  const b = doorPick(door);
  if (b) press(b);
  return !!b;
};

// An open exit walks (and teaches the tip); a shut door opens or unlocks when it can; else the
// exit shows, announces and logs its reason.
const walker =
  (learn: () => void, setNote: (note: string) => void) => (d: string | null, at: Props) => {
    const e = at.exits.find((x) => x.direction === d);
    if (e?.available) (haptic('selection'), at.go(e.direction), learn());
    else if (e && pressDoor(at.door(e.direction), at.press)) setNote('');
    else if (e) {
      const line = refused(e, at.text); // its one sentence; a screen reader hears it too
      (haptic('warning'),
        setNote(line.text),
        AccessibilityInfo.announceForAccessibility(line.text));
      at.refused(line);
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

/**
 * The first-run tip: an ink bubble with Got it.
 * - Use: first run only.
 * - Story: Tip.stories.tsx
 */
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
      <Text style={{ ...useType().small, color: c.bg }}>
        Hold the map and drag toward a path to walk; tap it to open the map.
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Control label={LABEL.gotIt} onPress={dismiss} onInk />
      </View>
    </View>
  );
}

// The lit exit's name (and why it is closed), or a closed exit's reason after release, on the side
// opposite the drag (joystick.ts `sideOf`, placed by `SPOT`).
export function Said({ text, side }: { text: string; side: keyof typeof SPOT }) {
  return text !== '' && <SaidLabel key={text} text={text} side={side} />;
}

// Keyed on the words: a newly lit direction's label presses in, dim to `fg`.
function SaidLabel({ text, side }: { text: string; side: keyof typeof SPOT }) {
  const c = usePalette();
  const t = useType();
  const ink = useDry(c.fg, 0, motion.press.duration);
  return (
    <InkText
      pointerEvents="none"
      style={[t.small, { color: c.fg, position: 'absolute', ...SPOT[side] }, ink]}
    >
      {text}
    </InkText>
  );
}

// A screen reader gets the map as one button: activate opens the Map page, and each exit is an
// action ("Go north"; "Go west, locked") that walks as a release does. No touch targets to collide.
function readerActions(
  { exits, text }: Props,
  said: string, // shown inside the button while dragging: it leads the name (WCAG 2.5.3)
  walk: (direction: string) => void,
  openMap: () => void,
) {
  return {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel: said ? `${said}, ${LABEL.map}` : LABEL.map,
    accessibilityActions: [
      { name: 'activate' },
      ...exits.map((x) => ({
        name: x.direction,
        label: `Go ${x.direction}${x.available ? '' : `, ${why(x, text)}`}`,
      })),
    ],
    onAccessibilityAction: (a: { nativeEvent: { actionName: string } }) =>
      a.nativeEvent.actionName === 'activate' ? openMap() : walk(a.nativeEvent.actionName),
  };
}
