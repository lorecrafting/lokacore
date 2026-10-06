// Page dispatch for the current Book view and local detail stack.
import { group, conversation, npcPage, type Page } from './model.ts';
import { presenter, type Button } from './presenter.ts';
import { ContentsPage, Item, NpcDetail, type Section } from './Menu.tsx';
import { NoticeEntries, NoticePage } from './notices.tsx';
import {
  CarryingPage,
  CharacterPage,
  ChapterPage,
  JournalPage,
  MapPage,
  RoomPage,
  ScenePage,
  SettingsPage,
} from './pages.tsx';
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
  back?: () => void;
};

export function Body(p: BodyProps) {
  const { view, text } = p.screen;
  const { page } = p;
  if (view.scene)
    return <ScenePage scene={view.scene} text={text} next={p.g.continue} press={p.press} />;
  if (page?.kind === 'chapter' && view.chapter)
    return <ChapterPage title={text(view.chapter.title)} done={p.chapterDone} />;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
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
  if (page.kind === 'notice' || page.kind === 'board') return <NoticePage {...p} page={page} />;
  if (page.kind === 'thing') return <Item {...p} id={page.id} />;
  if (page.kind === 'contents') return <ContentsPage open={(kind: Section) => p.open({ kind })} />;
  if (page.kind === 'character') return <CharacterPage view={view} text={text} />;
  if (page.kind === 'map') return <MapPage view={view} text={text} g={p.g} press={p.press} />;
  if (page.kind === 'settings') return <SettingsPage startOver={p.startOver} />;
  if (page.kind === 'journal') return <JournalPage view={view} text={text} />;
  return (
    <CarryingPage items={view.inventory} equipment={view.equipment} text={text} open={openThing} />
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
