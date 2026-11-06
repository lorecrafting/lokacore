// The generic card's hand-built fields (docs/rnd/gui-editor-design-2026-11-04.md §4.5, §11): they
// draw only; the logic is kernel/ts/play/card.ts. The walker names them by `ui:field`.
import { useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import { choices, pickKind, proseKey, refusePick } from '../../../../kernel/ts/play/card.ts';
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
  edit: (key: string) => void;
  hours?: number; // the calendar's hours_per_day, when the cartridge has one
  room?: unknown; // the NPC's own room: an added hour's first value
  put?: (field: string, value: unknown) => void; // writes a field and commits it
  hidden?: string[]; // the story model's (kernel/ts/play/story_counts.ts)
  unlinkable?: Record<string, string>;
  files?: Record<string, string>; // each node's source file, by ref
  open?: (sel: { kind: string; key: string }) => void; // selects another definition's card
  stale?: boolean; // the last compile failed: pickers offer the last good compile's keys
};
const context = (p: FieldProps) => p.registry.formContext as Context;

/** Prose: the text key, and a button that opens it in the Book's edit (agents write no words). */
function TextKey(p: FieldProps) {
  const { kind, key, edit } = context(p);
  const k = proseKey(p.formData, kind, key, p.fieldPathId.path);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{p.name}</span>
      <code className="min-w-0 truncate">{k}</code>
      <Button type="button" size="xs" variant="outline" onClick={() => edit(k)}>
        Edit in Book
      </Button>
    </div>
  );
}

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
