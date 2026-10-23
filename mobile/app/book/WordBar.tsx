// The World page's Word block (book-ui.md, Word bar): whisper, shout and cast chips.
import { View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { castWords } from './buttons.ts';
import { Chip, Row } from './Chip.tsx';
import { LABEL } from './labels.ts';
import { why } from './model.ts';
import { SectionTitle } from './pages.tsx';
import type { Button } from './presenter.ts';
import { space } from './tokens.ts';

const wordOf = (b: Button) => (b.input as { word?: string }).word;

/**
 * The World page's Word block: whisper, shout and cast chip rows (book-ui.md, Word bar). Saying
 * is the status line's say field, never a row here.
 * - Use: the room page's last block; none when no whisper, shout or cast is offered.
 * - States: rows; refused cast word.
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
  // Say (the keyboard's and each phrase's) is the status line's say field, not a row here.
  if (!p.chips.some((b) => wordOf(b) && b.action_key !== 'say') && !refused.length) return null;
  const of = (key: string, to?: string) =>
    p.chips.filter((b) => wordOf(b) && b.action_key === key && (!to || b.target_ids[0] === to));
  const chips = (bs: Button[]) => bs.map((b) => chip(b, p));
  const whispered = [...new Set(of('whisper').map((b) => b.target_ids[0]))];
  const name = (id: string) => p.text(p.view.entities.find((e) => e.id === id)!.name);
  return (
    <View style={{ gap: space.xl }}>
      <SectionTitle>{LABEL.word}</SectionTitle>
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
