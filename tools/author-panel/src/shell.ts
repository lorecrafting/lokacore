// The editor shell's model (docs/design/editor-chrome-rulings.md): the remembered layout, the one
// selection the hierarchy, Book strip, map slot and inspector share, the Cmd-K palette's ranking,
// timings against their budgets, and the OS colour scheme. No React here: tested from
// kernel/ts/test/author_shell.test.ts.

import type { ListState } from './storylist.ts';
import NEW from './edit/new.json' with { type: 'json' };

export type Selection = { file?: string; kind: string; key: string };
/** The World card's selection: cartridge.json, which no graph node names (its card opens the root files). */
export const WORLD: Selection = { file: 'cartridge.json', kind: 'cartridge', key: 'world' };
export type Layout = {
  left: number;
  right: number;
  slot: number; // the map slot's height
  leftOpen: boolean;
  rightOpen: boolean;
  tablet: boolean;
  tab: 'hierarchy' | 'project';
  map: 'map' | 'story' | 'flow';
  selection?: Selection;
  story?: ListState; // the Story list's folds, focus and trace (Flow shares the folds)
  flow?: { follow?: string; filters?: string[] }; // the Flow graph's followed fact and filters
};
type Side = 'left' | 'right' | 'slot';

// The slot's most is its column less the tab strip, measured by the divider.
const RANGE = { left: [220, 480, 280], right: [280, 560, 360], slot: [160, Infinity, 240] }; // mutate-skip: uncalibrated design value
export const STORE = 'loka.editor.layout';
export const START = 'loka.editor.start'; // the pinned checkpoint a fresh Book replays
export const LAYOUT: Layout = {
  left: RANGE.left[2],
  right: RANGE.right[2],
  slot: RANGE.slot[2],
  leftOpen: true,
  rightOpen: true,
  tablet: false,
  tab: 'hierarchy',
  map: 'map',
};

export const reset = (side: Side) => RANGE[side][2];
export const clamp = (side: Side, px: number, most = RANGE[side][1]) =>
  Number.isFinite(px) ? Math.min(most, Math.max(RANGE[side][0], Math.round(px))) : reset(side);
const GROW: Record<Side, Record<string, number>> = {
  left: { ArrowRight: 1, ArrowLeft: -1 },
  right: { ArrowLeft: 1, ArrowRight: -1 },
  slot: { ArrowUp: 1, ArrowDown: -1 },
};
/** A divider's arrow key: 16 px, 64 with Shift; the right column grows leftwards, the slot upwards. */
export function nudge(side: Side, px: number, key: string, shift: boolean, most?: number) {
  return clamp(side, px + (GROW[side][key] ?? 0) * (shift ? 64 : 16), most);
}
/** Cmd-\ folds the left column, Cmd-/ the right. */
export const fold = (l: Layout, key: string): Layout =>
  key === '\\'
    ? { ...l, leftOpen: !l.leftOpen }
    : key === '/'
      ? { ...l, rightOpen: !l.rightOpen }
      : l;

export function load(storage: Pick<Storage, 'getItem'>): Layout {
  let kept: Partial<Layout> = {};
  try {
    kept = JSON.parse(storage.getItem(STORE) ?? '{}') as Partial<Layout>;
  } catch {
    // a hand-edited or old value: the defaults
  }
  const l = { ...LAYOUT, ...kept };
  return {
    ...l,
    left: clamp('left', l.left),
    right: clamp('right', l.right),
    slot: clamp('slot', l.slot),
  };
}
export const save = (storage: Pick<Storage, 'setItem'>, l: Layout) =>
  storage.setItem(STORE, JSON.stringify(l));

const REF = /^[^@]+@[^:]+:([a-z_]+)\/(.+)$/; // a DefinitionRefString, kernel/ts/play/reach.ts
/** The selection of a /story node (`id@ver:kind/key`). */
export const fromRef = (ref: string): Selection | undefined => {
  const m = REF.exec(ref);
  return m ? { kind: m[1], key: m[2] } : undefined;
};
/** The selection of a Book line's text key (`kind.key.field`). */
export const fromTextKey = (textKey: string): Selection | undefined => {
  const [kind, key] = textKey.split('.');
  return key ? { kind, key } : undefined;
};
export type Node = { ref: string; kind: string };
/** The source a selection's card edits: its node's file, or the World row's own (no node names cartridge.json). */
export const fileOf = (sel: Selection, ref?: string, files?: Record<string, string>) =>
  ref ? files?.[ref] : sel.kind === WORLD.kind ? sel.file : undefined;

/** What each of the four places shows for one selection. */
export function places(sel: Selection | undefined, nodes: Node[]) {
  const node = sel && nodes.find((n) => n.ref.endsWith(`:${sel.kind}/${sel.key}`));
  return {
    hierarchy: node?.ref,
    book: sel && { op: 'select' as const, kind: sel.kind, key: sel.key },
    map: node?.ref,
    inspector: node,
  };
}

export type Item = {
  kind: 'command' | 'key' | 'text' | 'todo' | 'story';
  label: string;
  detail: string;
  id: string;
};
export const COMMANDS: Item[] = [
  // a starter of every editable kind (`bin/loka new`; test/loka/content_starters_test.exs compiles each)
  ...NEW.map((kind) => [`new-${kind}`, `New ${kind}`]),
  ['hold', 'Hold or release compiles'],
  ['undo', 'Undo the last edit'],
  ['go', 'Go to room'],
  // the map's edits on the selected room (mapwire.ts `mapCommand`)
  ['map-grow', 'New room from here'],
  ['map-area', 'Move room to area'],
  ['map-npc', 'New NPC here'],
  ['map-item', 'New item here'],
  ['map-unlink', 'Delete exit'],
  ['map-one-way', 'One-way exit (toggle)'],
  ['map-door', 'Door on exit'],
  ['map-lock', 'Lock on exit'],
  ['map-undo', 'Undo the last map edit'],
].map(([id, label]) => ({ kind: 'command', label, detail: 'command', id }));
/** The palette's rows: commands, /story's definitions, /find's text keys and the `~` keys. */
export function items(
  nodes: Node[],
  text: Record<string, string>,
  todo: Record<string, string>,
): Item[] {
  return [
    ...COMMANDS,
    ...nodes.flatMap((n) => {
      const s = fromRef(n.ref);
      return s ? [{ kind: 'key' as const, label: s.key, detail: s.kind, id: n.ref }] : [];
    }),
    ...Object.entries(todo).map(([key, at]) => ({
      kind: 'todo' as const,
      label: `~ ${key}`,
      detail: at,
      id: key,
    })),
    ...Object.entries(text)
      .filter(([key]) => !(key in todo))
      .map(([key, words]) => ({ kind: 'text' as const, label: words, detail: key, id: key })),
  ];
}
/** /find's hits on text.json lines (`"key": "words",`), as key to words; other files hold no text key. */
export function words(hits: { at: string; text: string }[]) {
  const out: Record<string, string> = {};
  for (const { at, text } of hits) {
    if (!at.startsWith('text.json:')) continue;
    try {
      Object.assign(out, JSON.parse(`{${text.replace(/,$/, '')}}`));
    } catch {} // a brace line or a value over several lines: no row
  }
  return out;
}
/** Rows holding `q`: a label that starts with it first, then one holding it, then a detail; `~` alone narrows to the unwritten. */
export function rank(
  q: string,
  all: Item[],
  max = 50 /* mutate-skip: list length, a design value */,
) {
  const s = q.trim().toLowerCase();
  const pool = s.startsWith('~') ? all.filter((i) => i.kind === 'todo') : all;
  const find = s.replace(/^~\s*/, '');
  const score = (i: Item) => {
    const label = i.label.toLowerCase().replace(/^~ /, '');
    if (label.startsWith(find)) return 0;
    if (label.includes(find)) return 1;
    return i.detail.toLowerCase().includes(find) ? 2 : 3;
  };
  return pool
    .map((i) => [score(i), i] as const)
    .filter(([n]) => n < 3)
    .sort((a, b) => a[0] - b[0])
    .slice(0, max)
    .map(([, i]) => i);
}

export type Timings = {
  at: number;
  compile: number;
  publish: number;
  kind: 'prose' | 'structural' | 'refusal';
  sha256?: string;
};
export const BUDGET = {
  prose: 300,
  structural: 1500,
  refusal: 1000,
  card: 100,
  flowOpen: 300,
  flowUpdate: 100,
}; // mutate-skip: uncalibrated design value
/** One edit's milliseconds: compile and publish, and for a structural edit the Book's load until `ready`. */
export const total = (t: Timings, load: number) => t.compile + t.publish + load;
export const within = (t: Timings, load = 0) => total(t, load) <= BUDGET[t.kind];

export type Loaded = { sha256?: string; at: number };
/** A structural edit's Book load: from its publish to the Book's `ready` naming its artifact. */
export const loadOf = (t: Timings, loaded?: Loaded) =>
  t.kind === 'structural' && loaded && loaded.sha256 === t.sha256 && loaded.at >= t.at
    ? loaded.at - t.at
    : 0;

type Scheme = {
  matches: boolean;
  addEventListener(type: 'change', f: () => void): void;
  removeEventListener(type: 'change', f: () => void): void;
};
// Shapes, not the DOM's types: the kernel tests that import this have no DOM lib.
type Root = {
  classList: { toggle(c: string, on: boolean): unknown };
  style: { colorScheme: string };
};

/** `.dark` and color-scheme follow the OS setting, now and on each change; returns the unfollow. */
export function follow(scheme: Scheme, root: Root) {
  const apply = () => {
    root.classList.toggle('dark', scheme.matches);
    root.style.colorScheme = scheme.matches ? 'dark' : 'light';
  };
  apply();
  scheme.addEventListener('change', apply);
  return () => scheme.removeEventListener('change', apply);
}
