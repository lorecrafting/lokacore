// The screen for a save that does not open (OFF-07; 10 §32; docs/system/book-ui.md, Chapters, scenes and recovery).
import { SafeAreaView } from 'react-native';
import { Control, Page } from './book/pages.tsx';
import { Text } from './book/Text.tsx';
import { note, PaletteContext, useFocusRing } from './book/palette.ts';
import { color, type } from './book/tokens.ts';
import { detail, locked } from './book/words.ts';
import type { Failed } from '../packages/game-view/session.ts';
import { LABEL } from './book/labels.ts';

const PLAIN: Record<string, string> = {
  save_corrupt: 'The save is damaged and cannot be read.',
  pinned_release_missing: 'The save needs a version of the story this app does not have.',
  unsupported_save_format:
    'The save was made by a newer version of the app. Update the app to go on.',
};

/**
 * The screen for a save that does not open (book-ui.md, Chapters, scenes and recovery).
 * - Use: App, when the save fails to open; no GameView behind it.
 * - Rules: the Page's centred variant; `startOver` asks first: it destroys the save (10 §31; the
 *   shell's confirm); `tryAgain` (a page reload on web) reopens the save, offered only on the other-tab lock.
 * - States: release; format; corrupt; locked.
 * - Story: RecoveryPages.stories.tsx
 */
export function SaveError({
  failed,
  startOver,
  tryAgain,
}: {
  failed: Failed;
  startOver: () => void;
  tryAgain?: () => void;
}) {
  const paper = color.light; // no GameView here, so no solar phase
  useFocusRing(paper); // outside the Book, so its ring is not installed
  const why = detail(failed);
  return (
    <PaletteContext value={paper}>
      <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
        <Page centred title={PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}>
          {why ? <Text style={note(paper, type)}>{why}</Text> : null}
          {tryAgain && locked(failed) && <Control label={LABEL.tryAgain} onPress={tryAgain} />}
          {failed.startOver && <Control label={LABEL.startOver} onPress={startOver} />}
        </Page>
      </SafeAreaView>
    </PaletteContext>
  );
}
