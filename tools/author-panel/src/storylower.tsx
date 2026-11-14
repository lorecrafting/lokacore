// The Story segment's lower section (docs/design/editor-map-and-story-rulings.md S2): one panel at a
// time, Trace, Knowledge, Pacing or the Facts table, each row a node a click selects.
import { Gauge, Table2, X } from 'lucide-react';
import type { Story } from './author.ts';
import { Button } from './components/ui/button.tsx';
import { fromRef, type Selection } from './shell.ts';
import * as C from './storyconseq.ts';
import * as F from './storyfacts.ts';
import * as K from './storyknow.ts';
import * as L from './storylist.ts';

export const ICONED = { className: 'size-3.5 shrink-0', strokeWidth: 1.5, absoluteStrokeWidth: true };
export type Act = { st: L.ListState; put: (st: L.ListState) => void; pick: (s: Selection) => void; open: (ref: string) => void };

// A lower-section row: a node's key, a click selects it.
function NodeButton({ r, a }: { r: L.TraceRow; a: Act }) {
  return (
    <button
      type="button"
      disabled={!(r.ref && fromRef(r.ref))}
      className="flex h-7 w-full items-center gap-2 px-4 text-left text-muted-foreground"
      onClick={() => r.ref && a.pick(fromRef(r.ref)!)}
    >
      {r.label}
      {r.key ? <code className={`text-foreground ${r.dashed ? 'underline decoration-dashed' : ''}`}>{r.key}</code> : null}
      {r.beat !== undefined ? <span>· beat {r.beat}</span> : null}
      {r.dashed ? <span className="sr-only">(a clock read)</span> : null}
    </button>
  );
}

// A consequences row: a choice walks that choice, a node selects it, a gate is text.
function ConsequenceButton({ r, a }: { r: C.ConsequenceRow; a: Act }) {
  const sel = r.ref ? fromRef(r.ref) : undefined;
  const color =
    r.ok === true ? 'text-foreground' : r.ok === false ? 'text-destructive' : r.ok === 'depends' ? 'text-muted-foreground' : '';
  return (
    <button
      type="button"
      disabled={!r.at && !sel}
      className={`flex h-7 w-full items-center gap-2 px-4 text-left text-muted-foreground ${r.depth ? 'pl-8' : ''} ${color}`}
      onClick={() => (r.at ? a.put({ ...a.st, lower: { panel: 'consequences', at: r.at } }) : sel && a.pick(sel))}
    >
      {r.label}
      {r.key ? <code className={`text-foreground ${r.ok === 'depends' ? 'underline decoration-dashed' : ''}`}>{r.key}</code> : null}
      {r.ok === 'depends' ? <span className="sr-only">(depends on play)</span> : null}
    </button>
  );
}

// A facts row (F1): the whole table row's words (its key first), a click traces that fact.
function FactButton({ r, a }: { r: F.FactRow; a: Act }) {
  return (
    <button
      type="button"
      className="flex h-7 w-full items-center gap-2 px-4 text-left text-muted-foreground"
      onClick={() => a.put({ ...a.st, lower: { panel: 'trace', at: r.ref } })}
    >
      <span className={`truncate ${r.status === 'both' ? '' : 'text-warning'}`}>{r.label}</span>
    </button>
  );
}

// The Facts table (F1): its ceiling is W4's relief, so the caveat says which it is.
function factPanel(story: Story, a: Act): [React.ReactNode, string, React.ReactNode[]] {
  const rows = F.factRows(story);
  const head = (
    <p className="px-4 py-1 text-xs text-muted-foreground">
      {['key', 'type', 'default', 'scope', 'meaning', 'set', 'read', 'status', 'range'].join(' · ')}
    </p>
  );
  return [
    'Facts',
    'range: the declared minimum to what its one-shot writes reach',
    [head, ...rows.map((r, i) => <FactButton key={i} r={r} a={a} />)],
  ];
}

const keyed = (label: string) => (ref: string): L.TraceRow => ({ label, ref, key: fromRef(ref)?.key ?? ref });

// The lower section's one panel: its title, its caveat line (Knowledge and Pacing assume the outline
// order; Consequences shows a gate only a hint unless the walk settled it) and its rows.
function lower(story: Story, p: L.Lower, a: Act): [title: React.ReactNode, caveat: string | undefined, rows: React.ReactNode[]] {
  if (p.panel === 'facts') return factPanel(story, a);
  if (p.panel === 'trace') {
    const key = fromRef(p.at)?.key ?? p.at;
    const title = (
      <>
        Trace <code>{key}</code>
      </>
    );
    return [title, undefined, L.trace(story, p.at).map((r, i) => <NodeButton key={i} r={r} a={a} />)];
  }
  if (p.panel === 'consequences') {
    const [node, choice] = p.at.split('#');
    const key = (r?: string) => (r ? (fromRef(r)?.key ?? r) : '');
    const title = (
      <>
        Consequences <code>{key(choice ?? node)}</code>
      </>
    );
    // each choice heads its own group; a click walks that choice, an Enter selects a node
    const data = C.consequenceRows(story, p.at);
    const rows = data.map((r, i) => <ConsequenceButton key={i} r={r} a={a} />);
    return [title, data.some((r) => r.ok === 'depends') ? 'dashed: depends on play' : undefined, rows];
  }
  if (p.panel === 'knowledge') {
    const k = K.knowledge(story, p.n);
    const rows = [...k.knows.map(keyed('knows')), ...k.may.map(keyed('may know')), ...k.not.map(keyed('not yet'))];
    return [`Knowledge at beat ${p.n}`, 'assumes the beats in outline order', rows.map((r, i) => <NodeButton key={i} r={r} a={a} />)];
  }
  const rows = K.pacing(story).map((r) => (
    <p key={r.part} className={`flex h-7 items-center justify-between px-4 ${r.thin ? 'text-warning' : 'text-muted-foreground'}`}>
      <span className="truncate">{r.title ?? `Part ${r.part + 1}`}</span>
      <span>
        {r.words} words{r.thin ? ', thin' : ''}
      </span>
    </p>
  ));
  return ['Pacing', 'assumes the beats in outline order', rows];
}

export function LowerPanel({ story, p, a }: { story: Story; p: L.Lower; a: Act }) {
  const [title, caveat, rows] = lower(story, p, a);
  const name =
    p.panel === 'trace'
      ? 'Trace'
      : p.panel === 'consequences'
        ? 'Consequences'
        : p.panel === 'knowledge'
          ? 'Knowledge'
          : p.panel === 'facts'
            ? 'Facts'
            : 'Pacing';
  return (
    <section aria-label={name} className="max-h-1/2 shrink-0 overflow-auto border-t">
      <header className="flex h-8 items-center justify-between px-2">
        <span>{title}</span>
        <Button variant="ghost" size="icon-xs" aria-label={`Close ${name}`} onClick={() => a.put({ ...a.st, lower: undefined })}>
          <X {...ICONED} />
        </Button>
      </header>
      {caveat ? <p className="px-2 text-xs text-muted-foreground">{caveat}</p> : null}
      <ul>
        {rows.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

/** Facts opens from the Story header (F1): the table is worth a click, not only a Cmd-K row. */
export function FactsButton({ a }: { a: Act }) {
  const open = () => a.put({ ...a.st, lower: { panel: 'facts' } });
  return (
    <Button variant="ghost" size="icon-xs" title="Facts" aria-label="Facts" onClick={open}>
      <Table2 {...ICONED} />
    </Button>
  );
}

/** Pacing opens from the Story header, with an outline to pace. */
export function PacingButton({ story, a }: { story: Story; a: Act }) {
  if (!L.outlineOf(story)) return null;
  const open = () => a.put({ ...a.st, lower: { panel: 'pacing' } });
  return (
    <Button variant="ghost" size="icon-xs" title="Pacing" aria-label="Pacing" onClick={open}>
      <Gauge {...ICONED} />
    </Button>
  );
}
