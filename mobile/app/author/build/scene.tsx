// A scene's rows in Build (slice 5.2, docs/design/scene-structure-rulings.md §1, §3-§5): a `.scene`
// file's lines and a `.cut` file's pages, each with its acts through one `/restructure`, refused as
// scene()/cut() refuse them on the bytes shown (a refused act is greyed with why and sends nothing);
// and a modal scene's trigger and treatment (scene_trigger.ts, the panel's ModalScene). Labels are
// placeholders.
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  blocks,
  cut,
  offers as kindsAt,
  rows,
  scene,
  type Op,
  type SceneKind,
} from '../../../../kernel/ts/play/scene_structure.ts';
import {
  kindOf,
  leftover,
  offers,
  outcomeRefused,
  outcomesOf,
  type Kind,
  type On,
} from '../../../../kernel/ts/play/scene_trigger.ts';
import { space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { block, INPUT } from './form.tsx';
import { id, opened, ops, send, toggle, type At, type Block, type Step } from './formwrite.ts';
import { known } from './room.tsx';
import { ed, io, row, run, tell } from './roomedit.tsx';
import { act, greyed } from './sheet.tsx';

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
  on: 'on',
  outcome: 'outcome',
  badOutcome: 'not a key, or another scene starts on it',
};
const KINDS: Kind[] = ['start', 'story_point', 'quest', 'action'];
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
      () => got.delete(file) && known.redraw(), // gone (a scene with no .cut): nothing to draw
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

const wrap = (indent: number, children: unknown) => (
  <View style={{ ...row, flexWrap: 'wrap', paddingLeft: space.md * indent }}>
    {children as never}
  </View>
);

/** One line of a file: its words, a press that opens its acts, Alt-arrows a move, Alt-Enter Add. */
function line(key: string, text: string, indent: number, keys: Record<string, () => void>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: opened.has(key) }}
      onPress={() => toggle(key)}
      // the row's keys, never an input's (rulings §5)
      {...({
        onKeyDown: (e: { altKey?: boolean; key: string; target?: { tagName?: string } }) => {
          if (!e.altKey || /INPUT|TEXTAREA/.test(e.target?.tagName ?? '')) return;
          keys[e.key]?.();
        },
      } as object)}
      style={{ paddingLeft: space.md * (indent + 1), minHeight: 44, justifyContent: 'center' }}
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
  const say = (op: Op) => why(scene(s.bytes, op));
  const go = (op: Op) => restructure(file, s.sha256, op);
  const press = (op: Op) => () => (say(op) === undefined ? go(op) : tell(say(op)!));
  const up: Op = { move: n, by: -1 };
  const down: Op = { move: n, by: 1 };
  const moves: [string, Op][] = [
    [WORDS.up(n), up],
    [WORDS.down(n), down],
    [WORDS.remove(n), { remove: n }],
  ];
  const kinds = kindsAt(rs, i).map((k) => [WORDS.kind(k), { add: { after: n, kind: k } }] as const);
  const open = opened.has(key);
  const depth = rs[i].indent / 2;
  return (
    <View key={key}>
      {line(key, rs[i].text, depth, {
        ArrowUp: press(up),
        ArrowDown: press(down),
        Enter: () => (opened.add(key), toggle(menu)),
      })}
      {open &&
        wrap(depth + 1, [
          act(WORDS.add(n), () => toggle(menu), opened.has(menu), `add ${key}`),
          ...moves.map(([label, op]) => acted(label, say(op), () => go(op))),
        ])}
      {open &&
        opened.has(menu) &&
        wrap(
          depth + 2,
          kinds.map(([l, op]) => acted(l, say(op), () => go(op))),
        )}
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
  const say = (op: Op) => why(cut(s.bytes, op, steps));
  const go = (op: Op) => restructure(file, s.sha256, op);
  const press = (op: Op) => () => (say(op) === undefined ? go(op) : tell(say(op)!));
  return (
    <View key={key}>
      {line(key, text, 0, k ? {} : { ArrowUp: press(ops[1][1]), ArrowDown: press(ops[2][1]) })}
      {opened.has(key) &&
        wrap(
          1,
          ops.map(([label, op]) => acted(label, say(op), () => go(op))),
        )}
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

/** A row of trigger picks, `now` lit; a pick puts `next(v)`. */
const picks = (
  put: (o: On | undefined) => unknown,
  what: string,
  vs: unknown[],
  next: (v: never) => On | undefined,
  now: unknown,
) =>
  wrap(
    0,
    vs.map((v) =>
      act(String(v), () => put(next(v as never)), undefined, `${what} ${String(v)}`, v === now),
    ),
  );

/** The trigger: its kinds with an offer, then its value's, then a point's outcomes or a quest's
 * typed one, then the quest a switch left (`~ q`). A pick writes the whole on at `path`. */
function trigger(at: At, path: Step[], on: On = {}) {
  const t = known.story!.triggers;
  const key = at.file.replace(/^.*\//, '').replace(/\.json$/, '');
  const all = offers(t, key, known.nodes);
  const kind = kindOf(on);
  const put = (next: On | undefined) => next && send(at, ops(path, next));
  const named = (o: On) => String(o[kind]);
  const gone = leftover(t, key, on);
  return (
    <View key={id(at, path)} style={{ paddingLeft: space.md }}>
      <Text style={LABEL}>{WORDS.on}</Text>
      {picks(
        put,
        'kind',
        KINDS.filter((k) => all[k].length || k === kind),
        (k: Kind) => all[k][0],
        kind,
      )}
      {kind !== 'start' &&
        picks(
          put,
          'value',
          [...new Set(all[kind].map(named))],
          (v: string) => all[kind].find((o) => named(o) === v),
          String(on[kind]),
        )}
      {kind === 'story_point' &&
        picks(
          put,
          'outcome',
          outcomesOf(all.story_point, on),
          (o: string) => ({ story_point: on.story_point, outcome: o }),
          on.outcome,
        )}
      {kind === 'quest' && questOutcome(at, path, t, key, on, put)}
      {gone && <Text style={LABEL}>{`~ ${gone}`}</Text>}
    </View>
  );
}

/** A quest trigger's outcome, typed; written on blur unless outcomeRefused refuses it. */
function questOutcome(
  at: At,
  path: Step[],
  t: Parameters<typeof leftover>[0],
  key: string,
  on: On,
  put: (o: On) => void,
) {
  return (
    <TextInput
      key={`outcome ${id(at, path)}`}
      accessibilityLabel={WORDS.outcome}
      defaultValue={String(on.outcome ?? '')}
      style={INPUT}
      onEndEditing={(e) => {
        const o = e.nativeEvent.text.trim();
        if (o === on.outcome) return;
        if (outcomeRefused(t, key, on, o)) tell(WORDS.badOutcome);
        else put({ quest: on.quest, outcome: o });
      }}
    />
  );
}
