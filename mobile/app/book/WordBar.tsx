// The World page's Word block (book-ui.md, Word bar): say, whisper, shout and cast chips, and a
// typed Say word that only its writer sees.
import { useState, type ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { castWords } from './buttons.ts';
import { Chip, Row } from './Chip.tsx';
import { LABEL } from './labels.ts';
import { Note } from './lines.tsx';
import { why } from './model.ts';
import { Control, SectionTitle } from './pages.tsx';
import { prose, usePalette, useType } from './palette.ts';
import type { Button } from './presenter.ts';
import { size, space } from './tokens.ts';

const WORD = /^[a-zA-Z]{1,32}$/; // the kernel's own check (kernel/ts/src/mechanics/speech/shared.ts)
const wordOf = (b: Button) => (b.input as { word?: string }).word;

/**
 * The World page's Word block: say, whisper, shout and cast chip rows, and a typed Say word only
 * its writer sees (book-ui.md, Word bar).
 * - Use: the room page's last block.
 * - Rules: the text field is focused on open and named "A word"; an invalid word is a Note under
 *   it.
 * - States: rows; text field empty; invalid.
 * - Story: WordBar.stories.tsx
 */
export function WordBar(p: {
  view: GameView;
  chips: Button[];
  pending: boolean;
  text: (key: string) => string;
  press: (b: Button) => void;
}) {
  const refused = castWords(p.view).filter((s) => !s.available);
  // The keyboard's Say (buttons.ts): offered with or without phrases, never a chip.
  const base = p.chips.find((b) => !wordOf(b));
  if (!p.chips.length && !refused.length) return null;
  const of = (key: string, to?: string) =>
    p.chips.filter((b) => wordOf(b) && b.action_key === key && (!to || b.target_ids[0] === to));
  const chips = (bs: Button[]) => bs.map((b) => chip(b, p));
  const whispered = [...new Set(of('whisper').map((b) => b.target_ids[0]))];
  const name = (id: string) => p.text(p.view.entities.find((e) => e.id === id)!.name);
  return (
    <View style={{ gap: space.xl }}>
      <SectionTitle>{LABEL.word}</SectionTitle>
      <Row title={LABEL.say}>{chips(of('say'))}</Row>
      {whispered.map((id) => (
        <Row key={id} title={`${LABEL.whisperTo} ${name(id)}`}>
          {chips(of('whisper', id))}
        </Row>
      ))}
      <Row title={LABEL.shout}>{chips(of('shout'))}</Row>
      <Row title={LABEL.cast} reasons={refused.map((s) => `${s.word}, cast: ${why(s, p.text)}`)}>
        {[
          ...chips(of('cast')),
          ...refused.map((s) => <Chip key={s.word} word={s.word} label={`${s.word}, cast`} />),
        ]}
      </Row>
      {base && <Typed base={base} pending={p.pending} press={p.press} />}
    </View>
  );
}

const chip = (b: Button, p: { pending: boolean; press: (b: Button) => void }) => (
  <Chip
    key={`${b.label}:${b.target_ids[0] ?? ''}`} // two same-name NPCs share a label
    word={wordOf(b)!}
    label={b.label}
    pending={p.pending}
    onPress={() => p.press(b)}
  />
);

// The keyboard: a typed word goes as the keyboard's Say with that word; only its writer sees it.
function Typed(p: { base: Button; pending: boolean; press: (b: Button) => void }) {
  const [c, t] = [usePalette(), useType()];
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [wrong, setWrong] = useState(false);
  const send = () => {
    if (p.pending) return;
    if (!WORD.test(draft)) return setWrong(true);
    p.press({ ...p.base, label: LABEL.say, input: { word: draft } });
    (setDraft(''), setWrong(false));
  };
  const row = (control: ReactNode) => <View style={{ flexDirection: 'row' }}>{control}</View>;
  if (!typing) return row(<Control label={LABEL.typeAWord} onPress={() => setTyping(true)} />);
  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        accessibilityLabel={LABEL.aWord}
        autoFocus
        allowFontScaling={false}
        value={draft}
        onChangeText={(s) => (setDraft(s), setWrong(false))}
        onSubmitEditing={send}
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
      {row(<Control label={LABEL.say} onPress={send} disabled={p.pending} />)}
      {wrong && <Note>{LABEL.oneWord}</Note>}
    </View>
  );
}
