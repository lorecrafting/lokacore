// The Scene card's lines (docs/rnd/gui-editor-design-2026-11-04.md §4.4): each a value it picks
// (POST /set, scene_card.ts) or a line of words the Book edits; no node:fs, the panel reads it.
import { choices } from './card.ts';

// the trimmed line scene_files.ex reads as `npc: `, `with: ` or `then: `; its indent and end kept
export const VALUE = /^(\s*(npc|with|then): )([a-z0-9_]+)(\s*)$/;
export type Verb = 'npc' | 'with' | 'then';
type Nodes = { ref: string; kind: string }[];

/** The keys a value line's verb picks, the card's and POST /set's alike, from the last good compile:
 * its NPCs; or each dialogue a then can enter (not `unlinkable`, dialogue_links.ex:387-394) and `end`. */
export const picks = (verb: Verb, nodes: Nodes, unlinkable: Record<string, string> = {}) =>
  verb === 'then'
    ? [...choices('dialogue', nodes).filter((k) => !(k in unlinkable)), 'end']
    : choices('npc', nodes);

/** A scene file the Scene card opens: `scenes/` or `dialogues/`, an area folder's too (Source.placed). */
export const scened = (rel: string | undefined) =>
  /(^|\/)(scenes|dialogues)\/[a-z0-9_]+\.scene$/.test(rel ?? '');

export type Line = { n: number; text: string; verb?: Verb; value?: string; key?: string };

/** The file's lines for the card: a value line its verb and value; a `* ` line of words the text
 * key that says it (a `<role>: ` line none: POST /edit refuses it, prose.ts), by the compile's `~` map, else by its words among the
 * file's own dialogue keys (`<kind>.<key>.` and its nested sets' `<kind>.<key>_<choice>.`). */
export function sceneLines(
  rel: string,
  bytes: string,
  kind: string,
  text: Record<string, string>,
  places: Record<string, string>,
): Line[] {
  const key = rel.slice(rel.lastIndexOf('/') + 1, -'.scene'.length);
  // the file's own set first: a sibling `<key>_x` file shares the nested sets' prefix
  const keys = Object.keys(text);
  const own = [
    ...keys.filter((k) => k.startsWith(`${kind}.${key}.`)),
    ...keys.filter((k) => k.startsWith(`${kind}.${key}_`)),
  ];
  const at = new Map(Object.entries(places).map(([k, p]) => [p, k]));
  return bytes.split('\n').map((t, i) => {
    const n = i + 1;
    const value = VALUE.exec(t);
    if (value) return { n, text: t, verb: value[2] as Verb, value: value[3] };
    const words = /^\s*\* (.*)$/.exec(t)?.[1];
    if (words === undefined) return { n, text: t };
    const found = at.get(`${rel}:${n}`) ?? own.find((k) => text[k].split('\n').includes(words));
    return found ? { n, text: t, key: found } : { n, text: t };
  });
}
