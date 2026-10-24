// The offered-action controls: action card, pick lists, verb line, continue button (BOOK-UI-COMPONENTS.md).
import { Children, type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { Tap } from './pages.tsx';
import { note, prose, usePalette, useType } from './palette.ts';
import { onKey } from './lines.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { picks, type Pick } from './pick.ts';
import type { Button } from './presenter.ts';
import { radius, size, space, type } from './tokens.ts';

/**
 * An offered action as a card.
 * - Use: a detail page's offered action or dialogue choice, the World page's drawn storylet, the
 *   Raise cards, a Pick list's option and rows; never an accent text link.
 * - Rules: no outer margin; cards stack in Cards. Without a Button it is the unavailable form: a
 *   Note reading `label: reason` (a service's price and benefit stay inside the label's
 *   parentheses), or the label alone with no reason (book-ui.md, Notice board details). Never a
 *   disabled card. With `onPress` and `expanded` it sends nothing: a Pick list's option. A row may
 *   show its own label, accessible name and quiet note in place of the Button's label.
 * - States: available; unavailable.
 * - Story: ActionCard.stories.tsx
 */
export function ActionCard(
  p: (
    | { b: Button; press: (b: Button) => void; label?: string; name?: string; note?: string }
    | { label: string; onPress: () => void; expanded: boolean }
    | { label: string; reason?: string }
  ) & { ref?: Ref<View> },
) {
  const c = usePalette();
  const t = useType();
  if (!('b' in p) && !('onPress' in p))
    return <Text style={note(c, t)}>{p.reason ? `${p.label}: ${p.reason}` : p.label}</Text>;
  const label = p.label ?? ('b' in p ? p.b.label : '');
  return (
    <Pressable
      ref={p.ref}
      accessibilityRole="button"
      accessibilityLabel={('b' in p && p.name) || label}
      accessibilityState={'expanded' in p ? { expanded: p.expanded } : undefined}
      onPress={'b' in p ? () => p.press(p.b) : p.onPress}
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
      <Text style={prose(c, t)}>{label}</Text>
      {'b' in p && p.note && <Text style={note(c, t)}>{p.note}</Text>}
    </Pressable>
  );
}

// An open list's rows, inset as the option's children; Escape anywhere in it closes it.
const rows = (k: Pick, first: Ref<View>, press: (b: Button) => void, close: () => void) => (
  <View style={{ paddingLeft: space.lg }} {...onKey((key) => key === 'Escape' && close())}>
    <Cards>
      {k.rows.map((r, i) => (
        <ActionCard
          key={i}
          ref={r === k.rows.find((o) => 'b' in o) ? first : undefined}
          {...('b' in r ? { ...r, press } : r)}
        />
      ))}
    </Cards>
  </View>
);

/**
 * A page's Pick lists: per option, an Action card that opens its rows in the page's flow
 * (book-ui.md, Pick a second thing; BOOK-UI-COMPONENTS.md, Pick list).
 * - Use: a thing's or a person's page, after its offered actions; rows from pick.ts only.
 * - Rules: one list open at a time, closed on another page; opening focuses the first row, and
 *   the option or Escape closes it with focus back on the option. A row press sends its pair and
 *   closes the list, unless an action is pending (nothing sends then, and the list stays).
 *   Rows are inset space.lg; an unavailable row is the unavailable form.
 * - States: closed; open; open with an unavailable row; recipes mixed; pending.
 * - Story: PickList.stories.tsx
 */
export function PickLists(p: {
  page: string;
  view: GameView;
  buttons: Button[];
  text: (key: string) => string;
  press: (b: Button) => void;
  pending?: boolean;
}) {
  const [shown, setShown] = useState<{ page: string; label: string }>();
  const open = shown?.page === p.page ? shown.label : undefined;
  const option = useRef<View>(null);
  const first = useRef<View>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  const close = () => {
    setShown(undefined);
    option.current?.focus();
  };
  const press = (b: Button) => {
    p.press(b);
    if (!p.pending) close();
  };
  return picks(p.view, p.buttons, p.page, p.text).map((k) => (
    <View key={k.label} style={{ gap: space.sm }}>
      <ActionCard
        ref={k.label === open ? option : undefined}
        label={k.label}
        expanded={k.label === open}
        onPress={() => (k.label === open ? close() : setShown({ page: p.page, label: k.label }))}
      />
      {k.label === open && rows(k, first, press, close)}
    </View>
  ));
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
      onPress={() => p.onPress()} // no press event: the handler takes none
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
