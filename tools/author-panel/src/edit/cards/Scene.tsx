// The Scene cards (docs/rnd/gui-editor-design-2026-11-04.md §4.4, E6d): a `.scene` dialogue's text,
// line by line, its speakers and links picked in place (POST /set) and its words edited in place;
// a modal scene's trigger and treatment picked from the compile's and the schema's (its steps' words
// in the form's words fields).
import { useCallback, useState } from 'react';
import { refusePick } from '../../../../../kernel/ts/play/card.ts';
import { picks, sceneLines, type Line } from '../../../../../kernel/ts/play/scene_lines.ts';
import { landed } from '../../../../../kernel/ts/play/scene_focus.ts';
import { rows, type Op } from '../../../../../kernel/ts/play/scene_structure.ts';
import { type On } from '../../../../../kernel/ts/play/scene_trigger.ts';
import { Input } from '../../components/ui/input.tsx';
import { WordsField, type Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import { RoomForm } from './Room.tsx';
import { lineKey, RowMenu, useLanded, type Landing, type Rower } from './SceneRows.tsx';
import { type Doc, type SceneProps, useSource } from './SceneSource.ts';
import { Pages } from './ScenePages.tsx';
import { Trigger } from './Trigger.tsx';

export function SceneText({ rel, context, diag }: SceneProps) {
  const { file, post, back, refused } = useSource(rel, diag);
  if (!file) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  // the last compile's words (GET /source), then the push's changed ones
  const words = { ...file.text, ...diag.text };
  const lines = sceneLines(rel, file.bytes, 'dialogue', words, diag.placeholders ?? {});
  const set: Setter = (l, value) => void post('set', { file: rel, line: l.n, was: l.text, value });
  // one op is one journal entry: the row buttons and the keys both come here. Focus follows the op
  // (rulings §5) onto the moved, added or gap-closing row. `/restructure` renumbers lines, so landed()
  // answers from the bytes the op was sent against, before the reload replaces them.
  const [focus, setFocus] = useState<Landing>();
  const op = useCallback(
    async (o: Op) => {
      const before = file.bytes.split('\n');
      if (await post('restructure', { file: rel, was: file.sha256, op: o, carry: [] })) {
        setFocus(landed(before, o) ?? undefined);
      }
    },
    [file, rel],
  );
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="scene card">
      <Header rel={rel} diag={diag} undo={back} />
      {refused ? <Refusal boxed>{refused}</Refusal> : null}
      <Lines lines={lines} context={context} set={set} op={op} bytes={file.bytes} focus={focus} />
    </div>
  );
}

/** The file's lines, each with its row buttons (rulings §1, §5). */
type Setter = (line: Line, value: string) => void;
function Lines({
  lines,
  context,
  set,
  op,
  bytes,
  focus,
}: Rows & { lines: Line[]; context: Context; focus?: Landing }) {
  const rs = rows(bytes.split('\n'));
  return (
    <ol className="grid gap-1 font-mono">
      {lines.map((l) => (
        // a words line keeps its field (and a draft) when its text changes; a value line remounts
        <Row
          key={l.key ?? `${l.n}:${l.text}`}
          l={l}
          context={context}
          set={set}
          op={op}
          rs={rs}
          focus={focus}
        />
      ))}
    </ol>
  );
}

type Rows = { set: Setter; op: Rower; bytes: string };
/** One line: a value line its picker, a words line its words field, the rest as written. The row an
 * op left takes focus once the reload lands (rulings §5), so the caret does not fall back to the top. */
function Row({
  l,
  context,
  set,
  op,
  rs,
  focus,
}: Pick<Rows, 'set' | 'op'> & {
  l: Line;
  context: Context;
  rs: ReturnType<typeof rows>;
  focus?: Landing;
}) {
  const here = focus?.n === l.n;
  return (
    <li
      ref={useLanded(here)}
      tabIndex={here ? -1 : undefined}
      className="group flex min-w-0 items-center gap-2"
      onKeyDown={(e) => lineKey(e, l.n, op)}
    >
      <span className="w-6 shrink-0 text-right text-muted-foreground">{l.n}</span>
      {l.verb ? (
        <Value line={l} keys={picks(l.verb, context.nodes, context.unlinkable)} set={(v) => set(l, v)} />
      ) : l.key ? (
        <div className="min-w-0 flex-1">
          <WordsField label="" k={l.key} words={l.text.replace(/^\s*\* /, '')} />
        </div>
      ) : (
        <span className="min-w-0 flex-1 truncate whitespace-pre">{l.text}</span>
      )}
      <span className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <RowMenu n={l.n} rs={rs} op={op} />
      </span>
    </li>
  );
}

/** A value line: its key picked from the compile's; an unknown one is refused here, never sent. */
function Value({ line, keys, set }: { line: Line; keys: string[]; set: (value: string) => void }) {
  const [value, setValue] = useState(line.value!);
  const list = `scene-${line.n}-keys`;
  const refused = refusePick({ kind: line.verb!, keys }, value);
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="whitespace-pre text-muted-foreground">
        {line.text.slice(0, line.text.indexOf(':') + 1)}
      </span>
      <Input
        list={list}
        aria-label={`line ${line.n} ${line.verb}`}
        className="h-7 text-xs"
        value={value}
        aria-invalid={!!refused}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== line.value && !refused && set(value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <datalist id={list}>
        {keys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {refused ? <Refusal>{refused}</Refusal> : null}
    </label>
  );
}

/** The schema's treatments for a modal scene (book-ui.md, Book treatments). */
const treatments = (defs: Record<string, never>) =>
  ((defs['source.SceneDefinition'] as { anyOf?: { properties?: Doc }[] } | undefined)?.anyOf ?? [])
    .map((b) => (b.properties?.treatment as { enum?: string[] } | undefined)?.enum)
    .find(Boolean) ?? [];

export function ModalScene({ rel, context, diag }: SceneProps) {
  const card = useCard(rel, diag);
  const cut = useSource(rel.replace(/\.json$/, '.cut'), diag);
  const draft = (card.draft ?? {}) as Doc;
  const defs = (card.saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  if (!card.saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const modal = draft.control === 'modal'; // a presentation-only scene's `on: {rest}` stays the form's
  const pick = (t: string) => {
    const { treatment: _, ...rest } = draft;
    card.change(t ? { ...rest, treatment: t } : rest);
    card.commit();
  };
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="scene card">
      {/* ponytail: the cut's last op undoes first, then the form's; an order across both needs one stack */}
      <Header rel={rel} diag={diag} undo={cut.back ?? (card.undo ? card.back : undefined)} />
      {cut.refused ? <Refusal boxed>{cut.refused}</Refusal> : null}
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Pages source={cut} steps={'steps' in (card.saved.doc as Doc)} />
      {modal ? (
        <>
          <Trigger
            on={(draft.on ?? {}) as On}
            context={context}
            put={(on) => (card.change({ ...draft, on }), card.commit())}
          />
          <Treatment value={draft.treatment} of={treatments(defs)} pick={pick} />
        </>
      ) : null}
      <RoomForm
        rel={rel}
        card={card}
        context={context}
        diag={diag}
        defs={defs}
        own={modal ? ['treatment', 'on'] : ['treatment']}
      />
    </div>
  );
}

/** A modal scene's treatment: none, or one the schema lists. */
function Treatment({
  value,
  of,
  pick,
}: {
  value: unknown;
  of: string[];
  pick: (t: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground">treatment</span>
      <select
        aria-label="treatment"
        className="form-control"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="">none</option>
        {of.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
