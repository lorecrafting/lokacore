// A `.cut` file's page ops (docs/design/scene-structure-rulings.md §1, §3, §4): the one pure
// function POST /restructure (scene_card.ts) and the Scene card's page buttons both call, so every
// refusal is checked here. No node:fs: the panel reads it. Every byte the op does not touch is kept.

/** `n` is a file line (from 1): a page's line, or for `split` the line that starts the new page. */
export type Op =
  | { add: { after: number; kind: 'page' } }
  | { remove: number }
  | { move: number; by: -1 | 1 }
  | { split: number }
  | { join: number };
type Block = [first: number, last: number]; // 0-based lines

const END = '---';
const isEnd = (lines: string[], [first]: Block) => lines[first].trim() === END;

/** The file's pages and its end marks, in order: a page is a run of non-blank lines, and `---` is
 * its own block that ends one (cut_files.ex paragraphs/1; lines are trimmed). */
export function blocks(lines: string[]): Block[] {
  const out: Block[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const last = out.at(-1);
    if (line !== END && last && last[1] === i - 1 && !isEnd(lines, last)) last[1] = i;
    else out.push([i, i]);
  });
  return out;
}

/** The compiler's `cut_end` (cut_files.ex:70-79): some page, then `---` once and last. */
function ended(lines: string[]) {
  const said = lines.map((l) => l.trim()).filter(Boolean);
  if (!said.some((l) => l !== END)) return 'a cut needs a page';
  if (said.at(-1) !== END || said.indexOf(END) !== said.length - 1)
    return '`---` closes the cut, once, under its last page';
}

/** The cut's bytes after `op`, or why it is refused. `steps`: its `scenes/<key>.json` twin carries
 * `steps`, which replace the pages (scene_merge.ex deep merge), so the pages are not the cut's. */
export function cut(bytes: string, op: Op, steps = false): { after: string } | { refused: string } {
  if (steps) return { refused: 'the twin .json carries steps: edit its pages there' };
  const lines = bytes.split('\n');
  const all = blocks(lines);
  const o = (op && typeof op === 'object' ? op : {}) as Record<string, any>;
  if (Object.keys(o).filter((k) => k !== 'by').length !== 1) return { refused: 'one op per write' };
  const n = 'add' in o ? o.add?.after : (o.remove ?? o.move ?? o.split ?? o.join);
  const i = all.findIndex(([a, b]) => a <= n - 1 && n - 1 <= b);
  if (!Number.isInteger(n) || i < 0) return { refused: `no page at line ${n}` };
  const [first, last] = all[i];
  const out = [...lines];
  if ('add' in o) {
    if (o.add.kind !== 'page') return { refused: 'a cut adds only a page' };
    out.splice(last + 1, 0, '', '~');
  } else if ('remove' in o) {
    // the page and the blank run before it (after it, for the first): the rest keeps its spacing
    const from = i > 0 ? all[i - 1][1] + 1 : first;
    const to = i > 0 ? last : (all[i + 1]?.[0] ?? lines.length) - 1;
    out.splice(from, to - from + 1);
  } else if ('move' in o) {
    const j = i + o.by;
    if (Math.abs(o.by) !== 1 || !all[j])
      return { refused: `no page ${o.by < 0 ? 'above' : 'below'}` };
    const [[a0, a1], [b0, b1]] = [all[Math.min(i, j)], all[Math.max(i, j)]];
    const part = (x: number, y: number) => lines.slice(x, y + 1);
    out.splice(a0, b1 - a0 + 1, ...part(b0, b1), ...part(a1 + 1, b0 - 1), ...part(a0, a1));
  } else if ('split' in o) {
    if (n - 1 === first || isEnd(lines, all[i]))
      return { refused: 'split at a page’s second line or later' };
    out.splice(n - 1, 0, '');
  } else if ('join' in o) {
    const next = all[i + 1];
    if (!next || isEnd(lines, all[i]) || isEnd(lines, next)) return { refused: 'no page below' };
    out.splice(last + 1, next[0] - last - 1);
  } else return { refused: 'op: add, remove, move, split or join' };
  const refused = ended(out);
  return refused ? { refused } : { after: out.join('\n') };
}
