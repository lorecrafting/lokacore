// size: allow 450, every card's logic lives here (cards hold no logic): the generic, Room, World, NPC, item, Action and Reaction cards' steps; the Action pairing is in action.ts, the World card's in world_card.ts, the room details' in room_card.ts
// The generic inspector card's logic (docs/rnd/gui-editor-design-2026-11-04.md sections 6 and 11;
// owner decision 2026-11-04 "cards hold no logic"): the panel's rjsf form only draws, and every
// value-to-ops, refusal-to-field and registry-to-menu step is a plain function here.
import { PICK_NAMES } from './rules.ts';
import { change, type Op, type Step } from './edit_model.ts';
import type { Surfaces, Ui } from './ui_schema.ts';

type Obj = Record<string, unknown>;
const plain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
// rjsf fills each drawn absent object field with `{}` (nested), which no author wrote
const empty = (v: unknown): boolean =>
  v === undefined || (plain(v) && Object.values(v).every(empty));

/** rjsf's default-state options: nothing invented, not a schema default nor a `const` (`dark`). */
export const FORM_DEFAULTS = {
  emptyObjectFields: 'skipDefaults',
  constAsDefaults: 'never',
} as const;

/**
 * The ops that turn `saved` into `draft`: plain objects are walked key by key (a key the draft
 * dropped is deleted, an added tree of empty objects is not added), arrays item by item (a new
 * item is appended, a dropped one deleted from the end); any other value that differs is replaced.
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
          : empty(draft[k])
            ? []
            : [{ path: [...path, k], value: draft[k] }],
    );
  }
  if (Array.isArray(saved) && Array.isArray(draft))
    return [
      ...saved.slice(0, draft.length).flatMap((s, i) => diff(s, draft[i], [...path, i])),
      ...draft
        .slice(saved.length)
        .flatMap((value, j) =>
          value === undefined ? [] : [{ path: [...path, saved.length + j], value }],
        ),
      ...saved
        .slice(draft.length)
        .map((_, j) => ({ path: [...path, saved.length - 1 - j], delete: true })),
    ];
  return JSON.stringify(saved) === JSON.stringify(draft) ? [] : [{ path, value: draft }];
}

/** `saved` with the ops to `draft` applied: the card's draft, which rjsf's `{}` fills never reach. */
export function applied(saved: unknown, draft: unknown): unknown {
  const out = structuredClone(saved);
  change(out, diff(saved, draft));
  return out;
}

/**
 * `doc` without each optional list the author emptied whose schema wants at least one item: a
 * room's last variant removed deletes the field (loka-wfrgk.78), which `[]` would hold refused.
 */
export function unlisted(doc: unknown, node: Obj, defs: Record<string, Obj>): unknown {
  if (!plain(doc)) return doc;
  const n = deref(node, defs);
  const props = (n.properties ?? {}) as Record<string, Obj>;
  const each = plain(n.additionalProperties) ? n.additionalProperties : {};
  const required = (n.required ?? []) as string[];
  return Object.fromEntries(
    Object.entries(doc).flatMap(([k, v]) => {
      const s = deref(props[k] ?? each, defs);
      const gone =
        Array.isArray(v) && !v.length && (s.minItems as number) >= 1 && !required.includes(k);
      return gone ? [] : [[k, unlisted(v, s, defs)]];
    }),
  );
}
const deref = (s: Obj, defs: Record<string, Obj>): Obj => {
  const ref = s.$ref as string | undefined;
  return ref ? deref(defs[ref.slice(ref.lastIndexOf('/') + 1)] ?? {}, defs) : s;
};
/** Field `f` of definition `def`: its schema description, else its `$ref` target's (the add menu's line). */
export function described(defs: Record<string, Obj>, def: string, f: string): string | undefined {
  const s = (defs[def]?.properties as Record<string, Obj> | undefined)?.[f];
  return s && ((s.description ?? deref(s, defs).description) as string | undefined);
}

/**
 * The draft after a reload: the reloaded `doc` with the edits from `base` to `now` that were not
 * `sent` (typed while a post was in flight, or held back by `apart`); `doc` alone if they no longer apply.
 */
export function rebase(base: unknown, now: unknown, doc: unknown, sent: Op[]): unknown {
  const done = new Set(sent.map((o) => JSON.stringify(o)));
  const out = structuredClone(doc);
  try {
    change(
      out,
      diff(base, now).filter((o) => !done.has(JSON.stringify(o))),
    );
  } catch {
    // refused: change applies all or nothing, so `out` is still the reloaded file
  }
  return out;
}

/**
 * The ops a schema error does not hold: those outside every errored top-level field (`property`
 * is rjsf's `.policy.items`, `.0.room`), so a half-made branch never blocks an edit elsewhere.
 * A root error (`if`/`else` restating a field's) holds everything only when no field is named.
 */
export function apart(ops: Op[], errors: { property?: string }[]): Op[] {
  const held = errors
    .map((e) => (e.property ?? '').replace(/^\./, '').split('.')[0])
    .filter(Boolean);
  if (errors.length && !held.length) return [];
  return ops.filter((o) => !held.includes(String(o.path[0])));
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
  for (const f of addable(kind, registry, doc, revealed))
    out[f] = { 'ui:field': 'Hidden', 'ui:widget': 'hidden' }; // the widget drops rjsf's label row too
  return out;
}

/** The node kind a reference field at `path` picks: its last named step, parent first (`patrol.route.0`). */
export function pickKind(path: (string | number)[]) {
  const named = path.filter((s) => typeof s === 'string' && !/^\d+$/.test(s)).map(String);
  const name = named.at(-1) ?? '';
  const pick = [`${named.at(-2)}.${name}`, name].find((n) => Object.hasOwn(PICK_NAMES, n));
  return pick ? PICK_NAMES[pick] : name;
}

/** A typed field's value: an emptied field is unset, a number field's text a number. */
export const entered = (text: string, number = false) =>
  text === '' ? undefined : number ? Number(text) : text;

/** `doc` placed at `key` of kind `kind` (room, npc, item): an NPC's `room`, an item's whole `location`, so no old holder stays. */
export const placed = (doc: Obj, dir: string, kind: string, key: string): Obj =>
  dir === 'npcs' ? { ...doc, room: key } : { ...doc, location: { in: kind, [kind]: key } };

/** Where `doc` starts as the file says: the holder's kind (room, npc, item, template) and key. */
export function placement(doc: Obj, dir: string): { kind: string; key?: unknown } {
  if (dir === 'npcs') return { kind: 'room', key: doc.room };
  const loc = plain(doc.location) ? doc.location : {};
  const kind = typeof loc.in === 'string' ? loc.in : 'room';
  return { kind, key: loc[kind] };
}

const typeOf = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
// the key a branch names itself by: a Step or Policy `op`, a trigger's `event`, a check's or target's `kind`
const tagOf = (branches: Obj[]) =>
  ['op', 'event', 'kind'].find((k) => branches.some((b) => constOf(b, k) !== undefined));
const constOf = (branch: Obj | undefined, k: string | undefined): unknown =>
  k === undefined ? undefined : (branch?.properties as any)?.[k]?.const;

/**
 * The branch of a union (`anyOf`, `oneOf`) that `value` is in: the one whose tag const (`op`,
 * `event`, `kind`) it names; for a value naming no tag (an `extends` partial's `{chance: 70}`),
 * the first branch declaring all its fields; else the first untagged one its type fits (a
 * `$ref Step` beside `wait`); -1 for none.
 */
export function branchOf(branches: Obj[], value: unknown): number {
  if (value === undefined) return -1;
  const k = tagOf(branches);
  const tag = plain(value) && k ? value[k] : undefined;
  const named = branches.findIndex((b) => constOf(b, k) !== undefined && constOf(b, k) === tag);
  if (named >= 0) return named;
  const keys = plain(value) && tag === undefined ? Object.keys(value) : [];
  const fits = branches.findIndex(
    (b) => keys.length && keys.every((f) => Object.hasOwn((b.properties ?? {}) as Obj, f)),
  );
  if (fits >= 0) return fits;
  const t = typeOf(value);
  return branches.findIndex(
    (b) =>
      constOf(b, k) === undefined &&
      (!b.type || b.type === t || (b.type === 'integer' && t === 'number')),
  );
}

const shape = (node: unknown) => {
  const { description: _d, ...rest } = (node ?? {}) as Obj;
  return JSON.stringify(rest);
};

// the room key an untagged union's value names: a key, a case's room, a ref's key, a case list's fallback
const roomOf = (v: unknown): unknown =>
  Array.isArray(v) ? roomOf(v.at(-1)) : plain(v) ? roomOf(v.room ?? v.key) : v;

/** An hour's (source.ex) branch `i`, carrying the old value's room key; other untagged unions: below. */
function untagged(branches: Obj[], i: number, old: unknown, defs: Record<string, Obj>): unknown {
  const room = roomOf(old);
  const b = branches[i];
  // not an hour (a status duration): a const branch writes its const, a number its least; else the value stays
  if (!branches.some((h) => h.title === 'cases'))
    return 'const' in b ? b.const : (b.minimum ?? old);
  if (room === undefined) return undefined;
  if (b.type === 'array') return [{ room }, room]; // one case, then its fallback room (schedules.ex `fallback`)
  if (b.type !== 'object') return room;
  const props = (b.properties ?? {}) as Record<string, Obj>;
  const at = Object.hasOwn(props, 'room') ? 'room' : 'key';
  const least = ((b.required ?? []) as string[])
    .filter((f) => f !== at)
    .map((f) => [f, minimal(props[f], defs)]);
  if (least.some(([, v]) => v === undefined)) return old; // a ref's cartridge is not invented: the hour stays
  return { ...Object.fromEntries(least), [at]: room };
}

/**
 * Branch `i`'s value when the author picks it: its tag, plus each old field the new branch declares
 * with the same schema (a check's `key`; any schema when no branch held the old value); in an
 * untagged union, the old value when it fits, else one carrying its room key (loka-wfrgk.74).
 */
export function start(
  branches: Obj[],
  i: number,
  old?: unknown,
  defs: Record<string, Obj> = {},
): unknown {
  const k = tagOf(branches);
  if (k === undefined)
    return branchOf(branches, old) === i ? old : untagged(branches, i, old, defs);
  const tag = constOf(branches[i], k);
  if (tag === undefined) return {}; // `$ref Step`: picker asks
  const from = branches[branchOf(branches, old)];
  const now = (branches[i].properties ?? {}) as Obj;
  const same = (f: string) => !from || shape(now[f]) === shape((from.properties as Obj)?.[f]);
  const kept = Object.entries(plain(old) ? old : {}).filter(
    ([f]) => f !== k && Object.hasOwn(now, f) && same(f),
  );
  return { [k]: tag, ...Object.fromEntries(kept) };
}

/** A union whose branches only require a field each (`has_tag`'s one subject): nothing to draw. */
export const constraintOnly = (branches: Obj[]) =>
  branches.every((b) => !b.type && !b.properties && !b.anyOf && !b.oneOf && !b.$ref);

/** A branch's own tag field is drawn by the picker, so its form hides it. */
export const tagHidden = (branches: Obj[], k = tagOf(branches)) =>
  k ? { [k]: { 'ui:widget': 'hidden' } } : {};

/** Whether `branch` is a `Policy`'s `named` leaf (K1): its tag const is `named`. */
export const isNamed = (branch: Obj | undefined) => constOf(branch, 'op') === 'named';

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

/**
 * The least value of a newly added field the schema allows, nothing invented: each text key `~`
 * (cartridge.md "Inline prose"), each `const`, `true`, each `minimum`, `minItems` copies; a
 * string, enum or key leaves the whole field undefined: the card only reveals it for the author.
 */
export function minimal(node: Obj, defs: Record<string, Obj>, seen: string[] = []): unknown {
  const ref = node.$ref as string | undefined;
  if (ref) {
    const name = ref.slice(ref.lastIndexOf('/') + 1);
    if (name === 'TextKey') return { prose: '~' };
    return seen.includes(name) ? undefined : minimal(defs[name], defs, [...seen, name]);
  }
  if ('const' in node) return node.const;
  for (const branch of (node.anyOf ?? node.oneOf ?? []) as Obj[]) {
    const v = minimal(branch, defs, seen);
    if (v !== undefined) return v;
  }
  if (node.type === 'boolean') return true;
  if (node.type === 'integer' || node.type === 'number') return node.minimum;
  if (node.type === 'array') {
    const n = (node.minItems as number) ?? 0;
    const item = n ? minimal(node.items as Obj, defs, seen) : undefined;
    return n && item === undefined ? undefined : Array.from({ length: n }, () => item);
  }
  if (node.type !== 'object' || node.allOf) return undefined; // allOf: a required set the author picks (a craft's consume or yield)
  const props = (node.properties ?? {}) as Record<string, Obj>;
  const pairs = ((node.required ?? []) as string[]).map((k) => [k, minimal(props[k], defs, seen)]);
  return pairs.some(([, v]) => v === undefined) ? undefined : Object.fromEntries(pairs);
}

// a field whose schema minimum does not compile starts at the sampler's value (resources.ex @defaults hp; BODY_BELOW_ZERO)
const t = () => ({ prose: '~' });
// a `~` per exit direction: every one out of an area room needs a key (population.ex:139, :149), others are let be
const away = () =>
  Object.fromEntries(['north', 'south', 'east', 'west', 'up', 'down'].map((d) => [d, t()]));
// keyed by definition and field, as `awaits` is: an item's or a room's field of the same name is not an NPC's
const SEEDS: Record<string, (doc: Obj, held: number) => unknown> = {
  // a capacity under the items already inside is CAPACITY_EXCEEDED (entities.ex:250-253)
  'source.ItemDefinition.capacity': (_, held) => Math.max(1, held),
  'source.NpcDefinition.hp': () => ({ minimum: 0, maximum: 20, start: 20, gain: 5 }),
  // a set has exactly one of lines or emotes (emotes.ex:52)
  ...Object.fromEntries(
    ['Npc', 'Item', 'Room'].map((k) => [
      `source.${k}Definition.ambient`,
      () => [{ every: 1, lines: [t()] }],
    ]),
  ),
  'source.PopulationPlan.pack': () => ({
    flight_below_percent: 1,
    flight_fare: 0,
    narration: { helper_joined: t(), enemy_fled: away(), primary_changed: t(), pack_withdrew: t() },
  }),
  'source.PopulationPlan.sight': () => ({ delay: 1, narration: away() }),
  // one rank per level: growth.length + 1 (skills.ex:107-108)
  'source.SkillDefinition.ranks': (doc) =>
    ((doc.growth ?? []) as unknown[]).concat([0]).map(() => ({ name: t() })),
};

/** The items the compiled story graph places in `ref` (an edge per item's `location.item`). */
export const held = (edges: { to: string; path: string }[] = [], ref?: string) =>
  edges.filter((e) => e.to === ref && e.path === '.location.item').length;

/** `doc` with field `f` of definition `def` at its least value; undefined when present or the author must choose it. */
export function added(
  doc: Obj,
  f: string,
  defs: Record<string, Obj>,
  def: string,
  held = 0, // the items the definition holds: a capacity's least value
): Obj | undefined {
  if (Object.hasOwn(doc, f)) return undefined; // a stale menu never overwrites a present field
  const node = (defs[def]?.properties as Record<string, Obj> | undefined)?.[f]; // abstract fields only reveal
  const value =
    node && (SEEDS[`${def.replace(/^partial\./, '')}.${f}`]?.(doc, held) ?? minimal(node, defs));
  return value === undefined ? undefined : { ...doc, [f]: value };
}

/** The definition `doc` of `kind` is (`source.items` → `source.ItemDefinition`): the generated
 * if/then/else on its present fields (`abstract`, `extends`, `command`) followed to its `$ref`. */
export function definitionOf(defs: Record<string, Obj>, kind: string, doc: unknown): string {
  let name = `source.${kind}`;
  for (let n: Obj | undefined = defs[name]; n;) {
    const ref = n.$ref as string | undefined;
    if (ref) n = defs[(name = ref.slice(ref.lastIndexOf('/') + 1))];
    else if (!n.if) break;
    else {
      const on = (((n.if as Obj).required ?? []) as string[]).every((f) =>
        Object.hasOwn((doc ?? {}) as Obj, f),
      );
      n = (on ? n.then : n.else) as Obj | undefined;
    }
  }
  return name;
}

/** `doc` without field `f`. */
export const removed = (doc: Obj, f: string): Obj => {
  const { [f]: _gone, ...rest } = doc;
  return rest;
};

/** The field a Book "Add here" pick adds to the room `key`: only its own room's, only one on offer. */
export const addedHere = (a: { kind: string; room: string }, key: string, menu: string[]) =>
  a.room === key && menu.includes(a.kind) ? a.kind : undefined;

import { allowed, awaits } from './allowed.ts';
export { allowed, awaits };

/** The generic card's add menu (a command action's, right.tsx's fallback): `only` narrows the
 * registry's fields, then the cartridge's capabilities gate them as the compiler does
 * (UNDECLARED_CAPABILITY); none until cartridge.json is read. */
export const cardMenu = (
  kind: string,
  registry: Record<string, Surfaces>,
  doc: unknown,
  revealed: string[],
  cart: { requires?: { capabilities?: object }; world?: Record<string, unknown> } | undefined,
  only = (fields: string[]) => fields,
) =>
  cart
    ? allowed(
        kind,
        only(addable(kind, registry, doc, revealed)),
        cart.requires?.capabilities ?? {},
        plain(doc) ? doc : {},
        cart.world,
      )
    : [];
export * from './world_card.ts';
export * from './room_card.ts';
