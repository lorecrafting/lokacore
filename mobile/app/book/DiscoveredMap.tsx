import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { paper, prose, note } from './paper.ts';

type Props = { view: GameView; text: (key: string) => string };
export function DiscoveredMap({ view, text }: Props) {
  const map = view.map!;
  const current = map.rooms.find((r) => r.id === view.place.id);
  const [level, setLevel] = useState(current?.z ?? 0);
  const [selected, select] = useState<string | null>(null);
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
  const index = levels.indexOf(level);
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 44, minWidth: 44 }}
          accessibilityLabel="Previous map level"
          disabled={index <= 0}
          onPress={() => {
            setLevel(levels[index - 1]);
            select(null);
          }}
        >
          <Text style={prose}>←</Text>
        </Pressable>
        <Text style={prose}>Level {level}</Text>
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 44, minWidth: 44 }}
          accessibilityLabel="Next map level"
          disabled={index >= levels.length - 1}
          onPress={() => {
            setLevel(levels[index + 1]);
            select(null);
          }}
        >
          <Text style={prose}>→</Text>
        </Pressable>
      </View>
      <ScrollView horizontal>
        <View
          style={{
            minHeight: (Math.max(0, ...rooms.map((r) => r.y)) - y) * 80 + 112,
            minWidth: (Math.max(0, ...rooms.map((r) => r.x)) - x) * 144 + 164,
          }}
        >
          {map.links.map((link) => {
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
                  backgroundColor: paper.dim,
                  transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
                }}
              />
            );
          })}
          {rooms.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${text(r.title)}${r.id === view.place.id ? ', current place' : ''}`}
              onPress={() => select(r.id)}
              style={{
                position: 'absolute',
                ...point(r),
                padding: 5,
                minHeight: 56,
                width: 128,
                backgroundColor: paper.bg,
                borderWidth: 1,
                borderColor: paper.fg,
              }}
            >
              <Text style={note}>
                {r.id === view.place.id ? '● ' : ''}
                {text(r.title)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {chosen && (
        <View>
          <Text style={prose}>{text(chosen.title)}</Text>
          {map.links
            .filter((l) => l.from === chosen.id)
            .map((l) => (
              <Text key={l.direction} style={note}>
                {l.direction}: {text(map.rooms.find((r) => r.id === l.to)!.title)}
              </Text>
            ))}
          <Pressable
            accessibilityRole="button"
            style={{ minHeight: 44 }}
            accessibilityLabel="Back to map"
            onPress={() => select(null)}
          >
            <Text style={prose}>Back to map</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
