// The offered-action controls: action card, pick lists, verb line, continue button (BOOK-UI-COMPONENTS.md).
import { Children, type ReactNode, type Ref, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { card, linked, Unavailable, type Wait } from './Unavailable.tsx';
import { InkText, LiftPressable } from './fade.ts';
import { haptic } from './haptic';
import { Tap } from './pages.tsx';
import { useInk, useLift, usePress } from './press.ts';
import { note, prose, usePalette, useType } from './palette.ts';
import { onKey } from './lines.tsx';
import { hides, reasonSentence } from './reasons.ts';
import { ASKED } from './words.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { picks, type Pick } from './pick.ts';
import { focusTitle, titleContext } from './title.ts';
import type { Button } from './presenter.ts';
import { radius, size, space, type } from './tokens.ts';

type CardProps = (
  | {
      b: Button;
      press: (b: Button) => void;
      label?: string;
      name?: string;
      note?: string;
      link?: string;
      asked?: boolean;
    }
  | { label: string; onPress: () => void; expanded?: boolean }
  | { label: string; reason?: string; name?: string; link?: string; wait?: Wait }
) & { ref?: Ref<View> };
/**
 * An offered action as a card.
 * - Use: a detail page's offered action or dialogue choice, the Raise cards, a Pick list's option and rows; never an accent text link.
 * - Rules: no outer margin; cards stack in Cards. Without a Button it is the unavailable form
 *   (book-ui.md, Unavailable actions): the same card reading its plain label, never `label: reason`;
 *   a press sends nothing and grays it, its reason as one sentence beneath (`reasonSentence`, reasons.ts), read
 *   once; a Button with `refused` (a sanctuary's Attack) is this form, but its press sends, so the log says it;
 *   a permanent refusal (`hides`, reasons.ts) draws nothing. It is exposed as disabled yet
 *   stays focusable and pressable, its sentence its hint. With
 *   `onPress` it sends nothing: a Pick list's option (with `expanded`) or a card that opens a child
 *   page (the NPC page's Trade and Look, an item's Look inside). A row may show its own label, accessible name and quiet note in
 *   place of the Button's label. With `link` it is a shop line, not a card (book-ui.md, Shop
 *   lines): a Tap reading its label as prose, the `link` words in the room link style
 *   (`type.named`), named by `name` (its shown text, then the action and spoken price); unavailable, the same press and
 *   sentence with no card. Shop lines stack in `Cards lines`. Stories: NpcPage (Shelf, Sale, Services).
 * - States: available; asked (a dialogue choice already taken: dim italic words, named with ASKED, still pressable); unavailable; unavailable, pressed; each as a card or a line.
 * - Effects: a card lifts with a selection haptic; an unavailable press does not lift, its reason
 *   dries and it gives a warning haptic. With `wait` (the rise card, book-ui.md, Spirit state) it has
 *   no reason: a countdown ring leads its label, its value the whole seconds left.
 * - Story: ActionCard.stories.tsx
 */
export function ActionCard(p: CardProps) {
  const c = usePalette();
  const t = useType();
  if (!('b' in p) && !('onPress' in p)) return hides(p.reason) ? null : <Unavailable {...p} />;
  if ('b' in p && p.b.refused)
    return <Unavailable label={p.b.label} reason={p.b.refused} send={() => p.press(p.b)} />;
  const label = p.label ?? ('b' in p ? p.b.label : '');
  if ('b' in p && p.link)
    return (
      <Tap label={p.name || label} onPress={() => p.press(p.b)}>
        <Text style={prose(c, t)}>{linked(label, p.link)}</Text>
      </Tap>
    );
  return <Available {...p} label={label} />;
}

function Available(
  p: Extract<CardProps, { b: Button } | { onPress: () => void }> & { label: string },
) {
  const c = usePalette();
  const t = useType();
  const label = p.label;
  const press = usePress('selection');
  const lift = useLift(press, c.card);
  return (
    <LiftPressable
      ref={p.ref}
      {...press.handlers}
      accessibilityRole="button"
      accessibilityLabel={('b' in p && (p.name || (p.asked && `${label}${ASKED}`))) || label}
      aria-expanded={'onPress' in p ? p.expanded : undefined} // RN web maps aria-expanded, not accessibilityState
      onPress={press.commit('b' in p ? () => p.press(p.b) : p.onPress)}
      style={[card(c), lift]}
    >
      <Text style={'b' in p && p.asked ? { ...note(c, t), ...type.italic } : prose(c, t)}>
        {/* One text node with a line break, so axe reads "label note" as the name's start. */}
        {'b' in p && p.note
          ? [label, <Text key="note" style={note(c, t)}>{`\n${p.note}`}</Text>]
          : label}
      </Text>
    </LiftPressable>
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
 * - Refs: one per card for its whole life; an animated component keeps the first it is given.
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
  /** shared open state, for lists on one screen under several pages (Combat's foes) */
  state?: Shown;
}) {
  const own = useState<{ page: string; label: string }>();
  const [shown, setShown] = p.state ?? own;
  const open = shown?.page === p.page ? shown.label : undefined;
  const options = useRef<Record<string, View | null>>({});
  const all = p.lists ?? picks(p.view, p.buttons ?? [], p.page, p.text);
  const { first, sent } = useFocus(open, p.view, all);
  const close = () => {
    setShown(undefined);
    if (open) options.current[open]?.focus();
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
        ref={(v) => void (options.current[k.label] = v)}
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
 * - Rules: an ink press (`bg` to `dim`, `action` being unreadable on the ink fill) and a selection haptic.
 * - Story: ContinueButton.stories.tsx
 */
export function ContinueButton(p: { label: string; onPress: () => void }) {
  const c = usePalette();
  const t = useType();
  const press = usePress('selection');
  const ink = useInk(press, c.bg, c.dim);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={press.commit(p.onPress)}
      {...press.handlers}
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
      <InkText style={[t.control, { textAlign: 'center' }, ink]}>{p.label}</InkText>
    </Pressable>
  );
}
