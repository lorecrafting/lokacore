// The World card (docs/rnd/gui-editor-design-2026-11-04.md §6, E6e): cartridge.json's settings,
// resources.json, attributes.json, and each population, transport and barrier definition. Every
// write is the generic card's (useCard: POST /change, Undo, Hold, refusals at the field); its
// reference fields are pickers that refuse a key no definition (or root-file entry) has.
import { useEffect, useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import {
  ROOTS,
  addable,
  entered,
  fieldErrors,
  hidden,
  newEntry,
  pickable,
  refuseKey,
  refusePick,
  rootNames,
  rootStamp,
  worldFile,
} from '../../../../../kernel/ts/play/card.ts';
import { uiSchema } from '../../../../../kernel/ts/play/ui_schema.ts';
import type { useDiagnostics } from '../../author.ts';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { FieldName, fields, type Context } from '../fields.tsx';
import { AddMenu, CardForm, Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';

type Diag = ReturnType<typeof useDiagnostics>;
type Named = Record<string, string[]>; // resource and attribute keys, from the root files
type Props = { rel: string; context: Context; diag: Diag };
type Entries = Record<string, Record<string, unknown>>;

export function World({ rel, context, diag }: Props) {
  const named = useNamed(diag);
  if (!worldFile(rel, true))
    return <Settings rel={rel} context={context} diag={diag} named={named} />; // mutate-skip: draw; the choice is worldFile(rel, true), pinned in card.test.ts
  return (
    <div className="grid gap-3" aria-label="World card">
      <Settings rel="cartridge.json" context={context} diag={diag} named={named} />
      {ROOTS.map((r) => (
        <Keyed key={r.rel} {...r} diag={diag} />
      ))}
    </div>
  );
}

/** The resource and attribute keys the root files hold now (refetched after a write to either). */
function useNamed(diag: Diag): Named {
  const [named, setNamed] = useState<Named>({});
  const stamp = rootStamp(diag.changes);
  useEffect(() => {
    const doc = async ({ rel }: (typeof ROOTS)[number]) => {
      const r = await fetch(`/__author/source?file=${rel}`);
      return r.ok ? JSON.parse((await r.json()).bytes) : {}; // mutate-skip: the fetch, walked in Chrome; its keys are rootNames'
    };
    void Promise.all(ROOTS.map(doc)).then((docs) => setNamed(rootNames(docs)));
  }, [stamp]);
  return named; // mutate-skip: the hook's result; its keys are rootNames', pinned in card.test.ts
}

/** A reference field with a known kind: offers its keys and refuses any other at the field. */
function Pick(p: FieldProps) {
  const { nodes, named } = p.registry.formContext as Context & { named: Named };
  const [text, setText] = useState<string>();
  const pick = pickable(p.fieldPathId.path, nodes, named, p.formData);
  if (!pick)
    return <fields.DefinitionRef {...p} />; // a free field, or a global ref
  const shown = text ?? p.formData ?? '';
  const refused = refusePick(pick, shown);
  const list = `${p.fieldPathId.$id}-keys`;
  return (
    <label className="grid gap-1 text-xs">
      <FieldName {...p} />
      <Input
        id={p.fieldPathId.$id}
        list={list}
        className="h-7 text-xs"
        aria-invalid={!!refused}
        value={shown}
        onChange={(e) => {
          // only a refused key is held here: an accepted one is the form's, so Undo or a reload shows
          const no = refusePick(pick, e.target.value);
          setText(no ? e.target.value : undefined);
          if (!no) p.onChange(entered(e.target.value), p.fieldPathId.path);
        }}
        onBlur={(e) => p.onBlur(p.fieldPathId.$id, e.target.value)}
      />
      <datalist id={list}>
        {pick.keys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {refused ? <Refusal>{refused}</Refusal> : null}
    </label>
  );
}
const picking = { ...fields, DefinitionRef: Pick };

/** One file's form: the generic card's, its reference fields the refusing picker. */
function Settings({ rel, context, diag, named }: Props & { named: Named }) {
  const card = useCard(rel, diag);
  const { saved, draft } = card;
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>; // mutate-skip: a loading line, draw only
  const defs = (saved.schema as { $defs: never }).$defs;
  // an empty registry: the card's own fields draw as the generic walker draws them
  const ui = hidden(uiSchema(saved.dir, saved.schema as never, defs, {}), saved.dir, registry, draft, card.revealed);
  const withNamed = { ...context, named };
  return (
    <section className="grid gap-2 px-3 text-xs" aria-label={rel}>
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <CardForm rel={rel} card={card} context={withNamed} diag={diag} ui={ui} fields={picking} />
      <AddMenu fields={addable(saved.dir, registry, draft, card.revealed)} reveal={card.reveal} />
    </section>
  );
}

/** resources.json or attributes.json: each entry's numbers, removable, and a new entry by key. */
function Keyed({ rel, field, blank, diag }: (typeof ROOTS)[number] & { diag: Diag }) {
  const card = useCard(rel, diag);
  const [key, setKey] = useState('');
  const [refused, setRefused] = useState<string>();
  if (!card.saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>; // mutate-skip: a loading line, draw only
  const doc = (card.draft ?? {}) as Record<string, Entries>;
  const rows = doc[field] ?? {};
  const errors = (fieldErrors((diag.diagnostics ?? []) as never, rel)[field] ?? {}) as Record<string, any>;
  const put = (next: Entries) => card.change({ ...doc, [field]: next });
  const add = () => {
    const no = refuseKey(key, rows);
    setRefused(no);
    if (!no) (put({ ...rows, [key]: newEntry({ rel, field, blank }, key) }), card.commit(), setKey(''));
  };
  const remove = (k: string) => {
    const { [k]: _gone, ...rest } = rows;
    (put(rest), card.commit());
  };
  const one = field.slice(0, -1); // mutate-skip: a label word (resources: resource)
  return (
    <section className="grid gap-2 px-3 text-xs" aria-label={rel}>
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      {Object.keys(rows).length ? null : <p className="text-muted-foreground">No {field} yet.</p>}
      {Object.entries(rows).map(([k, row]) => (
        <Row key={k} id={k} row={row} blank={blank} errors={errors[k]} commit={card.commit} remove={() => remove(k)} set={(r) => put({ ...rows, [k]: r })} />
      ))}
      <form className="flex items-center gap-1" onSubmit={(e) => (e.preventDefault(), add())}>
        <Input aria-label={`New ${one} key`} aria-invalid={!!refused} className="h-7 flex-1 text-xs" value={key} onChange={(e) => setKey(e.target.value)} />
        <Button type="submit" size="xs" variant="outline" onMouseDown={keep}>
          Add {one}
        </Button>
      </form>
      {refused ? <Refusal>{refused}</Refusal> : null}
    </section>
  );
}

// a click keeps focus: a blur's commit and the click's own would both post from one sha (the second refused)
const keep = (e: { preventDefault: () => void }) => e.preventDefault();

type RowProps = {
  id: string;
  row: Record<string, unknown>;
  blank: Record<string, number>;
  errors?: Record<string, { __errors: string[] }>;
  commit: () => void;
  remove: () => void;
  set: (row: Record<string, unknown>) => void;
};

/** One entry: its required numbers (a field the card does not draw is kept and named). */
function Row({ id, row, blank, errors, commit, remove, set }: RowProps) {
  const other = Object.keys(row).filter((f) => !(f in blank));
  return (
    <fieldset className="grid gap-1" onBlur={commit}>
      <legend className="flex w-full items-center font-medium">
        <span className="flex-1">{id}</span>
        <Button type="button" size="xs" variant="ghost" aria-label={`Remove ${id}`} onMouseDown={keep} onClick={remove}>
          Remove
        </Button>
      </legend>
      <div className="grid grid-cols-4 gap-1">
        {Object.keys(blank).map((f) => (
          <label key={f} className="grid gap-1">
            <span className="text-muted-foreground">{f} *</span>
            <Input
              type="number"
              className="h-7 text-xs"
              aria-invalid={!!errors?.[f]}
              value={String(row[f] ?? '')}
              onChange={(e) => set({ ...row, [f]: entered(e.target.value, true) })}
            />
            {errors?.[f] ? <Refusal>{errors[f].__errors.join(' ')}</Refusal> : null}
          </label>
        ))}
      </div>
      {other.length ? <p className="text-muted-foreground">also {other.join(', ')}</p> : null}
    </fieldset>
  );
}
