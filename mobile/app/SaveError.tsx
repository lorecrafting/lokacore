// The screen for a save that does not open (OFF-07; 10 §32; docs/system/book-ui.md, Chapters, scenes and recovery).
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import { haptic } from './book/haptic';
import { Control, Page } from './book/pages.tsx';
import { Text } from './book/Text.tsx';
import { note, PaletteContext, useFocusRing } from './book/palette.ts';
import { color, type } from './book/tokens.ts';
import { detail, locked } from './book/words.ts';
import type { Failed } from '../packages/game-view/session.ts';
import { LABEL } from './book/labels.ts';

// The web save's worker did not answer in time (Safari, loka-hcnlh.19.2): a reload starts a fresh one.
// ponytail: a timeout a reload cannot clear (a result over 64 MB) offers Try again on every reload.
const retryable = (f: Failed) => locked(f) || /^Sync operation timeout/.test(f.message);
const PLAIN: Record<string, string> = {
  save_corrupt: 'The save is damaged and cannot be read.',
  pinned_release_missing: 'This save was made with a different version of the game.',
  unsupported_save_format:
    'The save was made by a newer version of the app. Update the app to go on.',
  // builder-only placeholder (loka-hcnlh.100.1): the designer words it
  cartridge_error: "The world's files do not build. The save and the files are untouched.",
};

/**
 * The screen for a save that does not open (book-ui.md, Chapters, scenes and recovery).
 * - Use: App, when the save fails to open; no GameView behind it.
 * - Rules: an error haptic on arrival, no sound; the Page's centred variant; `startOver` asks first: it destroys the save (10 §31; the
 *   shell's confirm); `tryAgain` (a page reload on web) reopens the save, offered only on the other-tab lock and a worker timeout.
 * - States: release; format; corrupt; locked; timed out; cartridge error (dev only: the error text).
 * - Story: RecoveryPages.stories.tsx
 */
export function SaveError({
  failed,
  startOver,
  tryAgain,
  haptics = true,
}: {
  failed: Failed;
  startOver: () => void;
  tryAgain?: () => void;
  haptics?: boolean; // no Book here to give the haptic module the setting
}) {
  const paper = color.light; // no GameView here, so no solar phase
  useFocusRing(paper); // outside the Book, so its ring is not installed
  const why = detail(failed);
  useEffect(() => {
    if (haptics) haptic('error');
  }, [failed.kind]);
  return (
    <PaletteContext value={paper}>
      <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
        <Page centred title={PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}>
          {why ? <Text style={note(paper, type)}>{why}</Text> : null}
          {tryAgain && retryable(failed) && <Control label={LABEL.tryAgain} onPress={tryAgain} />}
          {failed.startOver && <Control label={LABEL.startOver} onPress={startOver} />}
        </Page>
      </SafeAreaView>
    </PaletteContext>
  );
}
