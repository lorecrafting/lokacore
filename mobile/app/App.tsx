// The phone smoke screen (R6 SM): one bare text screen over the real local authority and
// expo-sqlite. The logic is in authority/local-story/smoke.ts; this file only draws it.
import { useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { playSmoke } from '../authority/local-story/smoke';
import items from '../../protocol/fixtures/cartridge_items_hash.json';
import { confirmStartOver, SaveError } from './SaveError';

// Opened once per process, kept on globalThis so a Fast Refresh does not open a second handle
// (mobile lessons: a second handle on the same file crashes). A new file name: a save from before
// R6 S3a has no identity row, so it would open as corrupt. Start over closes the handle before it
// deletes the file (expo refuses to delete an open database).
// deleteDatabaseSync removes the main file only; SQLite discards a -journal left beside the new,
// empty file rather than replaying it, so nothing else needs deleting.
const NAME = 'loka-save.db';
let db: SQLiteDatabase | undefined;
const g = globalThis as { loka_smoke?: ReturnType<typeof playSmoke> };
const smoke = (g.loka_smoke ??= playSmoke(
  () => (db = openDatabaseSync(NAME)),
  () => {
    db?.closeSync();
    db = undefined;
    deleteDatabaseSync(NAME);
  },
  items,
  randomUUID,
));

export default function App() {
  const [, redraw] = useState(0);
  const startOver = () => {
    smoke.startOver();
    redraw((n) => n + 1);
  };
  const game = smoke.game();
  if (!game) return <SaveError failed={smoke.failed()!} startOver={startOver} />;
  const { view, text, buttons, log, pending, fault } = game.screen();
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
              game.press(b);
              redraw((n) => n + 1);
            }}
          />
        ))}
        {fault && <Button title="Start over" onPress={() => confirmStartOver(startOver)} />}
      </ScrollView>
    </SafeAreaView>
  );
}
