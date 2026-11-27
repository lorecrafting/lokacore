// The Cmd-K palette's model, shared by the panel (tools/author-panel/src/palette.tsx) and the
// Builder (mobile/app/author/build/palette.tsx): the command rows, the rows over definitions and
// text keys, and their ranking. Tested from kernel/ts/test/palette.test.ts.

import { fromRef, type Item } from './storylist.ts';
import NEW from './new.json' with { type: 'json' };

type Node = { ref: string; kind: string };

export const COMMANDS: Item[] = [
  // a starter of every editable kind (`bin/loka new`; test/loka/content_starters_test.exs compiles each)
  ...NEW.map((kind) => [`new-${kind}`, `New ${kind}`]),
  ['delete', 'Delete the selected definition'],
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
/** A definition's row label: `key · name`, the key alone with no written name. */
export const named = (key: string, name?: string) => (name ? `${key} · ${name}` : key);

/** The palette's rows: commands, /story's definitions, /find's text keys and the `~` keys. */
export function items(
  nodes: Node[],
  text: Record<string, string>,
  todo: Record<string, string>,
  names: Record<string, string> = {},
): Item[] {
  return [
    ...COMMANDS,
    ...nodes.flatMap((n) => {
      const s = fromRef(n.ref);
      return s
        ? [{ kind: 'key' as const, label: named(s.key, names[n.ref]), detail: s.kind, id: n.ref }]
        : [];
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
