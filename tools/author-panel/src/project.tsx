// The Project tab: the panel's earlier tools (play, write, state, why, find, numbers), moved into
// the shell's left column under the chapter's title.
import { useBook } from './book.ts';
import { Badge } from './components/ui/badge.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.tsx';
import { Numbers } from './numbers.tsx';
import { Facts, Find, Why } from './reading.tsx';
import { Play, Todo } from './sections.tsx';
import { Step } from './steptab.tsx';
import type { Checked } from './author.ts';
import type { Heard } from './book.ts';

type UseBook = ReturnType<typeof useBook>;
type Props = Pick<UseBook, 'state' | 'send' | 'trace'> & {
  said?: string[];
  checked?: Checked[];
  heard?: Heard;
};

const Title = ({ state }: { state?: UseBook['state'] }) => (
  <p className="flex items-center gap-2 px-3 pt-2" title={state?.hash && `chapter ${state.hash}`}>
    {state?.hash ? state.title : <Badge variant="secondary">waiting for the Book</Badge>}
  </p>
);

export function Project({ state, send, trace, said, checked, heard }: Props) {
  return (
    <Tabs defaultValue="play" className="gap-0">
      <Title state={state} />
      <TabsList className="mx-3 mt-2 grid w-auto grid-cols-7">
        <TabsTrigger value="play">Play</TabsTrigger>
        <TabsTrigger value="write">Write</TabsTrigger>
        <TabsTrigger value="state">State</TabsTrigger>
        <TabsTrigger value="why">Why</TabsTrigger>
        <TabsTrigger value="step">Step</TabsTrigger>
        <TabsTrigger value="find">Find</TabsTrigger>
        <TabsTrigger value="numbers">Numbers</TabsTrigger>
      </TabsList>
      <div className="p-3">
        <TabsContent value="play">
          <Play state={state} send={send} checked={checked} />
        </TabsContent>
        <TabsContent value="write">
          <Todo said={said} />
        </TabsContent>
        <TabsContent value="state">
          <Facts state={state} />
        </TabsContent>
        <TabsContent value="why" forceMount className="data-[state=inactive]:hidden">
          <Why state={state} trace={trace} />
        </TabsContent>
        <TabsContent value="step" forceMount className="data-[state=inactive]:hidden">
          <Step state={state} trace={trace} heard={heard} />
        </TabsContent>
        <TabsContent value="find" forceMount className="data-[state=inactive]:hidden">
          <Find />
        </TabsContent>
        <TabsContent value="numbers" forceMount className="data-[state=inactive]:hidden">
          <Numbers hash={state?.hash} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
