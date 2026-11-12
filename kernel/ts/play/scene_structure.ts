// size: allow 310, one pure function per op, each with its refusal beside it; splitting the op set would split the one guard
// A `.cut` file's page ops and a `.scene` file's line ops (docs/design/scene-structure-rulings.md
// §1, §3, §4): the pure functions POST /restructure and the Scene card both call. No node:fs: the
// panel reads it. Every untouched byte is kept, and every refusal is checked here.
import { choiceKey, freeKey, reword, TODO, type Row } from './scene_choice.ts';
export { choiceKey, choiceLabel, rewordedChoice } from './scene_choice.ts';
/** `n` is a file line (from 1); a reword names its choice by `line` and the words it becomes. */
export type Op =
  | { add: { after: number; kind: SceneKind; value?: string } }
  | { remove: number }
  | { move: number; by: -1 | 1 }
  | { split: number }
  | { join: number }
  | { reword: { line: number; words: string } };
type Block = [first: number, last: number]; // 0-based lines

const END = '---';
const isEnd = (lines: string[], [first]: Block) => lines[first].trim() === END;

/** The `.scene` line kinds the card adds (rulings §1): the grammar's own, nothing new. */
export type SceneKind =
  | 'page'
  | 'choice'
  | 'words'
  | 'speaker'
  | 'then'
  | 'needs'
  | 'once'
  | 'once:'
  | 'asked'
  | 'gives'
  | 'sets'
  | 'quest';

/** The file's pages and its end marks: a page is a run of non-blank lines, `---` its own block. */
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

/** Swap two blocks, the upper one first in file order, keeping every other byte. */
function reorder(lines: string[], out: string[], x: Block, y: Block) {
  const [[a0, a1], [b0, b1]] = [x, y];
  out.splice(
    a0,
    b1 - a0 + 1,
    ...lines.slice(b0, b1 + 1),
    ...lines.slice(a1 + 1, b0),
    ...lines.slice(a0, a1 + 1),
  );
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
    reorder(lines, out, all[Math.min(i, j)], all[Math.max(i, j)]);
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

/** A `.scene` line as the card sees it: its indent, and on a `- ` line its key (S3's ` #<key>`). */

const KEYLINE = /^(npc|with|when): /;
export const rows = (lines: string[]): Row[] =>
  lines.map((text, i) => {
    const indent = text.length - text.trimStart().length;
    const body = text.trim();
    if (!body.startsWith('- ')) return { indent, text };
    const label = body.slice(2);
    return { indent, text, key: choiceKey(label, i + 1) };
  });

/** A choice's block: its line and every deeper line under it. Trailing blanks belong to neither
 * side, so a swap leaves them where they are. */
const block = (rs: Row[], at: number): Block => {
  const { indent } = rs[at];
  let end = at;
  for (let j = at + 1; j < rs.length; j++) {
    if (rs[j].text.trim() === '') continue;
    if (rs[j].indent <= indent) break;
    end = j;
  }
  return [at, end];
};

/** The sibling choices at `at`'s depth in file order; a shallower line closes the set. */
function siblings(rs: Row[], at: number) {
  const { indent } = rs[at];
  const out: number[] = [];
  for (let j = 0; j < rs.length; j++) {
    const r = rs[j];
    if (r.indent < indent && out.length) break;
    if (r.indent === indent && r.key !== undefined) out.push(j);
  }
  return out;
}

/** The nearest `- ` above `at` at a shallower indent: the choice a sub-line belongs to. */
function parent(rs: Row[], at: number) {
  for (let j = at - 1; j >= 0; j--)
    if (rs[j].key !== undefined && rs[j].indent < rs[at].indent) return j;
  return -1;
}

const HEADS: Record<string, string> = {
  then: 'then:',
  needs: 'needs:',
  once: 'once',
  'once:': 'once:',
  asked: 'asked',
  gives: 'gives:',
  sets: 'sets:',
  quest: 'quest:',
};
const VALUED = new Set(['needs', 'gives', 'sets', 'quest', 'once:']);
const ONCE = new Set(['then', 'once', 'once:', 'asked', 'quest']);

/** The kinds a row may add, in the toolbar's order (rulings §1, §5): the sub-lines a block already
 * holds once are left out, so the menu offers only what the grammar would take. */
export function offers(rs: Row[], at: number): SceneKind[] {
  const under = rs.slice(...(block(rs, at) as [number, number]));
  const base: SceneKind[] = [
    'choice',
    'speaker',
    'words',
    'then',
    'needs',
    'once:',
    'asked',
    'gives',
    'sets',
    'quest',
  ];
  return base.filter(
    (k) => !(ONCE.has(k) && under.some((r) => r.text.trim().startsWith(HEADS[k]))),
  );
}

/** The line a kind adds at `indent`, or why it cannot (`~` is the placeholder the toolbar counts).
 * A new choice is keyed at once (rulings §2): `- ~ #choice_<n>`, the next free `choice_<n>` in the
 * file, so a choice the card makes never depends on its line number or its words. */
function made(kind: SceneKind, indent: string, value: string | undefined, under: Row[], rs: Row[]) {
  if (kind === 'page') return `${indent}- ~`;
  if (kind === 'choice') return `${indent}- ~ #${freeKey(rs.map((r) => r.key))}`;
  if (kind === 'words') return `${indent}* ~`;
  if (kind === 'speaker')
    return value ? `${indent}${value}: ~` : { refused: 'a speaker line names a role' };
  const head = HEADS[kind];
  if (!head) return { refused: `no kind ${kind}` };
  // the ones a choice holds once (scene_files.ex:331-338): a second `then:` or `once` cannot lower.
  // `needs:`, `sets:` and `gives:` repeat, one per fact or item
  if (ONCE.has(kind) && under.some((r) => r.text.trim().startsWith(head)))
    return { refused: `this choice already has \`${head}\`` };
  return `${indent}${head}${VALUED.has(kind) ? ` ${value ?? '~'}` : ''}`;
}

/** One op's edit of `lines`, or why it is refused: `add`, `remove` or `move` (§1). */
function edit(
  o: Record<string, any>,
  rs: Row[],
  out: string[],
  lines: string[],
  at: number,
): { refused: string } | undefined {
  const text = rs[at].text.trim();
  if (!text) return { refused: `no line ${at + 1}` };
  if ('add' in o) {
    // a choice goes after the line's whole block at its own depth; anything else right after the
    // line, a sub-line two spaces deeper than a `- ` one (its block's indent)
    const kind = o.add?.kind as SceneKind;
    const [, b] = kind === 'choice' ? block(rs, at) : ([at, at] as Block);
    const under = rs.slice(...(block(rs, at) as [number, number]));
    const depth = rs[at].key === undefined ? rs[at].indent : rs[at].indent + 2;
    const made_ = made(
      kind,
      ' '.repeat(kind === 'choice' ? rs[at].indent : depth),
      o.add.value,
      under,
      rs,
    );
    if (typeof made_ !== 'string') return made_;
    out.splice(b + 1, 0, made_);
  } else if ('reword' in o) return reword(o, rs, out, at);
  else if ('remove' in o) {
    if (KEYLINE.test(text)) return { refused: 'a key line has no Remove' };
    const [a, b] = rs[at].key === undefined ? ([at, at] as Block) : block(rs, at);
    out.splice(a, b - a + 1);
  } else if ('move' in o) return shifted(o, rs, out, lines, at);
  else return { refused: 'op: add, remove, move or reword on a .scene' };
}

/** A move by one: a choice with its block past a sibling, or a sub-line within its own block. */
function shifted(
  o: Record<string, any>,
  rs: Row[],
  out: string[],
  lines: string[],
  at: number,
): { refused: string } | undefined {
  if (Math.abs(o.by) !== 1) return { refused: 'move by one' };
  let x: Block, y: Block;
  if (rs[at].key !== undefined) {
    const sibs = siblings(rs, at);
    const here = sibs.indexOf(at);
    const dest = here + o.by;
    if (dest < 0 || dest >= sibs.length)
      return { refused: `no choice ${o.by < 0 ? 'above' : 'below'}` };
    x = block(rs, Math.min(sibs[here], sibs[dest]));
    y = block(rs, Math.max(sibs[here], sibs[dest]));
  } else {
    const up = parent(rs, at);
    const j = at + o.by;
    const pb = up < 0 ? rs.length - 1 : block(rs, up)[1];
    if (up < 0 || j <= up || j > pb || rs[j].indent !== rs[at].indent || rs[j].key !== undefined)
      return { refused: `no line ${o.by < 0 ? 'above' : 'below'}` };
    x = [Math.min(at, j), Math.min(at, j)];
    y = [Math.max(at, j), Math.max(at, j)];
  }
  reorder(lines, out, x, y);
}

/** `.scene` bytes after `op`, or why it is refused (§1, §2, §4). `refers` says whether a choice key
 * has any referrer (a twin `choices.<c>`, `riddle.choice_id`, a quest outcome, a `choice_resolved`
 * reaction, a save): a `~` choice's key is its line number, so shifting one that has a referrer
 * would orphan it. A changed key with no referrer goes through. */
export function scene(
  bytes: string,
  op: Op,
  refers: (key: string) => boolean = () => false,
): { after: string } | { refused: string } {
  const lines = bytes.split('\n');
  const rs = rows(lines);
  const o = (op && typeof op === 'object' ? op : {}) as Record<string, any>;
  // one op per write: `by` is a move's argument and `words` a reword's, not ops of their own
  const ops = Object.keys(o).filter((k) => k !== 'by' && k !== 'words');
  if (ops.length !== 1) return { refused: 'one op per write' };
  const n =
    'add' in o
      ? o.add?.after
      : 'reword' in o
        ? o.reword?.line
        : (o.remove ?? o.move ?? o.split ?? o.join);
  const at = Number.isInteger(n) ? n - 1 : -1;
  if (at < 0 || at >= lines.length) return { refused: `no line ${n}` };
  const out = [...lines];
  const refused = edit(o, rs, out, lines, at);
  if (refused) return refused;
  // §2: a `~` choice keys on its line (todo__<n>), so an op that renumbers one with a referrer is
  // refused before it writes
  for (const [i, r] of rows(out).entries()) {
    const key = rs[i]?.key;
    if (!key?.startsWith(TODO) || !refers(key)) continue;
    if (r.key !== key) return { refused: `give choice ${key.slice(TODO.length)} its words first` };
  }
  return { after: out.join('\n') };
}
