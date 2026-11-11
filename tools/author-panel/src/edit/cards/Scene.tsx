// The Scene cards (docs/rnd/gui-editor-design-2026-11-04.md §4.4, E6d): a `.scene` dialogue's text,
// line by line, its speakers and links picked in place (POST /set) and its words edited in place;
// a modal scene's trigger and treatment picked from the compile's and the schema's (its steps' words
// in the form's words fields).
import { ArrowDown, ArrowUp, Merge, Plus, Split, Trash2, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { refusePick } from '../../../../../kernel/ts/play/card.ts';
import { picks, sceneLines, type Line } from '../../../../../kernel/ts/play/scene_lines.ts';
import { blocks, cut, type Op } from '../../../../../kernel/ts/play/scene_structure.ts';
import { type On } from '../../../../../kernel/ts/play/scene_trigger.ts';
import { ask, type useDiagnostics } from '../../author.ts';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { WordsField, type Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import { RoomForm } from './Room.tsx';
import { Trigger } from './Trigger.tsx';

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Doc = Record<string, unknown>;
type Source = { bytes: string; sha256: string; text: Record<string, string> };

/** A source file's bytes (GET /source; null when there is none), reloaded when changed outside, and
 * its writes: a refusal kept to show boxed, the last write's id kept for Undo (a refusal keeps it). */
function useSource(rel: string, diag: Props['diag']) {
  const [file, setFile] = useState<Source | null>();
  const [undo, setUndo] = useState<string>();
  const [refused, setRefused] = useState<string>();
  const load = useCallback(
    () =>
      fetch(`/__author/source?file=${encodeURIComponent(rel)}`).then(async (r) =>
        setFile(r.ok ? await r.json() : null),
      ),
    [rel],
  );
  useEffect(() => void load(), [load]);
  const outside = diag.changes.find((c) => c.file === rel);
  useEffect(() => {
    if (file !== undefined && outside && outside.sha256 !== file?.sha256) void load();
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps
  const post = async (path: string, sent: object) => {
    const { ok, told } = await ask(path, sent);
    setRefused(ok ? undefined : typeof told === 'string' ? told : 'Changed outside: reloaded.');
    if (ok) setUndo(path === 'undo' ? undefined : (told as { id: string }).id);
    await load();
  };
  const back = undo ? () => void post('undo', { id: undo }) : undefined;
  return { rel, file, post, back, refused };
}

export function SceneText({ rel, context, diag }: Props) {
  const { file, post, back, refused } = useSource(rel, diag);
  if (!file) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  // the last compile's words (GET /source), then the push's changed ones
  const words = { ...file.text, ...diag.text };
  const lines = sceneLines(rel, file.bytes, 'dialogue', words, diag.placeholders ?? {});
  const set: Setter = (l, value) => void post('set', { file: rel, line: l.n, was: l.text, value });
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="scene card">
      <Header rel={rel} diag={diag} undo={back} />
      {refused ? <Refusal boxed>{refused}</Refusal> : null}
      <Lines lines={lines} context={context} set={set} />
    </div>
  );
}

/** The file's lines: a value line its picker, a words line its words field, the rest as written. */
type Setter = (line: Line, value: string) => void;
function Lines({ lines, context, set }: { lines: Line[]; context: Context; set: Setter }) {
  return (
    <ol className="grid gap-1 font-mono">
      {lines.map((l) => (
        // a words line keeps its field (and a draft) when its text changes; a value line remounts
        <li key={l.key ?? `${l.n}:${l.text}`} className="flex min-w-0 items-center gap-2">
          <span className="w-6 shrink-0 text-right text-muted-foreground">{l.n}</span>
          {l.verb ? (
            <Value
              line={l}
              keys={picks(l.verb, context.nodes, context.unlinkable)}
              set={(value) => set(l, value)}
            />
          ) : l.key ? (
            <div className="min-w-0 flex-1">
              <WordsField label="" k={l.key} words={l.text.replace(/^\s*\* /, '')} />
            </div>
          ) : (
            <span className="min-w-0 flex-1 truncate whitespace-pre">{l.text}</span>
          )}
        </li>
      ))}
    </ol>
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

export function ModalScene({ rel, context, diag }: Props) {
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

/** A modal scene's `.cut` pages (docs/design/scene-structure-rulings.md §1, §5): each line as written,
 * a page's item buttons on its first line and Split on each later one; `---` has none. */
function Pages({ source, steps }: { source: ReturnType<typeof useSource>; steps: boolean }) {
  const { file } = source;
  if (!file) return null; // no cut beside this scene
  const lines = file.bytes.split('\n');
  const act = (Icon: LucideIcon, name: string, op: Op) => (
    <Act key={name} Icon={Icon} name={name} op={op} source={source} steps={steps} />
  );
  let page = 0;
  return (
    <ol className="grid gap-1 font-mono" aria-label="pages">
      {blocks(lines).flatMap(([first, last]) => {
        const p = lines[first].trim() === '---' ? 0 : ++page;
        return lines.slice(first, last + 1).map((text, k) => {
          const n = first + k + 1;
          const buttons = !p
            ? null
            : k > 0
              ? act(Split, `Split page ${p} at line ${n}`, { split: n })
              : [
                  act(Plus, `Add after page ${p}`, { add: { after: n, kind: 'page' } }),
                  act(ArrowUp, `Move up page ${p}`, { move: n, by: -1 }),
                  act(ArrowDown, `Move down page ${p}`, { move: n, by: 1 }),
                  act(Merge, `Join page ${p}`, { join: n }),
                  act(Trash2, `Remove page ${p}`, { remove: n }),
                ];
          return (
            <li key={n} className="group flex min-w-0 items-center gap-2">
              <span className="w-6 shrink-0 text-right text-muted-foreground">{n}</span>
              <span className="min-w-0 flex-1 truncate whitespace-pre">{text}</span>
              <span className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                {buttons}
              </span>
            </li>
          );
        });
      })}
    </ol>
  );
}

/** A page op's item button (chrome §7), disabled with the route's own refusal (scene_structure.ts)
 * in its tooltip; the wrapper carries the tooltip, as a disabled button takes no pointer. */
function Act({
  Icon,
  name,
  op,
  source,
  steps,
}: {
  Icon: LucideIcon;
  name: string;
  op: Op;
  source: ReturnType<typeof useSource>;
  steps: boolean;
}) {
  const file = source.file!;
  const answer = cut(file.bytes, op, steps);
  const refused = 'refused' in answer ? answer.refused : undefined;
  const send = { file: source.rel, was: file.sha256, op, carry: [] };
  return (
    <span title={refused ? `${name}: ${refused}` : name}>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={name}
        disabled={!!refused}
        onClick={() => void source.post('restructure', send)}
      >
        <Icon className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
      </Button>
    </span>
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
