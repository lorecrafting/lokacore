// The footer: the map joystick between two hairline rules (the drawing: MapDrawing.tsx; the drag
// maths: joystick.ts). Press to zoom, drag toward a path to light it, release to walk, drag back
// to the middle to cancel; a tap opens the Map page. RN Animated and PanResponder only.
import { useRef, useState, type MutableRefObject } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, Text, View } from 'react-native';
import type { GameView } from '../../authority/local-story/smoke.ts';
import { pick, STAIR, ZOOM } from './joystick.ts';
import { MapDrawing } from './MapDrawing.tsx';
import { why } from './model.ts';
import { body, paper } from './paper.ts';

type Props = {
  exits: readonly GameView['exits'][number][];
  text: (key: string) => string;
  go: (direction: string) => void; // walks to an open exit
  openMap: () => void;
};
const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };
const TAP_MS = 500;
const rule = { flex: 1, height: 1, backgroundColor: paper.line };
// ponytail: session memory only: the tip shows again after the app restarts.
let learned = false;

type Ui = {
  now: MutableRefObject<Props>;
  walk: (direction: string | null) => void;
  openMap: () => void;
  setLit: (d: string | null) => void;
  setNote: (s: string) => void;
  zoom: Animated.Value;
  knob: Animated.ValueXY;
};

// The gesture. Distances are in map units (drag px / ZOOM); a drag under 2.5 units is still a tap.
function joystick(u: Ui) {
  const to = (v: number) =>
    Animated.timing(u.zoom, { toValue: v, duration: 160, useNativeDriver: true }).start();
  const reset = () => {
    u.setLit(null);
    u.knob.setValue({ x: 0, y: 0 });
    to(0);
  };
  let d = { t: 0, moved: false, pick: null as string | null };
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      d = { t: Date.now(), moved: false, pick: null };
      u.setNote('');
      to(1);
    },
    onPanResponderMove: (_, g) => {
      const [dx, dy] = [g.dx / ZOOM, g.dy / ZOOM];
      d.moved ||= Math.hypot(dx, dy) > 2.5;
      if (!d.moved) return;
      d.pick = pick(
        dx,
        dy,
        u.now.current.exits.map((e) => e.direction),
      );
      u.setLit(d.pick);
      const stair = d.pick && STAIR[d.pick];
      const k = Math.min(1, 17 / (Math.hypot(dx, dy) || 1)); // the dot stays inside the map
      u.knob.setValue(
        stair ? { x: stair[0] * ZOOM, y: stair[1] * ZOOM } : { x: dx * k * ZOOM, y: dy * k * ZOOM },
      );
    },
    onPanResponderRelease: () => {
      !d.moved && Date.now() - d.t < TAP_MS ? u.openMap() : u.walk(d.pick);
      reset();
    },
    onPanResponderTerminate: reset, // a stolen gesture walks nowhere
  });
}

export function Footer(p: Props) {
  const [lit, setLit] = useState<string | null>(null);
  const [note, setNote] = useState(''); // a closed exit's reason, kept after release until the next press
  const [tip, setTip] = useState(!learned);
  const zoom = useRef(new Animated.Value(0)).current;
  const knob = useRef(new Animated.ValueXY()).current;
  const now = useRef(p);
  now.current = p;
  const learn = () => ((learned = true), setTip(false)); // a walk or a tap that opens the map
  const walk = (d: string | null) => {
    const e = now.current.exits.find((x) => x.direction === d);
    if (e?.available) (now.current.go(e.direction), learn());
    else if (e) {
      const reason = why(e, now.current.text); // a screen reader hears it too
      (setNote(`${e.direction}: ${reason}`), AccessibilityInfo.announceForAccessibility(reason));
    }
  };
  const openMap = () => (now.current.openMap(), learn());
  const [pan] = useState(() => joystick({ now, walk, openMap, setLit, setNote, zoom, knob }));
  const e = p.exits.find((x) => x.direction === lit);
  const said = e ? `${e.direction}${e.available ? '' : ` · ${why(e, p.text)}`}` : note;
  return (
    <View>
      {tip && <Tip dismiss={learn} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
        <View style={rule} />
        <View
          style={{ width: 56, height: 56, zIndex: 1 }} // above the rules: the zoomed map covers them
          {...readerActions(p.exits, walk, openMap)}
          {...pan.panHandlers}
        >
          <MapDrawing exits={p.exits} lit={lit} zoom={zoom} knob={knob} />
          <Said text={said} />
        </View>
        <View style={rule} />
      </View>
    </View>
  );
}

function Tip({ dismiss }: { dismiss: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...small, color: paper.dim, flexShrink: 1, textAlign: 'center' }}>
        Hold the map and drag toward a path to walk; tap it to open the map.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Got it"
        onPress={dismiss}
        style={{ minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ ...small, color: paper.accent }}>got it</Text>
      </Pressable>
    </View>
  );
}

// The lit exit's name (and why it is closed), or a closed exit's reason after release.
function Said({ text }: { text: string }) {
  return (
    text !== '' && (
      <Text
        pointerEvents="none"
        style={{
          ...small,
          position: 'absolute',
          bottom: 28 + 14 * ZOOM + 8,
          left: -120,
          right: -120,
          textAlign: 'center',
          color: paper.fg,
        }}
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
