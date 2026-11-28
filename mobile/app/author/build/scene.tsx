// A scene's rows in Build (slice 5.2, docs/design/scene-structure-rulings.md §1, §3-§5): a `.scene`
// file's lines and a `.cut` file's pages, each with its acts through one `/restructure`, refused as
// scene()/cut() refuse them on the bytes shown (a refused act is greyed with why and sends nothing);
// and a modal scene's trigger and treatment (scene_trigger.ts, the panel's ModalScene). Labels are
// placeholders.
import { Pressable, Text, View } from 'react-native';
import {
  blocks,
  cut,
  offers as kindsAt,
  rows,
  scene,
  type Op,
  type SceneKind,
} from '../../../../kernel/ts/play/scene_structure.ts';
import type { On } from '../../../../kernel/ts/play/scene_trigger.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { block } from './form.tsx';
import { opened, toggle, type Block } from './formwrite.ts';
import { known } from './room.tsx';
import { ed, io, row, run, tell } from './roomedit.tsx';
import { act, greyed } from './sheet.tsx';
import { trigger } from './trigger.tsx';

export const WORDS = {
  add: (n: number) => `Add after line ${n}`,
  up: (n: number) => `Move up line ${n}`,
  down: (n: number) => `Move down line ${n}`,
  remove: (n: number) => `Remove line ${n}`,
  addPage: (p: number) => `Add after page ${p}`,
  upPage: (p: number) => `Move up page ${p}`,
  downPage: (p: number) => `Move down page ${p}`,
  join: (p: number) => `Join page ${p}`,
  removePage: (p: number) => `Remove page ${p}`,
  split: (p: number, n: number) => `Split page ${p} at line ${n}`,
  kind: (k: SceneKind, role?: string) =>
    k === 'speaker' || k === 'words' ? `${k} line${role ? ` ${role}` : ''}` : k,
};
const UNDER = 1; // mutate-skip: layout only (an act row's indent under its line)
const FLUSH = 0; // mutate-skip: layout only (a cut line's indent)
const LABEL = { ...type.label, color: ink('dim') };

type Src = { bytes: string; sha256: string };
type Row = ReturnType<typeof rows>[number];
const got = new Map<string, Src>(); // each file's bytes as last read
const fresh = new Set<string>(); // read under the latest /story
let of: unknown;
/** `file`'s bytes as last read; read again under a new /story (generic.tsx `load`), then a redraw. */
function source(file: string) {
  if (of !== known.files) (fresh.clear(), (of = known.files));
  if (!fresh.has(file)) {
    fresh.add(file);
    io.source(file).then(
      (s) => (got.set(file, s), known.redraw()),
      () => (got.delete(file), known.redraw()), // gone (a scene with no .cut): nothing to draw
    );
  }
  return got.get(file);
}

const ROW = 'loka-build-row'; // [row, open, end]: a `.scene` op's compile reloads the Book (App.tsx)
let focus: string | undefined; // the row to take focus once drawn (rulings §5)
try {
  const [k, open, end] = JSON.parse(localStorage.getItem(ROW) ?? 'null') ?? [];
  if (end > Date.now()) {
    if (open) opened.add(k);
    focus = k;
  }
  localStorage.setItem(ROW, 'null');
} catch {} // a damaged entry or none (a test, native): no row takes focus
/** Line `op` leaves its row at in `now` (was `was`): an add's new line, the first changed non-blank
 * one; a move's row at the start of the unit (`starts`) it passed, above on `was`, below on `now`. */
function landed(op: Op, was: string[], now: string[], starts: (ls: string[]) => number[]) {
  if ('add' in op) {
    let i = now.findIndex((l, j) => l !== was[j]);
    while (!now[i].trim()) i++;
    return i + 1;
  }
  if (!('move' in op)) return undefined; // a remove, split or join lands no row
  const at = op.move - 1;
  const above = starts(was).filter((k) => k < at);
  return (op.by < 0 ? above.at(-1) : starts(now).find((k) => k > at))! + 1;
}
/** Sends `op` on `s`; once done, a moved row stays open and focused at its new line, an added row
 * takes focus. */
const restructure = (
  file: string,
  s: Src,
  op: Op,
  now: string,
  starts: (ls: string[]) => number[],
) =>
  run(async () => {
    // after a remove, split or join `${file}:undefined`: no row takes focus
    const to = `${file}:${landed(op, s.bytes.split('\n'), now.split('\n'), starts)}`;
    const from = 'move' in op && `${file}:${op.move}`;
    // kept first, as the reload can come first; so not cleared on success, but ending soon
    localStorage.setItem(ROW, JSON.stringify([to, from && opened.has(from), Date.now() + 10_000]));
    try {
      await ed.call('restructure', { file, was: s.sha256, op, carry: [] }); // a refusal throws
    } catch (e) {
      localStorage.setItem(ROW, 'null');
      throw e;
    }
    focus = to;
    if (from) opened.delete(from) && opened.add(to);
    else for (const k of opened) if (k.startsWith(`${file}:`)) opened.delete(k); // the lines shifted
  });
/** An act: pressable when `why` is undefined, else greyed with it. */
const acted = (label: string, why: string | undefined, go: () => void) =>
  why === undefined ? act(label, go) : greyed(label, why, label);
type Done = { after: string } | { refused: string };
const why = (r: Done) => ('refused' in r ? r.refused : undefined);

/** `file`'s acts on `s`, each checked by `check`: its refusal, a send, a press that tells or sends,
 * and a drawn act. */
function acts(file: string, s: Src, test: (op: Op) => Done, starts: (ls: string[]) => number[]) {
  const check = (op: Op) => why(test(op));
  const go = (op: Op) => restructure(file, s, op, (test(op) as { after: string }).after, starts);
  const press = (op: Op) => () => (check(op) === undefined ? go(op) : tell(check(op)!));
  const draw = ([label, op]: readonly [string, Op]) => acted(label, check(op), () => go(op));
  return { press, draw };
}

const wrap = (indent: number, children: unknown) => (
  <View style={{ ...row, flexWrap: 'wrap', paddingLeft: space.md * indent }}>
    {children as never}
  </View>
);

type Key = {
  altKey?: boolean;
  key: string;
  target?: { tagName?: string };
  preventDefault: () => void;
};
/** One line of a file: its words, a press that opens its acts, Alt-arrows a move, Alt-Enter Add. */
function line(key: string, text: string, keys: Record<string, () => void>, indent: number) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: opened.has(key) }}
      onPress={() => toggle(key)}
      // the row's keys, never an input's (rulings §5)
      {...({
        onKeyDown: (e: Key) => {
          const k = keys[e.key];
          if (!k || !e.altKey || /INPUT|TEXTAREA/.test(e.target?.tagName ?? '')) return;
          e.preventDefault();
          k();
        },
      } as object)}
      ref={(el) => {
        if (el && focus === key) ((el as unknown as HTMLElement).focus(), (focus = undefined));
      }}
      style={{
        paddingLeft: space.md * (indent + 1),
        minHeight: size.touch,
        justifyContent: 'center',
      }} // mutate-skip: layout only
    >
      <Text style={{ ...type.small, color: ink('fg') }}>{text.trim()}</Text>
    </Pressable>
  );
}

/** A `.scene` file's lines (the Dialogue sheet), each opening to its acts. */
export function lines(file: string) {
  const s = source(file);
  if (!s) return null; // unread
  const rs = rows(s.bytes.split('\n'));
  return rs.map((r, i) => (r.text.trim() ? sceneRow(file, s, rs, i) : null));
}

/** A move's units for row `me`: rows at its depth, choices for a choice, lines for a line (shifted()). */
const units = (me: Row) => (ls: string[]) =>
  rows(ls).flatMap((r, j) =>
    r.text.trim() && r.indent === me.indent && (r.key === undefined) === (me.key === undefined)
      ? [j]
      : [],
  );

// Add items: a speaker line per role the header names (rulings §1); none: the one refused item
const adds = (rs: Row[], i: number) => {
  const roles = new Set(rs.flatMap((r) => /^(?:npc|with): (\w+)/.exec(r.text)?.slice(1) ?? []));
  return kindsAt(rs, i).flatMap((kind) =>
    (kind === 'speaker' && roles.size ? [...roles] : [undefined]).map((value) => {
      const op = { add: { after: i + 1, kind, ...(value && { value }) } };
      return [WORDS.kind(kind, value), op] as const;
    }),
  );
};

/** Line `i + 1`'s Add after (its kinds), Move up and down and Remove, checked by scene() on `s`. */
function sceneRow(file: string, s: Src, rs: Row[], i: number) {
  const n = i + 1;
  const key = `${file}:${n}`;
  const menu = `${key}:+`;
  const { press, draw } = acts(file, s, (op) => scene(s.bytes, op), units(rs[i]));
  const up: Op = { move: n, by: -1 };
  const down: Op = { move: n, by: 1 };
  const moves: [string, Op][] = [
    [WORDS.up(n), up],
    [WORDS.down(n), down],
    [WORDS.remove(n), { remove: n }],
  ];
  const kinds = adds(rs, i);
  const open = opened.has(key);
  const depth = rs[i].indent / 2; // mutate-skip: layout only
  return (
    <View key={key}>
      {line(
        key,
        rs[i].text,
        {
          ArrowUp: press(up),
          ArrowDown: press(down),
          Enter: () => (opened.add(key), toggle(menu)),
        },
        depth,
      )}
      {open &&
        wrap(depth + UNDER, [
          act(WORDS.add(n), () => toggle(menu), opened.has(menu), `add ${key}`),
          ...moves.map(draw),
        ])}
      {open && opened.has(menu) && wrap(depth + UNDER + UNDER, kinds.map(draw))}
    </View>
  );
}

/** A `.cut` file's pages (a scene's sheet), each line opening to its acts. `steps`: the twin .json
 * carries its pages, so cut() refuses every op. */
export function pages(file: string, steps: boolean) {
  const s = source(file);
  if (!s) return null; // not read yet, or no .cut
  const all = s.bytes.split('\n');
  let page = 0;
  return blocks(all).map(([first, last]) => {
    const p = all[first].trim() === '---' ? 0 : ++page;
    const caption = (
      <Text key={`page ${file}:${p}`} style={{ ...LABEL, paddingLeft: space.md }}>
        {`page ${p}`}
      </Text>
    );
    const its = all
      .slice(first, last + 1)
      .map((t, k) => cutRow(file, s, steps, p, first + k + 1, k));
    return p ? [caption, ...its] : its;
  });
}

/** Line `n` of page `p` (its `k`th): the first a page's Add after, Move up and down, Join and Remove,
 * a later one Split; checked by cut() on `s`. The end mark (`p` 0) has none. */
function cutRow(file: string, s: Src, steps: boolean, p: number, n: number, k: number) {
  const key = `${file}:${n}`;
  const text = s.bytes.split('\n')[n - 1];
  if (!p)
    return (
      <Text key={key} style={{ ...LABEL, paddingLeft: space.md }}>
        {text}
      </Text>
    );
  const ops: [string, Op][] = k
    ? [[WORDS.split(p, n), { split: n }]]
    : [
        [WORDS.addPage(p), { add: { after: n, kind: 'page' } }],
        [WORDS.upPage(p), { move: n, by: -1 }],
        [WORDS.downPage(p), { move: n, by: 1 }],
        [WORDS.join(p), { join: n }],
        [WORDS.removePage(p), { remove: n }],
      ];
  const { press, draw } = acts(
    file,
    s,
    (op) => cut(s.bytes, op, steps),
    (ls) => blocks(ls).map(([first]) => first),
  );
  return (
    <View key={key}>
      {line(key, text, k ? {} : { ArrowUp: press(ops[1][1]), ArrowDown: press(ops[2][1]) }, FLUSH)}
      {opened.has(key) && wrap(UNDER, ops.map(draw))}
    </View>
  );
}

/** A scene's `on` and `treatment` (registry book.edit `scene.tsx`): shown only when the scene is
 * modal (a non-modal `on` is the form's); `on` a trigger whose switch writes the whole new on. */
export const scenic =
  (doc: Record<string, unknown>): Block =>
  (at, path, node, value, removable) =>
    doc.control !== 'modal'
      ? path[0] === 'on'
        ? block(at, path, node, value, removable)
        : null
      : path[0] === 'on' && known.story
        ? trigger(at, path, value as On)
        : block(at, path, node, value, removable);
