// The outline's edits (design 5c) as mapedit gestures: split from mapedit.ts at its size limit.
import type { Run } from './mapedit.ts';

const no = (why: string): never => {
  throw new Error(why);
};
type Outline = { parts: { beats: { n: number; nodes?: string[] }[] }[] };
/** Bind (design 5c): `short`, one of `known` (Story.shorts), joins beat `n` of part `part` in outline.json. */
export const bind = (s: Run, part: number, n: number, short: string, known: string[]) =>
  s.change<Outline>('outline.json', (doc) => {
    if (!known.includes(short)) no(`${short} is no definition in the last compile`);
    const beats = doc.parts[part]?.beats ?? no(`outline.json has no part ${part + 1}`);
    const j = beats.findIndex((b) => b.n === n);
    if (j < 0) no(`part ${part + 1} has no beat ${n}`);
    const nodes = beats[j].nodes ?? [];
    if (nodes.includes(short)) no(`beat ${n} already binds ${short}`);
    return [{ path: ['parts', part, 'beats', j, 'nodes'], value: [...nodes, short] }];
  });

// Beat edits (design 5c) on part `part` of outline.json.
const partOf = (doc: Outline, part: number) =>
  doc.parts[part]?.beats ?? no(`outline.json has no part ${part + 1}`);
const beatOf = (doc: Outline, part: number, n: number) => {
  const j = partOf(doc, part).findIndex((b) => b.n === n);
  return j < 0 ? no(`part ${part + 1} has no beat ${n}`) : ['parts', part, 'beats', j];
};
// a beat's n is unique across the outline: readOutline (kernel/ts/play/story.ts) refuses a repeat
export const addBeat = (s: Run, part: number, n: number) =>
  s.change<Outline>('outline.json', (doc) => {
    if (!Number.isInteger(n) || n < 1) no(`a beat's number is a whole number from 1, not ${n}`);
    if (doc.parts.some((p) => p.beats.some((b) => b.n === n)))
      no(`outline.json already has beat ${n}`);
    const beats = [...partOf(doc, part), { n }].sort((a, b) => a.n - b.n); // play reads number order
    return [{ path: ['parts', part, 'beats'], value: beats }];
  });
export const titleBeat = (s: Run, part: number, n: number, title: string) =>
  s.change<Outline>('outline.json', (doc) => {
    const path = [...beatOf(doc, part, n), 'title'];
    const had = partOf(doc, part).some((b) => b.n === n && 'title' in b);
    return title ? [{ path, value: title }] : had ? [{ path, delete: true }] : []; // none: nothing to remove
  });
export const dropBeat = (s: Run, part: number, n: number) =>
  s.change<Outline>('outline.json', (doc) => [{ path: beatOf(doc, part, n), delete: true }]);
