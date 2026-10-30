// The thing and Contents views use the existing book controls (the NPC page: Npc.tsx).
import { View } from 'react-native';
import { cap, things, type group, type Page as Route } from './model.ts';
import { opens, within } from './item-pages.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { cardKey } from './presenter.ts';
import { ActionCard, Cards, PickLists } from './actions.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { EntityLine, LogLines, Note } from './lines.tsx';
import { Control, Page, SectionTitle, type Thing } from './pages.tsx';
import { ItemDetails } from './skills.tsx';
import { heldBy, NOTED, reasonOf, type Refusal } from './words.ts';
import { commandOf, other } from './buttons.ts';
import { LABEL } from './labels.ts';
type Say = (key: string) => string;

export type Section = 'character' | 'carrying' | 'map' | 'journal' | 'settings';
const SECTIONS: [Section, string][] = [
  ['character', LABEL.character],
  ['carrying', LABEL.inventory],
  ['map', LABEL.map],
  ['journal', LABEL.journal],
  ['settings', LABEL.settings],
];
/**
 * The Contents: one Entity line per section.
 * - Use: the status line's Contents button.
 * - Story: SectionPages.stories.tsx
 */
export function ContentsPage(p: { open: (section: Section) => void; world: () => void }) {
  return (
    <Page title={LABEL.contents} foot={<Control label={LABEL.backToWorld} onPress={p.world} />}>
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
// A refusal's cause names it (a curse: "it will not come off", loka-x6t.38), else the noted code.
const noted = (r: Refusal) =>
  r.cause ? reasonOf(r) : Object.hasOwn(NOTED, r.code) ? NOTED[r.code] : undefined;
const notes = (thing: Thing | undefined, label: Say, held?: string) => {
  const shown = (thing?.actions ?? [])
    .flatMap((a) => {
      // A resting use pair, or any refused aimed spell, is its Pick list row instead (book-ui.md, Pick a second thing).
      const row = (r: Refusal) =>
        commandOf(a) === 'cast' || (!!thing && !!other(a, thing.id) && r.code === 'cooldown');
      const word = !a.available && !row(a.reason) && noted(a.reason);
      return word ? [{ ...a, word }] : [];
    })
    .filter((a, i, all) => all.findIndex((b) => b.action_key === a.action_key) === i); // one note per use, however many targets (loka-x6t.80)
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
 * An item's detail in the detail-page order: projected state as Notes and Entity lines, options
 * as Action cards (book-ui.md, Item details and take/drop).
 * - Use: Item only.
 * - Rules: a refused action reads the same word as an offered one; a container whose contents are
 *   reachable (an open lid, or listed contents) draws a Look inside Control after its options, never
 *   its contents (InsidePage).
 * - States: plain; open container (Look inside); fuel; too heavy; held by a person.
 * - Story: ItemPage.stories.tsx
 */
export function ThingPage(p: {
  thing?: Thing;
  holder?: string; // a living NPC holding it (pass-1 E14)
  text: Say;
  label: Say; // a refused action reads the same word as an offered one
  actions: Button[]; // its Pick list rows too (buttons.ts)
  view: GameView;
  pending?: boolean;
  log: DetailLine[];
  press: (b: Button) => void;
  lookInside: () => void;
  leave: () => void;
}) {
  const refusals = notes(p.thing, p.label, p.holder);
  return (
    <Page
      title={p.thing ? cap(p.text(p.thing.name)) : LABEL.item}
      foot={<Control label={LABEL.leave} onPress={p.leave} />}
    >
      <ItemDetails thing={p.thing} text={p.text} />
      <LogLines lines={p.log} />
      {p.holder && <Note>{heldBy(cap(p.text(p.holder)))}</Note>}
      {refusals}
      <Cards>
        {p.actions
          .filter((b) => !b.pick)
          .map((b) => (
            <ActionCard key={cardKey(b)} b={b} press={p.press} />
          ))}
      </Cards>
      {p.thing && p.actions.some((b) => b.pick) && (
        <PickLists {...p} page={p.thing.id} buttons={p.actions} />
      )}
      {p.thing && opens(p.view, p.thing) && (
        <Control label={LABEL.lookInside} onPress={p.lookInside} />
      )}
    </Page>
  );
}

/**
 * An open container's contents as an anchored detail page of its item page (book-ui.md, Item
 * details and Take/Drop), as the dream page is of its bed.
 * - Use: the inside route, from the item page's Look inside.
 * - Rules: the container's name, then Inside and one Entity line per item, each opening its item
 *   page; no actions; Close returns to the item page and sends nothing.
 * - States: several items; empty (one Note).
 * - Story: ItemPage.stories.tsx
 */
export function InsidePage(p: {
  screen: Screen;
  id: string;
  open: (p: Route) => void;
  close: () => void;
}) {
  const { view, text } = p.screen;
  const thing = things(view).find((e) => e.id === p.id);
  return (
    <Page
      title={thing ? cap(text(thing.name)) : LABEL.item}
      foot={<Control label={LABEL.close} onPress={p.close} />}
    >
      {inside({
        thing,
        contents: within(view, p.id),
        text,
        open: (id) => p.open({ kind: 'thing', id }),
      }) || <Note>{LABEL.nothingInside}</Note>}
    </Page>
  );
}

/**
 * The item route: finds the thing and its holder, then draws ThingPage.
 * - Use: an item detail route.
 * - Story: ItemPage.stories.tsx
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
      view={p.screen.view}
      pending={p.screen.pending}
      log={p.screen.detail(p.id)}
      press={(b) => p.press(b, p.id)}
      lookInside={() => p.open({ kind: 'inside', id: p.id })}
      leave={p.back ?? p.world} // the page it was opened from (loka-x6t.23), so no Back to container (loka-x6t.94)
    />
  );
}
