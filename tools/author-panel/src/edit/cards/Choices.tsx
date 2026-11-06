// The Dialogue card's choice tree (docs/rnd/gui-editor-design-2026-11-04.md §4.4): one folded block
// per choice, its gate badges, its fields added and removed as the compiler accepts them
// (kernel/ts/play/choice.ts), the form's body of them; a choice's key is never renamed.
import { createContext, type ReactNode, useContext, useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import { toFieldPathId } from '@rjsf/utils';
import { added, minimal, refuseKey, removed } from '../../../../../kernel/ts/play/card.ts';
import {
  BADGES,
  choiceMenu,
  nested,
  RENAME,
  refuseRemove,
  withChoice,
} from '../../../../../kernel/ts/play/choice.ts';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import type { useDiagnostics } from '../../author.ts';
import type { Context } from '../fields.tsx';
import { AddMenu, type useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import { HIDE, useSource } from './Room.tsx';

export const LINKS = ['then', 'then_failed'] as const;
const CHOICE = 'DialogueChoice';
// valid only beside the hub's, the quest's or a story's other parts (hub.ex:51-66, exchanges.ex:55-62):
// revealed for the author to tick, the compile answers
const ASKED = ['sitting', 'exchange'];

type Card = ReturnType<typeof useCard>;
type Doc = Record<string, unknown>;

type Def = { properties: Record<string, unknown>; required: string[] };
export const Tree = createContext<{
  card: Card;
  defs: Record<string, never>;
  hidden: string[];
  caps?: object; // undefined while cartridge.json loads: nothing is offered
  context: Context;
  diag: ReturnType<typeof useDiagnostics>;
}>(null!);

/** `choices`, as a tree: one folded block per choice, a new one added by its key. */
export function Choices(p: FieldProps) {
  const { defs } = useContext(Tree);
  const all = (p.formData ?? {}) as Record<string, Doc>;
  const def = defs[CHOICE] as Def;
  const optional = Object.keys(def.properties).filter(
    (f) => !def.required.includes(f) && !(LINKS as readonly string[]).includes(f),
  );
  return (
    <section aria-label="choices" className="grid gap-1">
      <h3 className="font-medium">Choices</h3>
      {Object.entries(all).map(([k, c]) => (
        <Choice key={k} p={p} k={k} c={c} optional={optional} />
      ))}
      <AddChoice all={all} />
    </section>
  );
}

/** A new choice by its key; its label and narration `~` (minimal): the author writes them in the Book. */
function AddChoice({ all }: { all: Record<string, Doc> }) {
  const { card, defs } = useContext(Tree);
  const [key, setKey] = useState('');
  const taken = key ? refuseKey(key, all) : undefined;
  const add = () => {
    card.change(withChoice(card.draft as Doc, key, minimal(defs[CHOICE], defs) as Doc));
    card.commit();
    setKey('');
  };
  return (
    <>
      <div className="flex items-center gap-1">
        <Input
          aria-label="New choice key"
          aria-invalid={!!taken}
          className="h-7 text-xs"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <Act disabled={!key || !!taken} onClick={add}>
          Add choice
        </Act>
      </div>
      {taken ? <Refusal>{taken}</Refusal> : null}
    </>
  );
}

const keep = (e: { preventDefault: () => void }) => e.preventDefault(); // the form's blur would commit first

/** A small button that acts before the form's blur commits. */
const Act = (b: { onClick: () => void; disabled?: boolean; children: ReactNode }) => (
  <Button type="button" size="xs" variant="outline" onMouseDown={keep} {...b} />
);

type ChoiceProps = { p: FieldProps; k: string; c: Doc; optional: string[] };

/** One choice folded: its id, gate badges and links; open, its fields, the form's body of them and
 * its removal. Its label opens in the Book only. */
function Choice({ p, k, c, optional }: ChoiceProps) {
  const { card } = useContext(Tree);
  const [said, setSaid] = useState<string>();
  const seen = (f: string) => Object.hasOwn(c, f) || card.revealed.includes(`choices.${k}.${f}`);
  const ui = Object.fromEntries(
    [...optional.filter((f) => !seen(f)), ...LINKS].map((f) => [f, HIDE]),
  );
  const remove = () => {
    const why = refuseRemove(card.draft as Doc, k);
    setSaid(why);
    if (!why) (card.change(withChoice(card.draft as Doc, k)), card.commit());
  };
  return (
    <details className="rounded border px-2 py-1" aria-label={`choice ${k}`}>
      <Summary k={k} c={c} />
      <div className="grid gap-1 py-1">
        <ChoiceFields
          k={k}
          c={c}
          shown={optional.filter(seen)}
          absent={optional.filter((f) => !seen(f))}
        />
        <Body p={p} k={k} c={c} ui={ui} />
        {LINKS.map((f) => (c[f] && c[f] !== 'end' ? <Nested key={f} to={c[f] as string} /> : null))}
        <div className="flex gap-1">
          <Act onClick={() => setSaid(RENAME)}>Rename</Act>
          <Act onClick={remove}>Remove choice</Act>
        </div>
        {said ? <Refusal>{said}</Refusal> : null}
      </div>
    </details>
  );
}

type FieldsProps = { k: string; c: Doc; shown: string[]; absent: string[] };

/** Choice `k`'s optional fields: each shown one removable, each absent one the compiler accepts addable. */
function ChoiceFields({ k, c, shown, absent }: FieldsProps) {
  const { card, defs, hidden, caps } = useContext(Tree);
  const draft = card.draft as Doc;
  const put = (doc: Doc) => (card.change(doc), card.commit());
  const reveal = (f: string) => {
    card.reveal(`choices.${k}.${f}`);
    const next = ASKED.includes(f) ? undefined : added(c, f, defs, CHOICE);
    if (next) put(withChoice(draft, k, next));
  };
  const drop = (f: string) => (
    card.unreveal(`choices.${k}.${f}`),
    put(withChoice(draft, k, removed(c, f)))
  );
  return (
    <>
      {shown.map((f) => (
        <div key={f} className="flex items-center gap-1">
          <span className="flex-1">{f}</span>
          <Act onClick={() => drop(f)}>Remove</Act>
        </div>
      ))}
      <AddMenu fields={caps ? choiceMenu(draft, k, absent, caps, hidden) : []} reveal={reveal} />
    </>
  );
}

/** A link's target, when a nested set (choice.ts `nested`): its prompt and choice labels read-only
 * and a button to its own card; one level only, a deeper link is that button alone. */
function Nested({ to }: { to: string }) {
  const { context, diag } = useContext(Tree);
  const node = context.nodes.find((n) => n.ref.endsWith(`:dialogue/${to}`));
  const set = nested(useSource(diag, node && context.files?.[node.ref]), to);
  const open = (key: string) => (
    <Act onClick={() => context.open?.({ kind: 'dialogue', key })}>Open {key}</Act>
  );
  if (!set) return null;
  return (
    <section
      aria-label={`nested ${to}`}
      className="grid gap-1 rounded border border-dashed px-2 py-1"
    >
      <div className="flex items-center gap-1">
        <Badge variant="outline">entry: false</Badge>
        {open(to)}
      </div>
      <code className="truncate">{set.prompt}</code>
      {set.choices.map((c, i) => (
        <div key={i} className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate">{c.label}</code>
          {c.then && c.then !== 'end' ? open(c.then) : null}
        </div>
      ))}
    </section>
  );
}

/** A folded choice's line: its id, the gate badges it carries and where it leads. */
function Summary({ k, c }: { k: string; c: Doc }) {
  const then = LINKS.filter((f) => c[f] !== undefined).map((f) => `${f} ${c[f]}`);
  return (
    <summary className="flex flex-wrap items-center gap-1">
      <code>{k}</code>
      {BADGES.filter((f) => Object.hasOwn(c, f)).map((f) => (
        <Badge key={f} variant="outline">
          {f}
        </Badge>
      ))}
      {then.length ? <span className="text-muted-foreground">{then.join(', ')}</span> : null}
    </summary>
  );
}

/** Choice `k`'s fields drawn by the form, `ui` hiding the ones not shown. */
const Body = ({ p, k, c, ui }: { p: FieldProps; k: string; c: Doc; ui: Doc }) => (
  <p.registry.fields.SchemaField
    name={k}
    schema={p.schema.additionalProperties as never}
    uiSchema={{ ...(p.uiSchema?.additionalProperties as Doc), ...ui }}
    fieldPathId={toFieldPathId(k, p.registry.globalFormOptions, p.fieldPathId)}
    formData={c}
    errorSchema={p.errorSchema?.[k] as never}
    onChange={p.onChange}
    onBlur={p.onBlur}
    onFocus={p.onFocus}
    registry={p.registry}
    disabled={p.disabled}
    readonly={p.readonly}
  />
);
