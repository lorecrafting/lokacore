// A full reading page with the offered actions following its combat history.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import { bandPhrase, type group } from './model.ts';
import { ActionCard, Cards, PickLists, type Shown } from './actions.tsx';
import { commandOf } from './buttons.ts';
import { LogLines } from './lines.tsx';
import { LABEL } from './labels.ts';
import { Control, Page } from './pages.tsx';
import { RunningHead } from './RunningHead.tsx';
import { Blow } from './Blow.tsx';
import { onCue } from './cues.ts';
import {
  InkText,
  interpolateColor,
  Reanimated,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from './fade.ts';
import { useDry } from './press.ts';
import { motion, size } from './tokens.ts';
import { prose, usePalette, useType } from './palette.ts';
import type { presenter, Button } from './presenter.ts';
import { cardKey } from './presenter.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Encounter = NonNullable<Screen['ended']>;

const reduceMotion = ReduceMotion.Never; // the colour still shows; `still` takes only the travel
const { duration: pressIn, out: pressOut } = motion.press;

// A blow dealt: the line lifts and its phrase takes `dim` for one press (a nested Text's colour cannot
// animate on native, so it steps, and the travel is the line's). A foe falling: its line settles to `dim`.
function useBlow(id: string) {
  const { fg, dim } = usePalette();
  const still = useReducedMotion();
  const [struck, setStruck] = useState(false);
  const lift = useSharedValue(0);
  const fell = useSharedValue(0);
  useEffect(() => {
    let release: ReturnType<typeof setTimeout> | undefined;
    const stop = onCue((cue) => {
      if (cue.name === 'combat_close' && cue.end === 'fell')
        fell.value = withTiming(1, { duration: motion.settle.duration, reduceMotion });
      if (cue.name !== 'blow_dealt' || !cue.ids?.includes(id)) return;
      setStruck(true);
      clearTimeout(release);
      release = setTimeout(() => setStruck(false), pressIn + pressOut);
      lift.value = withSequence(
        reduceMotion,
        withTiming(1, { duration: pressIn, reduceMotion }),
        withTiming(0, { duration: pressOut, reduceMotion }),
      );
    });
    return () => (stop(), clearTimeout(release));
  }, [id]);
  const travel = useAnimatedStyle(() => ({
    transform: [{ translateY: still ? 0 : -size.rule * lift.value }],
  }));
  const settled = useAnimatedStyle(() => ({
    color: interpolateColor(fell.value, [0, 1], [fg, dim]),
  }));
  return { struck, travel, settled };
}

function Foe(p: {
  opponent: Pick<Encounter, 'name' | 'band' | 'words'> & { id: string };
  target: boolean;
  live: boolean;
  text: Screen['text'];
  children: React.ReactNode;
}) {
  const c = usePalette();
  const t = useType();
  const { opponent, text } = p;
  const { struck, travel, settled } = useBlow(opponent.id);
  return (
    <Reanimated.View style={travel}>
      <InkText style={[prose(c, t), settled]}>
        {opponent.words
          ? `${opponent.words.article ? `${LABEL.the} ` : ''}${text(opponent.words.bare)}`
          : text(opponent.name)}
        {p.target ? ' (your target)' : ''}
        {/* a closed encounter's band is stale (a dead foe has none) */}
        {p.live && opponent.band && (
          <Text style={struck ? { color: c.dim } : undefined}>
            {` — ${bandPhrase({ band: opponent.band }, text)}`}
          </Text>
        )}
      </InkText>
      {p.children}
    </Reanimated.View>
  );
}

// The opponent lines, "name — band", one block of touching lines (a run of one kind, like the
// mock's entity lines; Page's doc comment). A foe with name words reads definite, "the goblin"
// (a proper name stays bare), one line per foe (loka-6qi). Your own bleeding and conditions stay on the
// status line and Character (book-ui.md, Live combat response).
// Under a live foe's line, its Cast a spell… list; a pick keeps the combat page (loka-x6t.109.5).
function Fight(
  p: Pick<Screen, 'view' | 'text' | 'buttons' | 'pending'> & {
    combat: Encounter;
    press: (b: Button) => void;
  },
) {
  const { view, text, combat } = p;
  const { opponent_id: id, name, band, words } = combat;
  const shown: Shown = useState(); // one for every foe's list: one list open at a time (book-ui.md)
  const casts = p.buttons.filter((b) => commandOf(b) === 'cast');
  return (
    <View>
      {(combat.active_opponents ?? [{ id, name, band, words }]).map((opponent) => (
        <Foe
          key={opponent.id}
          opponent={opponent}
          target={!!(combat.active_opponents && opponent.id === combat.opponent_id && view.combat)}
          live={!!view.combat}
          text={text}
        >
          <PickLists
            page={opponent.id}
            view={view}
            buttons={casts.filter((b) => b.detail_id === opponent.id)}
            text={text}
            press={p.press}
            pending={p.pending}
            state={shown}
          />
        </Foe>
      ))}
    </View>
  );
}

function BackToWorld(p: { onPress: () => void }) {
  return (
    <Reanimated.View style={useDry()}>
      <Control label={LABEL.backToWorld} onPress={p.onPress} />
    </Reanimated.View>
  );
}

/**
 * The combat foreground (book-ui.md, Live combat response).
 * - Use: while a fight is on.
 * - Rules: opponent lines (name, band phrase; none of your own condition lines) as one block of
 *   touching lines, then the isolated log, then the response cards; no PageFoot.
 * - States: one foe; pack; bleeding.
 * - Story: CombatPage.stories.tsx
 */
export function Combat(p: {
  screen: ReturnType<ReturnType<typeof presenter>['screen']>;
  g: ReturnType<typeof group>;
  press: (button: Button) => void;
  world: () => void;
}) {
  const c = usePalette();
  const { view, text, combatLog, ended } = p.screen;
  const combat = view.combat ?? ended;
  if (!combat) return null;
  // A closed encounter keeps its page: no actions, one Back to World (book-ui.md, Closure).
  const foot = !view.combat && <BackToWorld onPress={p.world} />;
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    // Paper behind the running head too: the leaving page fades over the arriving one.
    <Blow>
      <RunningHead view={view} text={text} />
      <Page paperless title="Combat" foot={foot}>
        <Fight {...p.screen} combat={combat} press={p.press} />
        <LogLines lines={combatLog} />
        {view.combat && (
          <Cards>
            {stand && <ActionCard b={stand} press={p.press} />}
            {p.g.look && <ActionCard b={p.g.look} press={p.press} />}
            {p.g.flee.map((b) => (
              <ActionCard key={cardKey(b)} b={b} press={p.press} />
            ))}
            {p.g.bandage.map((b) => (
              <ActionCard key={b.target_ids[0]} b={b} press={p.press} />
            ))}
          </Cards>
        )}
      </Page>
    </Blow>
  );
}
