// The author panel page: the Book preview framed on the left, the writer's tools on the right
// (docs/system/cartridge.md#author-preview, docs/guides/writing-the-game.md).
import { BookOpen, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useDiagnostics } from './author.ts';
import { BOOK, useBook } from './book.ts';
import { Button } from './components/ui/button.tsx';
import { Badge } from './components/ui/badge.tsx';
import { ScrollArea } from './components/ui/scroll-area.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.tsx';
import { Compile, Facts, Play, Source, Todo, Why } from './sections.tsx';

const THEME = 'loka-theme';
function useTheme() {
  const [dark, setDark] = useState(
    () =>
      (localStorage.getItem(THEME) ??
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark',
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(THEME, dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

function Header({ hash, dark, toggle }: { hash?: string; dark: boolean; toggle: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b px-3 py-2">
      <BookOpen className="size-4" aria-hidden />
      <span className="font-semibold">Loka author</span>
      {hash ? (
        <Badge variant="outline" className="font-mono" title={hash}>
          {hash.slice(0, 8)}
        </Badge>
      ) : (
        <Badge variant="secondary">waiting for the Book</Badge>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="ml-auto"
        onClick={toggle}
        aria-label="Toggle dark mode"
      >
        {dark ? <Sun /> : <Moon />}
      </Button>
    </header>
  );
}

function Book({ frame }: { frame: RefObject<HTMLIFrameElement | null> }) {
  // allow: a cross-origin frame is only crossOriginIsolated (SharedArrayBuffer for the SQLite worker) when the parent delegates it
  return (
    <iframe
      ref={frame}
      title="Book preview"
      src={`${BOOK}/?dev=1`}
      allow="cross-origin-isolated"
      className="min-h-0 flex-1 border-0 bg-white"
    />
  );
}

export default function App() {
  const frame = useRef<HTMLIFrameElement>(null);
  const book = useBook(frame);
  const { said, compiled } = useDiagnostics();
  const [dark, toggle] = useTheme();
  return (
    <div className="flex h-full bg-background text-foreground max-[900px]:flex-col">
      <Book frame={frame} />
      <aside className="flex w-[400px] shrink-0 flex-col border-l max-[900px]:h-1/2 max-[900px]:w-full max-[900px]:border-t max-[900px]:border-l-0">
        <Header hash={book.state?.hash} dark={dark} toggle={toggle} />
        <Compile said={said} compiled={compiled} placeNote={book.state?.placeNote} />
        <Tabs defaultValue="play" className="min-h-0 flex-1 gap-0">
          <TabsList className="mx-3 mt-2 grid w-auto grid-cols-4">
            <TabsTrigger value="play">Play</TabsTrigger>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="state">State</TabsTrigger>
            <TabsTrigger value="why">Why</TabsTrigger>
          </TabsList>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              <TabsContent value="play">
                <Play state={book.state} send={book.send} />
              </TabsContent>
              <TabsContent value="write">
                <Todo said={said} />
              </TabsContent>
              <TabsContent value="state">
                <Facts state={book.state} />
              </TabsContent>
              <TabsContent value="why">
                <Why trace={book.trace} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
        <Source line={book.line} />
      </aside>
    </div>
  );
}
