import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { note, prose, usePalette, type Palette } from './palette.ts';
import { size } from './tokens.ts';

type Props = { view: GameView; text: (key: string) => string };
// The chosen room is the Map page's: its foot offers Back to map while one is open.
type Drawn = NonNullable<GameView['map']>;
type Room = Drawn['rooms'][number];
export function DiscoveredMap({
  view,
  text,
  selected,
  select,
}: Props & { selected: string | null; select: (id: string | null) => void }) {
  const c = usePalette();
  const map = view.map!;
  const current = map.rooms.find((r) => r.id === view.place.id);
  const [level, setLevel] = useState(current?.z ?? 0);
  const levels = [...new Set(map.rooms.map((r) => r.z))].sort((a, b) => a - b);
  const rooms = map.rooms.filter((r) => r.z === level);
  const minimum = (axis: 'x' | 'y') => Math.min(0, ...rooms.map((r) => r[axis]));
  const x = minimum('x'),
    y = minimum('y');
  const point = (r: (typeof rooms)[number]) => ({
    left: (r.x - x) * 144 + 16,
    top: (r.y - y) * 80 + 16,
  });
  const chosen = map.rooms.find((r) => r.id === selected);
  return (
    <View>
      {levelBar(c, level, levels, (next) => (setLevel(next), select(null)))}
      <ScrollView horizontal>
        <View
          style={{
            minHeight: (Math.max(0, ...rooms.map((r) => r.y)) - y) * 80 + 112,
            minWidth: (Math.max(0, ...rooms.map((r) => r.x)) - x) * 144 + 164,
          }}
        >
          {map.links.map((link) => linkLine(c, link, rooms, point))}
          {rooms.map((r) => roomButton(c, r, r.id === view.place.id, text, point(r), select))}
        </View>
      </ScrollView>
      {chosen && roomDetail(c, map, chosen, text)}
    </View>
  );
}

function levelBar(c: Palette, level: number, levels: number[], step: (next: number) => void) {
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
        <Text style={prose(c)}>←</Text>
      </Pressable>
      <Text style={prose(c)}>Level {level}</Text>
      <Pressable
        accessibilityRole="button"
        style={{ minHeight: size.touch, minWidth: size.touch }}
        accessibilityLabel="Next map level"
        disabled={index >= levels.length - 1}
        onPress={() => step(levels[index + 1])}
      >
        <Text style={prose(c)}>→</Text>
      </Pressable>
    </View>
  );
}

function linkLine(
  c: Palette,
  link: Drawn['links'][number],
  rooms: Room[],
  point: (r: Room) => { left: number; top: number },
) {
  const a = rooms.find((r) => r.id === link.from),
    b = rooms.find((r) => r.id === link.to);
  if (!a || !b) return null;
  const from = point(a),
    to = point(b),
    dx = to.left - from.left,
    dy = to.top - from.top;
  return (
    <View
      key={`${link.from}:${link.direction}`}
      style={{
        position: 'absolute',
        left: (from.left + to.left) / 2 - Math.hypot(dx, dy) / 2 + 64,
        top: (from.top + to.top) / 2 + 28,
        width: Math.hypot(dx, dy),
        height: 1,
        backgroundColor: c.dim,
        transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
      }}
    />
  );
}

function roomDetail(c: Palette, map: Drawn, chosen: Room, text: Props['text']) {
  return (
    <View>
      <Text style={prose(c)}>{text(chosen.title)}</Text>
      {map.links
        .filter((l) => l.from === chosen.id)
        .map((l) => (
          <Text key={l.direction} style={note(c)}>
            {l.direction}: {text(map.rooms.find((r) => r.id === l.to)!.title)}
          </Text>
        ))}
    </View>
  );
}

function roomButton(
  c: Palette,
  r: Room,
  here: boolean,
  text: Props['text'],
  at: { left: number; top: number },
  select: (id: string) => void,
) {
  return (
    <Pressable
      key={r.id}
      accessibilityRole="button"
      accessibilityLabel={`${text(r.title)}${here ? ', current place' : ''}`}
      onPress={() => select(r.id)}
      style={{
        position: 'absolute',
        ...at,
        padding: 5,
        minHeight: 56,
        width: 128,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.fg,
      }}
    >
      <Text style={note(c)}>
        {here ? '● ' : ''}
        {text(r.title)}
      </Text>
    </Pressable>
  );
}
