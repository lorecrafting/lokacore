export { prose, note } from './paper.ts';
import { ItemDetails } from './skills.tsx';
// The book's room and thing pages and their shared controls (the Contents sections: sections.tsx).
// Each is only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, plain, type group, type Pool, type Thing } from './model.ts';
import type { Button, DetailLine } from './presenter.ts';
import { head, paper, prose, note } from './paper.ts';
import { space } from './tokens.ts';
import { reason } from './words.ts';

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;
export type { Thing } from './model.ts';

// Tones are projected by the kernel from the cartridge's band table.
export const band = (tone: Pool['tone']): string =>
  ({ normal: paper.fg, warning: paper.mid, danger: paper.accent })[tone];

export const titleStyle = { fontFamily: head, fontSize: 26, color: paper.fg, paddingBottom: 10 };
export const scrollPaper = { backgroundColor: paper.bg };
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
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {p.children}
    </Pressable>
  );
}

export function Act({ b, press }: { b: Button; press: (b: Button) => void }) {
  return (
    <Tap label={b.label} onPress={() => press(b)}>
      <Text style={{ ...prose, color: paper.accent }}>{b.label}</Text>
    </Tap>
  );
}

export function Leave(p: { leave: () => void }) {
  return (
    <Tap label="Leave" onPress={p.leave}>
      <Text style={{ ...prose, color: paper.accent }}>Leave</Text>
    </Tap>
  );
}

// The place: its title (a tap looks), description, who and what is here, its own actions (an
// offered quest among them) and the log. NPCs open full details, as items do.
export function RoomPage(p: {
  view: GameView;
  text: Say;
  log: string[];
  g: Grouped;
  press: (b: Button) => void;
  open: (id: string) => void;
  openChoice: () => void;
  details: ReactNode;
}) {
  const title = (
    <Text {...titleFocus} style={{ ...titleStyle, textAlign: 'center' }}>
      {p.text(p.view.place.title.key)}
    </Text>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        {p.g.look ? (
          <Tap label={`Look, ${p.text(p.view.place.title.key)}`} onPress={() => p.press(p.g.look!)}>
            {title}
          </Tap>
        ) : (
          title
        )}
      </View>
      <ScrollView style={[{ flex: 1 }, scrollPaper]} contentContainerStyle={{ padding: 24 }}>
        <Text style={prose}>{plain(p.text(p.view.place.description.key))}</Text>
        {warnings(p.view, p.text)}
        <Here view={p.view} text={p.text} open={p.open} />
        {p.view.choice && !p.view.entities.some((e) => e.id === p.view.choice!.speaker_id) && (
          <Tap label="Continue conversation" onPress={p.openChoice}>
            <Text style={{ ...prose, color: paper.accent }}>Continue conversation</Text>
          </Tap>
        )}
        {p.details}
        {placeActions(p.view, p.g, p.press)}
        {p.log.length > 0 && <Text style={{ ...prose, marginTop: 12 }}>{p.log.join('\n')}</Text>}
      </ScrollView>
    </View>
  );
}

const warnings = (view: GameView, text: Say) =>
  view.exits
    .filter((e) => e.warning)
    .map((e) => (
      <Text key={e.direction} style={note}>
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
    .map((b) => <Act key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={press} />);

// NPCs, then every other entity as the room's items; no headings, an empty group omitted
// (book-ui.md, World and status entry).
function Here(p: { view: GameView; text: Say; open: (id: string) => void }) {
  const npcs = p.view.entities.filter((e) => e.kind === 'npc');
  const items = p.view.entities.filter((e) => e.kind !== 'npc');
  const line = (e: GameView['entities'][number]) => {
    const name = p.text(e.name);
    return (
      <Tap
        key={e.id}
        label={`${name}${e.carrying ? `, ${p.text(e.carrying)}` : ''}, open`}
        onPress={() => p.open(e.id)}
      >
        <Text style={prose}>
          <Text style={{ fontWeight: '500', textDecorationLine: 'underline' }}>{cap(name)}</Text> is
          here.
        </Text>
        {e.carrying && <Text style={note}>{p.text(e.carrying)}</Text>}
      </Tap>
    );
  };
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
  return (
    <ScrollView style={scrollPaper} contentContainerStyle={{ padding: 24, gap: 8 }}>
      <Text
        {...(title ? titleFocus : {})}
        style={{ ...titleStyle, fontSize: 32 }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

// A page's log: plain lines, then event lines in italics.
export const logLines = (log: DetailLine[]) =>
  log.map((line, i) => (
    <Text key={i} style={typeof line === 'string' ? prose : { ...note, fontStyle: 'italic' }}>
      {typeof line === 'string' ? line : line.text}
    </Text>
  ));

const tooHeavy = (thing: Thing | undefined, text: Say) =>
  thing?.actions
    .filter((a) => !a.available && a.reason.code === 'too_heavy')
    .map((a) => (
      <Text key={a.action_key} style={note}>
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
  return (
    <Sheet title={p.thing ? cap(p.text(p.thing.name)) : 'Item'}>
      <ItemDetails thing={p.thing} text={p.text} />
      {logLines(p.log)}
      {tooHeavy(p.thing, p.text)}
      {!p.actions.length && !p.contents.length && <Text style={note}>Nothing to do here.</Text>}
      {p.actions.map((b) => (
        <Act key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
      ))}
      {p.back && (
        <Tap label="Back to container" onPress={p.back}>
          <Text style={prose}>Back to container</Text>
        </Tap>
      )}
      <Leave leave={p.leave} />
      {p.contents.length > 0 && <Text style={titleStyle}>Inside</Text>}
      {p.contents.map((e) => (
        <Tap key={e.id} label={`${p.text(e.name)}, open`} onPress={() => p.open(e.id)}>
          <Text style={{ ...prose, color: paper.accent }}>{cap(p.text(e.name))}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}
