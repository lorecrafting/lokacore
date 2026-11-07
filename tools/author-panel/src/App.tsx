// The editor shell (gui-editor-design-2026-11-04.md §11, editor-chrome-rulings.md §5): Hierarchy |
// Project over the map slot, the Book strip, the inspector over the console; under 900 px, stacked.
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shortcut } from '../../../mobile/app/author/prose_rules.ts';
import { kept, mapCommand, shown } from './mapwire.ts';
import { ask, checkpoints, drop, undoDelete, story as getStory, useDiagnostics, type Story } from './author.ts';
import { useBook, type Heard } from './book.ts';
import { BookStrip } from './centre.tsx';
import { Divider, Rail, useLayout, type SetLayout } from './columns.tsx';
import { Button } from './components/ui/button.tsx';
import { ScrollArea } from './components/ui/scroll-area.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.tsx';
import { Hierarchy, MapSlot, WorldButton } from './left.tsx';
import { Palette } from './palette.tsx';
import { Project } from './project.tsx';
import { Counts, Unconfirmed } from './prose.tsx';
import { flowGo, flowItems } from './flowread.ts';
import { Feed, Inspector } from './right.tsx';
import { Compile, Source } from './sections.tsx';
import {
  fileOf, fold,
  fromRef,
  fromTextKey,
  items,
  places,
  START,
  type Item,
  type Layout,
  type Selection,
} from './shell.ts';
import { go, LIST, storyItems } from './storylist.ts';

type Book = ReturnType<typeof useBook>;

function Close({ side, set }: { side: 'left' | 'right'; set: SetLayout }) {
  const Icon = side === 'left' ? PanelLeftClose : PanelRightClose;
  const label = side === 'left' ? 'Fold the left column (Cmd-\\)' : 'Fold the right column (Cmd-/)';
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="ml-auto"
      aria-label={label}
      title={label}
      onClick={() => set((l) => fold(l, side === 'left' ? '\\' : '/'))}
    >
      <Icon />
    </Button>
  );
}

/** A fresh Book (no steps yet) replays the pinned start checkpoint, once per load. */
function useStart(book: Book) {
  const done = useRef<number>(undefined);
  useEffect(() => {
    const name = localStorage.getItem(START);
    if (!name || !book.loaded || book.state?.steps.length !== 0 || done.current === book.loaded.at)
      return; // a state still the last Book's (steps) waits for the new one
    done.current = book.loaded.at;
    void checkpoints.get(name).then(({ steps }) => book.send({ op: 'jump', steps }));
  }, [book]);
}

/** Every editor shortcut, pressed here or relayed from the Book frame. */
function useShortcuts(heard: React.RefObject<Heard>, act: (key: string) => void) {
  heard.current.shortcut = act;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = shortcut(e);
      if (key) (e.preventDefault(), heard.current.shortcut(key));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [heard]);
}

/** What each column reads: the layout, the last good /story, the Book and the stream. */
type Shell = {
  layout: Layout;
  set: SetLayout;
  story?: Story;
  book: Book;
  diag: ReturnType<typeof useDiagnostics>;
  pick: (s?: Selection) => void;
  offer: (add: string[]) => void;
};

function Left({ layout, set, story, book, diag, pick }: Shell) {
  const picked = places(layout.selection, story?.graph.nodes ?? []).hierarchy;
  const play = (room: string) => book.send({ op: 'go_to_room', room });
  const tab = (tab: string) => set((l) => ({ ...l, tab: tab as Layout['tab'] }));
  return (
    <Tabs value={layout.tab} onValueChange={tab} className="min-h-0 flex-1 gap-0">
      <div className="flex h-8 items-center border-b px-2">
        <TabsList>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
        </TabsList>
        <Close side="left" set={set} />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <TabsContent value="hierarchy">
          <Hierarchy
            story={story}
            picked={picked}
            here={book.state?.shown.here}
            pick={pick}
            play={play}
          />
        </TabsContent>
        <TabsContent value="project" forceMount className="data-[state=inactive]:hidden">
          <Project state={book.state} send={book.send} trace={book.trace} said={diag.said} />
          <WorldButton pick={pick} />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}

function Right({ layout, set, story, book, diag, offer, pick }: Shell) {
  const { said, compiled, lint, unconfirmed } = diag;
  return (
    <>
      <div className="flex h-8 items-center border-b px-3 text-xs">
        Inspector
        <Close side="right" set={set} />
      </div>
      <Inspector
        sel={layout.selection}
        story={story}
        diag={diag}
        edit={(key) => book.send({ op: 'edit', key })}
        {...{ offer, pick }}
      />
      <ScrollArea className="min-h-32 flex-1 border-t" aria-label="Console">
        <Compile said={said} compiled={compiled} lint={lint} state={book.state} send={book.send} />
        <section className="border-b px-3 pb-2">
          <Counts prose={book.prose} said={said} />
          <Unconfirmed prose={book.prose} unconfirmed={unconfirmed} said={said} />
        </section>
        <Feed changes={diag.changes} />
        <Source line={book.line} />
      </ScrollArea>
    </>
  );
}

/** An open column with its divider on the inner edge, or a folded column's rail. */
function Side({
  side,
  s,
  children,
}: {
  side: 'left' | 'right';
  s: Shell;
  children: React.ReactNode;
}) {
  if (!s.layout[side === 'left' ? 'leftOpen' : 'rightOpen'])
    return <Rail side={side} set={s.set} />;
  const w = { '--w': `${s.layout[side]}px` } as React.CSSProperties;
  const divider = <Divider side={side} layout={s.layout} set={s.set} />;
  return (
    <>
      {side === 'right' ? divider : null}
      <aside className={COLUMN} style={w} aria-label={`${side} column`}>
        {children}
      </aside>
      {side === 'left' ? divider : null}
    </>
  );
}

/** Selection, Book mark, start checkpoint, shortcuts; palette story rows (rulings S2, S3 Cmd-K). */
function useWiring(
  book: Book,
  heard: React.RefObject<Heard>,
  layout: Layout,
  set: SetLayout,
  open: () => void,
  story?: Story,
) {
  const pick = (s?: Selection) => s && set((l) => ({ ...l, selection: s }));
  heard.current.select = (textKey) => pick(fromTextKey(textKey));
  const [add, offer] = useState<string[]>([]); // the selected room's add-here menu, from its card
  const mark = places(layout.selection, []).book;
  const sent = [mark?.kind, mark?.key, book.loaded, add.join()];
  useEffect(() => void (mark && book.send({ ...mark, add })), sent); // eslint-disable-line react-hooks/exhaustive-deps
  useStart(book);
  const base = command(book, layout.selection, pick, story);
  const run = (i: Item) =>
    i.kind === 'story'
      ? story && set((l) => flowGo(story, l, i.id) ?? { ...l, leftOpen: true, map: 'story', story: { ...go(story, l.story ?? LIST, i.id), chosen: true } })
      : base(i);
  useShortcuts(heard, (key, sel = layout.selection) => {
    if (key === 'k') open();
    else if (key === 'e' && sel) void ask('open', { key: sel.key, file: fileOf(sel, places(sel, story?.graph.nodes ?? []).inspector?.ref, story?.files) });
    else if (key === '.') run({ kind: 'command', id: 'hold', label: '', detail: '' });
    else set((l) => fold(l, key));
  });
  return { pick, run, offer };
}

/** The map slot under the left column, with its divider; the map's moves go to the Book. */
function Slot({ layout, set, story, book, pick, diag, refused }: Shell & { refused?: string }) {
  return (
    <>
      <Divider side="slot" layout={layout} set={set} />
      <MapSlot
        layout={layout}
        set={set}
        story={story}
        refused={refused}
        here={book.state?.shown.here}
        visited={book.state?.shown.visited ?? []}
        selected={places(layout.selection, story?.graph.nodes ?? []).map}
        pick={pick}
        go={(room) => book.send({ op: 'go_to_room', room })}
        open={(ref) => void ask('open', { key: fromRef(ref)?.key ?? ref, file: story?.files[ref] ?? story?.bundled[ref] })}
        changes={diag.changes}
      />
    </>
  );
}

/** The last good story, refetched on each compile; a refusal's first line once the watcher spoke. */
function useStory(said: unknown[] | undefined) {
  const [story, setStory] = useState<Story>();
  const [refused, setRefused] = useState<string>();
  useEffect(() => {
    let live = true; // a later compile's fetch supersedes this one
    void getStory().then(
      (s) => live && ((shown.rooms = s.map), (shown.nodes = s.graph.nodes), (shown.shorts = s.shorts), setStory(s), setRefused(undefined)), // the map's commands work while it is closed
      (e: Error) => live && !kept(e) && setRefused(said?.length ? e.message.split('\n')[0] : undefined), // no watcher yet: waiting
    );
    return () => void (live = false);
  }, [said]);
  return [story, refused] as const;
}

const COLUMN =
  'flex min-h-0 shrink-0 flex-col bg-background w-(--w) max-[900px]:h-1/2 max-[900px]:w-full';

export default function App() {
  const frame = useRef<HTMLIFrameElement>(null);
  const heard = useRef<Heard>({ select: () => {}, shortcut: () => {} });
  const book = useBook(frame, heard);
  const diag = useDiagnostics();
  const [layout, set] = useLayout();
  const [story, refused] = useStory(diag.said);
  const [palette, setPalette] = useState(false);
  const { pick, run, offer } = useWiring(book, heard, layout, set, () => setPalette(true), story);
  const s: Shell = { layout, set, story, book, diag, pick, offer };
  const all = (text: Record<string, string>) => [
    ...items(story?.graph.nodes ?? [], text, diag.placeholders ?? {}),
    ...(story ? [...storyItems(story), ...flowItems(story)] : []),
  ];
  return (
    <div className="flex h-full bg-background text-foreground max-[900px]:flex-col">
      <Side side="left" s={s}>
        <Left {...s} />
        <Slot {...s} refused={refused} />
      </Side>
      <BookStrip
        frame={frame}
        layout={layout}
        set={set}
        held={diag.held}
        pending={diag.pending}
        last={diag.timings[0]}
        loaded={book.loaded}
      />
      <Side side="right" s={s}>
        <Right {...s} />
      </Side>
      {palette ? <Palette all={all} run={run} close={() => setPalette(false)} /> : null}
    </div>
  );
}

/** What a palette row does: a command runs, a key or text key selects, a `~` opens in the Book. */
function command(book: Book, sel: Selection | undefined, pick: (s?: Selection) => void, story?: Story) {
  return (i: Item) => {
    if (i.kind === 'key') return pick(fromRef(i.id));
    if (i.kind === 'text') return pick(fromTextKey(i.id));
    if (i.kind === 'todo') return (pick(fromTextKey(i.id)), book.send({ op: 'edit', key: i.id }));
    if (i.id === 'hold') return document.querySelector<HTMLButtonElement>('[data-hold]')?.click();
    if (i.id.startsWith('map-'))
      return mapCommand(i.id, sel?.kind === 'room' ? sel.key : undefined);
    if (i.id === 'delete') return void (sel && drop(sel.key, fileOf(sel, places(sel, story?.graph.nodes ?? []).inspector?.ref, story?.files)));
    if (i.id === 'undo') return void undoDelete(book);
    const kind = i.id.startsWith('new-') ? i.id.slice(4) : undefined;
    const name = kind === 'outline' ? kind : i.id === 'go' && sel?.kind === 'room' ? sel.key : prompt(kind ? `New ${kind.replace(/(us)es$|s$/, '$1')} key` : 'Room key');
    if (!name) return;
    if (kind) void ask('new', { kind, name }).then(({ ok, told }) => ok || alert(String(told)));
    else book.send({ op: 'go_to_room', room: name });
  };
}
