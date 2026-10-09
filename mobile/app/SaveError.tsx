// The screen for a save that does not open (OFF-07; 10 §32; docs/system/book-ui.md, Chapters, scenes and recovery).
import { SafeAreaView, Text } from 'react-native';
import { Control, Page } from './book/pages.tsx';
import { note, PaletteContext, useFocusRing } from './book/palette.ts';
import { color } from './book/tokens.ts';
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
  useFocusRing(paper); // outside the Book, so its ring is not installed
  const why = detail(failed);
  return (
    <PaletteContext value={paper}>
      <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
        <Page centred title={PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}>
          {why ? <Text style={note(paper)}>{why}</Text> : null}
          {failed.startOver && <Control label="Start over" onPress={startOver} />}
        </Page>
      </SafeAreaView>
    </PaletteContext>
  );
}
