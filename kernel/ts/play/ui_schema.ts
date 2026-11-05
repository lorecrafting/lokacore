// The schema walker (docs/rnd/gui-editor-design-2026-11-04.md §11): a source kind's rjsf uiSchema.
// It claims a field for a hand-built widget by `$ref` (TextKey, DefinitionRef, Policy, Step) and by
// editor registry row, and titles each `anyOf` branch; rjsf draws the rest. The coverage gate
// (bin/toolbox_page.exs) lists the same top-level fields by the same rule from the same schemas.
type Node = Record<string, any>;
export type Ui = Record<string, any>;
export type Surfaces = { create: string; edit: string; delete: string };

const CLAIMED = /^(?:partial\.)?(TextKey|DefinitionRef|Policy|Step)$/;
const named = (ref: string) => ref.slice(ref.lastIndexOf('/') + 1);

function title(branch: Node, i: number): string {
  if (branch.title) return branch.title;
  if (branch.$ref) return named(branch.$ref);
  if (branch.required?.length === 1) return branch.required[0];
  return typeof branch.type === 'string' ? branch.type : `option ${i + 1}`;
}

function walk(node: unknown, defs: Record<string, Node>, seen: string[]): Ui {
  if (typeof node !== 'object' || node === null) return {};
  const n = node as Node;
  if (n.$ref) {
    const ref = named(n.$ref);
    const claim = CLAIMED.exec(ref);
    if (claim) return { 'ui:field': claim[1] };
    return seen.includes(ref) ? {} : walk(defs[ref], defs, [...seen, ref]);
  }
  const ui: Ui = {};
  const put = (k: string, v: Ui) => Object.keys(v).length && !(k in ui) && (ui[k] = v);
  for (const [k, v] of Object.entries(n.properties ?? {})) put(k, walk(v, defs, seen));
  put('items', walk(n.items, defs, seen));
  put('additionalProperties', walk(n.additionalProperties, defs, seen));
  // an if/then/else or allOf adds fields at this level: the first branch naming one draws it
  for (const b of [...(n.allOf ?? []), n.then, n.else])
    for (const [k, v] of Object.entries(walk(b, defs, seen))) put(k, v as Ui);
  const branches: Node[] | undefined = n.anyOf ?? n.oneOf;
  if (branches)
    ui[n.anyOf ? 'anyOf' : 'oneOf'] = branches.map((b, i) => ({
      ...walk(b, defs, seen),
      'ui:title': title(b, i),
    }));
  return ui;
}

/**
 * The uiSchema of one source kind: `schema` is its `schemas/source/<kind>.schema.json`, `defs` the
 * `$defs` of defs.schema.json, `registry` tools/author-panel/src/edit/registry.json.
 */
export function uiSchema(
  kind: string,
  schema: Node,
  defs: Record<string, Node>,
  registry: Record<string, Surfaces>,
): Ui {
  const ui = walk(schema, defs, []);
  for (const [path, { edit }] of Object.entries(registry)) {
    const [k, field] = path.split('.');
    if (k === kind && field && edit !== 'generic') ui[field] = { 'ui:field': edit };
  }
  return ui;
}
