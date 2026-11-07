// The generic card's hand-built fields (docs/rnd/gui-editor-design-2026-11-04.md §4.5, §11): they
// draw only; the logic is kernel/ts/play/card.ts. The walker names them by `ui:field`.
import { useEffect, useRef, useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import { choices, pickKind, proseKey, refusePick } from '../../../../kernel/ts/play/card.ts';
import type { Triggers } from '../../../../kernel/ts/play/scene_trigger.ts';
import { oneLine, saving } from '../../../../mobile/app/author/prose_rules.ts';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Combat } from './blocks/Combat.tsx';
import { Rules } from './blocks/Rules.tsx';
import { Schedule } from './blocks/Schedule.tsx';
import { Refusal } from './templates.tsx';

/** What the fields read beyond rjsf's props: the selection, the story's nodes and the Book. */
export type Context = {
  kind: string;
  key: string;
  nodes: { ref: string; kind: string }[];
  hours?: number; // the calendar's hours_per_day, when the cartridge has one
  room?: unknown; // the NPC's own room: an added hour's first value
  put?: (field: string, value: unknown) => void; // writes a field and commits it
  hidden?: string[]; // the story model's (kernel/ts/play/story_counts.ts)
  unlinkable?: Record<string, string>;
  triggers?: Triggers; // what a modal scene may start on (kernel/ts/play/scene_trigger.ts)
  files?: Record<string, string>; // each node's source file, by ref
  held?: number; // the items placed in the selection (kernel/ts/play/card.ts held)
  open?: (sel: { kind: string; key: string }) => void; // selects another definition's card
  stale?: boolean; // the last compile failed: pickers offer the last good compile's keys
};
const context = (p: FieldProps) => p.registry.formContext as Context;

/** Prose: the text key's words, edited in place (agents write no words). */
function TextKey(p: FieldProps) {
  const { kind, key } = context(p);
  const { path } = p.fieldPathId;
  const k = proseKey(p.formData, kind, key, path);
  if (path[0] === 'choices' && path.at(-1) === 'label')
    // a choice label is its key: POST /edit refuses it (gui-editor-design ruling 11)
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{p.name}</span>
        <code className="min-w-0 truncate">{k}</code>
      </div>
    );
  return <WordsField key={k} label={p.name} k={k} words={inline(p.formData)} />;
}
/** An inline prose marker's words (docs/system/cartridge.md "Inline prose"): GET /line's hint. */
export const inline = (value: unknown) => (value as { prose?: string } | undefined)?.prose ?? '';

type At = { file: string; line: number; was: string; words: string };
async function api(path: string, sent?: object): Promise<[number, any]> {
  const r = await fetch(`/__author${path}`, sent && { method: 'POST', body: JSON.stringify(sent) });
  return [r.status, await r.json().catch(() => null)];
}
const lineOf = (key: string, words: string) =>
  api(`/line?key=${encodeURIComponent(key)}&words=${encodeURIComponent(words)}`);

type Told = { say: string; theirs?: At };
async function conflict(k: string, mine: At): Promise<Told> {
  const [s, theirs] = await lineOf(k, mine.words);
  const say = 'Changed on disk since you opened it.';
  return s === 200 ? { say: `${say} ${theirs.words}`, theirs } : { say };
}

function useLine(k: string, words: string) {
  const [at, setAt] = useState<At>();
  const [draft, setDraft] = useState('');
  const [told, setTold] = useState<Told>();
  const busy = useRef(false); // Enter's save, then the blur after it, sends one /edit
  const [out, setOut] = useState(false); // read-only meanwhile: no words typed over the save
  const dirty = at !== undefined && draft !== at.words;
  const kept = useRef(dirty);
  kept.current = dirty;
  // `fresh`: after a save or Take theirs; a card's redraw re-reads too, and never over a draft
  const read = async (w: string, fresh = false) => {
    const [status, line] = await lineOf(k, w);
    if (kept.current && !fresh) return;
    if (status !== 200) return setTold({ say: typeof line === 'string' ? line : `No line (${status}).` });
    setAt(line);
    setDraft(line.words);
    setTold(undefined);
  };
  useEffect(() => void read(words), [k, words]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (mine = at) => {
    if (!mine || busy.current) return;
    const choice = saving(draft, mine.words);
    if (choice === 'unchanged') return mine === at ? undefined : read(mine.words, true); // Keep mine == theirs
    if (choice === 'empty') return setTold({ say: 'Empty. Write ~ to leave it unwritten.' });
    busy.current = true;
    setOut(true);
    try {
      const [status, answer] = await api('/edit', { ...mine, words: draft, key: k });
      if (status === 200) await read(draft, true);
      else if (status === 409) setTold(await conflict(k, mine));
      else setTold({ say: typeof answer === 'string' ? answer : `Not saved (${status}).` });
    } finally {
      busy.current = false;
      setOut(false);
    }
  };
  return { at, draft, setDraft, told, theirs: told?.theirs, setTold, read, save, out };
}

/**
 * A words line edited on the card as the Book's field edits it (mobile/app/author/inbook.ts save,
 * conflict): GET /line reads the file's line, Enter or leaving saves it once through POST /edit's
 * `was` guard, Esc puts it back; a refusal or a conflict keeps the draft. `words` finds the line
 * (a scene's or an inline marker's words; a `"key":` line needs none).
 */
export function WordsField({ label, k, words }: { label: string; k: string; words: string }) {
  const { at, draft, setDraft, told, theirs, setTold, read, save, out } = useLine(k, words);
  return (
    <div className="grid min-w-0 gap-1 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        {label ? <span className="text-muted-foreground">{label}</span> : null}
        <Input
          aria-label={`${label || k} words`}
          title={k}
          className="h-7 flex-1 text-xs"
          disabled={!at}
          readOnly={out}
          value={draft}
          onChange={(e) => setDraft(oneLine(e.target.value))}
          onBlur={() => theirs || void save()} // a shown conflict waits for Keep mine
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // the card's form must not submit
              void save();
            } else if (e.key === 'Escape' && at && !theirs) {
              e.preventDefault();
              setDraft(at.words);
              setTold(undefined);
            }
          }}
        />
      </div>
      {told ? <Refusal>{told.say}</Refusal> : null}
      {theirs ? <Theirs keep={() => void save(theirs)} take={() => void read(theirs.words, true)} /> : null}
    </div>
  );
}
const Theirs = ({ keep, take }: { keep: () => void; take: () => void }) => (
  <div className="flex gap-1">
    <Button type="button" size="xs" variant="outline" onClick={keep}>
      Keep mine
    </Button>
    <Button type="button" size="xs" variant="outline" onClick={take}>
      Take theirs
    </Button>
  </div>
);

/** A picker's name, marked stale while the last compile failed: its keys are the last good compile's. */
export const FieldName = (p: FieldProps) => (
  <span className="text-muted-foreground">
    {p.name}
    {context(p).stale ? <span className="text-warning"> stale</span> : null}
  </span>
);

/** Picker: a definition key, offered from the story's nodes of the kind the field's path names; an
 * unknown one is refused at the field and never reaches the draft. */
function DefinitionRef(p: FieldProps) {
  const list = `${p.fieldPathId.$id}-keys`;
  const kind = pickKind(p.fieldPathId.path);
  const keys = choices(kind, context(p).nodes);
  const [bad, setBad] = useState<string>(); // a refused id: shown, never sent
  const [kept, keep] = useState<unknown>(); // the value at focus: a refused keystroke puts it back
  if (p.formData !== undefined && typeof p.formData !== 'string')
    return <code className="text-xs">{JSON.stringify(p.formData)}</code>; // a global ref: edit as text
  const refused = bad === undefined ? undefined : refusePick({ kind, keys }, bad);
  return (
    <label className="grid gap-1 text-xs">
      <FieldName {...p} />
      <Input
        id={p.fieldPathId.$id}
        list={list}
        className="h-7 text-xs"
        value={bad ?? p.formData ?? ''}
        aria-invalid={!!refused}
        onChange={(e) => {
          const v = e.target.value;
          const no = refusePick({ kind, keys }, v);
          setBad(no ? v : undefined);
          p.onChange(no ? kept : v || undefined, p.fieldPathId.path);
        }}
        onFocus={() => keep(p.formData)}
        onBlur={(e) => p.onBlur(p.fieldPathId.$id, e.target.value)}
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

/** A field the definition does not have yet: nothing until the add menu reveals it. */
const Hidden = () => null;

export const fields = {
  TextKey,
  DefinitionRef,
  Policy: Rules,
  Step: Rules,
  AnyOfField: Rules,
  OneOfField: Rules,
  Hidden,
  Combat,
  Schedule,
};
