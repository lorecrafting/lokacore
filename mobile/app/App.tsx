// The phone smoke screen (R6 SM): one bare text screen over the real local authority and
// expo-sqlite. The logic is in authority/local-story/smoke.ts; this file only draws it.
import { useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';
import { openSmoke } from '../authority/local-story/smoke';
import items from '../../protocol/fixtures/cartridge_items_hash.json';

// Opened once per process, kept on globalThis so a Fast Refresh does not open a second handle
// (mobile lessons: a second handle on the same file crashes). A new file name: a save from before
// R6 S3a has no identity row, so it would open as corrupt.
const g = globalThis as { loka_smoke?: ReturnType<typeof openSmoke> };
const smoke = (g.loka_smoke ??= openSmoke(openDatabaseSync('loka-save.db'), items, randomUUID));

export default function App() {
  const [, redraw] = useState(0);
  const { view, text, buttons, log, pending } = smoke.screen();
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
        {pending && <Text>Save not confirmed (pending)</Text>}
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
