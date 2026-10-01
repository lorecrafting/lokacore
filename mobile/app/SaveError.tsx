// The screen for a save that does not open (OFF-07; 10 §32), plain until the book look restyles it.
import { Alert, Button, SafeAreaView, Text } from 'react-native';
import type { Failed } from '../authority/local-story/smoke';

const PLAIN: Record<string, string> = {
  save_corrupt: 'The save is damaged and cannot be read.',
  pinned_release_missing: 'The save needs a version of the story this app does not have.',
  unsupported_save_format:
    'The save was made by a newer version of the app. Update the app to go on.',
};

/** Start over destroys the save, so the player confirms it first (10 §31). */
export const confirmStartOver = (startOver: () => void) =>
  Alert.alert('Start over?', 'Your saved game will be lost.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Start over', style: 'destructive', onPress: startOver },
  ]);

export function SaveError({ failed, startOver }: { failed: Failed; startOver: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontWeight: 'bold' }}>
        {PLAIN[failed.kind!] ?? 'The save could not be opened.'}
      </Text>
      <Text>({failed.message})</Text>
      {failed.kind !== 'unsupported_save_format' && (
        <Button title="Start over" onPress={() => confirmStartOver(startOver)} />
      )}
    </SafeAreaView>
  );
}
