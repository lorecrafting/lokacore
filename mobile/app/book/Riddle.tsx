// The riddle answer: a bank of letter tiles over one local buffer.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { playRiddleRight } from './cueSounds.ts';
import {
  InkText,
  LiftPressable,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from './fade.ts';
import { useGilt, useLift, usePress } from './press.ts';
import { play } from './sound';
import { Text } from './Text.tsx';
import type { Button } from './presenter.ts';
import { ActionCard } from './actions.tsx';
import { Control } from './pages.tsx';
import { prose, usePalette, useType } from './palette.ts';
import { motion, opacity, radius, size, space } from './tokens.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { LABEL } from './labels.ts';

// The word last submitted, until the view says how it went. `at` is the view that showed it right.
let sent: { word: string; id?: string; lastTry?: boolean; at?: GameView } | undefined;

// A wrong last try also closes the choice and the view cannot tell it from a right one, so a word
// on a riddle's last try is never gilt. ponytail: a right last try goes plain; the receipt's outcome
// would tell them apart, if it reaches the page.
function Word({ word }: { word: string }) {
  const c = usePalette();
  const t = useType();
  const gilt = useGilt(c.fg);
  const still = useReducedMotion();
  useEffect(playRiddleRight, []);
  return <InkText style={[prose(c, t), still ? { color: c.warning } : gilt]}>{word}</InkText>;
}

/**
 * The right riddle answer, gilt where the answer line was, for that view (book-ui.md, Page life).
 * - Use: once, on the NPC page, above the Choice.
 * - Rules: a wrong answer, a redraw or a riddle's last try shows nothing.
 * - Story: Riddle.stories.tsx
 */
export function RightWord(p: { view: GameView; choice?: GameView['choice']; pending?: boolean }) {
  useEffect(() => () => void (sent = undefined), []); // leaving the page ends it: no later page shows it
  if (!sent) return null;
  if (!sent.at && !p.pending) {
    if (p.choice?.riddle?.choice_id === sent.id)
      sent = undefined; // wrong: the tiles went back
    else sent.at = p.view;
  }
  return sent && sent.at === p.view && !sent.lastTry ? <Word word={sent.word} /> : null;
}

function Bank(p: {
  bank: readonly string[];
  selected: number[];
  slowly: boolean;
  pick: (i: number) => void;
}) {
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm }}
    >
      {p.bank.map((letter, i) => (
        <LetterTile
          key={i}
          letter={letter}
          used={p.selected.includes(i)}
          slowly={p.slowly}
          label={`${letter}, tile ${i + 1}`}
          onPress={() => p.pick(i)}
        />
      ))}
    </View>
  );
}

function Answering(p: {
  answer: string;
  button: Button;
  edit: (next: (s: number[]) => number[]) => void;
  send: (b: Button) => void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row' }}>
        <Control label={LABEL.backspace} onPress={() => p.edit((s) => s.slice(0, -1))} />
        <Control label={LABEL.clear} onPress={() => p.edit(() => [])} />
      </View>
      <ActionCard
        b={{ ...p.button, label: LABEL.submit, input: { ...p.button.input, answer: p.answer } }}
        press={p.send}
      />
    </View>
  );
}

/**
 * The riddle answer: a bank of Letter tiles over one local buffer, with Backspace, Clear and
 * Submit.
 * - Use: an NPC page offering a riddle.
 * - Rules: a right answer holds in `warning` for `motion.settle.hold`, then settles (RightWord); a
 *   wrong one sends the tiles back over `motion.settle`, silent.
 *   The answer line, the bank, its Controls and the Submit card are one block. Tile indices
 *   preserve multiplicity; only the bounded submitted word crosses the session boundary.
 * - Story: Riddle.stories.tsx
 */
export function Riddle(p: {
  bank: readonly string[];
  button: Button;
  press: (b: Button) => void;
  lastTry?: boolean;
}) {
  const c = usePalette();
  const t = useType();
  const [selected, setSelected] = useState<number[]>([]);
  const [sentBack, setSentBack] = useState(false);
  const answer = selected.map((i) => p.bank[i]).join('');
  return (
    // the answer, the bank and the controls, as the mock's `.word`, `.bankl` and `.rrow`
    <View style={{ gap: space.xl }}>
      <Text style={prose(c, t)}>{answer || 'Choose letters to answer.'}</Text>
      <Bank
        bank={p.bank}
        selected={selected}
        slowly={sentBack}
        pick={(i) => {
          setSentBack(false);
          setSelected((s) => (s.includes(i) ? s : [...s, i]));
        }}
      />
      {selected.length > 0 && (
        <Answering
          answer={answer}
          button={p.button}
          edit={setSelected}
          send={(b) => {
            sent = { word: answer, id: riddleId(p.button), lastTry: p.lastTry };
            p.press(b);
            setSentBack(true);
            setSelected([]);
          }}
        />
      )}
    </View>
  );
}

const riddleId = (b: Button) => (b.input as { choice_id?: string }).choice_id;

const TILE = {
  width: size.touch,
  height: size.touch,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: size.rule,
  borderRadius: radius.card,
} as const;

function useTileInk(used: boolean, slowly?: boolean) {
  const still = useReducedMotion();
  const ink = useSharedValue<number>(used ? opacity.disabled : 1);
  useEffect(() => {
    if (used || !slowly || still) ink.value = used ? opacity.disabled : 1;
    else ink.value = withTiming(1, { duration: motion.settle.duration });
  }, [used]); // eslint-disable-line
  return useAnimatedStyle(() => ({ opacity: ink.value }));
}

/**
 * One letter of the riddle bank.
 * - Use: Riddle only.
 * - Rules: a press lifts with a tick and a selection haptic; a used tile keeps its place (no reflow). Name: the letter, then its place (`N, tile 2`).
 * - States: free; used (not pressable).
 * - Story: LetterTile.stories.tsx
 */
export function LetterTile(p: {
  letter: string;
  used: boolean;
  /** a wrong answer's return: over `motion.settle`, at once under reduced motion */
  slowly?: boolean;
  label: string;
  onPress: () => void;
}) {
  const c = usePalette();
  const press = usePress('selection');
  const lift = useLift(press, c.card);
  const back = useTileInk(p.used, p.slowly);
  return (
    <LiftPressable
      {...press.handlers}
      onPressIn={() => {
        play('tick');
        press.handlers.onPressIn();
      }}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      disabled={p.used}
      onPress={press.commit(p.onPress)}
      style={[
        {
          ...TILE,
          backgroundColor: c.card,
          borderColor: c.line,
        },
        back,
        lift,
      ]}
    >
      <Text style={{ ...useType().tile, color: c.fg }}>{p.letter}</Text>
    </LiftPressable>
  );
}
