// Entity lines, the room's Here lines and log lines (EntityLine and LogLines doc comments).
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, cueLine, plain } from './model.ts';
import { LABEL } from './labels.ts';
import type { DetailLine } from './logs.ts';
import type { RecapLine } from './recap.ts';
import { Tap } from './pages.tsx';
import { note, prose, usePalette, useType } from './palette.ts';
import { radius, size, space, type } from './tokens.ts';

/**
 * A MUD line that opens a detail: the name, then `rest` verbatim, a carried-item note below.
 * - Use: every row that opens a detail: people and items here, held and worn, Inside, notices,
 *   Contents entries.
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
 * - Use: an aside, a sense cue, every empty state ("Nothing to do here."), a page's "save not
 *   confirmed", a priced page's balance, a held item's holder; never a Text the page styles.
 * - Rules: an empty-state Note never shares a page with an unavailable action line.
 * - Story: Note.stories.tsx
 */
export function Note({ children }: { children: string }) {
  return <Text style={note(usePalette(), useType())}>{children}</Text>;
}

/**
 * The character's passive voices as one block of Notes, links as plain words (book-ui.md, Aside
 * details).
 * - Use: the room page and people's asides; no asides, no block.
 * - Story: RoomPage.stories.tsx
 */
export function Asides({
  keys = [],
  text,
}: {
  keys?: readonly { key: string }[];
  text: (key: string) => string;
}) {
  return keys.length > 0 ? (
    <View>
      {keys.map((a, i) => (
        <Note key={i}>{plain(text(a.key))}</Note>
      ))}
    </View>
  ) : null;
}

/**
 * The log: one Text per narration record, never records joined.
 * - Use: room, detail and combat logs; no lines, no block.
 * - Rules: narration and the Book's speech echo in ink; a system line dim italic; a refused line
 *   leads with its reason tag, always the reason word even when the sentence repeats it. The tag
 *   is its own Text in a row beside the sentence, never nested (native draws no border on nested
 *   Text). A speech line (speaker bar) waits until the log projects a speaker.
 * - States: narration; system; refused.
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
        typeof line === 'string' ? (
          <Text key={i} style={{ ...t.log, color: c.fg }}>
            {line}
          </Text>
        ) : 'event' in line ? (
          <Text key={i} style={{ ...t.log, color: c.dim, ...type.italic }}>
            {line.text}
          </Text>
        ) : (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'baseline', columnGap: space.xs }}
          >
            <Text
              style={{
                ...t.tag,
                color: c.danger,
                borderColor: c.danger,
                borderWidth: size.rule,
                borderRadius: radius.tag,
                paddingHorizontal: space.xs,
              }}
            >
              {line.reason}
            </Text>
            <Text style={{ ...t.log, color: c.fg, flex: 1 }}>{line.text}</Text>
          </View>
        ),
      )}
    </View>
  );
}

/**
 * The World page's first block after an absence (book-ui.md, Away recap).
 * - Use: the World page; the Chronicle's day headings (`heading` "Day N").
 * - Rules: a Tap heading like a system log line, named with ", show" or ", hide"; open, one line
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
 * The room's people, then items, then sense cues; no headings, an empty group omitted
 * (book-ui.md, World and status entry).
 * - Use: RoomPage only.
 * - Story: RoomPage.stories.tsx
 */
export function Here(p: {
  view: GameView;
  text: (key: string) => string;
  open: (id: string) => void;
}) {
  const npcs = p.view.entities.filter((e) => e.kind === 'npc');
  const items = p.view.entities.filter((e) => e.kind !== 'npc');
  const line = (e: GameView['entities'][number]) => (
    <EntityLine
      key={e.id}
      name={cap(p.text(e.name))}
      rest=" is here."
      note={e.carrying && p.text(e.carrying)}
      onPress={() => p.open(e.id)}
    />
  );
  return [
    npcs.length > 0 && <View key="npcs">{npcs.map(line)}</View>,
    // Row FD10: the present people's asides, in listed then authored order, before the items.
    <Asides key="asides" keys={npcs.flatMap((e) => e.asides ?? [])} text={p.text} />,
    items.length > 0 && <View key="items">{items.map(line)}</View>,
    p.view.cues && (
      <View key="cues">
        {p.view.cues.map((cue, i) => (
          <Note key={i /* two equal cues are two lines */}>{cueLine(cue, p.text)}</Note>
        ))}
      </View>
    ),
  ];
}

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
      <Text key={said.key}>{said.text}</Text>
    </View>
  );
}

// Read by a screen reader, not seen: one pixel, clipped.
const unseen = {
  position: 'absolute',
  width: size.unseen,
  height: size.unseen,
  overflow: 'hidden',
} as const;
