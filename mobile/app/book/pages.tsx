import { ItemDetails } from './skills.tsx';
// The book's room and thing pages and their shared controls (the Contents sections: sections.tsx).
// Each is only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, plain, type group, type Pool, type Thing } from './model.ts';
import type { Button, DetailLine } from './presenter.ts';
import { note, prose, usePalette, type Palette } from './palette.ts';
import { opacity, size, space, type } from './tokens.ts';
import { ActionCard, Cards, VerbLine } from './actions.tsx';
import { EntityLine, LogLines } from './lines.tsx';
import { reason } from './words.ts';

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;
export type { Thing } from './model.ts';

// Tones are projected by the kernel from the cartridge's band table.
export const band = (c: Palette, tone: Pool['tone']): string =>
  ({ normal: c.fg, warning: c.warning, danger: c.danger })[tone];

const titleStyle = (c: Palette) => ({ color: c.fg, paddingBottom: space.md });
export const pageTitleStyle = (c: Palette) => ({ ...titleStyle(c), ...type.pageTitle });
export const sectionTitleStyle = (c: Palette) => ({ ...titleStyle(c), ...type.sectionTitle });
// A page's title takes focus as its page arrives (BOOK-UI-COMPONENTS.md#page-turn): keyboard focus
// on web (tabIndex -1: focusable, not a tab stop), the screen reader's on a device.
export const titleFocus = {
  ref: (title: (Text & { focus?: () => void }) | null) => {
    if (!title) return;
    title.focus?.();
    AccessibilityInfo.sendAccessibilityEvent?.(title, 'focus');
  },
  ...({ tabIndex: -1 } as object),
};

export function Tap(p: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={{ minHeight: size.touch, justifyContent: 'center' }}
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
  label: string;
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
  g: Grouped;
  press: (b: Button) => void;
  open: (id: string) => void;
  openChoice: () => void;
  details: ReactNode;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <RoomTitle {...p} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.page }}>
        <Text style={prose(c)}>{plain(p.text(p.view.place.description.key))}</Text>
        {warnings(c, p.view, p.text)}
        <Here view={p.view} text={p.text} open={p.open} />
        {p.view.choice && !p.view.entities.some((e) => e.id === p.view.choice!.speaker_id) && (
          <Control label="Continue conversation" onPress={p.openChoice} />
        )}
        {p.details}
        {placeActions(p.view, p.g, p.press)}
        {p.log.length > 0 && (
          <View style={{ marginTop: space.lg }}>
            <LogLines lines={p.log} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// The room's title; a tap looks.
function RoomTitle(p: { view: GameView; text: Say; g: Grouped; press: (b: Button) => void }) {
  const title = (
    <Text
      {...titleFocus}
      style={{ ...titleStyle(usePalette()), ...type.roomTitle, textAlign: 'center' }}
    >
      {p.text(p.view.place.title.key)}
    </Text>
  );
  return (
    <View style={{ paddingHorizontal: space.page, paddingTop: space.page }}>
      {p.g.look ? (
        <Tap label={`${p.text(p.view.place.title.key)}, look`} onPress={() => p.press(p.g.look!)}>
          {title}
        </Tap>
      ) : (
        title
      )}
    </View>
  );
}

const warnings = (c: Palette, view: GameView, text: Say) =>
  view.exits
    .filter((e) => e.warning)
    .map((e) => (
      <Text key={e.direction} style={note(c)}>
        {text(e.warning!)}
      </Text>
    ));

// The place's own actions; a notice's actions stay on its notice page.
const placeActions = (view: GameView, g: Grouped, press: (b: Button) => void) =>
  g.place
    .filter(
      (b) =>
        ![
          ...(view.notices ?? []),
          ...(view.notice_boards ?? []).flatMap((board) => board.notices),
        ].some((n) => b.target_ids.includes(n.id)),
    )
    .map((b) => <VerbLine key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={press} />);

// NPCs, then every other entity as the room's items; no headings, an empty group omitted
// (book-ui.md, World and status entry).
function Here(p: { view: GameView; text: Say; open: (id: string) => void }) {
  const npcs = p.view.entities.filter((e) => e.kind === 'npc');
  const items = p.view.entities.filter((e) => e.kind !== 'npc');
  const line = (e: GameView['entities'][number]) => (
    <EntityLine
      key={e.id}
      name={cap(p.text(e.name))}
      rest=" is here."
      note={e.carrying && p.text(e.carrying)}
      onPress={() => p.open(e.id)}
    />
  );
  return [npcs, items]
    .filter((group) => group.length > 0)
    .map((group, i) => (
      <View
        key={group[0].kind === 'npc' ? 'npcs' : 'items'}
        style={i ? { marginTop: space.block } : undefined}
      >
        {group.map(line)}
      </View>
    ));
}

export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const c = usePalette();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.page, gap: space.md }}
    >
      <Text {...(title ? titleFocus : {})} style={pageTitleStyle(c)} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

const tooHeavy = (c: Palette, thing: Thing | undefined, text: Say) =>
  thing?.actions
    .filter((a) => !a.available && a.reason.code === 'too_heavy')
    .map((a) => (
      <Text key={a.action_key} style={note(c)}>
        {text(a.label)}: {reason('too_heavy')}.
      </Text>
    ));

export function ThingPage(p: {
  thing?: Thing;
  text: Say;
  actions: Button[];
  log: DetailLine[];
  press: (b: Button) => void;
  contents: Thing[];
  open: (id: string) => void;
  leave: () => void;
  back?: () => void;
}) {
  const c = usePalette();
  return (
    <Sheet title={p.thing ? cap(p.text(p.thing.name)) : 'Item'}>
      <ItemDetails thing={p.thing} text={p.text} />
      <LogLines lines={p.log} />
      {tooHeavy(c, p.thing, p.text)}
      {!p.actions.length && !p.contents.length && <Text style={note(c)}>Nothing to do here.</Text>}
      <Cards>
        {p.actions.map((b) => (
          <ActionCard key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
        ))}
      </Cards>
      {p.back && <Control label="Back to container" onPress={p.back} />}
      <Control label="Leave" onPress={p.leave} />
      {p.contents.length > 0 && <Text style={sectionTitleStyle(c)}>Inside</Text>}
      {p.contents.map((e) => (
        <EntityLine key={e.id} name={cap(p.text(e.name))} onPress={() => p.open(e.id)} />
      ))}
    </Sheet>
  );
}
