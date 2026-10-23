// The one-word field: the status line's say field and the NPC page's Whisper.
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Control } from './pages.tsx';
import { LABEL } from './labels.ts';
import { Note } from './lines.tsx';
import { prose, usePalette, useType } from './palette.ts';
import { size, space } from './tokens.ts';

const WORD = /^[a-zA-Z]{1,32}$/; // the kernel's own check (kernel/ts/src/mechanics/speech/shared.ts)

export type Send = { label: (typeof LABEL)[keyof typeof LABEL]; send: (word: string) => void };

/**
 * The one-word field (book-ui.md, Word bar): one text field named "A word" (focused on open, up
 * to 32 characters, no autocorrect or autocapitalize), then one Control per send.
 * - Use: the status line's say field (Say, Shout, Cast, each only while offered) and the NPC
 *   page's Whisper (one Whisper button aimed at that person).
 * - Rules: a press sends the typed word with that button's action and closes; Enter sends the
 *   first. A word that is not 1 to 32 letters is not sent, keeps the field open and shows the
 *   Note "One word, letters only."; nothing sends while pending; Escape closes it unsent.
 * - States: open; pending; bad word.
 * - Story: SayField.stories.tsx
 */
export function SayField(p: { pending: boolean; sends: Send[]; close: () => void }) {
  const [c, t] = [usePalette(), useType()];
  const [draft, setDraft] = useState('');
  const [wrong, setWrong] = useState(false);
  const sender = (s: Send) => () => {
    if (p.pending) return;
    if (!WORD.test(draft)) return setWrong(true);
    (s.send(draft), p.close());
  };
  const send = sender(p.sends[0]!);
  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        accessibilityLabel={LABEL.aWord}
        autoFocus
        allowFontScaling={false}
        value={draft}
        onChangeText={(s) => (setDraft(s), setWrong(false))}
        onSubmitEditing={send}
        onKeyPress={(e) => e.nativeEvent.key === 'Escape' && p.close()} // web and hardware keyboards
        maxLength={32}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        style={{
          ...prose(c, t),
          backgroundColor: c.bg,
          minHeight: size.touch,
          paddingHorizontal: space.lg,
          borderColor: c.line,
          borderWidth: size.rule,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {p.sends.map((s) => (
          <Control key={s.label} label={s.label} onPress={sender(s)} disabled={p.pending} />
        ))}
      </View>
      {wrong && <Note>{LABEL.oneWord}</Note>}
    </View>
  );
}
