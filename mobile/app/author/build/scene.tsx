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
import { space, type } from '../../book/tokens.ts';
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
  kind: (k: SceneKind) => (k === 'speaker' || k === 'words' ? `${k} line` : k),
};
const UNDER = 1; // mutate-skip: layout only (an act row's indent under its line)
const LABEL = { ...type.label, color: ink('dim') };

type Src = { bytes: string; sha256: string };
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

const restructure = (file: string, was: string, op: Op) =>
  run(() => ed.call('restructure', { file, was, op, carry: [] }));
/** An act: pressable when `why` is undefined, else greyed with it. */
const acted = (label: string, why: string | undefined, go: () => void) =>
  why === undefined ? act(label, go) : greyed(label, why, label);
const why = (r: { after: string } | { refused: string }) =>
  'refused' in r ? r.refused : undefined;

/** `file`'s acts on `s`, each checked by `check`: its refusal, a send, a press that tells or sends,
 * and a drawn act. */
function acts(file: string, s: Src, check: (op: Op) => string | undefined) {
  const go = (op: Op) => restructure(file, s.sha256, op);
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
function line(key: string, text: string, keys: Record<string, () => void>, indent = 0) {
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
      style={{ paddingLeft: space.md * (indent + 1), minHeight: 44, justifyContent: 'center' }} // mutate-skip: layout only
    >
      <Text style={{ ...type.control, color: ink('action') }}>{text.trim()}</Text>
    </Pressable>
  );
}

/** A `.scene` file's lines (the Dialogue sheet), each opening to its acts. */
export function lines(file: string) {
  const s = source(file);
  if (!s) return null;
  const rs = rows(s.bytes.split('\n'));
  return rs.map((r, i) => (r.text.trim() ? sceneRow(file, s, rs, i) : null));
}

/** Line `i + 1`'s Add after (its kinds), Move up and down and Remove, checked by scene() on `s`. */
function sceneRow(file: string, s: Src, rs: ReturnType<typeof rows>, i: number) {
  const n = i + 1;
  const key = `${file}:${n}`;
  const menu = `${key}:+`;
  const { press, draw } = acts(file, s, (op) => why(scene(s.bytes, op)));
  const up: Op = { move: n, by: -1 };
  const down: Op = { move: n, by: 1 };
  const moves: [string, Op][] = [
    [WORDS.up(n), up],
    [WORDS.down(n), down],
    [WORDS.remove(n), { remove: n }],
  ];
  const kinds = kindsAt(rs, i).map((k) => [WORDS.kind(k), { add: { after: n, kind: k } }] as const);
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
  if (!s) return null;
  const all = s.bytes.split('\n');
  let page = 0;
  return blocks(all).map(([first, last]) => {
    const p = all[first].trim() === '---' ? 0 : ++page;
    return all.slice(first, last + 1).map((text, k) => cutRow(file, s, steps, p, first + k + 1, k));
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
  const { press, draw } = acts(file, s, (op) => why(cut(s.bytes, op, steps)));
  return (
    <View key={key}>
      {line(key, text, k ? {} : { ArrowUp: press(ops[1][1]), ArrowDown: press(ops[2][1]) })}
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
