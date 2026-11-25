// The builder's generic sheet logic (design §6.4, slice 2.3): what the React Native schema renderer
// (mobile/app/author/build/form.tsx) draws for a node of a source kind's schema, and the value a
// gesture writes. Pure: the sheet posts each value as one `/change` op through mapedit.ts.
import { minimal, plain, start } from './card.ts';
import type { Step } from './edit_model.ts';

type Obj = Record<string, unknown>;
export type Defs = Record<string, Obj>;

const DEPTH = 3; // a recursive definition is drawn this many levels deep (ui_schema.ts DEPTH)
const CLAIMED = /^(?:partial\.)?(TextKey|DefinitionRef)$/;
const named = (ref: string) => ref.slice(ref.lastIndexOf('/') + 1);

/** What one node draws as: a claimed field, a union, an enum, an object, an array, a scalar, or nothing. */
export type Shape =
  | { as: 'claimed'; claim: string }
  | { as: 'union'; branches: Obj[] }
  | { as: 'enum'; options: unknown[] }
  | { as: 'const'; value: unknown }
  | { as: 'object'; props: Record<string, Obj>; each?: Obj; required: string[] }
  | { as: 'array'; items: Obj }
  | { as: 'scalar'; type: 'string' | 'integer' | 'number' | 'boolean' }
  | { as: 'none' };

/** `node` with its `$ref`s followed, `seen` counting each definition entered; undefined past DEPTH. */
export function resolve(
  node: Obj | undefined,
  defs: Defs,
  seen: string[],
): [Obj, string[]] | undefined {
  let n = node ?? {};
  let s = seen;
  while (typeof n.$ref === 'string') {
    const ref = named(n.$ref);
    if (CLAIMED.test(ref) || s.filter((r) => r === ref).length >= DEPTH) break;
    s = [...s, ref];
    n = defs[ref] ?? {};
  }
  return typeof n.$ref === 'string' && !CLAIMED.test(named(n.$ref)) ? undefined : [n, s];
}

/** The branch of an if/then/else `value` takes: `then` when it holds every field `if` requires. */
function branch(n: Obj, value: unknown): Obj | undefined {
  const need = ((n.if as Obj)?.required ?? []) as string[];
  const on = need.every((f) => plain(value) && Object.hasOwn(value, f));
  return (on ? n.then : n.else) as Obj | undefined;
}

/** How `node` draws for `value`, its `$ref`s, if/then/else and allOf followed (to DEPTH). */
export function shapeOf(
  node: Obj | undefined,
  value: unknown,
  defs: Defs,
  seen: string[] = [],
): [Shape, string[]] {
  const got = resolve(node, defs, seen);
  if (!got) return [{ as: 'none' }, seen];
  let [n, s] = got;
  if (typeof n.$ref === 'string')
    return [{ as: 'claimed', claim: CLAIMED.exec(named(n.$ref))![1] }, s];
  if (n.if && !n.properties)
    return keyed(n, shapeOf(branch(n, value), value, defs, s), value, defs);
  if (Array.isArray(n.allOf)) n = merged(n, n.allOf as Obj[], defs, s);
  if ('const' in n) return [{ as: 'const', value: n.const }, s];
  // a one-value enum (a reaction's `once`) is a constant: it has nothing to pick, only On or Off
  if (Array.isArray(n.enum) && n.enum.length === 1) return [{ as: 'const', value: n.enum[0] }, s];
  if (Array.isArray(n.enum)) return [{ as: 'enum', options: n.enum }, s];
  const branches = (n.anyOf ?? n.oneOf) as Obj[] | undefined;
  if (branches && !n.properties) return [{ as: 'union', branches }, s];
  if (n.type === 'array') return [{ as: 'array', items: (n.items ?? {}) as Obj }, s];
  if (n.type === 'object' || n.properties || n.additionalProperties) return [object(n, value), s];
  const t = n.type as string;
  return [
    ['string', 'integer', 'number', 'boolean'].includes(t)
      ? { as: 'scalar', type: t as 'string' }
      : { as: 'none' },
    s,
  ];
}

/** An if/then/else's object with the fields its `if` tests (`abstract`, `extends`, `command`) addable,
 * each as the `then` branch declares it: adding one moves the definition to that branch. */
function keyed(n: Obj, [sh, s]: [Shape, string[]], value: unknown, defs: Defs): [Shape, string[]] {
  if (sh.as !== 'object') return [sh, s];
  const props = { ...sh.props };
  for (const k of ((n.if as Obj).required ?? []) as string[]) {
    const [t] = props[k] ? [sh] : shapeOf(n.then as Obj, { ...(value as Obj), [k]: true }, defs, s);
    if (t.as === 'object' && t.props[k]) props[k] = t.props[k];
  }
  return [{ ...sh, props }, s];
}

/** An object node: its own properties plus an if/then/else's branch's (a nested definition). */
function object(n: Obj, value: unknown): Shape {
  const b = n.if ? (branch(n, value) ?? {}) : {};
  const each = plain(n.additionalProperties) ? n.additionalProperties : undefined;
  return {
    as: 'object',
    props: {
      ...((n.properties ?? {}) as Record<string, Obj>),
      ...((b.properties ?? {}) as Record<string, Obj>),
    },
    each,
    required: [...((n.required ?? []) as string[]), ...((b.required ?? []) as string[])],
  };
}

/** `n` with its allOf parts' properties and required fields folded in. */
function merged(n: Obj, parts: Obj[], defs: Defs, seen: string[]): Obj {
  const all = parts.map((p) => resolve(p, defs, seen)?.[0] ?? {});
  return {
    ...n,
    type: n.type ?? all.find((p) => p.type)?.type,
    properties: Object.assign({}, n.properties, ...all.map((p) => p.properties ?? {})),
    required: [
      ...((n.required ?? []) as string[]),
      ...all.flatMap((p) => (p.required ?? []) as string[]),
    ],
  };
}

/** The least value a new field, entry or element starts at; undefined when the author must choose it. */
export function least(node: Obj, defs: Defs): unknown {
  const v = minimal(node, defs);
  if (v !== undefined) return v;
  const [s] = shapeOf(node, undefined, defs);
  return s.as === 'object' ? {} : s.as === 'array' ? [] : undefined;
}

/** A picked union branch's value: card.ts `start`, its required fields at their least. */
export function picked(branches: Obj[], i: number, old: unknown, defs: Defs): unknown {
  const b = resolve(branches[i], defs, [])?.[0] ?? {};
  const v = start(branches, i, old, defs) ?? least(b, defs);
  if (!plain(v)) return v;
  const props = (b.properties ?? {}) as Record<string, Obj>;
  const req = ((b.required ?? []) as string[]).filter((f) => !Object.hasOwn(v, f));
  return { ...v, ...Object.fromEntries(req.map((f) => [f, least(props[f], defs)])) };
}

/** Element `i` of `list` moved to `j`, or copied after itself when `j` is undefined. */
export function moved(list: unknown[], i: number, j?: number): unknown[] {
  const out = [...list];
  if (j === undefined) out.splice(i + 1, 0, structuredClone(list[i]));
  else out.splice(j, 0, ...out.splice(i, 1));
  return out;
}

export type { Step };
