// The Scene cards (docs/rnd/gui-editor-design-2026-11-04.md §4.4, E6d): a `.scene` dialogue's text,
// line by line, its speakers and links picked in place (POST /set) and its words opened in the Book;
// a modal scene's treatment picked from the schema's (its steps' words keep the form's Book edit).
import { useCallback, useEffect, useState } from 'react';
import { choices, refusePick } from '../../../../../kernel/ts/play/card.ts';
import { sceneLines, type Line } from '../../../../../kernel/ts/play/scene_lines.ts';
import { ask, type useDiagnostics } from '../../author.ts';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import type { Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import { RoomForm } from './Room.tsx';

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Doc = Record<string, unknown>;

/** The keys a value line's verb picks: the compile's NPCs, or its dialogues and `end`. */
const picks = (verb: string, nodes: Context['nodes']) =>
  verb === 'then' ? [...choices('dialogue', nodes), 'end'] : choices('npc', nodes);

export function SceneText({ rel, context, diag }: Props) {
  const [file, setFile] = useState<{ bytes: string; sha256: string }>();
  const [undo, setUndo] = useState<string>();
  const [refused, setRefused] = useState<string>();
  const load = useCallback(
    () => fetch(`/__author/source?file=${encodeURIComponent(rel)}`).then(async (r) => setFile(await r.json())),
    [rel],
  );
  useEffect(() => void load(), [load]);
  const outside = diag.changes.find((c) => c.file === rel);
  useEffect(() => {
    if (file && outside && outside.sha256 !== file.sha256) void load();
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!file) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const post = async (path: string, sent: object) => {
    const { ok, told } = await ask(path, sent);
    setRefused(ok ? undefined : typeof told === 'string' ? told : 'Changed outside: reloaded.');
    setUndo(ok && path === 'set' ? (told as { id: string }).id : undefined);
    await load();
  };
  const lines = sceneLines(rel, file.bytes, 'dialogue', diag.text ?? {}, diag.placeholders ?? {});
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="scene card">
      <Header rel={rel} diag={diag} undo={undo ? () => void post('undo', { id: undo }) : undefined} />
      {refused ? <Refusal boxed>{refused}</Refusal> : null}
      <Lines lines={lines} context={context} set={(l, value) => post('set', { file: rel, line: l.n, was: l.text, value })} />
    </div>
  );
}

/** The file's lines: a value line its picker, a words line its Book edit, the rest as written. */
type Setter = (line: Line, value: string) => void;
function Lines({ lines, context, set }: { lines: Line[]; context: Context; set: Setter }) {
  return (
    <ol className="grid gap-1 font-mono">
      {lines.map((l) => (
        <li key={`${l.n}:${l.text}`} className="flex min-w-0 items-center gap-2">
          <span className="w-6 shrink-0 text-right text-muted-foreground">{l.n}</span>
          {l.verb ? (
            <Value line={l} keys={picks(l.verb, context.nodes)} set={(value) => set(l, value)} />
          ) : (
            <span className="min-w-0 flex-1 truncate whitespace-pre">{l.text}</span>
          )}
          {l.key ? (
            <Button type="button" size="xs" variant="outline" onClick={() => context.edit(l.key!)}>
              Edit in Book
            </Button>
          ) : null}
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
      <span className="whitespace-pre text-muted-foreground">{line.text.slice(0, line.text.indexOf(':') + 1)}</span>
      <Input
        list={list}
        aria-label={`line ${line.n} ${line.verb}`}
        className="h-7 text-xs"
        value={value}
        aria-invalid={!!refused}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== line.value && !refused && set(value)}
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
  const draft = (card.draft ?? {}) as Doc;
  const defs = (card.saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  if (!card.saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const pick = (t: string) => {
    const { treatment: _, ...rest } = draft;
    card.change(t ? { ...rest, treatment: t } : rest);
    card.commit();
  };
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="scene card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      {draft.control === 'modal' ? (
        <Treatment value={draft.treatment} of={treatments(defs)} pick={pick} />
      ) : null}
      <RoomForm rel={rel} card={card} context={context} diag={diag} defs={defs} own={['treatment']} />
    </div>
  );
}

/** A modal scene's treatment: none, or one the schema lists. */
function Treatment({ value, of, pick }: { value: unknown; of: string[]; pick: (t: string) => void }) {
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
