import { Text, View } from 'react-native';
import { DreamPage } from './DreamPage.tsx';
// Page dispatch for the current Book view and local detail stack.
import { group, conversation, npcPage, type Page } from './model.ts';
import { presenter, type Button } from './presenter.ts';
import { ContentsPage, Item, NpcDetail, type Section } from './Menu.tsx';
import { NoticeEntries, NoticePage } from './notices.tsx';
import { VerbLine } from './actions.tsx';
import { RoomPage, RunningHead } from './pages.tsx';
import { note, usePalette } from './palette.ts';
import { space } from './tokens.ts';
import {
  AncestryPage,
  CarryingPage,
  ChapterPage,
  CharacterPage,
  JournalPage,
  MapPage,
  ScenePage,
  SettingsPage,
} from './sections.tsx';
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
};

export function Body(p: BodyProps) {
  const c = usePalette();
  const water = p.screen.view.water;
  const surface = water && p.g.exits.find((e) => e.direction === 'up')?.button;
  return (
    <View style={{ flex: 1 }}>
      {p.page?.kind !== 'journal' && <RunningHead view={p.screen.view} text={p.screen.text} />}
      {water && (
        <View style={{ paddingHorizontal: space.page }}>
          <Text style={note(c)}>{water.remaining_seconds} seconds to surface</Text>
          {surface && <VerbLine b={surface} press={p.press} />}
        </View>
      )}
      <PageBody {...p} />
    </View>
  );
}

function PageBody(p: BodyProps) {
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
    return <ChapterPage title={text(view.chapter.title)} done={p.chapterDone} />;
  if (!page) return <WorldPage {...p} />;
  if (page.kind === 'dialogue' || npcPage(page, view))
    return (
      <NpcDetail
        {...p}
        speaker={
          page.kind === 'dialogue' ? page.speaker : page.kind === 'thing' ? page.id : undefined
        }
      />
    );
  if (page.kind === 'dream') return <DreamPage {...p} close={p.back} id={page.id} />;
  if (page.kind === 'notice' || page.kind === 'board') return <NoticePage {...p} page={page} />;
  if (page.kind === 'thing') return <Item {...p} id={page.id} />;
  return sectionPage(p, page);
}

// A Contents section's page; Carrying is the last.
function sectionPage(p: BodyProps, page: Page) {
  const { view, text } = p.screen;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  if (page.kind === 'contents')
    return <ContentsPage open={(kind: Section) => p.open({ kind })} world={p.world} />;
  if (page.kind === 'character') return <CharacterPage view={view} text={text} world={p.world} />;
  if (page.kind === 'map')
    return (
      <MapPage view={view} text={text} g={p.g} press={p.press} log={p.screen.log} world={p.world} />
    );
  if (page.kind === 'settings') return <SettingsPage startOver={p.startOver} world={p.world} />;
  if (page.kind === 'journal') return <JournalPage view={view} text={text} world={p.world} />;
  return (
    <CarryingPage
      items={view.inventory}
      equipment={view.equipment}
      text={text}
      open={openThing}
      world={p.world}
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
      openChoice={() => p.open(conversation(view))}
      details={<NoticeEntries {...p} />}
    />
  );
}
