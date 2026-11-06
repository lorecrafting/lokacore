// size: allow 450, the cards' logic (cards hold no logic): the generic, Room, World, NPC, item, Action and Reaction cards' steps; the Action pairing is in action.ts
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

/** The keys of the nodes of the kind a reference field names (`room` lists rooms); [] is free text. */
export const choices = (field: string, nodes: { ref: string; kind: string }[]) =>
  nodes.filter((n) => n.kind === field).map((n) => n.ref.slice(n.ref.lastIndexOf('/') + 1));

/** The node kind a reference field at `path` picks: its last named step (`shop.offers.0.item`). */
export function pickKind(path: (string | number)[]) {
  const name = [...path].reverse().find((s) => typeof s === 'string' && !/^\d+$/.test(s));
  return Object.hasOwn(PICK_NAMES, String(name)) ? PICK_NAMES[String(name)] : String(name ?? '');
}

/** What a world file's reference field names, by its field (a transport's `reverse` is a transport). */
const PICKS: Record<string, string> = {
  ...Object.fromEntries(
    'entry home area room rooms destination recovery_rooms corridor drop_rooms shrine surface bottom'
      .split(' ')
      .map((f) => [f, 'room']),
  ),
  ...Object.fromEntries(
    'corpse npc_corpse player_corpse item items key_item nest'.split(' ').map((f) => [f, 'item']),
  ),
  ...Object.fromEntries('npc recipient allies with'.split(' ').map((f) => [f, 'npc'])),
  reverse: 'transport',
  currency: 'resource',
  resource: 'resource',
  attribute: 'attribute',
};

// every cartridge's resource pools, listed in resources.json or not (lib/loka/content/resources.ex @defaults)
const POOLS = ['hp', 'ma', 'mv'];

/**
 * The World card's picker at `path` (its last named step picks the kind): the keys it offers, from
 * the story's nodes or, for a resource or attribute, the root file's `named` keys; none when free.
 */
export function pickable(
  path: Step[],
  nodes: { ref: string; kind: string }[],
  named: Record<string, string[]>,
  value?: unknown,
) {
  const kind = PICKS[path.filter((s) => typeof s === 'string').at(-1) ?? ''];
  // a value that is not a key (a global ref's object) keeps its own field
  if (!kind || (value !== undefined && typeof value !== 'string')) return undefined;
  const keys = named[kind] ?? choices(kind, nodes);
  return { kind, keys: kind === 'resource' ? [...new Set([...POOLS, ...keys])] : keys };
}

/** A key the picker refuses: one no definition of its kind has; none known yet (no compile) is free text. */
export function refusePick(pick: ReturnType<typeof pickable>, value: string) {
  return pick?.keys.length && value && !pick.keys.includes(value)
    ? `no ${pick.kind} ${value}`
    : undefined;
}

/** A new root-file entry's key: lowercase words joined by `_`, not one the file has. */
export function refuseKey(key: string, taken: Record<string, unknown>) {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(key))
    return 'a key is up to 64 lowercase letters, digits and _';
  return Object.hasOwn(taken, key) ? `already ${key}` : undefined;
}

/** The World card's keyed root files, each new entry's least fields (ResourceSpec, AttributeSpec) at 0. */
export const ROOTS: { rel: string; field: string; blank: Record<string, number> }[] = [
  {
    rel: 'resources.json',
    field: 'resources',
    blank: { minimum: 0, maximum: 0, start: 0, gain: 0 },
  },
  { rel: 'attributes.json', field: 'attributes', blank: { start: 0 } },
];

/** A file the World card opens: a root file (`root`), or one population, transport or barrier. */
export const worldFile = (rel: string, root = false) =>
  /^(cartridge|resources|attributes)\.json$/.test(rel) ||
  (!root && /(^|\/)(populations|transports|barriers)\/[^/]+\.json$/.test(rel));

/** The resource and attribute keys the ROOTS docs (in order) hold: `{resource: [...], attribute: [...]}`. */
export const rootNames = (docs: unknown[]): Record<string, string[]> =>
  Object.fromEntries(
    ROOTS.map(({ field }, i) => [
      field.slice(0, -1),
      Object.keys(((docs[i] ?? {}) as Obj)[field] ?? {}),
    ]),
  );

/** What changes when a ROOTS file is written, so the card refetches its keys then only. */
export const rootStamp = (changes: { file: string; sha256: string }[]) =>
  changes
    .filter((c) => ROOTS.some((r) => r.rel === c.file))
    .map((c) => c.sha256)
    .join();

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

/**
 * Branch `i`'s value when the author picks it: its tag, plus each old field the new branch declares
 * with the same schema (a check's `key`; any schema when no branch held the old value).
 */
export function start(branches: Obj[], i: number, old?: unknown): Obj | undefined {
  const k = tagOf(branches);
  const tag = constOf(branches[i], k);
  if (k === undefined || tag === undefined) return k ? {} : undefined; // `$ref Step`: picker asks
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
const SEEDS: Record<string, unknown> = { hp: { minimum: 0, maximum: 20, start: 20, gain: 5 } };

/** `doc` with field `f` of definition `def` at its least value; undefined when present or the author must choose it. */
export function added(
  doc: Obj,
  f: string,
  defs: Record<string, Obj>,
  def: string,
): Obj | undefined {
  if (Object.hasOwn(doc, f)) return undefined; // a stale menu never overwrites a present field
  const node = (defs[def]?.properties as Record<string, Obj> | undefined)?.[f]; // abstract fields only reveal
  const value = node && (structuredClone(SEEDS[f]) ?? minimal(node, defs));
  return value === undefined ? undefined : { ...doc, [f]: value };
}

/** `doc` without field `f`. */
export const removed = (doc: Obj, f: string): Obj => {
  const { [f]: _gone, ...rest } = doc;
  return rest;
};

/** The field a Book "Add here" pick adds to the room `key`: only its own room's, only one on offer. */
export const addedHere = (a: { kind: string; room: string }, key: string, menu: string[]) =>
  a.room === key && menu.includes(a.kind) ? a.kind : undefined;

// Each field's owning capabilities, as UNDECLARED_CAPABILITY checks them (content/); a field it omits needs none.
const VARIANT = 'description_variant';
const OWNERS: Record<string, string> = {
  'npcs.ask': 'speech topic',
  'npcs.attack': 'combat', // world.combat needs it (combat.ex requirements); NEEDS has the rest
  'npcs.cues': 'sense_cue',
  'npcs.daily_schedule': 'schedule',
  'npcs.description_variants': VARIANT,
  'npcs.name_variants': VARIANT,
  'npcs.shop': 'commerce',
  'items.affects': 'attribute', // derived.ex owner/2
  'items.bandage': 'bleed combat skill food', // bleed.ex gate/1
  'items.cues': 'sense_cue',
  'items.description_variants': VARIANT,
  'items.edible': 'food',
  'items.fuel': 'light',
  'items.name_variants': VARIANT,
  'items.readable': 'readable',
  'items.room_line_variants': VARIANT,
  'items.slot': 'equipment',
  'items.tags': 'tag',
  'rooms.cues': 'sense_cue',
  'rooms.dark': 'light',
  'rooms.dark_description': 'light',
  'rooms.details': 'inspectable_detail',
  'rooms.site': 'construction',
  'rooms.tags': 'tag',
  'rooms.variants': VARIANT,
  'actions.check': 'check', // its check_passed (scripted_actions.ex:125)
  'actions.tip': 'fact', // its fact_changed (action_tips.ex:40)
  'actions.policy': 'policy', // its least `all` (resolve.ex:415)
  'reactions.when': 'policy',
};

// Beyond capabilities: an NPC's attack needs world.combat and the NPC's hp (combat.ex npc_profiles).
const NEEDS: Record<string, (doc: Obj, world: Obj) => boolean> = {
  'npcs.attack': (doc, world) => doc.hp !== undefined && world.combat !== undefined,
  'actions.duration': (d, w) => !w.time_policy && !/"status\.apply"/.test(JSON.stringify(d)), // INVALID_TIME_POLICY (scripted_actions.ex:88): the whole cartridge.json; duration_status (:94); ponytail: also hides it beside a permanent status, which status.ex:72 lets through
  'actions.craft': (doc) => (doc.target as Obj | undefined)?.kind !== 'spell', // replenish.ex:59
  'reactions.zone': (doc) => (doc.on as Obj | undefined)?.room === undefined, // ReactionRule: a zone forbids on.room
};

/** The menu's fields whose capability `requires.capabilities` (`caps`) declares and whose other needs
 * the definition (`doc`) and cartridge.json's `world` meet; others would not compile. */
export const allowed = (
  kind: string,
  menu: string[],
  caps: object,
  doc: Obj = {},
  world: Obj = {},
) =>
  menu.filter((f) => {
    const owners = OWNERS[`${kind}.${f}`]?.split(' ') ?? [];
    const need = NEEDS[`${kind}.${f}`];
    return owners.every((o) => Object.hasOwn(caps, o)) && (!need || need(doc, world));
  });
