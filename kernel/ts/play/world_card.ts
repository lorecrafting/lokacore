// The World card's logic (docs/rnd/gui-editor-design-2026-11-04.md §6, E6e; cards hold no logic):
// its pickers, the keyed root files' new entries and keys. Re-exported by card.ts.
import type { Step } from './edit_model.ts';

type Obj = Record<string, unknown>;

/** The keys of the nodes of the kind a reference field names (`room` lists rooms); [] is free text. */
export const choices = (field: string, nodes: { ref: string; kind: string }[]) =>
  nodes.filter((n) => n.kind === field).map((n) => n.ref.slice(n.ref.lastIndexOf('/') + 1));
/** A source file's area (Areas.area_of, areas.ex:57-63): `<a>` for `areas/<a>.json` and `areas/<a>/<dir>/<file>`. */
const areaOf = (rel = '') => {
  const [top, area, ...rest] = rel.split('/');
  if (top !== 'areas') return undefined;
  return rest.length ? (rest.length === 2 ? area : undefined) : area?.replace(/\.[^.]*$/, '');
};
/** Another area's definition a file in `from` may not name (Areas.crossed, areas.ex:70-73): its area, else undefined. */
export const crossed = (from?: string, to?: string) => {
  const [a, b] = [areaOf(from), areaOf(to)];
  return a && b && a !== b ? b : undefined;
};
type Files = Record<string, string>;
/** The nodes a definition in file `rel` may name: any room, else not another area's (area_rules.ex:27),
 * by the node's own file or its `areas/<a>.json` bundle (story.ts files, bundled). */
export const reachable = <N extends { ref: string; kind: string }>(
  nodes: N[],
  { files = {}, bundled = {} }: { files?: Files; bundled?: Files } = {},
  rel?: string,
) => nodes.filter((n) => n.kind === 'room' || !crossed(rel, files[n.ref] ?? bundled[n.ref]));

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

/** A new entry `key` of a ROOTS file: a default pool writes nothing (resources.ex:218 merges its @defaults). */
export const newEntry = ({ field, blank }: (typeof ROOTS)[number], key: string) =>
  field === 'resources' && POOLS.includes(key) ? {} : blank;

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
