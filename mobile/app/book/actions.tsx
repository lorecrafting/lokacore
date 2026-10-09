// The offered-action controls: action card, verb line, continue button (BOOK-UI-COMPONENTS.md).
import { Pressable, Text } from 'react-native';
import { Tap } from './pages.tsx';
import { prose, usePalette } from './palette.ts';
import type { Button } from './presenter.ts';
import { radius, size, space, type } from './tokens.ts';

// A detail page's offered action or dialogue choice (BOOK-UI-COMPONENTS.md, Action card).
export function ActionCard({ b, press }: { b: Button; press: (b: Button) => void }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={b.label}
      onPress={() => press(b)}
      style={{
        backgroundColor: c.card,
        borderColor: c.line,
        borderWidth: size.rule,
        borderRadius: radius.card,
        minHeight: size.card,
        justifyContent: 'center',
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        marginTop: space.sm,
      }}
    >
      <Text style={prose(c)}>{b.label}</Text>
    </Pressable>
  );
}

// A room's offered place action (BOOK-UI-COMPONENTS.md, Verb line).
export function VerbLine({ b, press }: { b: Button; press: (b: Button) => void }) {
  const c = usePalette();
  return (
    <Tap label={b.label} onPress={() => press(b)}>
      <Text style={{ ...prose(c), fontStyle: 'italic', color: c.action }}>{b.label}</Text>
    </Tap>
  );
}

// A scene or chapter continuation (BOOK-UI-COMPONENTS.md, Continue button).
export function ContinueButton(p: { label: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={{
        backgroundColor: c.fg,
        borderRadius: radius.card,
        minHeight: size.card,
        minWidth: size.touch,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ ...type.control, color: c.bg }}>{p.label}</Text>
    </Pressable>
  );
}
