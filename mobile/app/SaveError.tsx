// The screen for a save that does not open (OFF-07; 10 §32), plain until the book look restyles it.
import { Alert, Button, SafeAreaView, Text } from 'react-native';
import { useFonts } from 'expo-font';
import { body, fonts, head, paper } from './book/paper.ts';
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
  const [loaded, fontError] = useFonts(fonts);
  if (!loaded && !fontError) return null;
  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: paper.bg }}
    >
      <Text style={{ fontFamily: head, fontSize: 22, color: paper.fg }}>
        {PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}
      </Text>
      <Text style={{ fontFamily: body, color: paper.dim }}>({failed.message})</Text>
      {(failed.newGame || failed.replace) && (
        <Button
          title="Start over"
          color={paper.accent}
          onPress={() => confirmStartOver(startOver)}
        />
      )}
    </SafeAreaView>
  );
}
