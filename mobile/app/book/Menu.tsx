// The thing and Contents views use the existing book controls (the NPC page: Npc.tsx).
import { View } from 'react-native';
import { cap, things, type group, type Page as Route } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { ActionCard, Cards } from './actions.tsx';
import { EntityLine, LogLines, Note } from './lines.tsx';
import { Control, Page, SectionTitle, type Thing } from './pages.tsx';
import { ItemDetails } from './skills.tsx';
import { holding, NOTED } from './words.ts';
import { commandOf } from './buttons.ts';
import { LABEL } from './labels.ts';
type Say = (key: string) => string;

export type Section = 'character' | 'carrying' | 'map' | 'journal' | 'settings';
const SECTIONS: [Section, string][] = [
  ['character', 'Character'],
  ['carrying', LABEL.inventory],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['settings', 'Settings'],
];
/**
 * The Contents: one Entity line per section.
 *
 * Use: the status line's Contents button.
 *
 * Story: SectionPages.stories.tsx
 */
export function ContentsPage(p: { open: (section: Section) => void; world: () => void }) {
  return (
    <Page title="Contents" foot={<Control label={LABEL.backToWorld} onPress={p.world} />}>
      <View>
        {SECTIONS.map(([kind, label]) => (
          <EntityLine key={kind} name={label} onPress={() => p.open(kind)} />
        ))}
      </View>
    </Page>
  );
}

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

// The refusal notes are one block (Page's doc comment: a run of rows of one kind).
const notes = (thing: Thing | undefined, label: Say, held?: string) => {
  const shown =
    thing?.actions.flatMap((a, i, all) =>
      !a.available &&
      Object.hasOwn(NOTED, a.reason.code) &&
      all.findIndex((b) => b.action_key === a.action_key) === i // one note per use, however many targets
        ? [{ ...a, word: NOTED[a.reason.code] }]
        : [],
    ) ?? [];
  return (
    shown.length > 0 && (
      <View>
        {shown.map((a) => (
          <ActionCard
            key={a.action_key}
            label={held && commandOf(a) === 'take' ? LABEL.lift : label(a.label)} // E14, refused too
            reason={`${a.word}.`}
          />
        ))}
      </View>
    )
  );
};

// A container's Inside heading (a living NPC's: Held), then its rows as one block.
export const inside = (p: {
  thing?: Thing;
  contents: Thing[];
  text: Say;
  open: (id: string) => void;
}) =>
  p.contents.length > 0 && (
    <>
      <SectionTitle>{p.thing?.kind === 'npc' ? LABEL.held : LABEL.inside}</SectionTitle>
      <View>
        {p.contents.map((e) => (
          <EntityLine key={e.id} name={cap(p.text(e.name))} onPress={() => p.open(e.id)} />
        ))}
      </View>
    </>
  );

/**
 * An item's detail in the detail-page order (book-ui.md, Item details and take/drop): projected state as Notes and Entity lines, options as Action cards.
 *
 * Use: Item only.
 *
 * Rules: a refused action reads the same word as an offered one.
 *
 * States: plain; container with Inside; fuel; too heavy; held by a person.
 *
 * Story: ItemPage.stories.tsx
 */
export function ThingPage(p: {
  thing?: Thing;
  holder?: string; // a living NPC holding it (pass-1 E14)
  text: Say;
  label: Say; // a refused action reads the same word as an offered one
  actions: Button[];
  log: DetailLine[];
  press: (b: Button) => void;
  contents: Thing[];
  open: (id: string) => void;
  leave: () => void;
  back?: () => void;
}) {
  const refusals = notes(p.thing, p.label, p.holder);
  return (
    <Page
      title={p.thing ? cap(p.text(p.thing.name)) : 'Item'}
      foot={
        <>
          {p.back && <Control label={LABEL.backToContainer} onPress={p.back} />}
          <Control label={LABEL.leave} onPress={p.leave} />
        </>
      }
    >
      <ItemDetails thing={p.thing} text={p.text} />
      <LogLines lines={p.log} />
      {p.holder && <Note>{holding(cap(p.text(p.holder)))}</Note>}
      {refusals}
      {!refusals && !p.actions.length && !p.contents.length && <Note>Nothing to do here.</Note>}
      <Cards>
        {p.actions.map((b) => (
          <ActionCard key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
        ))}
      </Cards>
      {inside(p)}
    </Page>
  );
}

/**
 * The item route: finds the thing and its holder, then draws ThingPage.
 *
 * Use: an item detail route.
 *
 * Story: ItemPage.stories.tsx
 */
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
  const holder = thing && 'container_id' in thing && items.find((e) => e.id === thing.container_id);
  const held = holder && holder.kind === 'npc' ? holder.name : undefined;
  return (
    <ThingPage
      thing={thing}
      holder={held}
      text={p.screen.text}
      label={p.screen.label}
      actions={p.g
        .on(p.id)
        .map((b) => (held && commandOf(b) === 'take' ? { ...b, label: LABEL.lift } : b))}
      log={p.screen.detail(p.id)}
      press={(b) => p.press(b, p.id)}
      contents={items.filter((e) => 'container_id' in e && e.container_id === p.id)}
      open={(id) => p.open({ kind: 'thing', id })}
      leave={p.world}
      back={thing && 'container_id' in thing ? p.back : undefined}
    />
  );
}
