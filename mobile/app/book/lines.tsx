// Entity lines and log lines (BOOK-UI-COMPONENTS.md, Entity line and Log line).
import { Text } from 'react-native';
import type { DetailLine } from './logs.ts';
import { Tap } from './pages.tsx';
import { note, prose, usePalette } from './palette.ts';
import { radius, size, space, type } from './tokens.ts';

const named = {
  fontWeight: '500',
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
} as const;

// A row that opens a detail: the name, then `rest` (verbatim, its own spacing), a note below.
// Without `rest` the name is the line's one Text. Its accessible name is that shown text, then `suffix`.
export function EntityLine(p: {
  name: string;
  rest?: string;
  note?: string;
  suffix?: string;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Tap
      label={`${p.name}${p.rest ?? ''}${p.note ? ` ${p.note}` : ''}${p.suffix ?? ''}`}
      onPress={p.onPress}
    >
      {p.rest ? (
        <Text style={prose(c)}>
          <Text style={named}>{p.name}</Text>
          {p.rest}
        </Text>
      ) : (
        <Text style={{ ...prose(c), ...named }}>{p.name}</Text>
      )}
      {p.note ? <Text style={note(c)}>{p.note}</Text> : null /* '' is no bare string on native */}
    </Tap>
  );
}

// One Text per line: narration in ink, a system line dim italic, a refused line after its tag.
// ponytail: the tag is nested Text, so iOS and Android draw it without its border (web draws it).
export function LogLines({ lines }: { lines: readonly DetailLine[] }) {
  const c = usePalette();
  return lines.map((line, i) =>
    typeof line === 'string' ? (
      <Text key={i} style={{ ...type.log, color: c.fg }}>
        {line}
      </Text>
    ) : 'event' in line ? (
      <Text key={i} style={{ ...type.log, color: c.dim, fontStyle: 'italic' }}>
        {line.text}
      </Text>
    ) : (
      <Text key={i} style={{ ...type.log, color: c.fg }}>
        <Text
          style={{
            ...type.tag,
            color: c.danger,
            borderColor: c.danger,
            borderWidth: size.rule,
            borderRadius: radius.tag,
            paddingHorizontal: space.xs,
          }}
        >
          {line.reason}
        </Text>{' '}
        {line.text}
      </Text>
    ),
  );
}
