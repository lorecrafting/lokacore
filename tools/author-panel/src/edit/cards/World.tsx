// The World card (docs/rnd/gui-editor-design-2026-11-04.md §6, E6e): cartridge.json's settings,
// resources.json, attributes.json, and each population, transport and barrier definition. Every
// write is the generic card's (useCard: POST /change, Undo, Hold, refusals at the field); its
// reference fields are pickers that refuse a key no definition (or root-file entry) has.
import { useEffect, useState } from 'react';
import Form from '@rjsf/core';
import type { FieldProps } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
  FORM_DEFAULTS,
  addable,
  fieldErrors,
  hidden,
  pickable,
  refuseKey,
  refusePick,
} from '../../../../../kernel/ts/play/card.ts';
import { uiSchema } from '../../../../../kernel/ts/play/ui_schema.ts';
import type { useDiagnostics } from '../../author.ts';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { fields, type Context } from '../fields.tsx';
import { AddMenu, Header, useCard } from '../Generic.tsx';
import { Refusal, templates } from '../templates.tsx';
import registry from '../registry.json';

const validator = customizeValidator({ AjvClass: Ajv2020 });
type Diag = ReturnType<typeof useDiagnostics>;
type Named = Record<string, string[]>; // resource and attribute keys, from the root files
type Props = { rel: string; context: Context; diag: Diag };
type Entries = Record<string, Record<string, unknown>>;
// a new entry's least fields (the compiler's ResourceSpec and AttributeSpec), all numbers
const ROOTS: { rel: string; field: string; blank: Record<string, number> }[] = [
  { rel: 'resources.json', field: 'resources', blank: { minimum: 0, maximum: 0, start: 0, gain: 0 } },
  { rel: 'attributes.json', field: 'attributes', blank: { start: 0 } },
];

/** The world files the card opens: the root three, or one population, transport or barrier. */
export const WORLD = /^(cartridge|resources|attributes)\.json$|(^|\/)(populations|transports|barriers)\/[^/]+\.json$/;

export function World({ rel, context, diag }: Props) {
  const named = useNamed(diag);
  if (!/^(cartridge|resources|attributes)\.json$/.test(rel))
    return <Settings rel={rel} context={context} diag={diag} named={named} />;
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
  const stamp = diag.changes
    .filter((c) => ROOTS.some((r) => r.rel === c.file))
    .map((c) => c.sha256)
    .join();
  useEffect(() => {
    const keys = async ({ rel, field }: (typeof ROOTS)[number]) => {
      const r = await fetch(`/__author/source?file=${rel}`);
      const doc = r.ok ? JSON.parse((await r.json()).bytes) : {};
      return [field.slice(0, -1), Object.keys(doc[field] ?? {})];
    };
    void Promise.all(ROOTS.map(keys)).then((e) => setNamed(Object.fromEntries(e)));
  }, [stamp]);
  return named;
}

/** A reference field with a known kind: offers its keys and refuses any other at the field. */
function Pick(p: FieldProps) {
  const { nodes, named } = p.registry.formContext as Context & { named: Named };
  const [text, setText] = useState<string>();
  const pick = pickable(p.fieldPathId.path, nodes, named);
  if (!pick || (p.formData !== undefined && typeof p.formData !== 'string'))
    return <fields.DefinitionRef {...p} />; // a free field, or a global ref
  const shown = text ?? p.formData ?? '';
  const refused = refusePick(pick, shown);
  const list = `${p.fieldPathId.$id}-keys`;
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{p.name}</span>
      <Input
        id={p.fieldPathId.$id}
        list={list}
        className="h-7 text-xs"
        aria-invalid={!!refused}
        value={shown}
        onChange={(e) => {
          setText(e.target.value);
          if (!refusePick(pick, e.target.value))
            p.onChange(e.target.value || undefined, p.fieldPathId.path);
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
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const defs = (saved.schema as { $defs: never }).$defs;
  // an empty registry: the card's own fields draw as the generic walker draws them
  const ui = hidden(uiSchema(saved.dir, saved.schema as never, defs, {}), saved.dir, registry, draft, card.revealed);
  return (
    <section className="grid gap-2 px-3 text-xs" aria-label={rel}>
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <div onBlur={card.commit}>
        <Form
          schema={saved.schema}
          uiSchema={ui}
          formData={draft}
          validator={validator}
          fields={picking}
          templates={templates}
          showErrorList={false}
          formContext={{ ...context, named }}
          experimental_defaultFormStateBehavior={FORM_DEFAULTS}
          extraErrors={fieldErrors((diag.diagnostics ?? []) as never, rel) as never}
          onChange={(e) => card.change(e.formData)}
          onSubmit={card.commit}
        >
          <span />
        </Form>
      </div>
      <AddMenu fields={addable(saved.dir, registry, draft, card.revealed)} reveal={card.reveal} />
    </section>
  );
}

/** resources.json or attributes.json: each entry's numbers, removable, and a new entry by key. */
function Keyed({ rel, field, blank, diag }: (typeof ROOTS)[number] & { diag: Diag }) {
  const card = useCard(rel, diag);
  const [key, setKey] = useState('');
  const [refused, setRefused] = useState<string>();
  if (!card.saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const doc = (card.draft ?? {}) as Record<string, Entries>;
  const rows = doc[field] ?? {};
  const errors = (fieldErrors((diag.diagnostics ?? []) as never, rel)[field] ?? {}) as Record<string, any>;
  const put = (next: Entries) => card.change({ ...doc, [field]: next });
  const add = () => {
    const no = refuseKey(key, rows);
    setRefused(no);
    if (!no) (put({ ...rows, [key]: blank }), card.commit(), setKey(''));
  };
  const remove = (k: string) => {
    const { [k]: _gone, ...rest } = rows;
    (put(rest), card.commit());
  };
  const one = field.slice(0, -1);
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
        <Button type="submit" size="xs" variant="outline">
          Add {one}
        </Button>
      </form>
      {refused ? <Refusal>{refused}</Refusal> : null}
    </section>
  );
}

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
        <Button type="button" size="xs" variant="ghost" aria-label={`Remove ${id}`} onClick={remove}>
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
              onChange={(e) => set({ ...row, [f]: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
            {errors?.[f] ? <Refusal>{errors[f].__errors.join(' ')}</Refusal> : null}
          </label>
        ))}
      </div>
      {other.length ? <p className="text-muted-foreground">also {other.join(', ')}</p> : null}
    </fieldset>
  );
}
