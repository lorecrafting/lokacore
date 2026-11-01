// The panel's sections, each reading the Book's state or the watcher's API; no game logic here.
import { Bookmark, Clock, FileCode2, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ask, checkpoints, type Todo as TodoRow, todo } from './author.ts';
import type { Line, State, Step } from './book.ts';
import { Badge } from './components/ui/badge.tsx';
import { Button } from './components/ui/button.tsx';
import { Input } from './components/ui/input.tsx';
import { Separator } from './components/ui/separator.tsx';

export const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </h2>
);

/** The last compile's diagnostics first: a writer reads the error before anything else. */
export function Compile({ said, compiled, lint, state, send }: { said?: string[]; compiled: boolean; lint?: string[]; state?: State; send: Send }) {
  const placeNote = state?.placeNote;
  return (
    <section className="border-b px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {said === undefined ? (
          <Badge variant="secondary">watcher not running</Badge>
        ) : !compiled ? (
          <Badge variant="destructive">not compiled</Badge>
        ) : (
          <Badge className="bg-emerald-600 text-white dark:bg-emerald-500">compiled</Badge>
        )}
        {placeNote ? <span className="truncate text-muted-foreground" title={placeNote}>{placeNote}</span> : null}
      </div>
      {state?.refused === undefined ? null : (
        <Button className="mt-2" size="sm" variant="outline" onClick={() => send({ op: 'drop' })}>
          drop this step and continue
        </Button>
      )}
      {said?.length ? (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
          {said.join('\n')}
        </pre>
      ) : null}
      {lint === undefined ? null : lint.length ? (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
          {lint.join('\n')}
        </pre>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">lint clean</p>
      )}
    </section>
  );
}

type Send = (asked: { op: 'advance'; minutes: number } | { op: 'jump'; steps: Step[] } | { op: 'drop' }) => void;
/** Game time and named checkpoints; both go through the Book's own replay path. */
export function Play({ state, send }: { state?: State; send: Send }) {
  return (
    <div className="space-y-4">
      <GameTime state={state} send={send} />
      <Separator />
      <Checkpoints state={state} send={send} />
    </div>
  );
}

function GameTime({ state, send }: { state?: State; send: Send }) {
  const [minutes, setMinutes] = useState('60');
  return (
    <div>
      <Heading>
        <Clock className="size-3.5" /> Game time
      </Heading>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send({ op: 'advance', minutes: Number(minutes) });
        }}
      >
        <Input aria-label="Game minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-24" />
        <Button type="submit" variant="secondary" disabled={!state}>
          Advance minutes
        </Button>
      </form>
      <p className="mt-1 text-xs text-muted-foreground">{state ? `${state.steps.length} steps recorded` : 'No Book yet'}</p>
    </div>
  );
}

function Checkpoints({ state, send }: { state?: State; send: Send }) {
  const [name, setName] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const list = () => checkpoints.list().then(setNames, () => setNames([]));
  useEffect(() => void list(), []);
  const save = () =>
    checkpoints.put(name, state?.steps ?? []).then((r) => {
      if (r.ok) return list();
      setNote(`Not saved: ${r.status}`);
    });
  const jump = (n: string) => void checkpoints.get(n).then(({ steps }) => send({ op: 'jump', steps }));
  const named = /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name); // live.ts NAME
  return (
    <div>
      <Heading>
        <Bookmark className="size-3.5" /> Checkpoints
      </Heading>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input aria-label="Checkpoint name" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!named || !state?.steps.length}>
          Save
        </Button>
      </form>
      {note ? <p className="mt-1 text-xs text-destructive">{note}</p> : null}
      <CheckpointList names={names} jump={jump} />
    </div>
  );
}

function CheckpointList({ names, jump }: { names: string[]; jump: (n: string) => void }) {
  if (names.length === 0)
    return <p className="mt-1 text-xs text-muted-foreground">Play to a beat, name it, Save; later, pick it to replay there.</p>;
  return (
    <ul className="mt-2 space-y-1">
      {names.map((n) => (
        <li key={n}>
          <Button variant="outline" size="sm" className="w-full justify-start font-mono" onClick={() => jump(n)}>
            {n}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Still to write: every `~` by the file that owns it, with the words written there; read again
 * after each compile (`said` changes), so a line just written leaves the list. */
export function Todo({ said }: { said?: string[] }) {
  const [rows, setRows] = useState<TodoRow[]>();
  useEffect(() => {
    todo().then(setRows, () => setRows(undefined));
  }, [said]);
  return (
    <div className="space-y-3">
      <Heading>
        <PenLine className="size-3.5" /> Still to write
      </Heading>
      {rows === undefined ? (
        <p className="text-sm text-muted-foreground">Waiting for the watcher.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing left: every line is written.</p>
      ) : (
        rows.map((row) => (
          <div key={row.file} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{row.file}</span>
              <Badge variant="secondary">{row.words} words</Badge>
            </div>
            <ul className="mt-1 list-disc pl-5 font-mono text-xs text-muted-foreground">
              {row.placeholders.map((at) => (
                <li key={at}>{at}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

/** An Alt-clicked Book line, opened in the owner's editor by the watcher (LOKA_EDITOR). */
export function Source({ line }: { line?: Line }) {
  const [note, setNote] = useState('Alt-click a Book line to open its source.');
  useEffect(() => {
    if (!line) return;
    ask('open', line).then(
      ({ ok, told }) => setNote(ok ? `Opened ${told}` : `Not opened: ${told}`),
      (err: Error) => setNote(`Not opened: ${err.message}`),
    );
  }, [line]);
  return (
    <footer className="flex items-center gap-1.5 border-t px-3 py-1.5 text-xs text-muted-foreground">
      <FileCode2 className="size-3.5 shrink-0" />
      <span className="truncate" title={note}>{note}</span>
    </footer>
  );
}
