// The Story segment's lower section (docs/design/editor-map-and-story-rulings.md S2): one panel at a
// time, Trace, Knowledge or Pacing, each row a node a click selects.
import { Gauge, X } from 'lucide-react';
import type { Story } from './author.ts';
import { Button } from './components/ui/button.tsx';
import { fromRef, type Selection } from './shell.ts';
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

const keyed = (label: string) => (ref: string): L.TraceRow => ({ label, ref, key: fromRef(ref)?.key ?? ref });

// The lower section's one panel: its title, its caveat (Knowledge and Pacing) and its rows.
function lower(story: Story, p: L.Lower, a: Act): [title: React.ReactNode, caveat: boolean, rows: React.ReactNode[]] {
  if (p.panel === 'trace') {
    const key = fromRef(p.at)?.key ?? p.at;
    const title = (
      <>
        Trace <code>{key}</code>
      </>
    );
    return [title, false, L.trace(story, p.at).map((r, i) => <NodeButton key={i} r={r} a={a} />)];
  }
  if (p.panel === 'knowledge') {
    const k = K.knowledge(story, p.n);
    const rows = [...k.knows.map(keyed('knows')), ...k.may.map(keyed('may know')), ...k.not.map(keyed('not yet'))];
    return [`Knowledge at beat ${p.n}`, true, rows.map((r, i) => <NodeButton key={i} r={r} a={a} />)];
  }
  const rows = K.pacing(story).map((r) => (
    <p key={r.part} className={`flex h-7 items-center justify-between px-4 ${r.thin ? 'text-warning' : 'text-muted-foreground'}`}>
      <span className="truncate">{r.title ?? `Part ${r.part + 1}`}</span>
      <span>
        {r.words} words{r.thin ? ', thin' : ''}
      </span>
    </p>
  ));
  return ['Pacing', true, rows];
}

export function LowerPanel({ story, p, a }: { story: Story; p: L.Lower; a: Act }) {
  const [title, caveat, rows] = lower(story, p, a);
  const name = p.panel === 'trace' ? 'Trace' : p.panel === 'knowledge' ? 'Knowledge' : 'Pacing';
  return (
    <section aria-label={name} className="max-h-1/2 shrink-0 overflow-auto border-t">
      <header className="flex h-8 items-center justify-between px-2">
        <span>{title}</span>
        <Button variant="ghost" size="icon-xs" aria-label={`Close ${name}`} onClick={() => a.put({ ...a.st, lower: undefined })}>
          <X {...ICONED} />
        </Button>
      </header>
      {caveat ? <p className="px-2 text-xs text-muted-foreground">assumes the beats in outline order</p> : null}
      <ul>
        {rows.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </section>
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
