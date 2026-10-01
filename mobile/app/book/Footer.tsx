// The footer: the map joystick between two hairline rules (the drawing: MapDrawing.tsx; the drag
// maths: joystick.ts). Press to zoom, drag toward a path to light it, release to walk, drag back
// to the middle to cancel; a tap opens the Map page. RN Animated and PanResponder only.
import { useRef, useState, type MutableRefObject } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
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
const hidden = { position: 'absolute' as const, width: 1, height: 1, opacity: 0.02 };
const TAP_MS = 500;
// ponytail: session memory only: the tip shows again after the app restarts.
let learned = false;

type Ui = {
  now: MutableRefObject<Props>;
  walk: (direction: string | null) => void;
  setLit: (d: string | null) => void;
  clearNote: () => void;
  zoom: Animated.Value;
  knob: Animated.ValueXY;
};

// The gesture. Distances are in map units (drag px / ZOOM); a drag under 2.5 units is still a tap.
function joystick(u: Ui) {
  const to = (v: number) =>
    Animated.timing(u.zoom, { toValue: v, duration: 160, useNativeDriver: true }).start();
  let d = { t: 0, moved: false, pick: null as string | null };
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      d = { t: Date.now(), moved: false, pick: null };
      u.clearNote();
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
    onPanResponderRelease: () =>
      !d.moved && Date.now() - d.t < TAP_MS ? u.now.current.openMap() : u.walk(d.pick),
    onPanResponderEnd: () => {
      u.setLit(null);
      u.knob.setValue({ x: 0, y: 0 });
      to(0);
    },
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
  const walk = (d: string | null) => {
    const e = now.current.exits.find((x) => x.direction === d);
    if (e?.available) {
      learned = true;
      setTip(false);
      now.current.go(e.direction);
    } else if (e) setNote(`${e.direction}: ${why(e, now.current.text)}`);
  };
  const [pan] = useState(() =>
    joystick({ now, walk, setLit, clearNote: () => setNote(''), zoom, knob }),
  );
  const e = p.exits.find((x) => x.direction === lit);
  const said = e ? `${e.direction}${e.available ? '' : ` · ${why(e, p.text)}`}` : note;
  const rule = { flex: 1, height: 1, backgroundColor: paper.line };
  return (
    <View>
      {tip && <Tip dismiss={() => ((learned = true), setTip(false))} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
        <View style={rule} />
        <View style={{ width: 56, height: 56 }} {...pan.panHandlers}>
          <MapDrawing exits={p.exits} lit={lit} zoom={zoom} knob={knob} />
          <Said text={said} />
          <Reachable exits={p.exits} text={p.text} walk={walk} openMap={p.openMap} />
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

// Hidden buttons so a screen reader can walk, and open the map, without the gesture.
function Reachable(p: Omit<Props, 'go'> & { walk: (direction: string) => void }) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Map"
        onPress={p.openMap}
        style={hidden}
      />
      {p.exits.map((x) => (
        <Pressable
          key={x.direction}
          accessibilityRole="button"
          accessibilityLabel={`Go ${x.direction}${x.available ? '' : `, ${why(x, p.text)}`}`}
          onPress={() => p.walk(x.direction)}
          style={hidden}
        />
      ))}
    </>
  );
}
