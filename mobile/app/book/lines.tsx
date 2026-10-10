// Entity lines and log lines (BOOK-UI-COMPONENTS.md, Entity line and Log line).
import { Text, View } from 'react-native';
import type { DetailLine } from './logs.ts';
import { Tap } from './pages.tsx';
import { note, prose, usePalette } from './palette.ts';
import { radius, size, space, type } from './tokens.ts';

// A row that opens a detail: the name, then `rest` (verbatim, its own spacing), a note below.
// Without `rest` the name is the line's one Text. Its accessible name is that shown text, then ", open".
export function EntityLine(p: { name: string; rest?: string; note?: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Tap label={`${p.name}${p.rest ?? ''}${p.note ? ` ${p.note}` : ''}, open`} onPress={p.onPress}>
      {p.rest ? (
        <Text style={prose(c)}>
          <Text style={type.named}>{p.name}</Text>
          {p.rest}
        </Text>
      ) : (
        <Text style={{ ...prose(c), ...type.named }}>{p.name}</Text>
      )}
      {p.note ? <Text style={note(c)}>{p.note}</Text> : null /* '' is no bare string on native */}
    </Tap>
  );
}

// A dim body note: an empty state, "save not confirmed" (BOOK-UI-COMPONENTS.md, Note).
export function Note({ children }: { children: string }) {
  return <Text style={note(usePalette())}>{children}</Text>;
}

// One Text per line: narration in ink, a system line dim italic, a refused line after its tag. The
// tag is its own Text beside the sentence in a row, since native draws no border on nested Text.
// The lines are one block of the page, `space.sm` apart; no lines, no block.
export function LogLines({ lines }: { lines: readonly DetailLine[] }) {
  const c = usePalette();
  if (!lines.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      {lines.map((line, i) =>
        typeof line === 'string' ? (
          <Text key={i} style={{ ...type.log, color: c.fg }}>
            {line}
          </Text>
        ) : 'event' in line ? (
          <Text key={i} style={{ ...type.log, color: c.dim, ...type.italic }}>
            {line.text}
          </Text>
        ) : (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'baseline', columnGap: space.xs }}
          >
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
            </Text>
            <Text style={{ ...type.log, color: c.fg, flex: 1 }}>{line.text}</Text>
          </View>
        ),
      )}
    </View>
  );
}
