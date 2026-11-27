// The editor shell's model (docs/design/editor-chrome-rulings.md): the remembered layout, the one
// selection the hierarchy, Book strip, map slot and inspector share, the Cmd-K palette's ranking,
// timings against their budgets, and the OS colour scheme. No React here: tested from
// kernel/ts/test/author_shell.test.ts.

import { fromRef, type Item, type Selection } from '../../../kernel/ts/play/storylist.ts';
import type { Layout } from '../../../kernel/ts/play/flow.ts';
import NEW from '../../../kernel/ts/play/new.json' with { type: 'json' };
import { nodeOf } from '../../../kernel/ts/play/mapedit.ts';

export { fromRef, type Item, type Layout, type Selection };
export { COMMANDS, items, named, rank, words } from '../../../kernel/ts/play/palette.ts';
/** The World card's selection: cartridge.json, which no graph node names (its card opens the root files). */
export const WORLD: Selection = { file: 'cartridge.json', kind: 'cartridge', key: 'world' };
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

/** The starter a Hierarchy kind header's + makes: `room` → rooms (the later of areas and rooms wins). */
// The actions starter writes a scripted action, not the command `action` nodes listed under that header, so it gets no +.
export const STARTER: Record<string, string> = Object.fromEntries(NEW.filter((k) => k !== 'actions').map((k) => [nodeOf(k), k]));
/** The Hierarchy's New list: every starter of kernel/ts/play/new.json, by what an author is making. */
export const GROUPS: [string, string[]][] = [
  ['Places', ['rooms', 'areas', 'barriers', 'transports', 'structures']],
  ['People and things', ['npcs', 'items', 'populations', 'services', 'liquids']],
  ['Story', ['quests', 'dialogues', 'cutscene', 'reactions', 'actions', 'topics', 'facts', 'behaviours', 'emotes']],
  ['World rules', ['resources', 'attributes', 'skills', 'statuses', 'bleeds', 'replenish']],
  ['Files', ['layout', 'text', 'outline']],
];
/** The palette command a New `kind` runs: an NPC or item goes in the selected room, as New NPC/item here. */
export const newCommand = (kind: string, sel?: Selection) =>
  sel?.kind === 'room' && (kind === 'npcs' || kind === 'items') ? `map-${kind.slice(0, -1)}` : `new-${kind}`;

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
