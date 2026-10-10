// The offered-action controls: action card, verb line, continue button (BOOK-UI-COMPONENTS.md).
import { Children, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Tap } from './pages.tsx';
import { note, prose, usePalette } from './palette.ts';
import type { Button } from './presenter.ts';
import { radius, size, space, type } from './tokens.ts';

// A detail page's offered action or dialogue choice (BOOK-UI-COMPONENTS.md, Action card). With no
// Button it is the unavailable form: a non-action note, the label then its real reason.
export function ActionCard(
  p: { b: Button; press: (b: Button) => void } | { label: string; reason?: string },
) {
  const c = usePalette();
  if (!('b' in p))
    return <Text style={note(c)}>{p.reason ? `${p.label}: ${p.reason}` : p.label}</Text>;
  const { b, press } = p;
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
      }}
    >
      <Text style={prose(c)}>{b.label}</Text>
    </Pressable>
  );
}

// A list of action cards: one block of its page, the cards `space.sm` apart (no card margin);
// nothing when the list is empty, so it adds no block gap.
export function Cards({ children }: { children: ReactNode }) {
  return Children.toArray(children).length ? (
    <View style={{ gap: space.sm }}>{children}</View>
  ) : null;
}

// A room's offered place action (BOOK-UI-COMPONENTS.md, Verb line).
export function VerbLine({ b, press }: { b: Button; press: (b: Button) => void }) {
  const c = usePalette();
  return (
    <Tap label={b.label} onPress={() => press(b)}>
      <Text style={{ ...prose(c), ...type.italic, color: c.action }}>{b.label}</Text>
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
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
      }}
    >
      <Text style={{ ...type.control, color: c.bg, textAlign: 'center' }}>{p.label}</Text>
    </Pressable>
  );
}
