// The builder's generic schema renderer (design §6.4, slice 2.3): one source file's fields drawn
// from its kind's schema, each gesture one `/change` op (mapedit.ts `change`). What a node draws as
// is kernel/ts/play/generic.ts `shapeOf`; the server validates. Labels are placeholders.
import type { ReactElement, ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { entered, plain } from '../../../../kernel/ts/play/card.ts';
import { least, moved, shapeOf, type Shape } from '../../../../kernel/ts/play/generic.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { reveals } from './reveal.ts';
import { inRow, row } from './roomedit.tsx';
import { mechanics } from './mechanic.tsx';
import { later, rules } from './rules.tsx';
import {
  drafts,
  keep,
  drop,
  id,
  opened,
  ops,
  set,
  toggle,
  type At,
  type Obj,
  type Step,
  BUSY,
  about,
} from './formwrite.ts';
import { note } from './note.tsx';
import { act } from './sheet.tsx';

export const WORDS = {
  add: 'Add…',
  remove: 'Remove',
  up: 'Move up',
  copy: 'Copy',
  item: 'Add item',
  key: 'Key',
  on: 'On',
  off: 'Off',
  mechanic: 'Add mechanic…',
  needs: (caps: string[]) => `needs ${caps.join(' + ')} in cartridge.json`,
  first: 'needs another field first',
};
const LABEL = { ...type.label, color: ink('dim') };
export const INPUT = {
  ...inRow,
  flex: 1, // mutate-skip: layout
  minWidth: 0, // mutate-skip: layout; a row may shrink the field below its own width, to the docked sheet's
  borderBottomWidth: size.rule, // mutate-skip: layout
  borderColor: ink('action'), // mutate-skip: layout
}; // mutate-skip: layout; ruled as the Room sheet's Move field

/** `value` at `path` drawn as `node` says. */
export function field(at: At, path: Step[], node: Obj | undefined, value: unknown): ReactNode {
  const [s, seen] = shapeOf(node, value, at.defs, at.seen);
  const inner = {
    ...at,
    seen,
    ...(path.length && { seed: undefined, mech: undefined, claim: undefined }),
  };
  if (s.as === 'object') return object(inner, path, s, value);
  if (s.as === 'array') return array(inner, path, s.items, value);
  if (s.as === 'union') return rules(inner, path, s.branches, value);
  if (s.as === 'enum') return picks(at, path, s.options, value);
  if (s.as === 'const') return <Text style={inRow}>{String(s.value)}</Text>;
  if (s.as === 'scalar' && s.type === 'boolean') return picks(at, path, [true, false], value);
  if (s.as === 'scalar' || s.as === 'claimed') return typed(at, path, s, value);
}

/** A field's block: its name, Remove when it may go, and its value, folded when it holds fields;
 * an optional constant (a flag such as `hidden`) is an On/Off switch: present or absent. */
export function block(
  at: At,
  path: Step[],
  node: Obj | undefined,
  value: unknown,
  removable: boolean,
  drawn = () => field(at, path, node, value), // built only when shown
) {
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
              () => drop(at, path, value),
              undefined,
              `remove ${key}`,
              s.as === 'const' ? value !== s.value : undefined,
            )
          : null}
      </View>
      {note(about(at, node))}
      {flag ? null : !folds || opened.has(key) ? drawn() : null}
    </View>
  );
}

/** An object's present fields, then Add… for the absent ones (a map: a typed key's new entry). */
function object(at: At, path: Step[], s: Extract<Shape, { as: 'object' }>, value: unknown) {
  const v: Obj = plain(value) ? value : {};
  const shown = (k: string) => Object.hasOwn(v, k) || reveals().includes(id(at, [...path, k]));
  const keys = [...new Set([...Object.keys(v), ...Object.keys(s.props)])].filter(shown);
  const m = at.mech; // the root only (field)
  const theirs = new Set([
    ...(m?.allowed ?? []),
    ...(m?.hide ?? []),
    ...(m?.blocked ?? []).map((b) => b.field),
  ]);
  const start = (k: string) => at.seed?.(k) ?? least(s.props[k], at.defs);
  // Add mechanic… offers no field whose first write the gate would refuse (generic.tsx `gate`)
  const refused = (k: string) => start(k) !== undefined && !!at.gate?.(ops([...path, k], start(k)));
  const absent = Object.keys(s.props).filter((k) => !shown(k) && !theirs.has(k));
  const menu = id(at, [...path, '+']);
  const said = (k: string) => about(at, s.props[k]); // each option's description
  const add = (k: string) => () => set(at, [...path, k], start(k));
  const option = (k: string) =>
    side(path, act(k, add(k), undefined, `add ${k} ${menu}`, undefined, said(k)));
  const more = act(WORDS.add, () => toggle(menu), opened.has(menu), `add ${menu}`);
  return [
    ...keys.map((k) =>
      (at.claim?.(k) ?? block)(
        at,
        [...path, k],
        s.props[k] ?? s.each,
        v[k],
        !s.required.includes(k),
      ),
    ),
    absent.length ? side(path, more) : null,
    ...(opened.has(menu) ? absent : []).map(option),
    ...(m
      ? mechanics(at, m, (k) => shown(k) || !Object.hasOwn(s.props, k) || refused(k), start, said)
      : []), // this branch's fields
    s.each ? entry(at, path, s.each, v) : null,
  ];
}

/** A root menu's opener, inset like the sheet's text; a nested one sits in its block already. */
export const side = (path: Step[], el: ReactElement) =>
  path.length ? (
    el
  ) : (
    <View key={el.key} style={{ marginHorizontal: space.md }}>
      {el}
    </View>
  ); // mutate-skip: layout
/** A map's new entry: its key typed, then Add writes the entry's least value (an existing key: nothing). */
function entry(at: At, path: Step[], each: Obj, map: Obj) {
  const key = id(at, [...path, '+key']);
  const add = () => {
    const k = (drafts.get(key) ?? '').trim();
    drafts.delete(key);
    if (k && !Object.hasOwn(map, k))
      void set(at, [...path, k], at.fresh?.(path, k) ?? least(each, at.defs) ?? '', BUSY)?.then(
        (ok) => ok || keep(key, k), // not written: the typed key waits for another Add
      );
  };
  return (
    <View key={key} style={row}>
      <TextInput
        accessibilityLabel={WORDS.key}
        placeholder={WORDS.key}
        placeholderTextColor={ink('dim')}
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
        {later(at, [...path, i], el)}
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

/** An enum's or a boolean's options, the present one selected. */
const picks = (at: At, path: Step[], options: unknown[], value: unknown) => (
  <View key={`picks ${id(at, path)}`} style={row}>
    {options.map((o) => act(String(o), () => set(at, path, o), undefined, String(o), o === value))}
  </View>
);

/** A typed field (a string, a number, a text's words, a definition's key), written when it loses focus. */
function typed(at: At, path: Step[], s: Shape, value: unknown) {
  const long = at.long?.(path, value);
  if (long) return long;
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
      void set(at, path, prose ? { prose: v } : v, BUSY)?.then(
        (ok) => ok || keep(key, t!), // not written: leaving the field again writes it
      );
  };
  const keys = at.pick?.(path, value);
  const input = (
    <TextInput
      key={key}
      accessibilityLabel={String(path.at(-1))}
      defaultValue={drafts.get(key) ?? (shown === '~' ? '' : shown)} // reopened, it shows a draft not yet written
      placeholder={shown === '~' ? '~' : undefined} // unwritten: typing replaces it, select-all or not
      placeholderTextColor={ink('dim')}
      style={INPUT}
      onChangeText={(t) => void drafts.set(key, t)}
      onBlur={write}
    />
  );
  return keys?.length ? [input, picks(at, path, keys, value)] : input; // a reference's keys, as picks
}
