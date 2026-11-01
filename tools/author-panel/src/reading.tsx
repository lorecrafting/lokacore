// The panel's reading tabs: the game as the view shows it, why a rule answers as it does, and where
// a key or words live. No game logic here.
import { useState } from 'react';
import { ask, find, type Found } from './author.ts';
import type { Row } from '../../../kernel/ts/play/why_words.ts';
import type { State } from './book.ts';
import { Button } from './components/ui/button.tsx';
import { Input } from './components/ui/input.tsx';
import { Separator } from './components/ui/separator.tsx';
import { Heading } from './sections.tsx';

const Rows = ({ title, rows }: { title: string; rows: [string, string][] }) => (
  <div>
    <Heading>
      {title} ({rows.length})
    </Heading>
    <ul className="space-y-1">
      {rows.map(([name, value]) => (
        <li key={name} className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs">{name}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{value}</span>
        </li>
      ))}
    </ul>
  </div>
);
const Listed = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <Heading>
      {title} ({items.length})
    </Heading>
    <p className="text-sm">{items.join(', ') || 'none'}</p>
  </div>
);

/** The game as the view shows it now, then facts and quests as the kernel holds them. */
export function Facts({ state }: { state?: State }) {
  if (!state) return <p className="text-sm text-muted-foreground">No Book yet</p>;
  const { shown } = state;
  return (
    <div className="space-y-4 text-sm">
      <div>
        <Heading>Room</Heading>
        <p>{shown.room}</p>
      </div>
      <Listed title="People" items={shown.people} />
      <Listed title="Held" items={shown.held} />
      <Rows title="Pools" rows={shown.pools.map((p) => [p.key, `${p.current}/${p.maximum} ${p.band}`])} />
      <Listed title="Statuses" items={shown.statuses.map((s) => s.label)} />
      <div>
        <Heading>Clock</Heading>
        <p className="font-mono text-xs">{JSON.stringify(shown.clock.calendar ?? shown.clock.time)}</p>
      </div>
      {shown.choice ? <Listed title={`Choice: ${shown.choice.prompt}`} items={shown.choice.options} /> : null}
      <Separator />
      <Rows title="Quests" rows={shown.quests.map((q) => [q.quest, q.state])} />
      <Rows title="Facts" rows={Object.entries(state.facts).map(([k, v]) => [k, JSON.stringify(v)])} />
    </div>
  );
}

type Told = { lines: Row[] };
const Answer = ({ name, report }: { name: string; report: Told }) => (
  <div>
    <Heading>{name}</Heading>
    <ul className="space-y-1">
      {report.lines.map((l, i) => (
        <li key={i} style={{ paddingLeft: `${l.depth}rem` }} className={l.ok === false ? 'text-destructive' : ''}>
          {l.ok === 'depends' ? 'depends on the target' : l.ok ? 'yes' : 'no'}: {l.text}
        </li>
      ))}
    </ul>
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">Full report</summary>
      <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
        {JSON.stringify(report, null, 1)}
      </pre>
    </details>
  </div>
);

/** Why an action or dialogue of this room is or is not on offer now (kernel/ts/play/why.ts, over POST /__author/why). */
export function Why({ state, trace }: { state?: State; trace: () => Promise<string[]> }) {
  const [answer, setTold] = useState<{ at: string; key: string; report?: Told; error?: string }>();
  const at = JSON.stringify(state);
  const told = answer?.at === at ? answer : undefined; // true of the world it was asked on, no other
  const why = async (on: 'action' | 'dialogue', key: string) => {
    const rows = await trace();
    ask('why', { trace: rows, [on]: key }).then(
      (r) => setTold(r.ok ? { at, key, report: r.told as Told } : { at, key, error: String(r.told) }),
      (err: Error) => setTold({ at, key, error: err.message }),
    );
  };
  const offers = state?.shown.offers;
  const pick = (on: 'action' | 'dialogue', keys: string[] = []) =>
    keys.map((key) => (
      <Button key={key} variant="outline" size="sm" className="font-mono" onClick={() => void why(on, key)}>
        {key}
      </Button>
    ));
  const none = !offers?.action.length && !offers?.dialogue.length;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <Heading>Why, in this room</Heading>
        {none ? <p className="text-muted-foreground">No actions or dialogues here.</p> : null}
        <div className="flex flex-wrap gap-1">
          {pick('action', offers?.action)}
          {pick('dialogue', offers?.dialogue)}
        </div>
      </div>
      {told?.error ? <p className="text-destructive">{told.error}</p> : null}
      {told?.report ? <Answer name={told.key} report={told.report} /> : null}
    </div>
  );
}

const Results = ({ found }: { found: Found }) => (
  <>
    <div>
      <Heading>Referred to by ({found.refs.length})</Heading>
      <ul className="space-y-1 font-mono text-xs">
        {found.refs.map((r) => (
          <li key={`${r.by} ${r.kind}`}>
            {r.by} ({r.kind}){r.at ? ` ${r.at}` : ''}
          </li>
        ))}
      </ul>
    </div>
    <div>
      <Heading>
        Lines ({found.hits.length < found.total ? `first ${found.hits.length} of ${found.total}` : found.total})
      </Heading>
      <ul className="space-y-1">
        {found.hits.map((h) => (
          <li key={h.at}>
            <div className="font-mono text-xs text-muted-foreground">{h.at}</div>
            <div className="break-words">{h.text}</div>
          </li>
        ))}
      </ul>
    </div>
  </>
);

/** A key or words to every source line, and who refers to that key. */
export function Find() {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found>();
  const [note, setNote] = useState('');
  const search = () =>
    find(q).then(
      (f) => {
        setFound(f);
        setNote('');
      },
      (err: Error) => setNote(`Find failed: ${err.message}`),
    );
  return (
    <div className="space-y-3 text-sm">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Input aria-label="Key or words" placeholder="key or words" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={!q}>
          Find
        </Button>
      </form>
      {note ? <p className="text-destructive">{note}</p> : null}
      {found ? <Results found={found} /> : null}
    </div>
  );
}
