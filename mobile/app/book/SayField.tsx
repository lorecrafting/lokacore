// The one-word field: the status line's say field and the NPC page's Whisper.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Chip } from './Chip.tsx';
import { Control } from './pages.tsx';
import { LABEL } from './labels.ts';
import { Note } from './lines.tsx';
import { prose, usePalette, useType } from './palette.ts';
import { size, space } from './tokens.ts';

const WORD = /^[a-zA-Z]{1,32}$/; // the kernel's own check (kernel/ts/src/mechanics/speech/shared.ts)

export type Send = { label: (typeof LABEL)[keyof typeof LABEL]; send: (word: string) => void };

// Laid over what sits behind the open say field: a tap there only closes it, unsent, and reaches
// nothing beneath (book-ui.md, Word bar). Not focusable; the say icon and Escape stay the close.
export const shield = (close: () => void) => (
  <Pressable
    accessible={false}
    onPress={close}
    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
  />
);

// Named "A word", focused on open, the word as typed: no font scaling, autocorrect, capitals or
// spell check.
const bare = {
  accessibilityLabel: LABEL.aWord,
  autoFocus: true,
  allowFontScaling: false,
  maxLength: 32,
  autoCorrect: false,
  autoCapitalize: 'none',
  spellCheck: false,
} as const;
const box = { minHeight: size.touch, paddingHorizontal: space.lg, borderWidth: size.rule };

/**
 * The one-word field (book-ui.md, Word bar): one text field named "A word" (focused on open, up
 * to 32 characters, no autocorrect or autocapitalize), then one Control per send, then a Chip
 * per known word.
 * - Use: the status line's say field (Say, Shout, Cast, each only while offered; the known
 *   phrases and castable spell words) and the NPC page's Whisper (one Whisper button aimed at
 *   that person; the known phrases).
 * - Rules: a press sends the typed word with that button's action and closes; Enter sends the
 *   first. A word chip only fills the field (named by its word), never sends. A word that is not
 *   1 to 32 letters is not sent, keeps the field open and shows the Note "One word, letters
 *   only."; nothing sends while pending; Escape closes it unsent.
 * - States: open; known words; pending; bad word.
 * - Story: SayField.stories.tsx
 */
export function SayField(p: {
  pending: boolean;
  sends: Send[];
  words?: readonly string[];
  close: () => void;
}) {
  const [c, t] = [usePalette(), useType()];
  const [draft, setDraft] = useState('');
  const [wrong, setWrong] = useState(false);
  const sender = (s: Send) => () => {
    if (p.pending) return;
    if (!WORD.test(draft)) return setWrong(true);
    (s.send(draft), p.close());
  };
  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        {...bare}
        value={draft}
        onChangeText={(s) => (setDraft(s), setWrong(false))}
        onSubmitEditing={sender(p.sends[0]!)}
        onKeyPress={(e) => e.nativeEvent.key === 'Escape' && p.close()} // web and hardware keyboards
        style={{ ...prose(c, t), ...box, backgroundColor: c.bg, borderColor: c.line }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {p.sends.map((s) => (
          <Control key={s.label} label={s.label} onPress={sender(s)} disabled={p.pending} />
        ))}
      </View>
      {wrong && <Note>{LABEL.oneWord}</Note>}
      {!!p.words?.length && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {p.words.map((w) => (
            <Chip key={w} word={w} label={w} onPress={() => (setDraft(w), setWrong(false))} />
          ))}
        </View>
      )}
    </View>
  );
}
