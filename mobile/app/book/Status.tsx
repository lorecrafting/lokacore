// The status line under the footer (BOOK-UI-COMPONENTS.md, Status line).
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import {
  bleedingLine,
  branch,
  conditionLine,
  pools,
  said,
  sky,
  toneOf,
  type Pool,
} from './model.ts';
import { band, Tap } from './pages.tsx';
import { usePalette, type Palette } from './palette.ts';
import { size, space, type } from './tokens.ts';

// One line, never wrapping: the sky glyph (sun by day, moon by night), the position, bleeding, then
// the resource button, which shows the condition pools coloured by band when GameView carries them
// (the room-view status line, an owner-ruled departure) and opens Contents, the index of the
// existing book sections. Too wide, the position and condition items truncate; the pools never
// shrink (polish pick mv1j35ltxddx).
type StatusProps = {
  time: number;
  calendar?: GameView['calendar_status'];
  resources?: readonly Pool[];
  bleeding?: GameView['bleeding'];
  conditions?: GameView['conditions'];
  position?: GameView['position'];
  text: (key: string) => string;
  locked: boolean;
  pending: boolean;
  open: () => void;
  openPosition?: () => void;
};

const statusRow = {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  columnGap: space.sm,
} as const;
const group = { flexDirection: 'row', alignItems: 'center', columnGap: space.sm } as const;
const shrink = { flexShrink: 1, minWidth: 0 } as const;

// The calendar in words, the sky glyph's accessible label: day and hour, then the solar term, the
// moon, the weather, the season and the tide when the world has them (toolbox row 31).
const words = (s?: string) => s?.replaceAll('_', ' ');
const calendarLine = (calendar: StatusProps['calendar']) =>
  calendar &&
  [
    `day ${calendar.day}, ${String(calendar.hour).padStart(2, '0')}:${String(calendar.subdivision).padStart(2, '0')}`,
    words(calendar.solar),
    calendar.lunar && `${words(calendar.lunar)} moon`,
    words(calendar.weather),
    words(calendar.season),
    calendar.tide && `${words(calendar.tide)} tide`,
  ]
    .filter(Boolean)
    .join(', ');

// The sky glyph, then the day's weather as a word (trap 12: the sign is in the words).
const skyText = (p: StatusProps) =>
  [sky(p.calendar?.solar, p.calendar?.lunar) ?? branch(p.time).glyph, words(p.calendar?.weather)]
    .filter(Boolean)
    .join(' ');

// size: allow 42, each condition item carries its own accessible name beside its text
export function StatusLine(p: StatusProps) {
  const c = usePalette();
  const items = [
    <Text
      key="time"
      style={{ ...type.small, color: c.dim }}
      accessibilityLabel={calendarLine(p.calendar) ?? branch(p.time).label}
    >
      {skyText(p)}
    </Text>,
    p.position && <Position key="position" value={p.position} open={p.openPosition} />,
    p.bleeding && (
      <Text key="bleeding" numberOfLines={1} style={{ ...type.small, color: c.danger }}>
        {bleedingLine(p.bleeding, p.time, p.text)}
      </Text>
    ),
    ...(p.conditions ?? []).map((x, i) => {
      const line = conditionLine(x, p.time, p.text);
      return (
        <Text
          key={`${x.label}-${i}`}
          numberOfLines={1}
          style={{ ...type.small, color: x.per_tick < 0 ? c.danger : c.dim }}
          accessibilityLabel={line.replaceAll(' · ', ', ')}
        >
          {line}
        </Text>
      );
    }),
    <Contents key="contents" {...p} resources={pools(p.resources)} />,
  ].filter(Boolean);
  return (
    <View>
      <View style={statusRow}>
        {items.map((item, i) => (i ? joined(c, item as ReactElement) : item))}
      </View>
      <View style={{ alignItems: 'center' }}>
        {p.pending && <Text style={{ ...type.small, color: c.dim }}>save not confirmed</Text>}
      </View>
    </View>
  );
}

// Each " · " belongs to the item after it, so the line never starts with a lone dot. Every item
// but the pools may shrink (position and the condition items truncate, longer ones giving up more).
const joined = (c: Palette, item: ReactElement) => (
  <View key={item.key} style={item.key === 'contents' ? group : { ...group, ...shrink }}>
    <Text aria-hidden style={{ ...type.small, color: c.dim }}>
      ·
    </Text>
    {item}
  </View>
);

// The resources (or "character"), a button that opens Contents; not pressable while locked.
function Contents(p: StatusProps) {
  const c = usePalette();
  return (
    <Pressable
      disabled={p.locked}
      accessibilityRole="button"
      // Label in name (book-ui.md): the shown text first (its en spaces as spaces), then where it goes.
      accessibilityLabel={`${p.resources ? said(p.resources, p.text) : 'character'}; opens Contents`}
      onPress={p.open}
      style={{ minHeight: size.touch, justifyContent: 'center' }}
    >
      <Text style={{ ...type.small, color: p.locked ? c.dim : c.action }}>
        {p.resources ? shown(c, p.resources, p.locked) : 'character'}
      </Text>
    </Pressable>
  );
}

// An en space between resources, as text, not a margin: the shown words lead the button's name
// (book-ui.md, Label in name). The resources as the status line shows them (band colours per model.ts `toneOf`; dim while
// locked); its label is model.ts `said`.
const shown = (c: Palette, rs: readonly Pool[], locked: boolean) =>
  rs.map((r, i) => (
    <Text key={r.resource.key} style={{ color: locked ? c.dim : band(c, toneOf(r)) }}>
      {i ? ' ' : ''}
      <Text style={type.label}>{r.resource.key}</Text>
      {` ${r.current}/${r.maximum}`}
    </Text>
  ));

// The position word, one line: too wide, it ends in an ellipsis while its label stays whole.
function Position(p: { value: NonNullable<GameView['position']>; open?: () => void }) {
  const c = usePalette();
  const words = (
    <Text numberOfLines={1} style={{ ...type.small, color: c.dim }}>
      {p.value}
    </Text>
  );
  return p.open ? (
    <Tap label={`${p.value}, change position`} onPress={p.open} shrink>
      {words}
    </Tap>
  ) : (
    words
  );
}
