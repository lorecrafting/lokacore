// The status line under the footer.
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { bleedingLine, branch, pools, said, sky, toneOf, type Pool } from './model.ts';
import { band, Tap } from './pages.tsx';
import { LABEL } from './labels.ts';
import { StatusIcons } from './StatusIcon.tsx';
import { usePalette, useType, type Palette, type Type } from './palette.ts';
import { size, space } from './tokens.ts';

// The status icon row (StatusIcon.tsx) when any condition is on, then the line: the sky glyph (sun by day, moon by night), the position, bleeding, then
// the resource button, which shows the condition pools coloured by band when GameView carries them
// (the room-view status line, an owner-ruled departure) and opens Contents, the index of the
// existing book sections. Too wide, the pools move to a second line, whole; then the position
// truncates (polish pick mv1j35ltxddx; loka-x6t.86).
type StatusProps = {
  time: number;
  // NonNullable: react-docgen reads a bare GameView['x'] as a member-less type that Storybook's arg-type conversion throws on.
  calendar?: NonNullable<GameView['calendar_status']>;
  resources?: readonly Pool[];
  bleeding?: NonNullable<GameView['bleeding']>;
  conditions?: NonNullable<GameView['conditions']>;
  position?: NonNullable<GameView['position']>;
  text: (key: string) => string;
  locked: boolean;
  pending: boolean;
  open: () => void;
  openCharacter: () => void; // a status icon's tap
  openPosition?: () => void;
};

const statusRow = {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  flexWrap: 'wrap',
  columnGap: space.xl,
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

/**
 * A centred line: the sky glyph and weather, position and bleeding, then hp, ma and mv
 * (book-ui.md, World and status entry); no say icon in single-player (book-ui.md, Word bar).
 * - Use: under the footer on every page.
 * - Rules: at most two lines, nothing dropped: too wide, the pools take the second line whole
 *   (the only break falls before hp); still too wide, position and bleeding end in an ellipsis,
 *   the longer giving up more. The glyph and pools never shrink. The pools are one unbreakable
 *   run: no-break spaces as text, never a margin, so the shown words lead the button's name. A
 *   gap, not a dot, sets the pools apart.
 *   Every role scales with the Reading size. The sky glyphs are model.ts `sky`: ink is
 *   the moon's dark side, waxing lit on the right; the glyph's name is the time in words (`day 3,
 *   18:05, dusk, waxing crescent moon`). Position and pools are controls named by the
 *   label-in-name rule.
 * - States: enabled; weather; locked (not pressable); pending ("save not confirmed" under the
 *   line); resource tones normal, warning, danger; only pennies (the button says `character`).
 * - Story: StatusLine.stories.tsx
 */
export function StatusLine(p: StatusProps) {
  const c = usePalette();
  const t = useType();
  const items = leading(c, t, p);
  return (
    <View>
      {/* Mounted when empty too, so the last icon's fade plays. */}
      <StatusIcons
        conditions={p.conditions ?? []}
        time={p.time}
        text={p.text}
        open={p.locked ? undefined : p.openCharacter}
      />
      <View style={statusRow}>
        {/* Two wrap units, so the only break falls before the pools. */}
        <View style={{ ...group, ...shrink }}>
          {items.map((item, i) => (i ? joined(c, t, item) : item))}
        </View>
        <View style={group}>
          <Contents {...p} resources={pools(p.resources)} />
        </View>
      </View>
      <View style={{ alignItems: 'center' }}>
        {p.pending && <Text style={{ ...t.small, color: c.dim }}>{LABEL.saveNotConfirmed}</Text>}
      </View>
    </View>
  );
}

// The items before the pools: the sky glyph and weather, then position and bleeding when present.
const leading = (c: Palette, t: Type, p: StatusProps) =>
  [
    <Text
      key="time"
      style={{ ...t.small, color: c.dim }}
      accessibilityLabel={calendarLine(p.calendar) ?? branch(p.time).label}
    >
      {skyText(p)}
    </Text>,
    p.position && <Position key="position" value={p.position} open={p.openPosition} />,
    p.bleeding && (
      <Text key="bleeding" numberOfLines={1} style={{ ...t.small, color: c.danger }}>
        {bleedingLine(p.bleeding, p.time, p.text)}
      </Text>
    ),
  ].filter(Boolean) as ReactElement[];

// Each " · " belongs to the item after it, so the line never starts with a lone dot; position and
// bleeding may shrink (they truncate).
const joined = (c: Palette, t: Type, item: ReactElement) => (
  <View key={item.key} style={{ ...group, ...shrink }}>
    <Text aria-hidden style={{ ...t.small, color: c.dim }}>
      ·
    </Text>
    {item}
  </View>
);

// The resources (or "character"), a button that opens Contents; not pressable while locked.
function Contents(p: StatusProps) {
  const c = usePalette();
  const t = useType();
  return (
    <Pressable
      disabled={p.locked}
      accessibilityRole="button"
      // Label in name (book-ui.md): the shown text first (its no-break spaces as spaces), then where it goes.
      accessibilityLabel={`${p.resources ? said(p.resources, p.text) : 'character'}; opens Contents`}
      onPress={() => p.open()} // no press event: open takes none
      style={{ minHeight: size.touch, justifyContent: 'center' }}
    >
      <Text style={{ ...t.small, color: p.locked ? c.dim : c.action }}>
        {p.resources ? shown(c, t, p.resources, p.locked) : 'character'}
      </Text>
    </Pressable>
  );
}

// The resources as the status line shows them (band colours per model.ts `toneOf`; dim while
// locked); its label is model.ts `said`. A figure space between resources and a no-break space
// within each, as text, not a margin: both are no-break, so the pools never split and the shown
// words lead the button's name (book-ui.md, Label in name).
const shown = (c: Palette, t: Type, rs: readonly Pool[], locked: boolean) =>
  rs.map((r, i) => (
    <Text key={r.resource.key} style={{ color: locked ? c.dim : band(c, toneOf(r)) }}>
      {i ? '\u2007' : ''}
      <Text style={t.label}>{r.resource.key}</Text>
      {`\u00a0${r.current}/${r.maximum}`}
    </Text>
  ));

// The position word, one line: too wide, it ends in an ellipsis while its label stays whole.
function Position(p: { value: NonNullable<GameView['position']>; open?: () => void }) {
  const c = usePalette();
  const words = (
    <Text numberOfLines={1} style={{ ...useType().small, color: c.dim }}>
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
