// The phone smoke screen (R6 SM): one bare text screen over the real local authority and
// expo-sqlite. The logic is in authority/local-story/smoke.ts; this file only draws it.
import { useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text } from 'react-native';
import { openDatabaseSync } from 'expo-sqlite';
import { openSmoke } from '../authority/local-story/smoke';
import items from '../../protocol/fixtures/cartridge_items_hash.json';

// Opened once per process (mobile lessons: a second handle on the same file crashes).
const smoke = openSmoke(openDatabaseSync('loka-smoke.db'), items);

export default function App() {
  const [, redraw] = useState(0);
  const { view, text, buttons, log } = smoke.screen();
  const here = [text(view.place.title.key), text(view.place.description.key)];
  const names = (es: typeof view.entities) => es.map((e) => text(e.name)).join(', ') || 'nothing';
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>{here[0]}</Text>
        <Text>{here[1]}</Text>
        <Text>Here: {names(view.entities)}</Text>
        <Text>Exits: {view.exits.map((e) => e.direction).join(', ') || 'none'}</Text>
        <Text>Carrying: {names(view.inventory)}</Text>
        <Text>Time: {view.time}</Text>
        <Text>{log.slice(-20).join('\n')}</Text>
        {buttons.map((b, i) => (
          <Button
            key={i}
            title={b.label}
            onPress={() => {
              smoke.press(b);
              redraw((n) => n + 1);
            }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
