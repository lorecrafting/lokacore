// The thing and Contents views use the existing book controls (the NPC page: Npc.tsx).
import { Text, View } from 'react-native';
import { cap, things, type group, type Page as Route } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { ActionCard, Cards } from './actions.tsx';
import { EntityLine, LogLines } from './lines.tsx';
import { Control, Page, SectionTitle, type Thing } from './pages.tsx';
import { ItemDetails } from './skills.tsx';
import { reason } from './words.ts';
import { note, usePalette, type Palette } from './palette.ts';
type Say = (key: string) => string;

export type Section = 'character' | 'carrying' | 'map' | 'journal' | 'settings';
const SECTIONS: [Section, string][] = [
  ['character', 'Character'],
  ['carrying', 'Equipment & Inventory'],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['settings', 'Settings'],
];
export function ContentsPage(p: { open: (section: Section) => void; world: () => void }) {
  return (
    <Page title="Contents" foot={<Control label="Back to World" onPress={p.world} />}>
      <View>
        {SECTIONS.map(([kind, label]) => (
          <EntityLine key={kind} name={label} onPress={() => p.open(kind)} />
        ))}
      </View>
    </Page>
  );
}

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

// The too-heavy notes are one block (BOOK-UI-COMPONENTS.md, Page: a run of rows of one kind).
const tooHeavy = (c: Palette, thing: Thing | undefined, text: Say) => {
  const heavy = thing?.actions.filter((a) => !a.available && a.reason.code === 'too_heavy') ?? [];
  return (
    heavy.length > 0 && (
      <View>
        {heavy.map((a) => (
          <Text key={a.action_key} style={note(c)}>
            {text(a.label)}: {reason('too_heavy')}.
          </Text>
        ))}
      </View>
    )
  );
};

// A container's Inside heading, then its rows as one block.
const inside = (p: { contents: Thing[]; text: Say; open: (id: string) => void }) =>
  p.contents.length > 0 && (
    <>
      <SectionTitle>Inside</SectionTitle>
      <View>
        {p.contents.map((e) => (
          <EntityLine key={e.id} name={cap(p.text(e.name))} onPress={() => p.open(e.id)} />
        ))}
      </View>
    </>
  );

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
    <Page
      title={p.thing ? cap(p.text(p.thing.name)) : 'Item'}
      foot={
        <>
          {p.back && <Control label="Back to container" onPress={p.back} />}
          <Control label="Leave" onPress={p.leave} />
        </>
      }
    >
      <ItemDetails thing={p.thing} text={p.text} />
      <LogLines lines={p.log} />
      {tooHeavy(c, p.thing, p.text)}
      {!p.actions.length && !p.contents.length && <Text style={note(c)}>Nothing to do here.</Text>}
      <Cards>
        {p.actions.map((b) => (
          <ActionCard key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
        ))}
      </Cards>
      {inside(p)}
    </Page>
  );
}

export function Item(p: {
  id: string;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  open: (p: Route) => void;
  world: () => void;
  back?: () => void;
}) {
  const items = things(p.screen.view);
  const thing = items.find((e) => e.id === p.id);
  return (
    <ThingPage
      thing={thing}
      text={p.screen.text}
      actions={p.g.on(p.id)}
      log={p.screen.detail(p.id)}
      press={(b) => p.press(b, p.id)}
      contents={items.filter((e) => 'container_id' in e && e.container_id === p.id)}
      open={(id) => p.open({ kind: 'thing', id })}
      leave={p.world}
      back={thing && 'container_id' in thing ? p.back : undefined}
    />
  );
}
