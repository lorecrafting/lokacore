// The builder's generic schema renderer (design §6.4, slice 2.3): one source file's fields drawn
// from its kind's schema, each gesture one `/change` op (mapedit.ts `change`). What a node draws as
// is kernel/ts/play/generic.ts `shapeOf`; the server validates. Labels are placeholders.
import type { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { branchOf, entered, plain } from '../../../../kernel/ts/play/card.ts';
import {
  least,
  moved,
  picked,
  shapeOf,
  type Defs,
  type Shape,
} from '../../../../kernel/ts/play/generic.ts';
import { titles } from '../../../../kernel/ts/play/ui_schema.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { ed, inRow, row, run } from './roomedit.tsx';
import { act } from './sheet.tsx';

type Obj = Record<string, unknown>;
type Step = string | number;
/** The file drawn and the hash it was read at, its schema's `$defs`, the definitions entered so far and a root field's least value. */
export type At = {
  file: string;
  was: string;
  defs: Defs;
  seen: string[];
  seed?: (f: string) => unknown;
};

export const WORDS = {
  add: 'Add…',
  remove: 'Remove',
  up: 'Move up',
  copy: 'Copy',
  item: 'Add item',
  key: 'Key',
  on: 'On',
  off: 'Off',
};
const opened = new Set<string>(); // the folded blocks and Add… menus open, by file and path
const revealed = new Set<string>(); // fields added with no least value: drawn empty until written
const drafts = new Map<string, string>(); // each typed field, as typed
const LABEL = { ...type.label, color: ink('dim') };
const INPUT = { ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }; // mutate-skip: layout; ruled as the Room sheet's Move field

const id = (at: At, path: Step[]) => `${at.file}:${JSON.stringify(path)}`;
const toggle = (key: string) => (
  opened.has(key) ? opened.delete(key) : opened.add(key),
  known.redraw()
);
const set = (at: At, path: Step[], value: unknown) =>
  value === undefined
    ? (revealed.add(id(at, path)), known.redraw())
    : void run(() =>
        ed.change(at.file, at.was, ops(path, value)).then(() => void revealed.delete(id(at, path))),
      );
/** A write at `path`; at the root (a picked branch, a whole list) one op per top-level field. */
const ops = (path: Step[], value: unknown) =>
  path.length
    ? [{ path, value }]
    : Array.isArray(value)
      ? value.map((v, i) => ({ path: [i], value: v }))
      : Object.entries(value as Obj).map(([k, v]) => ({ path: [k], value: v }));
const drop = (at: At, path: Step[]) =>
  void run(() => ed.change(at.file, at.was, [{ path, delete: true }]));

/** `value` at `path` drawn as `node` says. */
export function field(at: At, path: Step[], node: Obj | undefined, value: unknown): ReactNode {
  const [s, seen] = shapeOf(node, value, at.defs, at.seen);
  const inner = { ...at, seen, seed: path.length ? undefined : at.seed };
  if (s.as === 'object') return object(inner, path, s, value);
  if (s.as === 'array') return array(inner, path, s.items, value);
  if (s.as === 'union') return union(inner, path, s.branches, value);
  if (s.as === 'enum') return picks(at, path, s.options, value);
  if (s.as === 'const') return <Text style={inRow}>{String(s.value)}</Text>;
  if (s.as === 'scalar' && s.type === 'boolean') return picks(at, path, [true, false], value);
  if (s.as === 'scalar' || s.as === 'claimed') return typed(at, path, s, value);
}

/** A field's block: its name, Remove when it may go, and its value, folded when it holds fields;
 * an optional constant (a flag such as `hidden`) is an On/Off switch: present or absent. */
function block(at: At, path: Step[], node: Obj | undefined, value: unknown, removable: boolean) {
  const key = id(at, path);
  const [s] = shapeOf(node, value, at.defs, at.seen);
  const folds = s.as === 'object' || s.as === 'array';
  const name = String(path.at(-1));
  const flag = s.as === 'const' && removable; // an On/Off switch
  return (
    <View key={key} style={{ paddingLeft: space.md }}>
      <View style={row}>
        {folds ? (
          act(name, () => toggle(key), opened.has(key), `fold ${key}`)
        ) : (
          <Text style={LABEL}>{name}</Text>
        )}
        {flag
          ? act(WORDS.on, () => set(at, path, s.value), undefined, `on ${key}`, value === s.value)
          : null}
        {removable
          ? act(
              s.as === 'const' ? WORDS.off : WORDS.remove,
              () => drop(at, path),
              undefined,
              `remove ${key}`,
              s.as === 'const' ? value !== s.value : undefined,
            )
          : null}
      </View>
      {flag ? null : !folds || opened.has(key) ? field(at, path, node, value) : null}
    </View>
  );
}

/** An object's present fields, then Add… for the absent ones (a map: a typed key's new entry). */
function object(at: At, path: Step[], s: Extract<Shape, { as: 'object' }>, value: unknown) {
  const v: Obj = plain(value) ? value : {};
  const shown = (k: string) => Object.hasOwn(v, k) || revealed.has(id(at, [...path, k]));
  const keys = [...new Set([...Object.keys(v), ...Object.keys(s.props)])].filter(shown);
  const absent = Object.keys(s.props).filter((k) => !shown(k));
  const menu = id(at, [...path, '+']);
  const add = (k: string) => set(at, [...path, k], at.seed?.(k) ?? least(s.props[k], at.defs));
  return [
    ...keys.map((k) =>
      block(at, [...path, k], s.props[k] ?? s.each, v[k], !s.required.includes(k)),
    ),
    absent.length ? act(WORDS.add, () => toggle(menu), opened.has(menu), `add ${menu}`) : null,
    ...(opened.has(menu)
      ? absent.map((k) => act(k, () => add(k), undefined, `add ${k} ${menu}`))
      : []),
    s.each ? entry(at, path, s.each, v) : null,
  ];
}

/** A map's new entry: its key typed, then Add writes the entry's least value (an existing key: nothing). */
function entry(at: At, path: Step[], each: Obj, map: Obj) {
  const key = id(at, [...path, '+key']);
  const add = () => {
    const k = (drafts.get(key) ?? '').trim();
    drafts.delete(key);
    if (k && !Object.hasOwn(map, k)) set(at, [...path, k], least(each, at.defs) ?? '');
  };
  return (
    <View key={key} style={row}>
      <TextInput
        accessibilityLabel={WORDS.key}
        placeholder={WORDS.key}
        style={INPUT}
        onChangeText={(t) => void drafts.set(key, t)}
      />
      {act(WORDS.add, add, undefined, `entry ${key}`)}
    </View>
  );
}

/** A list's elements, each with Remove, Move up and Copy, then Add item. */
function array(at: At, path: Step[], items: Obj, value: unknown) {
  const list = Array.isArray(value) ? value : [];
  const whole = (next: unknown[]) => set(at, path.length ? path : [], next);
  return [
    ...list.map((el, i) => (
      <View key={id(at, [...path, i])}>
        {block(at, [...path, i], items, el, true)}
        <View style={row}>
          {i > 0 && path.length
            ? act(WORDS.up, () => whole(moved(list, i, i - 1)), undefined, `up ${i}`)
            : null}
          {path.length
            ? act(WORDS.copy, () => whole(moved(list, i)), undefined, `copy ${i}`)
            : null}
        </View>
      </View>
    )),
    act(
      WORDS.item,
      () => set(at, [...path, list.length], least(items, at.defs) ?? ''),
      undefined,
      `item ${id(at, path)}`,
    ),
  ];
}

/** A union's branch picker (titled as the panel's), then the picked branch's own fields. */
function union(at: At, path: Step[], branches: Obj[], value: unknown) {
  const i = branchOf(branches, value);
  const names = titles(branches, at.defs as never);
  return [
    <View key={`pick ${id(at, path)}`} style={row}>
      {names.map((n, j) =>
        act(
          n,
          () => set(at, path, picked(branches, j, value, at.defs)),
          undefined,
          `branch ${j}`,
          j === i,
        ),
      )}
    </View>,
    i >= 0 ? field(at, path, branches[i], value) : null,
  ];
}

/** An enum's or a boolean's options, the present one selected. */
const picks = (at: At, path: Step[], options: unknown[], value: unknown) => (
  <View key={`picks ${id(at, path)}`} style={row}>
    {options.map((o) => act(String(o), () => set(at, path, o), undefined, String(o), o === value))}
  </View>
);

/** A typed field (a string, a number, a text's words, a definition's key), written when it loses focus. */
function typed(at: At, path: Step[], s: Shape, value: unknown) {
  const key = id(at, path);
  const number = s.as === 'scalar' && s.type !== 'string';
  const prose =
    s.as === 'claimed' && s.claim === 'TextKey' && (value === undefined || plain(value));
  const shown = plain(value) ? String(value.prose ?? '') : value === undefined ? '' : String(value);
  const write = () => {
    const t = drafts.get(key);
    const v = t === undefined ? undefined : entered(t, number);
    drafts.delete(key);
    if (v !== undefined && !Number.isNaN(v) && String(v) !== shown)
      set(at, path, prose ? { prose: v } : v);
  };
  return (
    <TextInput
      key={key}
      accessibilityLabel={String(path.at(-1))}
      defaultValue={shown}
      style={INPUT}
      onChangeText={(t) => void drafts.set(key, t)}
      onBlur={write}
    />
  );
}
