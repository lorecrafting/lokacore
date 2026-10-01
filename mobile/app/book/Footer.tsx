// The footer: the open exits and any other place action as plain tappable words, status line above.
// SM2c replaces this component with the map joystick; it takes the grouped buttons and a press.
import { Pressable, Text, View } from 'react-native';
import type { Button } from '../../authority/local-story/smoke.ts';
import type { Exit } from './model.ts';
import { body, paper } from './paper.ts';

const word = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 17 };

export function Footer({
  exits,
  place,
  press,
}: {
  exits: Exit[];
  place: Button[];
  press: (b: Button) => void;
}) {
  const items = [
    ...exits.map((e) => ({ text: e.direction, label: `Go ${e.direction}`, b: e.button })),
    ...place.map((b) => ({ text: b.label, label: b.label, b })),
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {items.map((i) => (
        <Pressable
          key={i.label}
          accessibilityRole="button"
          accessibilityLabel={i.label}
          onPress={() => press(i.b)}
          style={{ minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ ...word, color: paper.fg }}>{i.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}
