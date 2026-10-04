// The footer: the map joystick between two hairline rules (the drawing: MapDrawing.tsx; the drag
// maths: joystick.ts). Press to zoom, drag toward a path to light it, release to walk, drag back
// to the middle to cancel; a tap opens the Map page. RN Animated and PanResponder only.
import { useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { gesture, sideOf, ZOOM, type Ui } from './joystick.ts';
import { MapDrawing } from './MapDrawing.tsx';
import { branch, refused, said, why, type Hint, type Pool } from './model.ts';
import { band, Tap } from './pages.tsx';
import { body, paper } from './paper.ts';

type Props = {
  exits: readonly GameView['exits'][number][];
  text: (key: string) => string;
  go: (direction: string) => void; // walks to an open exit
  refused: (line: string) => void; // a drag toward a closed exit: its line for the log
  openMap: () => void;
  learned: Hint; // the shell's first-run store: the tip shows until the first walk or map tap
};
const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };
const rule = { flex: 1, height: 1, backgroundColor: paper.line };

// ponytail: react-native-web's announceForAccessibility is a no-op; a web build needs a live region.
// A walk goes by the props it was offered on (`at`: a drag's start), never newer ones (04 §16).
export function Footer(p: Props) {
  const [lit, setLit] = useState<string | null>(null);
  const [note, setNote] = useState(''); // a closed exit's reason, kept after release until the next press
  const [tip, setTip] = useState(() => !p.learned.seen());
  const zoom = useRef(new Animated.Value(0)).current;
  const [knob, setKnob] = useState({ x: 0, y: 0 }); // your dot's offset, in zoomed px
  const now = useRef(p);
  now.current = p;
  const learn = () => (p.learned.see(), setTip(false)); // a walk, or a map tap
  const walk = (d: string | null, at: Props) => {
    const e = at.exits.find((x) => x.direction === d);
    if (e?.available) (at.go(e.direction), learn());
    else if (e) {
      const reason = why(e, at.text); // a screen reader hears it too
      (setNote(`${e.direction}: ${reason}`), AccessibilityInfo.announceForAccessibility(reason));
      at.refused(refused(e, at.text));
    }
  };
  const openMap = () => (now.current.openMap(), learn());
  const [pan] = useState(() => responder({ now, walk, openMap, setLit, setNote }, zoom, setKnob));
  const e = p.exits.find((x) => x.direction === lit);
  const said = e ? `${e.direction}${e.available ? '' : ` · ${why(e, p.text)}`}` : note;
  return (
    <View>
      {tip && <Tip dismiss={learn} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
        <View style={rule} />
        <View
          style={{ width: 56, height: 56, zIndex: 1 }} // above the rules: the zoomed map covers them
          {...readerActions(p.exits, (d) => walk(d, p), openMap)}
          {...pan.panHandlers}
        >
          <MapDrawing exits={p.exits} lit={lit} zoom={zoom} knob={knob} />
          <Said text={said} side={sideOf(lit)} />
        </View>
        <View style={rule} />
      </View>
    </View>
  );
}

// The drag (joystick.ts `gesture`) over RN's PanResponder and the drawing's Animated values.
function responder(
  u: Omit<Ui<Props>, 'zoom' | 'knob'>,
  zoom: Animated.Value,
  setKnob: (k: { x: number; y: number }) => void,
) {
  const to = (v: number) =>
    Animated.timing(zoom, { toValue: v, duration: 160, useNativeDriver: true }).start();
  return PanResponder.create(gesture({ ...u, zoom: to, knob: (x, y) => setKnob({ x, y }) }));
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

// The lit exit's name (and why it is closed), or a closed exit's reason after release, on the side
// opposite the drag (joystick.ts `sideOf`); 44 px from the middle clears the zoomed exit rings.
const AWAY = 28 + 14 * ZOOM + 8;
const SPOT = {
  above: { bottom: AWAY, left: -120, right: -120, textAlign: 'center' },
  below: { top: AWAY, left: -120, right: -120, textAlign: 'center' },
  left: { top: 19, right: AWAY, width: 120, textAlign: 'right' },
  right: { top: 19, left: AWAY, width: 120, textAlign: 'left' },
} as const;
function Said({ text, side }: { text: string; side: keyof typeof SPOT }) {
  return (
    text !== '' && (
      <Text
        pointerEvents="none"
        style={{ ...small, position: 'absolute', ...SPOT[side], color: paper.fg }}
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

// One line: the time as its earthly branch, then the resource button, which shows the body's
// resources coloured by band when GameView carries them (the room-view status line, an owner-
// ruled departure) and opens Contents, the index of the existing book sections.
type StatusProps = {
  time: number;
  resources?: readonly Pool[];
  position?: GameView['position'];
  text: (key: string) => string;
  locked: boolean;
  pending: boolean;
  open: () => void;
  openPosition?: () => void;
};

export function Status(p: StatusProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: 14,
      }}
    >
      <Text style={{ ...small, color: paper.dim }} accessibilityLabel={branch(p.time).label}>
        {branch(p.time).glyph}
      </Text>
      {p.position && <Position value={p.position} open={p.openPosition} />}
      <Pressable
        disabled={p.locked}
        accessibilityRole="button"
        accessibilityLabel={p.resources ? `Contents, ${said(p.resources, p.text)}` : 'Contents'}
        onPress={p.open}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ ...small, color: paper.accent }}>
          {p.resources ? shown(p.resources) : 'character'}
        </Text>
      </Pressable>
      {p.pending && (
        <Text style={{ ...small, color: paper.dim, width: '100%', textAlign: 'center' }}>
          save not confirmed
        </Text>
      )}
    </View>
  );
}

// The resources as the status line shows them (coloured by band); its label is model.ts `said`.
const shown = (rs: readonly Pool[]) =>
  rs.map((r, i) => (
    <Text key={r.resource.key} style={{ color: band(r.tone) }}>
      {`${i ? '  ' : ''}${r.resource.key} ${r.current}/${r.maximum}`}
    </Text>
  ));

function Position(p: { value: NonNullable<GameView['position']>; open?: () => void }) {
  const words = (
    <Text style={{ ...small, color: paper.dim }} accessibilityLabel={`Position, ${p.value}`}>
      {p.value}
    </Text>
  );
  return p.open ? (
    <Tap label={`Position, ${p.value}`} onPress={p.open}>
      {words}
    </Tap>
  ) : (
    words
  );
}
