// The screen for a save that does not open (OFF-07; 10 §32), plain until the book look restyles it.
import { Button, SafeAreaView, Text, View } from 'react-native';
import { color, font } from './book/tokens.ts';
import { detail } from './book/words.ts';
import type { Failed } from '../packages/game-view/session.ts';

const PLAIN: Record<string, string> = {
  save_corrupt: 'The save is damaged and cannot be read.',
  pinned_release_missing: 'The save needs a version of the story this app does not have.',
  unsupported_save_format:
    'The save was made by a newer version of the app. Update the app to go on.',
};

/** `startOver` asks first: it destroys the save (10 §31; the shell's confirm). */
export function SaveError({ failed, startOver }: { failed: Failed; startOver: () => void }) {
  const paper = color.light; // no GameView here, so no solar phase
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      {/* The padding sits on an inner View: iOS SafeAreaView replaces its own padding with the insets. */}
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: font.head, fontSize: 22, color: paper.fg }}>
          {PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}
        </Text>
        <Text style={{ fontFamily: font.body, color: paper.dim }}>({detail(failed)})</Text>
        {failed.startOver && <Button title="Start over" color={paper.action} onPress={startOver} />}
      </View>
    </SafeAreaView>
  );
}
