// The generic inspector card's logic (docs/rnd/gui-editor-design-2026-11-04.md sections 6 and 11;
// owner decision 2026-11-04 "cards hold no logic"): the panel's rjsf form only draws, and every
// value-to-ops, refusal-to-field and registry-to-menu step is a plain function here.
import type { Op, Step } from './edit_model.ts';
import type { Surfaces, Ui } from './ui_schema.ts';

type Obj = Record<string, unknown>;
const plain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** rjsf's default-state options: nothing invented, not a schema default nor a `const` (`dark`). */
export const FORM_DEFAULTS = {
  emptyObjectFields: 'skipDefaults',
  constAsDefaults: 'never',
} as const;

/**
 * The ops that turn `saved` into `draft`: plain objects are walked key by key (a key the draft
 * dropped is deleted); an array or a value that differs is replaced whole.
 */
export function diff(saved: unknown, draft: unknown, path: Step[] = []): Op[] {
  if (plain(saved) && plain(draft)) {
    const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]);
    return [...keys].flatMap((k): Op[] =>
      draft[k] === undefined
        ? Object.hasOwn(saved, k)
          ? [{ path: [...path, k], delete: true }]
          : []
        : Object.hasOwn(saved, k)
          ? diff(saved[k], draft[k], [...path, k])
          : [{ path: [...path, k], value: draft[k] }],
    );
  }
  return JSON.stringify(saved) === JSON.stringify(draft) ? [] : [{ path, value: draft }];
}

type Diagnostic = { rel?: string; path?: string; words?: string };
export type Errors = { __errors?: string[]; [field: string]: Errors | string[] | undefined };

// Source.at: a plain stem (`npcs/ada`) or the quoted file name, then `.name`, `[0]` or `["lit"]`.
const NAME = /^[a-z0-9_]+$/;
const STEP = /\.([a-z0-9_]+)|\[(\d+)\]|\[("(?:[^"\\]|\\.)*")\]/y;

function steps(path: string, rel: string): Step[] | null {
  const stem = rel.replace(/\.json$/, '');
  const source =
    stem !== rel && stem.split('/').every((s) => NAME.test(s)) ? stem : JSON.stringify(rel);
  if (!path.startsWith(source)) return null;
  const out: Step[] = [];
  STEP.lastIndex = source.length;
  while (STEP.lastIndex < path.length) {
    const m = STEP.exec(path);
    if (!m) return null;
    out.push(m[1] ?? (m[2] !== undefined ? Number(m[2]) : JSON.parse(m[3]!)));
  }
  return out;
}

/** The compiler's diagnostics for `rel` as rjsf's ErrorSchema: each at its field, else at the top. */
export function fieldErrors(diagnostics: Diagnostic[], rel: string): Errors {
  const out: Errors = {};
  for (const d of diagnostics) {
    if (d.rel !== rel) continue;
    let at = out;
    for (const s of steps(d.path ?? '', rel) ?? []) at = (at[s] ??= {}) as Errors;
    (at.__errors ??= []).push(d.words ?? '');
  }
  return out;
}

/** The registry's fields of `kind` the definition does not have yet: the card's add menu. */
export function addable(
  kind: string,
  registry: Record<string, Surfaces>,
  doc: unknown,
  revealed: string[],
): string[] {
  if (!plain(doc)) return [];
  return Object.keys(registry)
    .filter((path) => path.startsWith(`${kind}.`))
    .map((path) => path.slice(kind.length + 1))
    .filter((f) => !Object.hasOwn(doc, f) && !revealed.includes(f));
}

/** `ui` with each addable field hidden; a field the walker or registry claimed keeps its card once shown. */
export function hidden(
  ui: Ui,
  kind: string,
  registry: Record<string, Surfaces>,
  doc: unknown,
  revealed: string[],
): Ui {
  const out = { ...ui };
  for (const f of addable(kind, registry, doc, revealed)) out[f] = { 'ui:field': 'Hidden' };
  return out;
}

/** The keys of the nodes of the kind a reference field names (`room` lists rooms); [] is free text. */
export const choices = (field: string, nodes: { ref: string; kind: string }[]) =>
  nodes.filter((n) => n.kind === field).map((n) => n.ref.slice(n.ref.lastIndexOf('/') + 1));

const opOf = (branch: Obj): unknown => (branch.properties as any)?.op?.const;
const typeOf = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/**
 * The branch of a union (`anyOf`, `oneOf`) that `value` is in: the one whose `op` const it names,
 * else the first with no `op` const its type fits (a `$ref Step` beside `wait`); -1 for none.
 */
export function branchOf(branches: Obj[], value: unknown): number {
  if (value === undefined) return -1;
  const op = plain(value) ? value.op : undefined;
  const named = branches.findIndex((b) => opOf(b) !== undefined && opOf(b) === op);
  if (named >= 0) return named;
  const t = typeOf(value);
  return branches.findIndex(
    (b) =>
      opOf(b) === undefined &&
      (!b.type || b.type === t || (b.type === 'integer' && t === 'number')),
  );
}

/** A newly chosen branch's value: its `op` and nothing else, since no default is invented. */
export const start = (branch: Obj) =>
  opOf(branch) === undefined ? undefined : { op: opOf(branch) };

/** The card's state label: Hold first, then a compile in flight, then an artifact older than the source. */
export const status = (held: boolean, pending: boolean, compiled: boolean) =>
  held ? 'held' : pending ? 'compiling' : compiled ? null : 'stale';

/** The text key a prose field's value names (cartridge.md "Inline prose"): its own string, else generated. */
export const proseKey = (value: unknown, kind: string, key: string, path: Step[]) =>
  typeof value === 'string'
    ? value
    : [kind, key, ...path.map((s) => (s === 'room_line' ? 'room' : s))].join('.');

/** Only a definition's `.json` source has a card; a `.scene` or `.cut` is edited as text. */
export const editable = (rel: string | undefined) => rel?.endsWith('.json') === true;
