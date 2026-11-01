// Entity lines, log lines and a press's fault (their doc comments).
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain } from './model.ts';
import { LABEL } from './labels.ts';
import { InkText, Reanimated } from './fade.ts';
import { haptic } from './haptic';
import { logMark, markDrawn, type DetailLine } from './logs.ts';
import { GiltLine } from './GiltLine.tsx';
import { useDry } from './press.ts';
import { lineText } from './words.ts';
import { grouped, type RecapLine } from './recap.ts';
import { Control, Tap } from './pages.tsx';
import { narrated, note, prose, usePalette, useType } from './palette.ts';
import { motion, size, space, type } from './tokens.ts';

// Web keys on a Text or View: react-native-web forwards onKeyDown, React Native's types lack it.
export const onKey = (f: (key: string) => unknown) =>
  ({
    onKeyDown: (e: { key: string; preventDefault: () => void }) => f(e.key) && e.preventDefault(),
  }) as object;

/**
 * A MUD line that opens a detail: the name, then `rest` verbatim, a carried-item note below.
 * - Use: every row that opens a detail: held and worn, Inside, notices, Contents entries; never
 *   the room's people and items (Here).
 * - Rules: the whole line is the touch target, its hit area Tap's bleed, so a run of lines
 *   touches at the body pitch. Name: the shown text in order, then ", open".
 * - Story: EntityLine.stories.tsx
 */
export function EntityLine(p: { name: string; rest?: string; note?: string; onPress: () => void }) {
  const c = usePalette();
  const t = useType();
  // A trailing space ends the first line, so the shown text reads like the name (it hangs unseen).
  const gap = p.note ? ' ' : '';
  return (
    <Tap
      label={`${p.name}${p.rest ?? ''}${p.note ? ` ${p.note}` : ''}, open`}
      pulse="selection"
      onPress={p.onPress}
    >
      {p.rest ? (
        <Text style={prose(c, t)}>
          <Text style={type.named}>{p.name}</Text>
          {p.rest + gap}
        </Text>
      ) : (
        <Text style={{ ...prose(c, t), ...type.named }}>{p.name + gap}</Text>
      )}
      {
        p.note ? (
          <Text style={note(c, t)}>{p.note}</Text>
        ) : null /* '' is no bare string on native */
      }
    </Tap>
  );
}

/**
 * A dim body line that is not pressable and carries no action.
 * - Use: a sense cue, a page's "save not confirmed", a priced page's balance, a held item's
 *   holder; never a Text the page styles. A detail page with nothing to do draws no Note
 *   (owner pick mvlyb5x2m9i3).
 * - Story: Note.stories.tsx
 */
export function Note({ children }: { children: string }) {
  return <Text style={note(usePalette(), useType())}>{children}</Text>;
}

/**
 * The log: one Text per narration record, never records joined.
 * - Use: room, detail and combat logs; no lines, no block.
 * - Rules: narration and the Book's speech echo in ink. Every line the Book composes itself is a
 *   narrated event: one present-tense second-person sentence (`You learn Cooking.`), never a `Label:
 *   value`, drawn once in ink italic (palette.ts `narrated`; book-ui.md Line placement, loka-lsqi).
 *   A refused line is a narrated event with no tag or chip (owner pick mvlyp3gphp2t); its reason
 *   word stays in its accessible name (`locked, The way west is locked.`, as the live region reads
 *   it). A speech line (speaker bar) waits until the log projects a speaker. A line no page has
 *   drawn yet dries in, a narrated event `motion.dry.lag` later; a quiet merge, a page return and
 *   restored history do not. `keep` hides lines without renumbering the rest.
 * - States: narration (a repeated quiet line reads `<line> (N times)`); narrated event; refused;
 *   an away recap entry, drawn as AwayRecap; drying.
 * - Story: LogLines.stories.tsx
 */
export function LogLines({
  lines,
  keep,
}: {
  lines: readonly DetailLine[];
  keep?: (line: DetailLine) => boolean; // shows only these; the rest still count as drawn
}) {
  const { gone, drawn } = logMark(lines);
  useEffect(() => markDrawn(lines), [gone + lines.length]);
  // A line's number, also its stable key.
  const shown = lines.flatMap((line, i) =>
    !keep || keep(line) ? [<LogLine key={gone + i} line={line} fresh={gone + i >= drawn} />] : [],
  );
  if (!shown.length) return null;
  return (
    // The walk tells log lines from refusal notes by this id (walkthrough/walk.ts live).
    <View testID="log-lines" style={{ gap: space.sm }}>
      {shown}
    </View>
  );
}

// `fresh` is read once: the redraw after this one must not cut the drying, and an old line stays a
// plain Text, so a long log carries no animation.
function LogLine({ line, fresh }: { line: DetailLine; fresh: boolean }) {
  const c = usePalette();
  const t = useType();
  const dries = useRef(fresh).current;
  if (typeof line === 'object' && 'recap' in line) {
    const recap = <AwayRecap lines={grouped(line.recap)} />;
    return dries ? <DryBlock>{recap}</DryBlock> : recap;
  }
  const plain = typeof line === 'string' || 'quiet' in line;
  const style = plain ? { ...t.log, color: c.fg } : narrated(c, t);
  const name =
    typeof line === 'object' && 'reason' in line
      ? { accessibilityLabel: `${line.reason}, ${line.text}` }
      : {};
  const words = plain ? lineText(line) : line.text;
  if (dries && typeof line === 'object' && 'gilt' in line) {
    return <GiltLine style={style}>{words}</GiltLine>;
  }
  return dries ? (
    <DryLine style={style} lag={plain ? 0 : motion.dry.lag} {...name}>
      {words}
    </DryLine>
  ) : (
    <Text style={style} {...name}>
      {words}
    </Text>
  );
}

function DryLine(p: {
  style: { color: string };
  lag: number;
  accessibilityLabel?: string;
  children: string;
}) {
  const { style, lag, ...rest } = p;
  return <InkText style={[style, useDry(style.color, lag)]} {...rest} />;
}

const DryBlock = ({ children }: { children: ReactNode }) => (
  <Reanimated.View style={useDry()}>{children}</Reanimated.View>
);

/**
 * A room log entry after an absence (book-ui.md, Away recap).
 * - Use: the room log (LogLines); the Chronicle's day headings (`heading` "Day N").
 * - Rules: a dim italic Tap heading, named with ", show" or ", hide"; open, one line
 *   per group, " (N times)" after a repeat; `milestone` lines named "<line>, story point".
 *   Wording pending the designer (loka-x6t.14).
 * - States: collapsed; open; milestone.
 * - Story: AwayRecap.stories.tsx
 */
export function AwayRecap({
  lines,
  heading = LABEL.awayRecap,
  open: first = false,
  milestone = () => false,
}: {
  lines: readonly RecapLine[];
  heading?: string;
  open?: boolean;
  milestone?: (line: string) => boolean; // the Chronicle: a story point's line in body type
}) {
  const c = usePalette();
  const t = useType();
  const [open, setOpen] = useState(first);
  return (
    <View style={{ gap: space.sm }}>
      <Tap label={`${heading}, ${open ? 'hide' : 'show'}`} onPress={() => setOpen(!open)}>
        <Text style={{ ...t.log, color: c.dim, ...type.italic }}>{heading}</Text>
      </Tap>
      {open &&
        lines.map(({ line, count }, i) => {
          const shown = count > 1 ? `${line} (${count} times)` : line;
          return milestone(line) ? (
            <Text key={i} style={prose(c, t)} accessibilityLabel={`${shown}, story point`}>
              {shown}
            </Text>
          ) : (
            <Text key={i} style={{ ...t.log, color: c.fg }}>
              {shown}
            </Text>
          );
        })}
    </View>
  );
}

// An inline link inside running prose (Here's names, RoomPage's linked fixtures): `type.named`, no
// touch box (the inline-link exception, BOOK-UI-COMPONENTS.md), named "<words>, open", Enter or Space
// presses it on the web. A function, not a component: the Book's test text helpers read Text
// children only, and a component would need its own story and catalogue line.
export const nameLink = (name: string, onPress: () => void, key?: string | number) => (
  <Text
    key={key}
    style={type.named}
    accessibilityRole="button"
    accessibilityLabel={`${name}, open`}
    onPress={onPress}
    {...onKey((k) => (k === 'Enter' || k === ' ') && (onPress(), true))} // web Text has no key press
  >
    {name}
  </Text>
);

/**
 * The Book's live region: each new batch of World, combat and refused lines, read once by a screen
 * reader and not seen (book-ui.md, Announcements).
 * - Use: once, in the Book, outside PageTurn, so a page turn never reads it again.
 * - Rules: polite; a new key per batch remounts the text, so a repeated line is read again.
 * - Story: Heard.stories.tsx
 */
export function Heard({ said }: { said: { key: number; text: string } }) {
  return (
    <View aria-live="polite" style={unseen}>
      <Text key={said.key} numberOfLines={1}>
        {said.text}
      </Text>
    </View>
  );
}

// Read by a screen reader, not seen: one pixel, clipped.
export const unseen = {
  position: 'absolute',
  width: size.unseen,
  height: size.unseen,
  overflow: 'hidden',
} as const;

/**
 * A press that threw (a damaged page, a full disk): its message, and Start over beside the retry
 * that any press still sends (03 §14).
 * - Use: Book's foot, after a press throws.
 * - Rules: the message sits outside the button, since its accessibilityLabel replaces the
 *   children it reads. An error haptic once per fault, no sound.
 * - Story: Live.stories.tsx
 */
export function Fault(p: { fault: string; startOver: () => void }) {
  const c = usePalette();
  useEffect(() => haptic('error'), [p.fault]);
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ ...useType().small, color: c.dim }}>{p.fault}</Text>
      <Control label={LABEL.startOver} onPress={p.startOver} />
    </View>
  );
}
