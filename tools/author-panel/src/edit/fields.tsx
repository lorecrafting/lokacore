// The generic card's hand-built fields (docs/rnd/gui-editor-design-2026-11-04.md §4.5, §11): they
// draw only; the logic is kernel/ts/play/card.ts. The walker names them by `ui:field`.
import { useState } from 'react';
import type { FieldProps, RJSFSchema } from '@rjsf/utils';
import { branchOf, choices, proseKey, start } from '../../../../kernel/ts/play/card.ts';
import { uiSchema } from '../../../../kernel/ts/play/ui_schema.ts';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';

/** What the fields read beyond rjsf's props: the selection, the story's nodes and the Book. */
export type Context = {
  kind: string;
  key: string;
  nodes: { ref: string; kind: string }[];
  edit: (key: string) => void;
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

/** Picker: a definition key, offered from the story's nodes of the kind the field names. */
function DefinitionRef(p: FieldProps) {
  const list = `${p.fieldPathId.$id}-keys`;
  if (p.formData !== undefined && typeof p.formData !== 'string')
    return <code className="text-xs">{JSON.stringify(p.formData)}</code>; // a global ref: edit as text
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{p.name}</span>
      <Input
        id={p.fieldPathId.$id}
        list={list}
        className="h-7 text-xs"
        value={p.formData ?? ''}
        onChange={(e) => p.onChange(e.target.value || undefined, p.fieldPathId.path)}
        onBlur={(e) => p.onBlur(p.fieldPathId.$id, e.target.value)}
      />
      <datalist id={list}>
        {choices(p.name, context(p).nodes).map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </label>
  );
}

/** A branch's name in the picker: its op, else its title. */
const label = (b: RJSFSchema, ui: Record<string, unknown> | undefined, i: number) =>
  (start(b as never)?.op as string) ?? (ui?.['ui:title'] as string) ?? `option ${i + 1}`;

/**
 * Any union, and the Policy and Step blocks: an op picker, then the chosen branch's fields. A new
 * branch starts as `{op}` and nothing else (rjsf's own switch would drop `op` under our defaults);
 * a `wait` step draws the divider before the rules that run later.
 */
function Union(p: FieldProps) {
  const { registry, schema, formData, fieldPathId } = p;
  const [picked, pick] = useState(-1);
  const raw = (schema.anyOf ?? schema.oneOf) as RJSFSchema[];
  const branches = raw.map((b) => registry.schemaUtils.retrieveSchema(b, formData));
  const ui =
    p.uiSchema?.anyOf || p.uiSchema?.oneOf
      ? p.uiSchema!
      : uiSchema('', schema as never, registry.rootSchema.$defs as never, {});
  const each: Record<string, unknown>[] = ui.anyOf ?? ui.oneOf ?? [];
  const found = branchOf(branches as never, formData);
  const at = found >= 0 ? found : picked;
  const { SchemaField } = registry.fields;
  return (
    <div className={formData?.op === 'wait' ? 'mt-1 border-t-2 border-dashed pt-1' : ''}>
      {formData?.op === 'wait' ? (
        <p className="text-xs text-muted-foreground">later rules</p>
      ) : null}
      <select
        aria-label={`${p.name} kind`}
        className="form-control"
        value={at}
        onChange={(e) => {
          const i = Number(e.target.value);
          pick(i);
          p.onChange(start(branches[i] as never), fieldPathId.path);
        }}
      >
        {at < 0 ? <option value={-1}>choose</option> : null}
        {branches.map((b, i) => (
          <option key={i} value={i}>
            {label(b, each[i], i)}
          </option>
        ))}
      </select>
      {at >= 0 ? <SchemaField {...p} schema={branches[at]} uiSchema={{ ...each[at], 'ui:label': false }} /> : null}
    </div>
  );
}

/** A field the definition does not have yet: nothing until the add menu reveals it. */
const Hidden = () => null;

export const fields = {
  TextKey,
  DefinitionRef,
  Policy: Union,
  Step: Union,
  AnyOfField: Union,
  OneOfField: Union,
  Hidden,
};
