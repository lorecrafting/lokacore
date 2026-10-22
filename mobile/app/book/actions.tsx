// The offered-action controls: action card, verb line, continue button (BOOK-UI-COMPONENTS.md).
import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { Tap } from './pages.tsx';
import { note, prose, usePalette, useType } from './palette.ts';
import type { Button } from './presenter.ts';
import { radius, size, space, type } from './tokens.ts';

/**
 * An offered action as a card.
 * - Use: a detail page's offered action or dialogue choice, the World page's drawn storylet, the
 *   Raise cards; never an accent text link.
 * - Rules: no outer margin; cards stack in Cards. Without a Button it is the unavailable form: a
 *   Note reading `label: reason` (a service's price and benefit stay inside the label's
 *   parentheses), or the label alone with no reason (book-ui.md, Notice board details). Never a
 *   disabled card.
 * - States: available; unavailable.
 * - Story: ActionCard.stories.tsx
 */
export function ActionCard(
  p: { b: Button; press: (b: Button) => void } | { label: string; reason?: string },
) {
  const c = usePalette();
  const t = useType();
  if (!('b' in p))
    return <Text style={note(c, t)}>{p.reason ? `${p.label}: ${p.reason}` : p.label}</Text>;
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
      <Text style={prose(c, t)}>{b.label}</Text>
    </Pressable>
  );
}

/**
 * A stack of Action cards, one block of its page.
 * - Use: every stack of Action cards.
 * - Rules: draws nothing when empty, so an empty list adds no block gap.
 * - Story: ActionCard.stories.tsx
 */
export function Cards({ children }: { children: ReactNode }) {
  return Children.toArray(children).length ? (
    <View style={{ gap: space.sm }}>{children}</View>
  ) : null;
}

/**
 * A room's offered place action as an italic `action` line.
 * - Use: the room's list, after the entity lines.
 * - Rules: an unavailable one is the Action card's unavailable form (`Chop wood: too heavy to
 *   carry`) after the available lines, never dropped.
 * - States: available; unavailable.
 * - Story: VerbLine.stories.tsx
 */
export function VerbLine({ b, press }: { b: Button; press: (b: Button) => void }) {
  const c = usePalette();
  const t = useType();
  return (
    <Tap label={b.label} onPress={() => press(b)}>
      <Text style={{ ...prose(c, t), ...type.italic, color: c.action }}>{b.label}</Text>
    </Tap>
  );
}

/**
 * An ink-filled scene or chapter continuation.
 * - Use: a scene or chapter page's Continue.
 * - Story: ContinueButton.stories.tsx
 */
export function ContinueButton(p: { label: string; onPress: () => void }) {
  const c = usePalette();
  const t = useType();
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
      <Text style={{ ...t.control, color: c.bg, textAlign: 'center' }}>{p.label}</Text>
    </Pressable>
  );
}
