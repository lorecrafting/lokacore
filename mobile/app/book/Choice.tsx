import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, why, type group } from './model.ts';
import type { Button } from './presenter.ts';
import { ActionCard } from './actions.tsx';
import { note, usePalette, useType } from './palette.ts';
import { Reanimated, useAnimatedStyle } from './fade.ts';
import { useDrawn, useFading } from './press.ts';
import { Riddle } from './Riddle.tsx';
import { space, motion, size } from './tokens.ts';
import { LABEL } from './labels.ts';

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

// The pending choice (06 §43): the prompt, each answer (an unavailable one with its reason, not
// pressable), inside the full NPC/conversation detail page.
// The continuation last lifted: a redraw or a return to the page never lifts its answers again.
let lifted: string | undefined;

function Answer(p: { at: number; fresh: boolean; left: boolean; children: ReactNode }) {
  const lag = Math.min(p.at, motion.stagger.most - 1) * motion.stagger.gap;
  const drawn = useDrawn(p.fresh, motion.press, lag);
  const fading = useFading(p.left);
  const lift = useAnimatedStyle(() => ({
    opacity: drawn.value,
    transform: [{ translateY: (1 - drawn.value) * size.rule }],
  }));
  return (
    <Reanimated.View style={lift} pointerEvents={p.left ? 'none' : 'auto'}>
      <Reanimated.View style={fading}>{p.children}</Reanimated.View>
    </Reanimated.View>
  );
}

/**
 * A conversation's offered answers, lifting in once, on a talk page.
 * - Use: Npc.tsx.
 * - Story: covered by the talk page stories.
 */
// size: allow 60, the answers' lift and fade share the choice's state
export function Choice(p: {
  view: GameView;
  choice: NonNullable<GameView['choice']>;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
  pending?: boolean;
}) {
  const c = usePalette();
  const t = useType();
  const [fresh] = useState(() => {
    const isNew = lifted !== p.choice.continuation_id;
    lifted = p.choice.continuation_id;
    return isNew;
  });
  const [chosen, setChosen] = useState<string>();
  useEffect(() => {
    if (!p.pending) setChosen(undefined);
  }, [p.pending]);
  const left = (id: string) => !!p.pending && !!chosen && chosen !== id; // a refusal brings them back
  const answer = (id: string) =>
    p.g.choice.find((b) => (b.input as { choice_id?: string }).choice_id === id);
  return (
    <View style={{ gap: space.sm }}>
      {p.choice.riddle?.attempts && (
        <Text style={note(c, t)}>
          {LABEL.riddleTries(p.choice.riddle.attempts.count, p.choice.riddle.attempts.limit)}
        </Text>
      )}
      {absent(p.view) !== '' && <Text style={note(c, t)}>{absent(p.view)}</Text>}
      {p.choice.choices.map((o, at) => {
        const b = answer(o.choice_id);
        if (b && b === exit(p.g)) return null; // the foot's Leave the conversation sends it
        const riddle = p.choice.riddle;
        if (b && riddle?.choice_id === o.choice_id)
          return (
            <Answer key={o.choice_id} at={at} fresh={fresh} left={false}>
              <Riddle
                key={`${p.choice.continuation_id}:${p.choice.speaker_id}:${riddle.bank.join('')}`}
                bank={riddle.bank}
                button={b}
                press={p.press}
                lastTry={riddle.attempts?.count === (riddle.attempts?.limit ?? 0) - 1}
              />
            </Answer>
          );
        return (
          <Answer key={o.choice_id} at={at} fresh={fresh} left={left(o.choice_id)}>
            {b ? (
              <ActionCard b={b} press={(x) => (setChosen(o.choice_id), p.press(x))} />
            ) : (
              <ActionCard label={p.text(o.label)} reason={why(o, p.text)} />
            )}
          </Answer>
        );
      })}
    </View>
  );
}

// An authored choice whose whole label is the Book's Leave or Close is the talk's exit
// (loka-512o): the foot sends it, so the content omits it.
export const exit = (g: Grouped) =>
  g.choice.find(
    (b) => b.action_key === 'choose' && ([LABEL.leave, LABEL.close] as string[]).includes(b.label),
  );
