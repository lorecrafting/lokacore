import { useContext, useRef } from 'react';
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
import { ActionCard, VerbLine } from './actions.tsx';
import type { Wait } from './Unavailable.tsx';
import { LABEL } from './labels.ts';
import { focusTitle, titleContext } from './title.ts';
import { LogLines, nameLink } from './lines.tsx';
import { Here } from './people.tsx';
import { Page as PageShell } from './pages.tsx';
import { RunningHead } from './RunningHead.tsx';
import { note, prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { ItemPop } from './ItemPop.tsx';
import { space } from './tokens.ts';
import { UnderInk } from './UnderInk.tsx';
import { chapterLabel } from './words.ts';
import type { Effects, Reading } from './reading.ts';
import {
  AncestryPage,
  CarryingPage,
  ChapterPage,
  CharacterPage,
  MapPage,
  SettingsPage,
} from './sections.tsx';
import { ScenePage } from './ScenePage.tsx';
import { SkillsPage } from './skills.tsx';
import { CreditsPage } from './CreditsPage.tsx';
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
  rise: () => void;
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
      {p.page?.kind !== 'journal' && !p.screen.spirit && !p.screen.treatment && (
        <RunningHead view={p.screen.view} text={p.screen.text} />
      )}
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
  if (view.scene) return <ScenePage {...p.screen} next={p.g.continue} press={p.press} />;
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
const SettingsRoute = (p: BodyProps & { contents?: () => void }) => (
  <SettingsPage
    startOver={p.startOver}
    credits={() => p.open({ kind: 'credits' })}
    world={p.world}
    contents={p.contents}
    reading={p.reading}
    effects={p.effects}
  />
);

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
  const sheet = {
    view,
    text,
    ...home,
    buttons: p.screen.buttons,
    press: p.press,
  };
  if (page.kind === 'character') return <CharacterPage {...sheet} />;
  if (page.kind === 'skills') return <SkillsPage {...sheet} pending={p.screen.pending} />;
  if (page.kind === 'map') return <MapPage view={view} text={text} {...home} />;
  if (page.kind === 'credits') return <CreditsPage back={p.back} />;
  if (page.kind === 'settings') return <SettingsRoute {...p} {...home} />;
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
  const { view, text, log, spirit } = p.screen;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  return (
    <RoomPage
      view={view}
      text={text}
      log={log}
      g={p.g}
      press={p.press}
      open={openThing}
      links={spirit ? undefined : proseLinks(p)}
      spirit={spirit}
      rise={p.rise}
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
  spirit?: Wait; // the spirit state (book-ui.md): plain prose, the log and the rise card only
  rise?: () => void;
}) {
  const c = usePalette();
  const t = useType();
  const look = !p.spirit && p.g.look;
  return (
    <View style={{ flex: 1 }}>
      <UnderInk view={p.view} treatment={p.spirit ? 'spirit' : undefined} />
      <PageShell
        paperless
        title={p.text(p.view.place.title.key)}
        fixedTitle
        onTitlePress={look ? () => p.press(look) : undefined}
        scrollToEnd={p.log.length > 0}
        foot={p.spirit && <Rise wait={p.spirit} rise={p.rise!} />}
      >
        <View style={{ gap: space.lg }}>
          {paragraphs(c, t, p.text(p.view.place.description.key), p.links)}
          {!p.spirit && <Here view={p.view} text={p.text} open={p.open} />}
        </View>
        {!!p.log.length && (
          <View>
            <LogLines lines={p.log} />
            <ItemPop view={p.view} text={p.text} />
          </View>
        )}
      </PageShell>
    </View>
  );
}

// The spirit state's one control: unavailable, its ring draining, until zero; then Rise, focus to
// the title (book-ui.md, Spirit state). At zero the card is a new element: focus held on the
// waiting card moves to it once; focus elsewhere stays. A blur as the waiting card leaves is not a move.
function Rise(p: { wait: Wait; rise: () => void }) {
  const title = useContext(titleContext);
  const held = useRef(false);
  const waiting = useRef(true);
  waiting.current = p.wait.left > 0;
  const rise = () => (p.rise(), focusTitle(title.last));
  const ready = (card: View | null) => {
    if (card && held.current) ((held.current = false), focusTitle(card as never));
  };
  return (
    <View style={{ flexGrow: 1 }}>
      {p.wait.left ? (
        <ActionCard
          label={LABEL.rise}
          wait={p.wait}
          focus={(on) => void ((on || waiting.current) && (held.current = on))}
        />
      ) : (
        <ActionCard label={LABEL.rise} onPress={rise} ref={ready} />
      )}
    </View>
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
