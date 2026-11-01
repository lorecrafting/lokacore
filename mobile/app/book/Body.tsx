import { View } from 'react-native';
import { Text } from './Text.tsx';
import { DreamPage } from './DreamPage.tsx';
import { JournalPage } from './journal.tsx';
// Page dispatch for the current Book view and local detail stack, and the room page it renders.
import { group, LINK, npcPage, type Page } from './model.ts';
import { presenter, type Button } from './presenter.ts';
import { ContentsPage, InsidePage, Item, type Section } from './Menu.tsx';
import { NpcDetail } from './Npc.tsx';
import { ShelfPage } from './Shelf.tsx';
import { NoticePage, proseLinks } from './notices.tsx';
import { VerbLine } from './actions.tsx';
import { Here, LogLines, nameLink } from './lines.tsx';
import { Page as PageShell } from './pages.tsx';
import { RunningHead } from './RunningHead.tsx';
import { note, prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { ItemPop } from './ItemPop.tsx';
import { space } from './tokens.ts';
import { chapterLabel } from './words.ts';
import type { Effects, Reading } from './reading.ts';
import {
  AncestryPage,
  CarryingPage,
  ChapterPage,
  CharacterPage,
  MapPage,
  ScenePage,
  SettingsPage,
} from './sections.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import type { DetailLine } from './logs.ts';
type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;
type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

type BodyProps = {
  page?: Page;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  open: (p: Page) => void;
  startOver: () => void;
  chapterDone: () => void;
  world: () => void;
  back: () => void;
  stack: Page[];
  reading?: Reading;
  effects?: Effects;
};
// The NPC page (this visit, by identity) in conversation; BookView holds it outside PageTurn's remount.
type Talk = { talkingOn?: Page; talkOn: (page?: Page) => void };

/**
 * The page under the running head: picks the page for the current route and detail stack.
 * - Use: BookView only.
 * - Story: RoomPage.stories.tsx
 */
export function Body(p: BodyProps & Talk) {
  const c = usePalette();
  const t = useType();
  const water = p.screen.view.water;
  const surface = water && p.g.exits.find((e) => e.direction === 'up')?.button;
  return (
    <View style={{ flex: 1 }}>
      {p.page?.kind !== 'journal' && <RunningHead view={p.screen.view} text={p.screen.text} />}
      {water && (
        <View style={{ paddingHorizontal: space.page }}>
          <Text style={note(c, t)}>{water.remaining_seconds} seconds to surface</Text>
          {surface && <VerbLine b={surface} press={p.press} />}
        </View>
      )}
      <PageBody {...p} />
    </View>
  );
}

function PageBody(p: BodyProps & Talk) {
  const { view, text } = p.screen;
  const { page } = p;
  if (view.ancestry_choices)
    return (
      <AncestryPage
        view={view}
        text={text}
        buttons={p.screen.buttons}
        pending={p.screen.pending}
        press={p.press}
      />
    );
  if (view.scene)
    return <ScenePage scene={view.scene} text={text} next={p.g.continue} press={p.press} />;
  if (page?.kind === 'chapter' && view.chapter)
    return (
      <ChapterPage
        key={view.chapter.index}
        label={chapterLabel(view.chapter.index)}
        title={text(view.chapter.title)}
        done={p.chapterDone}
      />
    );
  if (!page) return <WorldPage {...p} />;
  if (page.kind === 'dialogue' || npcPage(page, view)) {
    const speaker =
      page.kind === 'dialogue' ? page.speaker : page.kind === 'thing' ? page.id : undefined;
    return <NpcDetail {...p} speaker={speaker} visit={page} />;
  }
  if (page.kind === 'shelf' || page.kind === 'sale')
    return <ShelfPage {...p} id={page.id} sale={page.kind === 'sale'} />;
  if (page.kind === 'dream') return <DreamPage {...p} close={p.back} id={page.id} />;
  if (page.kind === 'inside') return <InsidePage {...p} close={p.back} id={page.id} />;
  if (page.kind === 'notice' || page.kind === 'board') return <NoticePage {...p} page={page} />;
  if (page.kind === 'thing') return <Item {...p} id={page.id} />;
  return sectionPage(p, page);
}

// A Contents section's page; Carrying is the last.
function sectionPage(p: BodyProps, page: Page) {
  const { view, text } = p.screen;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  // Opened from Contents, a section returns to it (owner, 2026-10-30, loka-8lpm).
  const home = {
    world: p.world,
    contents: p.stack.at(-2)?.kind === 'contents' ? p.back : undefined,
  };
  if (page.kind === 'contents')
    return <ContentsPage open={(kind: Section) => p.open({ kind })} world={p.world} />;
  if (page.kind === 'character')
    return (
      <CharacterPage
        view={view}
        text={text}
        {...home}
        buttons={p.screen.buttons}
        press={p.press}
        pending={p.screen.pending}
      />
    );
  if (page.kind === 'map') return <MapPage view={view} text={text} {...home} />;
  if (page.kind === 'settings')
    return (
      <SettingsPage startOver={p.startOver} {...home} reading={p.reading} effects={p.effects} />
    );
  if (page.kind === 'journal') return <JournalPage {...p.screen} {...home} press={p.press} />;
  return (
    <CarryingPage
      items={view.inventory}
      equipment={view.equipment}
      text={text}
      open={openThing}
      {...home}
    />
  );
}

function WorldPage(p: BodyProps) {
  const { view, text, log } = p.screen;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  return (
    <RoomPage
      view={view}
      text={text}
      log={log}
      g={p.g}
      press={p.press}
      open={openThing}
      links={proseLinks(p)}
    />
  );
}

/**
 * The place (book-ui.md Room page anatomy): fixed title, prose with fixture links, people and
 * items, then the log; sense cues, an exit's warning and the away recap are log entries. The page
 * scrolls to its end while the log has lines.
 * - Use: the World page.
 * - Rules: the title is centred and is the Look tap, named `<title>, look`; a new paragraph at every blank line
 *   of the authored text; a touch link in `links` is a name link in the prose, any other its words;
 *   the prose, people and items sit `space.lg` apart, a step under the page's
 *   `space.xl` block gap.
 * - Story: RoomPage.stories.tsx
 */
export function RoomPage(p: {
  view: GameView;
  text: Say;
  log: DetailLine[];
  g: Grouped;
  press: (b: Button) => void;
  open: (id: string) => void;
  links?: ReadonlyMap<string, () => void>; // a linked fixture's press, by link target (proseLinks)
}) {
  const c = usePalette();
  const t = useType();
  const look = p.g.look;
  return (
    <PageShell
      title={p.text(p.view.place.title.key)}
      fixedTitle
      onTitlePress={look && (() => p.press(look))}
      scrollToEnd={p.log.length > 0}
    >
      <View style={{ gap: space.lg }}>
        {paragraphs(c, t, p.text(p.view.place.description.key), p.links)}
        <Here view={p.view} text={p.text} open={p.open} />
      </View>
      {!!p.log.length && (
        <View>
          <LogLines lines={p.log} />
          <ItemPop view={p.view} text={p.text} />
        </View>
      )}
    </PageShell>
  );
}

// The room prose as one block; a blank line in the authored text is a paragraph break. A touch
// link draws as a name link when `links` has its target, else as its words.
const paragraphs = (
  c: Palette,
  t: Type,
  description: string,
  links: ReadonlyMap<string, () => void> = new Map(),
) => (
  <View style={{ gap: space.lg }}>
    {description
      .trim()
      .split(/\s*\n\s*\n\s*/)
      .map((paragraph, i) => (
        <Text key={i} style={prose(c, t)}>
          {paragraph.split(LINK).map((part, j, parts) => {
            const press = j % 3 === 1 && links.get(parts[j + 1]);
            return press ? nameLink(part, press, j) : j % 3 < 2 && part;
          })}
        </Text>
      ))}
  </View>
);
