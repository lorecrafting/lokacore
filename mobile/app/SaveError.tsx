// The screen for a save that does not open (OFF-07; 10 §32; docs/system/book-ui.md, Chapters, scenes and recovery).
import { SafeAreaView, Text, View } from 'react-native';
import { Control, pageTitleStyle } from './book/pages.tsx';
import { note } from './book/palette.ts';
import { color, space } from './book/tokens.ts';
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
  const paper = color.light; // no GameView here, so no solar phase (and Control's default palette)
  const why = detail(failed);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      {/* The padding sits on an inner View: iOS SafeAreaView replaces its own padding with the insets. */}
      <View style={{ flex: 1, justifyContent: 'center', padding: space.page }}>
        <Text style={pageTitleStyle(paper)}>
          {PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}
        </Text>
        {why ? <Text style={note(paper)}>{why}</Text> : null}
        {failed.startOver && <Control label="Start over" onPress={startOver} />}
      </View>
    </SafeAreaView>
  );
}
