// The status line under the footer (BOOK-UI-COMPONENTS.md, Status line).
import { Pressable, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { bleedingLine, branch, said, toneOf, type Pool } from './model.ts';
import { band, Tap } from './pages.tsx';
import { usePalette, type Palette } from './palette.ts';
import { size, space, type } from './tokens.ts';

// One line: the time as its earthly branch, then the resource button, which shows the body's
// resources coloured by band when GameView carries them (the room-view status line, an owner-
// ruled departure) and opens Contents, the index of the existing book sections.
type StatusProps = {
  time: number;
  calendar?: GameView['calendar_status'];
  resources?: readonly Pool[];
  bleeding?: GameView['bleeding'];
  position?: GameView['position'];
  text: (key: string) => string;
  locked: boolean;
  pending: boolean;
  open: () => void;
  openPosition?: () => void;
};

const statusRow = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  columnGap: space.sm,
} as const;

// The calendar as one line: day and hour, then the solar term and the moon when the world has them.
const calendarLine = (calendar: StatusProps['calendar']) =>
  calendar &&
  [
    `day ${calendar.day}, ${String(calendar.hour).padStart(2, '0')}:${String(calendar.subdivision).padStart(2, '0')}`,
    calendar.solar?.replaceAll('_', ' '),
    calendar.lunar && `${calendar.lunar.replaceAll('_', ' ')} moon`,
  ]
    .filter(Boolean)
    .join(' · ');

export function StatusLine(p: StatusProps) {
  const c = usePalette();
  const time = calendarLine(p.calendar);
  const items = [
    <Text
      key="time"
      style={{ ...type.small, color: c.dim }}
      accessibilityLabel={time ? time.replaceAll(' · ', ', ') : branch(p.time).label}
    >
      {time ?? branch(p.time).glyph}
    </Text>,
    p.position && <Position key="position" value={p.position} open={p.openPosition} />,
    p.bleeding && (
      <Text key="bleeding" style={{ ...type.small, color: c.danger }}>
        {bleedingLine(p.bleeding, p.time, p.text)}
      </Text>
    ),
    <Pressable
      key="contents"
      disabled={p.locked}
      accessibilityRole="button"
      accessibilityLabel={p.resources ? `Contents, ${said(p.resources, p.text)}` : 'Contents'}
      onPress={p.open}
      style={{ minHeight: size.touch, justifyContent: 'center' }}
    >
      {p.resources ? (
        <View style={{ flexDirection: 'row', columnGap: space.sm }}>
          {shown(c, p.resources, p.locked)}
        </View>
      ) : (
        <Text style={{ ...type.small, color: p.locked ? c.dim : c.action }}>character</Text>
      )}
    </Pressable>,
  ].filter(Boolean);
  return (
    <View style={statusRow}>
      {items.flatMap((item, i) =>
        i
          ? [
              <Text key={`join${i}`} aria-hidden style={{ ...type.small, color: c.dim }}>
                ·
              </Text>,
              item,
            ]
          : [item],
      )}
      {p.pending && (
        <Text style={{ ...type.small, color: c.dim, width: '100%', textAlign: 'center' }}>
          save not confirmed
        </Text>
      )}
    </View>
  );
}

// The resources as the status line shows them (band colours per model.ts `toneOf`; dim while
// locked); its label is model.ts `said`.
const shown = (c: Palette, rs: readonly Pool[], locked: boolean) =>
  rs.map((r) => (
    <Text
      key={r.resource.key}
      style={{ ...type.small, color: locked ? c.dim : band(c, toneOf(r)) }}
    >
      <Text style={type.label}>{r.resource.key}</Text>
      {` ${r.current}/${r.maximum}`}
    </Text>
  ));

function Position(p: { value: NonNullable<GameView['position']>; open?: () => void }) {
  const c = usePalette();
  const words = (
    <Text style={{ ...type.small, color: c.dim }} accessibilityLabel={`Position, ${p.value}`}>
      {p.value}
    </Text>
  );
  return p.open ? (
    <Tap label={`Position, ${p.value}`} onPress={p.open}>
      {words}
    </Tap>
  ) : (
    words
  );
}
