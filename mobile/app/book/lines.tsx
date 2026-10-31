// Entity lines, Here lines, log lines and a press's fault (their doc comments).
import { Fragment, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, plain } from './model.ts';
import { COUNT, LABEL } from './labels.ts';
import type { DetailLine } from './logs.ts';
import { lineText, subject } from './words.ts';
import { grouped, type RecapLine } from './recap.ts';
import { Control, Tap } from './pages.tsx';
import { narrated, note, prose, usePalette, useType } from './palette.ts';
import { size, space, type } from './tokens.ts';

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
    <Tap label={`${p.name}${p.rest ?? ''}${p.note ? ` ${p.note}` : ''}, open`} onPress={p.onPress}>
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
 *   narrated event: one second-person sentence (`You have learned Cooking.`), never a `Label:
 *   value`, drawn once in ink italic (palette.ts `narrated`; book-ui.md Line placement, loka-lsqi).
 *   A refused line is a narrated event with no tag or chip (owner pick mvlyp3gphp2t); its reason
 *   word stays in its accessible name (`locked, The way west is locked.`, as the live region reads
 *   it). A speech line (speaker bar) waits until the log projects a speaker.
 * - States: narration (a repeated quiet line reads `<line> (N times)`); narrated event; refused;
 *   an away recap entry, drawn as AwayRecap.
 * - Story: LogLines.stories.tsx
 */
export function LogLines({ lines }: { lines: readonly DetailLine[] }) {
  const c = usePalette();
  const t = useType();
  if (!lines.length) return null;
  return (
    // The walk tells log lines from refusal notes by this id (walkthrough/walk.ts live).
    <View testID="log-lines" style={{ gap: space.sm }}>
      {lines.map((line, i) =>
        typeof line === 'string' || 'quiet' in line ? (
          <Text key={i} style={{ ...t.log, color: c.fg }}>
            {lineText(line)}
          </Text>
        ) : 'recap' in line ? (
          <AwayRecap key={i} lines={grouped(line.recap)} />
        ) : 'event' in line ? (
          <Text key={i} style={narrated(c, t)}>
            {line.text}
          </Text>
        ) : (
          <Text key={i} accessibilityLabel={`${line.reason}, ${line.text}`} style={narrated(c, t)}>
            {line.text}
          </Text>
        ),
      )}
    </View>
  );
}

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

/**
 * The room's people, then items; no headings, an empty group omitted (book-ui.md, Room page
 * anatomy).
 * - Use: RoomPage only.
 * - Rules: each group is one sentence, "Aldous, Bess, the carpenter, chandler, and cook are here."
 *   ("A and B are here.", "A crow is here.", "Two crows are here."): serial comma, the first word
 *   capitalised, each name its own link named "<name>, open"; articles, commas and "and" are plain
 *   text. A name with words shows its bare name; an article is shared by a run of different names
 *   that take it.
 * - Story: RoomPage.stories.tsx
 */
export function Here(p: {
  view: GameView;
  text: (key: string) => string;
  open: (id: string) => void;
}) {
  const npcs = p.view.entities.filter((e) => e.kind === 'npc');
  const items = p.view.entities.filter((e) => e.kind !== 'npc');
  return [
    npcs.length > 0 && <Present key="npcs" group={npcs} text={p.text} open={p.open} />,
    items.length > 0 && <Present key="items" group={items} text={p.text} open={p.open} />,
  ];
}

// One group as one sentence of inline name links (owner, mvl9864n2qi8, mvl9q99wzm29). With name
// words (loka-6qi): the bare name, its article written when it differs from the previous link's or
// the name ends in the previous link's last word (a name without one breaks the run), and
// same-name entities with a plural as one. With a carrier: "<Carrier> carries <links>." or, with
// verb wears, "<Carrier> wears <links>." (the NPC's Look page, InsidePage), first link lowercase.
const noun = (n?: string) => n?.split(' ').pop(); // 'cowering goblin' and 'goblin' end alike
type Group = {
  group: GameView['entities'];
  text: (key: string) => string;
  open: (id: string) => void;
  carrier?: string;
  verb?: 'carries' | 'wears';
};
// An empty group draws no sentence (a seen NPC always has worn, often []).
export const carries = (p: Group & { carrier: string }) => p.group.length > 0 && <Present {...p} />;
function Present(p: Group) {
  const [c, t] = [usePalette(), useType()];
  type Link = { id: string; name: string; article?: string; many?: true };
  const links = p.group.flatMap((e): Link[] => {
    const { bare, article, plural } = e.words ?? {};
    const kind = (o: (typeof p.group)[number]) => o.words?.plural && p.text(o.words.plural); // eggs keyed egg_01..06
    const same = plural ? p.group.filter((o) => kind(o) === kind(e)) : [e];
    if (same[0] !== e) return []; // a later member of a collapsed group
    const n = same.length;
    if (n > 1) return [{ id: e.id, name: `${COUNT[n - 2] ?? n} ${p.text(plural!)}`, many: true }];
    return [{ id: e.id, name: p.text(bare ?? e.name), article }];
  });
  return (
    <Text style={prose(c, t)}>
      {p.carrier && `${p.carrier} ${p.verb ?? 'carries'} `}
      {links.map((l, i) => {
        const prev = links[i - 1];
        const article =
          (l.article !== prev?.article || noun(l.name) === noun(prev?.name)) && l.article;
        const first = (s: string) => (i === 0 && !p.carrier ? cap(s) : s);
        return (
          <Fragment key={l.id}>
            {i > 0 && (i < links.length - 1 ? ', ' : links.length > 2 ? ', and ' : ' and ')}
            {article && `${first(article)} `}
            {nameLink(article ? l.name : first(l.name), () => p.open(l.id))}
          </Fragment>
        );
      })}
      {!p.carrier && subject(links.at(-1)?.name ?? '').endsWith(',') && ','}
      {p.carrier ? '.' : links.length > 1 || links[0]?.many ? ' are here.' : ' is here.'}
    </Text>
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
 *   children it reads.
 * - Story: Live.stories.tsx
 */
export function Fault(p: { fault: string; startOver: () => void }) {
  const c = usePalette();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ ...useType().small, color: c.dim }}>{p.fault}</Text>
      <Control label={LABEL.startOver} onPress={p.startOver} />
    </View>
  );
}
