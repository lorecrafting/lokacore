// The Rules blocks (docs/rnd/gui-editor-design-2026-11-04.md §4.5): Policy, Steps, Trigger and Check
// are one union picker, told apart by their tag (`op`, `event`, `kind`); the logic is
// kernel/ts/play/card.ts. Every other union in a generic card is drawn by it too.
import { useState } from 'react';
import type { FieldProps, RJSFSchema } from '@rjsf/utils';
import { branchOf, constraintOnly, start, tagHidden } from '../../../../../kernel/ts/play/card.ts';
import { offered } from '../../../../../kernel/ts/play/rules.ts';
import { uiSchema } from '../../../../../kernel/ts/play/ui_schema.ts';

/** Each branch's titles and claims: the walker's beneath a registry block, else the claimed definition walked. */
function branchUi({ registry, schema, uiSchema: given }: FieldProps): Record<string, unknown>[] {
  const defs = registry.rootSchema.$defs as Record<string, never>;
  // rjsf hands over `schema` with its `$ref`s resolved: walk the claimed definition itself
  const ui =
    given?.anyOf || given?.oneOf
      ? given
      : uiSchema('', (defs[given?.['ui:field'] as string] ?? schema) as never, defs, {});
  return ui.anyOf ?? ui.oneOf ?? [];
}

const option = (each: Record<string, unknown>[], i: number) => (
  <option key={i} value={i}>
    {(each[i]?.['ui:title'] as string) ?? `option ${i + 1}`}
  </option>
);

/**
 * An op (event, kind) picker, then the chosen branch's fields. A new branch starts as its tag and
 * the old fields it shares (rjsf's own switch would drop the tag under our defaults); a `wait`
 * step draws the divider before the rules that run later. The picker's label counts an array item
 * from 1, as the owner does; its name ends in the 0-based index (chrome rulings §7).
 */
export function Rules(p: FieldProps) {
  const { registry, schema, formData, fieldPathId } = p;
  const [picked, pick] = useState(-1);
  const raw = (schema.anyOf ?? schema.oneOf) as RJSFSchema[];
  const branches = raw.map((b) => registry.schemaUtils.retrieveSchema(b, formData));
  if (constraintOnly(branches as never)) return null; // the compiler reports a missing or second subject
  const each = branchUi(p);
  const found = branchOf(branches as never, formData);
  const at = found >= 0 ? found : picked;
  const wait = formData?.op === 'wait';
  return (
    <div className={wait ? 'mt-1 border-t-2 border-dashed pt-1' : ''}>
      {wait ? <p className="text-xs text-muted-foreground">later rules</p> : null}
      <select
        aria-label={`${p.name.replace(/-(\d+)$/, (_, n) => ` ${Number(n) + 1}`)} kind`}
        className="form-control"
        value={at}
        onChange={(e) => {
          const i = Number(e.target.value);
          pick(i);
          p.onChange(start(branches as never, i, formData), fieldPathId.path);
        }}
      >
        {at < 0 ? <option value={-1}>choose</option> : null}
        {branches.map((b, i) =>
          i === at || offered(b as never, registry.formContext.kind) ? option(each, i) : null,
        )}
      </select>
      {at >= 0 ? (
        <registry.fields.SchemaField
          {...p}
          schema={branches[at]}
          uiSchema={{ ...tagHidden(branches as never), ...each[at], 'ui:label': false }}
        />
      ) : null}
    </div>
  );
}
