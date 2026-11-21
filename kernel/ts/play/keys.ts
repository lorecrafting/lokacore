// A new definition's key and graph kind (mapedit.ts `create`, the panel's and the builder's New, a
// template's child): pure, no routes.

const minted = new Set<string>(); // `kind/key` handed out here: a second New before the recompile skips the first
/** A new definition's key, no name asked: the first `<base>_<n>` from 1 that no `kind` node in the graph,
 * no template and no key handed out before holds (a template's child: `<template>_<n>`). */
export function freeKey(
  base: string,
  kind: string,
  nodes: { kind: string; ref: string }[],
  templates: string[],
) {
  const taken = new Set([
    ...templates,
    ...nodes.filter((o) => o.kind === kind).map((o) => o.ref.split('/')[1]),
  ]);
  let n = 1;
  while (taken.has(`${base}_${n}`) || minted.has(`${kind}/${base}_${n}`)) n++;
  minted.add(`${kind}/${base}_${n}`);
  return `${base}_${n}`;
}

const NODE: Record<string, string> = { cutscene: 'scene', areas: 'room' };
/** The graph kind a starter compiles to (`rooms` → `room`, `statuses` → `status`, `cutscene` → `scene`). */
export const nodeOf = (kind: string) => NODE[kind] ?? kind.replace(/(us)es$|s$/, '$1');
/** Kinds no graph node holds the keys of: a reused key would merge silently, so the author names it. */
export const NAMED = ['text', 'behaviours'];

/** A dropped template's child key, `<template>_<n>`, free among the nodes of the template's kind. */
export const childKey = (
  dir: 'npcs' | 'items',
  template: string,
  nodes: { kind: string; ref: string }[],
  templates: string[],
) => freeKey(template, dir === 'npcs' ? 'npc' : 'item', nodes, templates);
