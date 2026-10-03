// The screen for a save that does not open (OFF-07; 10 §32), plain until the book look restyles it.
import { Button, SafeAreaView, Text } from 'react-native';
import { body, head, paper } from './book/paper.ts';
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
  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: paper.bg }}
    >
      <Text style={{ fontFamily: head, fontSize: 22, color: paper.fg }}>
        {PLAIN[failed.kind!] ?? 'The game cannot go on yet.'}
      </Text>
      <Text style={{ fontFamily: body, color: paper.dim }}>({detail(failed)})</Text>
      {failed.startOver && <Button title="Start over" color={paper.accent} onPress={startOver} />}
    </SafeAreaView>
  );
}
