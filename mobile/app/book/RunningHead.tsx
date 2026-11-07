// The objective above the World page, which changes in place (book-ui.md, Running head).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { onCue } from './cues.ts';
import { InkText, Reanimated, useAnimatedStyle } from './fade.ts';
import { plain } from './model.ts';
import { useDrying, useInk } from './press.ts';
import { usePalette, useType } from './palette.ts';
import { motion, opacity, space } from './tokens.ts';

type Say = (key: string) => string;
const useFadeOut = (dry: { value: number }) => useAnimatedStyle(() => ({ opacity: 1 - dry.value }));

// What the head last drew (null: nothing yet): it sits inside the page turn, whose remount forgets it.
let lastHead: string | undefined | null = null;
let lastQuest: string | undefined; // whose words those were

// Keyed on the words: a changed objective cross-fades, a redraw or a page turn does not.
function HeadLine(p: { words?: string; style: object; view: GameView }) {
  const [was] = useState(() => lastHead);
  const [settles] = useState(() =>
    p.view.journal.some(
      (q) => q.quest.key === lastQuest && (q.state === 'resolved' || q.state === 'failed'),
    ),
  );
  if (!p.words) return was && settles ? <HeadOut words={was} style={p.style} /> : null;
  if (was === null || was === p.words) return <Text style={p.style}>{p.words}</Text>;
  return settles && was ? (
    <HeadSettle was={was} words={p.words} style={p.style} />
  ) : (
    <HeadFade was={was} words={p.words} style={p.style} />
  );
}

// A finished objective with none after it: out over `motion.settle`, then the head's space closes.
function HeadOut(p: { words: string; style: object }) {
  const [gone, setGone] = useState(false);
  const dry = useDrying(0, motion.settle.duration);
  const leaving = useFadeOut(dry);
  useEffect(() => void setTimeout(() => setGone(true), motion.settle.duration), []);
  if (gone) return null;
  return (
    <Reanimated.View style={leaving} aria-hidden>
      <Text style={p.style}>{p.words}</Text>
    </Reanimated.View>
  );
}

// A resolved or failed objective out over `motion.settle`, then the next dries in. The head's ink
// is already secondary, so resolved and failed read alike, neither gilt.
function HeadSettle(p: { was: string; words: string; style: object }) {
  const out = useDrying(0, motion.settle.duration);
  const dry = useDrying(motion.settle.duration);
  const arriving = useAnimatedStyle(() => ({ opacity: dry.value }));
  const leaving = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  return (
    <View>
      <Reanimated.View style={[OVER, leaving]} aria-hidden>
        <Text style={p.style}>{p.was}</Text>
      </Reanimated.View>
      <Reanimated.View style={arriving}>
        <Text style={p.style}>{p.words}</Text>
      </Reanimated.View>
    </View>
  );
}

const OVER = { position: 'absolute', left: 0, right: 0 } as const; // mutate-skip: layout

// The new objective over the old one, across `motion.dry` (reduced: `motion.fade`).
function HeadFade(p: { was?: string; words: string; style: object }) {
  const dry = useDrying();
  const arriving = useAnimatedStyle(() => ({ opacity: dry.value }));
  const leaving = useFadeOut(dry);
  return (
    <View>
      {p.was ? (
        <Reanimated.View style={[OVER, leaving]} aria-hidden>
          <Text style={p.style}>{p.was}</Text>
        </Reanimated.View>
      ) : null}
      <Reanimated.View style={arriving}>
        <Text style={p.style}>{p.words}</Text>
      </Reanimated.View>
    </View>
  );
}

// True for `motion.first.hold` after the first quest's cue (book-ui.md, First times).
function useFirstQuest() {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    let hold: ReturnType<typeof setTimeout>;
    const off = onCue((cue) => {
      if (cue.name !== 'quest_on' || !cue.first) return;
      setFirst(true);
      hold = setTimeout(() => setFirst(false), motion.first.hold);
    });
    return () => (off(), clearTimeout(hold));
  }, []);
  return first;
}

/**
 * The current quest's projected journal text, above every page but Journal.
 * - Use: Body only.
 * - Rules: the first quest in journal order that is active or objectives_complete and has journal
 *   text; none when no quest qualifies. Not pressable; wraps, never cuts authored words.
 * - States: one line; long; none.
 * - Story: Page.stories.tsx
 */
export function RunningHead({ view, text }: { view: GameView; text: Say }) {
  const c = usePalette();
  const t = useType();
  // ponytail: the first unfinished quest in journal order; several at once await a GameView answer.
  const quest = view.journal.find(
    (q) => (q.state === 'active' || q.state === 'objectives_complete') && q.journal,
  );
  const words = quest && plain(text(quest.journal!));
  const first = useFirstQuest();
  useEffect(() => {
    lastHead = words;
    lastQuest = quest?.quest.key;
  }, [words]);
  const style = {
    ...t.runningHead,
    color: first ? c.warning : c.dim,
    paddingHorizontal: space.page,
    paddingTop: space.page,
  };
  return <HeadLine key={words ?? ''} style={style} words={words} view={view} />;
}
