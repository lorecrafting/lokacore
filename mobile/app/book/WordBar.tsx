// The World page's Word block (book-ui.md, Word bar): say, whisper, shout and cast chips, and a
// typed Say word that only its writer sees.
import { useState, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { wordless } from './buttons.ts';
import { Chip } from './Chip.tsx';
import { LABEL } from './labels.ts';
import { why } from './model.ts';
import { Control, SectionTitle } from './pages.tsx';
import { note, prose, usePalette } from './palette.ts';
import type { Button } from './presenter.ts';
import { size, space } from './tokens.ts';

const WORD = /^[a-zA-Z]{1,32}$/; // the kernel's own check (kernel/ts/src/mechanics/speech/shared.ts)
const wordOf = (b: Button) => (b.input as { word: string }).word;

export function WordBar(p: {
  view: GameView;
  chips: Button[];
  pending: boolean;
  text: (key: string) => string;
  press: (b: Button) => void;
}) {
  const c = usePalette();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [wrong, setWrong] = useState(false);
  const refused =
    !wordless(p.view) && p.view.actions.some((a) => a.action_key === 'cast')
      ? (p.view.spell_words ?? []).filter((s) => !s.available)
      : [];
  if (!p.chips.length && !refused.length) return null;
  const of = (key: string, to?: string) =>
    p.chips.filter((b) => b.action_key === key && (!to || b.target_ids[0] === to));
  const chips = (bs: Button[]) =>
    bs.map((b) => (
      <Chip
        key={b.label}
        word={wordOf(b)}
        label={b.label}
        pending={p.pending}
        onPress={() => p.press(b)}
      />
    ));
  const row = (title: string, children: ReactNode[], reasons: string[] = []) =>
    children.length > 0 && (
      <View key={title} style={{ gap: space.sm }}>
        <Text style={note(c)}>{title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>
        {reasons.map((r) => (
          <Text key={r} style={note(c)}>
            {r}
          </Text>
        ))}
      </View>
    );
  const whispered = [...new Set(of('whisper').map((b) => b.target_ids[0]))];
  const name = (id: string) => p.text(p.view.entities.find((e) => e.id === id)!.name);
  // ponytail: a typed word reuses a say chip's token and context, so say without phrases has no keyboard.
  const base = of('say')[0];
  const send = () => {
    if (!WORD.test(draft)) return setWrong(true);
    p.press({ ...base, label: LABEL.say, input: { word: draft } });
    setDraft('');
    setWrong(false);
  };
  return (
    <View style={{ gap: space.block }}>
      <SectionTitle>{LABEL.word}</SectionTitle>
      {row(LABEL.say, chips(of('say')))}
      {whispered.map((id) => row(`${LABEL.whisperTo} ${name(id)}`, chips(of('whisper', id))))}
      {row(LABEL.shout, chips(of('shout')))}
      {row(
        LABEL.cast,
        [
          ...chips(of('cast')),
          ...refused.map((s) => <Chip key={s.word} word={s.word} label={`${s.word}, cast`} />),
        ],
        refused.map((s) => `${s.word}, cast: ${why(s, p.text)}`),
      )}
      {base &&
        (typing ? (
          <View style={{ gap: space.sm }}>
            <TextInput
              accessibilityLabel={LABEL.aWord}
              value={draft}
              onChangeText={(t) => (setDraft(t), setWrong(false))}
              onSubmitEditing={send}
              maxLength={32}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              style={{
                ...prose(c),
                minHeight: size.touch,
                paddingHorizontal: space.lg,
                borderColor: c.line,
                borderWidth: size.rule,
              }}
            />
            <View style={{ flexDirection: 'row' }}>
              <Control label={LABEL.say} onPress={send} disabled={p.pending} />
            </View>
            {wrong && <Text style={note(c)}>{LABEL.oneWord}</Text>}
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Control label={LABEL.typeAWord} onPress={() => setTyping(true)} />
          </View>
        ))}
    </View>
  );
}
