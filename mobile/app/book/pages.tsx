// The book's page shell, the room page and their shared controls (the Contents sections:
// sections.tsx; the thing page: Menu.tsx; the title's arriving focus: title.ts).
// Each is only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { notVerb, plain, why, type group, type Pool } from './model.ts';
import type { Button, DetailLine } from './presenter.ts';
import { note, prose, usePalette, type Palette } from './palette.ts';
import { opacity, size, space, type } from './tokens.ts';
import { ActionCard, VerbLine } from './actions.tsx';
import { Asides, AwayRecap, Here, LogLines } from './lines.tsx';
import type { RecapLine } from './recap.ts';
import { useTitleFocus } from './title.ts';
import { LABEL } from './labels.ts';
export { useTitleFocus };

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;
export type { Thing } from './model.ts';

// Tones are projected by the kernel from the cartridge's band table.
export const band = (c: Palette, tone: Pool['tone']): string =>
  ({ normal: c.fg, warning: c.warning, danger: c.danger })[tone];

export function Tap(p: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  shrink?: boolean; // may give up width in a row (the status position truncates)
}) {
  const bleed = { paddingVertical: space.md, marginVertical: -space.md }; // hit area, no shown space
  const shrink = p.shrink ? { flexShrink: 1, minWidth: 0 } : {};
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={{ minHeight: size.touch, justifyContent: 'center', ...bleed, ...shrink }}
    >
      {p.children}
    </Pressable>
  );
}

// The running head: the current quest's projected journal text (BOOK-UI-COMPONENTS.md, Page).
// ponytail: the first unfinished quest in journal order; several at once await a GameView answer.
export function RunningHead({ view, text }: { view: GameView; text: Say }) {
  const c = usePalette();
  const quest = view.journal.find(
    (q) => (q.state === 'active' || q.state === 'objectives_complete') && q.journal,
  );
  if (!quest) return null;
  return (
    <Text
      style={{
        ...type.runningHead,
        color: c.dim,
        paddingHorizontal: space.page,
        paddingTop: space.page,
      }}
    >
      {plain(text(quest.journal!))}
    </Text>
  );
}

// Local navigation that is not an offered action (BOOK-UI-COMPONENTS.md, Control).
// `onInk`: the label in `bg`, for a Control on an `fg` fill (the tip's Got it).
export function Control(p: {
  label: (typeof LABEL)[keyof typeof LABEL];
  onPress: () => void;
  disabled?: boolean;
  onInk?: true;
}) {
  const { label, onPress, disabled, onInk } = p;
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled} // also sets accessibilityState.disabled (aria-disabled on web)
      onPress={onPress}
      style={{
        minHeight: size.touch,
        minWidth: size.touch,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: space.md,
        opacity: disabled ? opacity.disabled : 1,
      }}
    >
      <Text style={{ ...type.control, color: disabled ? c.dim : onInk ? c.bg : c.fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

// The place: its title (a tap looks), description, who and what is here, its own actions (an
// offered quest among them) and the log. NPCs open full details, as items do.
export function RoomPage(p: {
  view: GameView;
  text: Say;
  log: DetailLine[];
  recap?: RecapLine[];
  g: Grouped;
  press: (b: Button) => void;
  open: (id: string) => void;
  openChoice: () => void;
  details: ReactNode;
  word?: ReactNode; // the Word block, last: after the room's actions and the log (pass-1 UA)
}) {
  const c = usePalette();
  const look = p.g.look;
  const actions = placeActions(p.view, p.g, p.press, p.text); // one list, as the room's lines
  return (
    <Page
      title={p.text(p.view.place.title.key)}
      fixedTitle
      onTitlePress={look && (() => p.press(look))}
    >
      {p.recap && <AwayRecap lines={p.recap} />}
      {paragraphs(c, p.text(p.view.place.description.key))}
      <Asides keys={p.view.place.asides} text={p.text} />
      {warnings(c, p.view, p.text)}
      <Here view={p.view} text={p.text} open={p.open} />
      {p.view.choice && !p.view.entities.some((e) => e.id === p.view.choice!.speaker_id) && (
        <Control label={LABEL.continueConversation} onPress={p.openChoice} />
      )}
      {p.details}
      {storylet(p.view, p.g, p.press, p.text)}
      {actions.length > 0 && <View>{actions}</View>}
      {p.log.length > 0 && <LogLines lines={p.log} />}
      {p.word}
    </Page>
  );
}

// The room prose as one block; a blank line in the authored text is a paragraph break.
const paragraphs = (c: Palette, description: string) => (
  <View style={{ gap: space.lg }}>
    {plain(description)
      .trim()
      .split(/\s*\n\s*\n\s*/)
      .map((paragraph, i) => (
        <Text key={i} style={prose(c)}>
          {paragraph}
        </Text>
      ))}
  </View>
);

// The exit warnings are one block of notes.
const warnings = (c: Palette, view: GameView, text: Say) => {
  const shown = view.exits.filter((e) => e.warning);
  return (
    shown.length > 0 && (
      <View>
        {shown.map((e) => (
          <Text key={e.direction} style={note(c)}>
            {text(e.warning!)}
          </Text>
        ))}
      </View>
    )
  );
};

// The deck's pick here this hour (book-ui.md, Storylet card details): its card, or the
// unavailable note with the action's reason.
const storylet = (view: GameView, g: Grouped, press: (b: Button) => void, text: Say) => {
  if (!view.storylet) return null;
  const b = g.place.find((x) => x.action_key === view.storylet);
  if (b) return <ActionCard b={b} press={press} />;
  const offer = view.actions.find((a) => a.action_key === view.storylet);
  return (
    offer && !offer.available && <ActionCard label={text(offer.label)} reason={why(offer, text)} />
  );
};

// The place's own actions, then those it lists unavailable as `label: reason` notes, never dropped
// (pass-1 R2); a notice's actions stay on its notice page; the storylet has its card.
const placeActions = (view: GameView, g: Grouped, press: (b: Button) => void, text: Say) => {
  const notices = [
    ...(view.notices ?? []),
    ...(view.notice_boards ?? []).flatMap((board) => board.notices),
  ];
  const verb = (a: { action_key: string; target_ids?: readonly string[] }) =>
    a.action_key !== view.storylet && !notices.some((n) => a.target_ids?.includes(n.id));
  return [
    ...g.place
      .filter(verb)
      .map((b) => <VerbLine key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={press} />),
    ...view.actions
      .filter(
        (a) =>
          !a.available &&
          !a.input.length &&
          (a.target.kind === 'none' || a.target_ids?.length) && // as buttons.ts placeButtons
          !notVerb(a.action_key) &&
          verb(a),
      )
      .map((a) => (
        <ActionCard
          key={`${a.label}:${a.target_ids?.join(',')}`}
          label={text(a.label)}
          reason={why(a, text)}
        />
      )),
  ];
};

// One shell for every page (BOOK-UI-COMPONENTS.md, Page): the title (fixed: the room's, outside
// the scroll), the blocks, and the page foot.
export function Page(p: {
  title?: string;
  fixedTitle?: boolean;
  onTitlePress?: () => void;
  scrollToEnd?: boolean;
  centred?: boolean; // centres the blocks vertically: the save error, the chapter card
  foot?: ReactNode;
  children: ReactNode;
}) {
  const c = usePalette();
  let scroll: ScrollView | null = null; // this render's view: a ref callback, so no hook
  const title = p.title !== undefined && (
    <Title title={p.title} fixed={p.fixedTitle} onPress={p.onTitlePress} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {p.fixedTitle && (
        <View style={{ paddingHorizontal: space.page, paddingTop: space.xl }}>{title}</View>
      )}
      <ScrollView
        ref={(view) => {
          scroll = view;
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: space.page,
          ...(p.fixedTitle && { paddingTop: space.xs }), // the title's own space.md below it, then this: 12 to the description
          gap: space.block,
          ...(p.centred && { flexGrow: 1, justifyContent: 'center' }),
        }}
        onContentSizeChange={() => p.scrollToEnd && scroll?.scrollToEnd({ animated: false })}
      >
        {!p.fixedTitle && title}
        {p.children}
      </ScrollView>
      {p.foot && <PageFoot>{p.foot}</PageFoot>}
    </View>
  );
}

// A header that takes the arriving focus; the room's is fixed, and a tap on it looks.
function Title(p: { title: string; fixed?: boolean; onPress?: () => void }) {
  const heading = (
    <Text
      {...useTitleFocus()}
      accessibilityRole="header"
      style={{
        color: usePalette().fg,
        // a scrolling title is a block: the page's gap alone is its space below
        ...(p.fixed
          ? { ...type.roomTitle, textAlign: 'center', paddingBottom: space.md }
          : type.pageTitle),
      }}
    >
      {p.title}
    </Text>
  );
  return p.onPress ? (
    <Tap label={`${p.title}, look`} onPress={p.onPress}>
      {heading}
    </Tap>
  ) : (
    heading
  );
}

// The page's local returns, nearest first (BOOK-UI-COMPONENTS.md, PageFoot).
export function PageFoot({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        columnGap: space.lg,
        paddingTop: space.md,
        paddingHorizontal: space.xl,
        paddingBottom: space.xl,
        borderTopWidth: size.rule,
        borderTopColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

// A heading inside a page (Inside, Held, Worn, Where).
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ color: usePalette().fg, ...type.sectionTitle }}>
      {children}
    </Text>
  );
}
