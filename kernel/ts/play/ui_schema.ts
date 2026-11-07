// The schema walker (docs/rnd/gui-editor-design-2026-11-04.md §11): a source kind's rjsf uiSchema.
// It claims a field for a hand-built widget by `$ref` (TextKey, DefinitionRef, Policy, Step) and by
// editor registry row, and titles each `anyOf` branch; rjsf draws the rest. The coverage gate
// (bin/toolbox_page.exs) lists the same top-level fields by the same rule from the same schemas.
type Node = Record<string, any>;
export type Ui = Record<string, any>;
export type Surfaces = { create: string; edit: string; delete: string };

const CLAIMED = /^(?:partial\.)?(TextKey|DefinitionRef|Policy|Step)$/;
const DEPTH = 3;
const named = (ref: string) => ref.slice(ref.lastIndexOf('/') + 1);

/**
 * A union picker's branch names (docs/design/editor-chrome-rulings.md §7): each branch's title (a
 * `$ref` is titled by its definition), else its value of the key that is a distinct `const` in every
 * branch, else its single required key, else `option n`; a JSON type only when the branches differ
 * only by type. A name two branches share falls back to `option n`.
 */
export function titles(branches: Node[], defs: Record<string, Node>): string[] {
  const at = branches.map((b) => (b.$ref ? (defs[named(b.$ref)] ?? {}) : b));
  const consts = (k: string) => at.map((b) => b.properties?.[k]?.const);
  const key = Object.keys(at[0]?.properties ?? {}).find(
    (k) => consts(k).every((c) => typeof c === 'string') && new Set(consts(k)).size === at.length,
  );
  const types = at.map((b) => b.type);
  const byType = types.every((t) => typeof t === 'string') && new Set(types).size === at.length;
  const names = branches.map(
    (b, i): string | undefined =>
      b.title ??
      at[i].title ??
      (b.$ref ? named(b.$ref) : undefined) ??
      (key && at[i].properties[key].const) ??
      (at[i].required?.length === 1 ? at[i].required[0] : undefined) ??
      (byType ? types[i] : undefined),
  );
  return names.map((n, i) =>
    n && names.indexOf(n) === names.lastIndexOf(n) ? n : `option ${i + 1}`,
  );
}

function walk(node: unknown, defs: Record<string, Node>, seen: string[]): Ui {
  if (typeof node !== 'object' || node === null) return {};
  const n = node as Node;
  if (n.$ref) {
    const ref = named(n.$ref);
    const claim = CLAIMED.exec(ref);
    // the hand-built field draws the whole union (TextKey, DefinitionRef, Policy and Step are anyOf), not under rjsf's selector
    if (claim) return { 'ui:field': claim[1], 'ui:fieldReplacesAnyOrOneOf': true };
    // a recursive definition is drawn DEPTH levels deep, then ends (no real kind recurses today)
    if (seen.filter((s) => s === ref).length >= DEPTH) return {};
    return walk(defs[ref], defs, [...seen, ref]);
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
  if (branches) {
    const t = titles(branches, defs);
    ui[n.anyOf ? 'anyOf' : 'oneOf'] = branches.map((b, i) => ({
      ...walk(b, defs, seen),
      'ui:title': t[i],
    }));
  }
  return ui;
}

/**
 * The uiSchema of one source kind: `schema` is its `schemas/source/<kind>.schema.json`, `defs` the
 * `$defs` of defs.schema.json, `registry` tools/author-panel/src/edit/registry.json. A hand-built
 * row claims the whole card (`<kind>`), a field (`<kind>.<field>`, under `items` when the file is
 * an array) or, for `treatment:<name>`, the kind's `treatment` field; `ui:field` names the card.
 */
export function uiSchema(
  kind: string,
  schema: Node,
  defs: Record<string, Node>,
  registry: Record<string, Surfaces>,
): Ui {
  const ui = walk(schema, defs, []);
  const root = schema.$ref ? defs[named(schema.$ref)] : schema;
  const at: Ui = root?.type === 'array' ? (ui.items ??= {}) : ui;
  for (const [path, { edit }] of Object.entries(registry)) {
    if (edit === 'generic') continue;
    const card = { 'ui:field': edit.replace(/\.tsx$/, '') };
    const [k, field] = path.split('.');
    if (path === kind) Object.assign(ui, card);
    // a block (blocks/) draws through the walker's own claims (Policy, Step, a union's branch titles)
    else if (k === kind && field && !edit.startsWith('blocks/')) at[field] = card;
    else if (path.startsWith('treatment:') && `${kind}.treatment` in registry) at.treatment = card;
  }
  return ui;
}
