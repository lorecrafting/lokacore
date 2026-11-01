import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { Reanimated, useAnimatedStyle } from './fade.ts';
import { LABEL } from './labels.ts';
import { useDrawn, usePress, useThin } from './press.ts';
import { prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { motion, size } from './tokens.ts';

type Props = { view: GameView; text: (key: string) => string };
type Drawn = NonNullable<GameView['map']>;
type Room = Drawn['rooms'][number];
type At = { x: number; y: number };
// A drawing (BOOK-UI-COMPONENTS.md, design tokens: exempt from space tokens): one grid cell per
// room, a dot's radius, the current room's ring, and a stub's length toward an exit's open dot (open
// dots on neighbouring stubs stay 24 apart). The margin keeps an edge stub's touch target inside.
const [CELL, DOT, HERE, STUB] = [72, 6, 11, 32];
const MARGIN = STUB + size.touch / 2 - CELL / 2;
// Up and down point up-right and down-right, as the minimap's stair nodes do.
const AIM: Record<string, At> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  up: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  down: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};
// What this Map has shown since launch: the first opening draws nothing on, a reload replays nothing.
let shown: Set<string> | undefined;
const linkOf = (l: Drawn['links'][number]) => `${l.from}:${l.direction}`;
function inkNew(map: Drawn) {
  const ids = [...map.rooms.map((r) => r.id), ...map.links.map(linkOf)];
  const fresh = new Set(shown ? ids.filter((id) => !shown!.has(id)) : []);
  shown = new Set([...(shown ?? []), ...ids]);
  return fresh;
}

function spread(rooms: Room[]) {
  const low = (axis: 'x' | 'y') => Math.min(...rooms.map((r) => r[axis]));
  const high = (axis: 'x' | 'y') => Math.max(...rooms.map((r) => r[axis]));
  return {
    at: (r: Room): At => ({
      x: (r.x - low('x') + 0.5) * CELL + MARGIN,
      y: (r.y - low('y') + 0.5) * CELL + MARGIN,
    }),
    box: {
      width: (high('x') - low('x') + 1) * CELL + 2 * MARGIN,
      height: (high('y') - low('y') + 1) * CELL + 2 * MARGIN,
    },
  };
}

/**
 * The Map page's drawing: dots and lines, no actions and no names inside it (owner 2026-10-30).
 * - Use: the Map page.
 * - Rules: what is new since the Map last showed draws on over `motion.settle`, silent.
 *   A filled dot per visited room on the shown level, the current one ringed; a line per
 *   known exit; each unexplored exit a short line to an open dot, an up or down one drawn
 *   aslant. A tapped dot's room name, or "Unexplored", shows in the caption under the drawing.
 *   Every dot is a touch-sized button named by its room title. Colours are the minimap's roles.
 * - States: one level; two levels; unexplored exits; a dot tapped.
 * - Story: MapPage.stories.tsx
 */
export function DiscoveredMap({ view, text }: Props) {
  const c = usePalette();
  const t = useType();
  const map = view.map!;
  const current = map.rooms.find((r) => r.id === view.place.id);
  const [level, setLevel] = useState(current?.z ?? 0);
  const [caption, setCaption] = useState<string | null>(null);
  const [fresh] = useState(() => inkNew(map));
  const levels = [...new Set(map.rooms.map((r) => r.z))].sort((a, b) => a - b);
  const rooms = map.rooms.filter((r) => r.z === level);
  const { at, box } = spread(rooms);
  const dot = (r: Room) => (
    <Dot
      key={r.id}
      c={c}
      at={at(r)}
      name={text(r.title)}
      here={r === current}
      fresh={fresh.has(r.id)}
      tap={setCaption}
    />
  );
  return (
    <View>
      {levelBar(c, t, level, levels, (next) => (setLevel(next), setCaption(null)))}
      <Follow x={current?.z === level ? at(current).x - CELL / 2 - MARGIN : undefined}>
        <View style={box}>
          {lines(c, map, rooms, at, fresh)}
          {stubs(c, map, rooms, at, text, setCaption)}
          {rooms.map(dot)}
        </View>
      </Follow>
      <Text style={prose(c, t)}>{caption ?? ' '}</Text>
    </View>
  );
}

// The current-room marker stays visible (book-ui.md, Map): a narrow page scrolls to it when it is
// drawn and when its level is shown again, also when the drawing keeps its size.
function Follow(p: { x?: number; children: ReactNode }) {
  const scroller = useRef<ScrollView>(null);
  const follow = () => p.x !== undefined && scroller.current?.scrollTo({ x: p.x, animated: false });
  useEffect(() => void follow(), [p.x]);
  return (
    <ScrollView horizontal ref={scroller} onContentSizeChange={follow}>
      {p.children}
    </ScrollView>
  );
}

function levelBar(
  c: Palette,
  t: Type,
  level: number,
  levels: number[],
  step: (next: number) => void,
) {
  const index = levels.indexOf(level);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Pressable
        accessibilityRole="button"
        style={{ minHeight: size.touch, minWidth: size.touch }}
        accessibilityLabel="Previous map level"
        disabled={index <= 0}
        onPress={() => step(levels[index - 1])}
      >
        <Text aria-hidden style={prose(c, t)}>
          ←
        </Text>
      </Pressable>
      <Text style={prose(c, t)}>Level {level}</Text>
      <Pressable
        accessibilityRole="button"
        style={{ minHeight: size.touch, minWidth: size.touch }}
        accessibilityLabel="Next map level"
        disabled={index >= levels.length - 1}
        onPress={() => step(levels[index + 1])}
      >
        <Text aria-hidden style={prose(c, t)}>
          →
        </Text>
      </Pressable>
    </View>
  );
}

// Each known exit between two rooms on this level, centre to centre.
function lines(c: Palette, map: Drawn, rooms: Room[], at: (r: Room) => At, fresh: Set<string>) {
  return map.links.map((link) => {
    const a = rooms.find((r) => r.id === link.from),
      b = rooms.find((r) => r.id === link.to);
    const id = linkOf(link);
    return a && b && <Line key={id} c={c} from={at(a)} to={at(b)} fresh={fresh.has(id)} />;
  });
}

// Each unexplored exit from a room on this level: a short line to an open dot.
function stubs(
  c: Palette,
  map: Drawn,
  rooms: Room[],
  at: (r: Room) => At,
  text: Props['text'],
  tap: (caption: string) => void,
) {
  return map.unexplored.map((u) => {
    const from = rooms.find((r) => r.id === u.from);
    if (!from) return null;
    const a = at(from),
      b = { x: a.x + AIM[u.direction].x * STUB, y: a.y + AIM[u.direction].y * STUB };
    return (
      <View key={`${u.from}:${u.direction}`}>
        <Line c={c} from={a} to={b} />
        <Dot
          c={c}
          at={b}
          name={LABEL.unexplored}
          tap={tap}
          open
          label={LABEL.unexploredExit(u.direction, text(from.title))}
        />
      </View>
    );
  });
}

function Line(p: { c: Palette; from: At; to: At; fresh?: boolean }) {
  const [dx, dy] = [p.to.x - p.from.x, p.to.y - p.from.y];
  const length = Math.hypot(dx, dy);
  const rotate = `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`;
  const drawn = useDrawn(!!p.fresh, motion.settle);
  const trim = useAnimatedStyle(() => ({
    transform: [
      { rotate },
      { translateX: (drawn.value - 1) * (length / 2) }, // from its near end
      { scaleX: drawn.value },
    ],
  }));
  return (
    <Reanimated.View
      style={[
        {
          position: 'absolute',
          left: (p.from.x + p.to.x) / 2 - length / 2,
          top: (p.from.y + p.to.y) / 2 - size.rule / 2,
          width: length,
          height: size.rule,
          backgroundColor: p.c.dim,
        },
        trim,
      ]}
    />
  );
}

// A touch-sized button centred on its point; the dot drawn inside. The current room's is ringed in
// the action colour, so it is told by shape as well as colour; an unexplored one is open and muted.
const hit = {
  position: 'absolute',
  width: size.touch,
  height: size.touch,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const dotInk = (p: { c: Palette; here?: boolean; open?: boolean }) => ({
  borderWidth: p.open || p.here ? size.speechBar : 0,
  borderColor: p.here ? p.c.action : p.c.dim,
  backgroundColor: p.open ? p.c.bg : p.c.fg,
});

function Dot(p: {
  c: Palette;
  at: At;
  name: string;
  label?: string;
  here?: boolean;
  open?: boolean;
  fresh?: boolean;
  tap: (caption: string) => void;
}) {
  const r = p.here ? HERE : DOT;
  const press = usePress();
  const ink = useThin(press, false);
  const drawn = useDrawn(!!p.fresh, motion.settle);
  const trim = useAnimatedStyle(() => ({ transform: [{ scale: drawn.value }] }));
  return (
    <Pressable
      {...press.handlers}
      accessibilityRole="button"
      accessibilityLabel={p.label ?? `${p.name}${p.here ? ', current place' : ''}`}
      onPress={() => p.tap(p.name)}
      style={{
        left: p.at.x - size.touch / 2,
        top: p.at.y - size.touch / 2,
        ...hit,
      }}
    >
      <Reanimated.View
        style={[{ width: r * 2, height: r * 2, borderRadius: r, ...dotInk(p) }, ink, trim]}
      />
    </Pressable>
  );
}
