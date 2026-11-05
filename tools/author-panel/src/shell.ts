// The editor shell's model (docs/design/editor-chrome-rulings.md): the remembered layout, the one
// selection the hierarchy, Book strip, map slot and inspector share, the Cmd-K palette's ranking,
// timings against their budgets, and the OS colour scheme. No React here: tested from
// kernel/ts/test/author_shell.test.ts.

export type Selection = { file?: string; kind: string; key: string };
export type Layout = {
  left: number;
  right: number;
  leftOpen: boolean;
  rightOpen: boolean;
  tablet: boolean;
  tab: 'hierarchy' | 'project';
  map: 'map' | 'story';
  selection?: Selection;
};
type Side = 'left' | 'right';

const RANGE = { left: [220, 480, 280], right: [280, 560, 360] }; // mutate-skip: uncalibrated design value
export const STORE = 'loka.editor.layout';
export const START = 'loka.editor.start'; // the pinned checkpoint a fresh Book replays
export const LAYOUT: Layout = {
  left: RANGE.left[2],
  right: RANGE.right[2],
  leftOpen: true,
  rightOpen: true,
  tablet: false,
  tab: 'hierarchy',
  map: 'map',
};

export const reset = (side: Side) => RANGE[side][2];
export const clamp = (side: Side, px: number) =>
  Number.isFinite(px)
    ? Math.min(RANGE[side][1], Math.max(RANGE[side][0], Math.round(px)))
    : reset(side);
/** A divider's arrow key: 16 px, 64 with Shift; the right column grows leftwards. */
export function nudge(side: Side, px: number, key: string, shift: boolean) {
  const way = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  return clamp(side, px + way * (shift ? 64 : 16) * (side === 'left' ? 1 : -1));
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
  return { ...l, left: clamp('left', l.left), right: clamp('right', l.right) };
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
  kind: 'command' | 'key' | 'text' | 'todo';
  label: string;
  detail: string;
  id: string;
};
export const COMMANDS: Item[] = [
  ['new', 'New room'],
  ['hold', 'Hold or release compiles'],
  ['undo', 'Undo the last edit'],
  ['go', 'Go to room'],
].map(([id, label]) => ({ kind: 'command', label, detail: 'command', id }));
/** The palette's rows: commands, /story's definitions, the event stream's text keys and `~` keys. */
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
/** Rows holding `q`: a label that starts with it first, then one holding it, then a detail; `~` alone narrows to the unwritten. */
export function rank(q: string, all: Item[], max = 50) {
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
export const BUDGET = { prose: 300, structural: 1500, refusal: 1000, card: 100 }; // mutate-skip: uncalibrated design value
/** One edit's milliseconds: compile and publish, and for a structural edit the Book's load until `ready`. */
export const total = (t: Timings, load = 0) => t.compile + t.publish + load;
export const within = (t: Timings, load = 0) => total(t, load) <= BUDGET[t.kind];

export type Loaded = { sha256?: string; at: number };
/** A structural edit's Book load: from its publish to the Book's `ready` naming its artifact. */
export const loadOf = (t: Timings, loaded?: Loaded) =>
  t.kind === 'structural' && loaded && loaded.sha256 === t.sha256 && loaded.at >= t.at
    ? loaded.at - t.at
    : 0;

/** `.dark` and color-scheme follow the OS setting, now and on each change; returns the unfollow. */
export function follow(
  scheme: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>,
  root: HTMLElement,
) {
  const apply = () => {
    root.classList.toggle('dark', scheme.matches);
    root.style.colorScheme = scheme.matches ? 'dark' : 'light';
  };
  apply();
  scheme.addEventListener('change', apply);
  return () => scheme.removeEventListener('change', apply);
}
