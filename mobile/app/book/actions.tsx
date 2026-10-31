// The offered-action controls: action card, pick lists, verb line, continue button (BOOK-UI-COMPONENTS.md).
import { Children, type ReactNode, type Ref, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { refusedProps, Tap } from './pages.tsx';
import { note, prose, usePalette, useType } from './palette.ts';
import { onKey, unseen } from './lines.tsx';
import { reasonSentence } from './reasons.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { picks, type Pick } from './pick.ts';
import { focusTitle, titleContext } from './title.ts';
import type { Button } from './presenter.ts';
import { radius, size, space, type } from './tokens.ts';

/**
 * An offered action as a card.
 * - Use: a detail page's offered action or dialogue choice, the
 *   Raise cards, a Pick list's option and rows; never an accent text link.
 * - Rules: no outer margin; cards stack in Cards. Without a Button it is the unavailable form
 *   (book-ui.md, Unavailable actions): the same card reading its plain label, never `label: reason`;
 *   a press sends nothing and grays it, its reason as one sentence beneath (`reasonSentence`, reasons.ts), read
 *   once. It is exposed as disabled yet stays focusable and pressable, its sentence its hint. With
 *   `onPress` it sends nothing: a Pick list's option (with `expanded`) or a card that opens a child
 *   page (the NPC page's Trade). A row may show its own label, accessible name and quiet note in
 *   place of the Button's label. With `link` it is a shop line, not a card (book-ui.md, Shop
 *   lines): a Tap reading its label as prose, the `link` words in the room link style
 *   (`type.named`), named by `name` (its shown text, then the action and spoken price); unavailable, the same press and
 *   sentence with no card. Shop lines stack in `Cards lines`.
 * - States: available; unavailable; unavailable, pressed; each as a card or a line.
 * - Story: ActionCard.stories.tsx; the line form NpcPage.stories.tsx (Shelf, Sale, Services)
 */
type CardProps = (
  | {
      b: Button;
      press: (b: Button) => void;
      label?: string;
      name?: string;
      note?: string;
      link?: string;
    }
  | { label: string; onPress: () => void; expanded?: boolean }
  | { label: string; reason?: string; name?: string; link?: string }
) & { ref?: Ref<View> };
export function ActionCard(p: CardProps) {
  const c = usePalette();
  const t = useType();
  if (!('b' in p) && !('onPress' in p)) return <Unavailable {...p} />;
  const label = p.label ?? ('b' in p ? p.b.label : '');
  if ('b' in p && p.link)
    return (
      <Tap label={p.name || label} onPress={() => p.press(p.b)}>
        <Text style={prose(c, t)}>{linked(label, p.link)}</Text>
      </Tap>
    );
  return (
    <Pressable
      ref={p.ref}
      accessibilityRole="button"
      accessibilityLabel={('b' in p && p.name) || label}
      aria-expanded={'onPress' in p ? p.expanded : undefined} // RN web maps aria-expanded, not accessibilityState
      onPress={'b' in p ? () => p.press(p.b) : p.onPress}
      style={card(c)}
    >
      <Text style={prose(c, t)}>
        {/* One text node with a line break, so axe reads "label note" as the name's start. */}
        {'b' in p && p.note
          ? [label, <Text key="note" style={note(c, t)}>{`\n${p.note}`}</Text>]
          : label}
      </Text>
    </Pressable>
  );
}

const card = (c: ReturnType<typeof usePalette>, grayed = false) => ({
  backgroundColor: grayed ? c.bg : c.card,
  borderColor: c.line,
  borderWidth: size.rule,
  borderRadius: radius.card,
  minHeight: size.card,
  justifyContent: 'center' as const,
  paddingVertical: space.md,
  paddingHorizontal: space.lg,
});

// A shop line's words with its `link` words drawn as the room link (lines.tsx nameLink's style).
const linked = (label: string, link: string) => {
  const i = label.indexOf(link);
  return i < 0
    ? [label]
    : [
        label.slice(0, i),
        <Text key="link" style={type.named}>
          {link}
        </Text>,
        label.slice(i + link.length),
      ];
};

// The unavailable form: its own component, so its pressed state is the card's alone. The state
// keeps the label and reason it was pressed on, so a changed card starts unpressed. Its name is the
// shown text, then the rest of `name`, which starts with the label (label in name).
// ponytail: announceForAccessibility is a no-op on web, where the card's own polite region reads the
// sentence; where native maps aria-live too, it may be read twice (Footer.tsx, check on device).
function Unavailable(p: { label: string; reason?: string; name?: string; link?: string }) {
  const c = usePalette();
  const t = useType();
  const sentence = reasonSentence(p.reason);
  const [pressed, setPressed] = useState<string>();
  const shown = `${p.label}\n${sentence}`;
  const grayed = pressed === shown;
  const label = p.link ? linked(p.label, p.link) : p.label;
  const a11y = (grayed && sentence ? shown : p.label) + (p.name ?? p.label).slice(p.label.length);
  const press = () => {
    setPressed(shown);
    if (sentence) AccessibilityInfo.announceForAccessibility(sentence);
  };
  const body = (
    <Text style={grayed ? note(c, t) : prose(c, t)}>
      {grayed && sentence ? [label, `\n${sentence}`].flat() : label}
    </Text>
  );
  return (
    <View>
      {p.link ? (
        <Tap label={a11y} refused={sentence} onPress={press}>
          {body}
        </Tap>
      ) : (
        <Pressable
          accessibilityLabel={a11y}
          {...refusedProps(sentence)}
          onPress={press}
          style={card(c, grayed)}
        >
          {body}
        </Pressable>
      )}
      <View aria-live="polite" style={unseen}>
        {grayed && sentence ? <Text>{sentence}</Text> : null}
      </View>
    </View>
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

// Opening focuses the first row. `sent` is the option whose row was pressed: the next view keeps
// focus on it, or moves it to the page title when the option went (also a shop page's sold row).
export function useFocus(
  open: string | undefined,
  view: GameView,
  all: readonly { label: string }[],
) {
  const title = useContext(titleContext);
  const first = useRef<View>(null);
  const sent = useRef<string>(undefined);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  useEffect(() => {
    if (sent.current && !all.some((k) => k.label === sent.current)) focusTitle(title.last);
    sent.current = undefined;
  }, [view]);
  return { first, sent };
}

export type Shown = ReturnType<typeof useState<{ page: string; label: string }>>;

/**
 * A page's Pick lists: per option, an Action card that opens its rows in the page's flow
 * (book-ui.md, Pick a second thing; BOOK-UI-COMPONENTS.md, Pick list).
 * - Use: a thing's or a person's page among its offered actions, rows from pick.ts or prebuilt
 *   by the page (`lists`).
 * - Rules: one list open at a time, closed on another page; opening focuses the first row, and
 *   the option or Escape closes it with focus back on the option. A row press sends its pair and
 *   closes the list, unless an action is pending (nothing sends then, and the list stays); when
 *   the answer leaves the option no row, the option goes and focus moves to the page title.
 *   Rows are inset space.lg; an unavailable row is the unavailable form.
 * - States: closed; open; open with an unavailable row; scripted actions mixed; pending.
 * - Story: PickList.stories.tsx
 */
export function PickLists(p: {
  page: string;
  view: GameView;
  buttons?: Button[];
  /** prebuilt lists (the NPC page's), drawn in place of the buttons' pairs */
  lists?: Pick[];
  text: (key: string) => string;
  press: (b: Button) => void;
  pending?: boolean;
  /** shared open state, for lists on one screen under several pages (Combat's foe lines) */
  state?: Shown;
}) {
  const own = useState<{ page: string; label: string }>();
  const [shown, setShown] = p.state ?? own;
  const open = shown?.page === p.page ? shown.label : undefined;
  const option = useRef<View>(null);
  const all = p.lists ?? picks(p.view, p.buttons ?? [], p.page, p.text);
  const { first, sent } = useFocus(open, p.view, all);
  const close = () => {
    setShown(undefined);
    option.current?.focus();
  };
  const press = (b: Button) => {
    p.press(b);
    if (p.pending) return;
    sent.current = open;
    close();
  };
  return all.map((k) => (
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
 * - Rules: draws nothing when empty, so an empty list adds no block gap. With `lines`, a run of
 *   shop lines with no gap between them, like a room's entity lines.
 * - Story: ActionCard.stories.tsx
 */
export function Cards({ children, lines }: { children: ReactNode; lines?: boolean }) {
  return Children.toArray(children).length ? (
    <View style={lines ? undefined : { gap: space.sm }}>{children}</View>
  ) : null;
}

/**
 * A room's offered place action as an italic `action` line.
 * - Use: the room's list, after the entity lines.
 * - Rules: an unavailable one is the Action card's unavailable form (its plain label) after the
 *   available lines, never dropped.
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
