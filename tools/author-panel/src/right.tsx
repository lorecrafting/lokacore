// The shell's right column: the inspector (a read-only card for the selection until E4 and E6 add
// editors) over the console (the change feed, you or outside, and the last compile's diagnostics).
import type { Change, Story } from './author.ts';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card.tsx';
import type { Selection } from './shell.ts';

/** The selection's summary: its kind, ref, `~`, diagnostics and links, from GET /story. */
export function Inspector({ sel, story }: { sel?: Selection; story?: Story }) {
  if (!sel) return <p className="p-3 text-muted-foreground">Select a definition in the hierarchy or a line in the Book.</p>;
  const ref = story?.graph.nodes.find((n) => n.ref.endsWith(`:${sel.kind}/${sel.key}`))?.ref;
  const count = (rows?: Record<string, unknown[]>) => (ref && rows?.[ref]?.length) || 0;
  const unreached = !!ref && Object.values(story!.report.unreachable).some((refs) => refs.includes(ref));
  return (
    <Card className="m-2 gap-2 py-3" aria-label="Inspector">
      <CardHeader className="px-3">
        <CardTitle className="text-sm">{sel.key}</CardTitle>
        <p className="text-xs text-muted-foreground">{sel.kind}</p>
      </CardHeader>
      <CardContent className="px-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt className="text-muted-foreground">ref</dt>
          <dd className="truncate font-mono">{ref ?? 'not in the last good compile'}</dd>
          <dt className="text-muted-foreground">~</dt>
          <dd className={count(story?.todo) ? 'text-warning' : ''}>{count(story?.todo)}</dd>
          <dt className="text-muted-foreground">diagnostics</dt>
          <dd className={count(story?.diagnostics) ? 'text-destructive' : ''}>{count(story?.diagnostics)}</dd>
          {unreached ? <dd className="col-span-2 text-warning">unreached from the start</dd> : null}
        </dl>
      </CardContent>
    </Card>
  );
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Each write to a source file, newest first: the editor's in `accent`, one from outside in `outside`. */
export function Feed({ changes }: { changes: Change[] }) {
  if (!changes.length) return <p className="px-3 py-2 text-xs text-muted-foreground">No change since this page opened.</p>;
  return (
    <ul className="px-3 py-2 font-mono text-xs" aria-label="Change feed">
      {changes.map((c) => (
        <li key={`${c.seen}${c.file}${c.sha256}`} className={c.by === 'outside' ? 'text-outside' : 'text-primary'}>
          {clock(c.seen)} {c.by === 'outside' ? 'outside' : 'you'} {c.file}
        </li>
      ))}
    </ul>
  );
}
