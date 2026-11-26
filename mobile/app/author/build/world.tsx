// The notebook's World tab (slices 6.1a-b, the panel's World button and card): the root files, then the
// populations, transports and barriers, each opening its def:<file> sheet, then each capability cartridge.json lacks with its Turn on; and the
// World card's block, which a root field the registry gives to world.tsx draws as (generic.tsx `claims`).
import { cloneElement, type ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  newEntry,
  pickable,
  reachable,
  refusePick,
  rootNames,
  ROOTS,
  worldFile,
} from '../../../../kernel/ts/play/world_card.ts';
import CAPS from '../../../../protocol/capability_registry.json' with { type: 'json' };
import { type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { block, INPUT } from './form.tsx';
import { id, set, type At, type Block, type Ops, type Step } from './formwrite.ts';
import { known } from './room.tsx';
import { ed, refusal, row, run } from './roomedit.tsx';
import { act, raise } from './sheet.tsx';

export const WORDS = {
  tab: 'World',
  on: (cap: string) => `Turn on ${cap}`,
  more: (n: number) => `+${n} more`,
};
const NODES = ['room', 'item', 'npc', 'transport']; // the kinds a compile's nodes hold (a long-list field)
const SHORT = 6; // a long-list field with this many keys or fewer offers them all; also the matches' cap
const FILES = ['cartridge.json', 'facts.json', 'resources.json', 'attributes.json', 'text.json']; // guard.ts ROOTS, the map's layout aside; the /story names none
type Read = (file: string) => { doc: unknown; was: string } | undefined;
type Cart = { requires?: { capabilities?: object } };

/** The World tab: each root file `read` finds, the story's world files, then the capabilities cartridge.json lacks. */
export function worldRows(read: Read) {
  const cart = read('cartridge.json');
  const caps = (cart?.doc as Cart | undefined)?.requires?.capabilities ?? {};
  return [
    refusal(),
    <View key="files" style={row}>
      {FILES.filter((f) => read(f)).map((f) => act(f, () => known.open(`def:${f}`)))}
    </View>,
    <View key="world" style={row}>
      {[...new Set(Object.values(known.files))]
        .filter((f) => worldFile(f) && !worldFile(f, true))
        .sort()
        .map((f) => act(f, () => known.open(`def:${f}`)))}
    </View>,
    <View key="caps" style={row}>
      {cart &&
        CAPS.filter((c) => !Object.hasOwn(caps, c.key)).map((c) =>
          act(
            WORDS.on(c.key),
            () =>
              void run(() =>
                ed.change([
                  'cartridge.json',
                  cart.was,
                  [{ path: ['requires', 'capabilities', c.key], value: c.version }],
                ]),
              ),
            undefined,
            `on ${c.key}`,
          ),
        )}
    </View>,
  ];
}

/** The World card's block (`read` a root file's doc): a resource or attribute's new entry is
 * `newEntry`'s; a cartridge field naming a resource or attribute picks the root files' keys only. */
export const world =
  (read: (file: string) => unknown): Block =>
  (at, path, node, value, removable) => {
    const root = ROOTS.find((r) => r.rel === at.file);
    if (root)
      return block(
        { ...at, fresh: (p, k) => (p.length === 1 ? newEntry(root, k) : undefined) },
        path,
        node,
        value,
        removable,
      );
    const docs = ROOTS.map((r) => read(r.rel));
    // a root file not read (yet, or at all) names no keys: its field stays free text, refusing nothing
    const named = Object.fromEntries(Object.entries(rootNames(docs)).filter((_, i) => docs[i]));
    // the keys this file may name (the panel's `reachable` list); a resource or attribute refuses at the sheet's top
    const nodes = reachable(known.nodes, known.story, at.file);
    const pick = (p: Step[], v: unknown) => {
      const got = pickable(p, nodes, named, v);
      return got && Object.hasOwn(named, got.kind) ? got : undefined;
    };
    const long = (p: Step[], v: unknown) => {
      const got = pickable(p, nodes, named, v);
      return got?.keys.length && NODES.includes(got.kind)
        ? field(at, p, v as string, got)
        : undefined;
    };
    const gate = (o: Ops) =>
      o
        .map((x) =>
          typeof x.value === 'string' ? refusePick(pick(x.path, x.value), x.value) : undefined,
        )
        .find(Boolean) ?? at.gate?.(o);
    return block(
      { ...at, pick: (p, v) => pick(p, v)?.keys, long, gate },
      path,
      node,
      value,
      removable,
    );
  };

/** `keys` matching `text`, case ignored: the equal, then those starting with it, then those
 * containing it, each in list order; the first SHORT, and how many more. */
export function matches(keys: string[], text: string) {
  const t = text.toLowerCase();
  const by = (f: (k: string) => boolean) => keys.filter((k) => f(k.toLowerCase()));
  const all = [
    ...by((k) => k === t),
    ...by((k) => k !== t && k.startsWith(t)),
    ...by((k) => !k.startsWith(t) && k.includes(t)),
  ];
  return { shown: all.slice(0, SHORT), more: all.length - SHORT };
}

const typing = new Map<string, string>(); // a long-list field's text since its last keystroke, until a write or a blur on its key
const told = new Set<string>(); // the fields left holding a refused text: their polite line reads it
type Press = { onPressIn?: () => void; onPressOut?: () => void };
let pressing = false; // a match press is taking the focus: that blur writes nothing

/** A room, item, person or transport field: free typing that writes only a key, refusing at the field. */
function field(at: At, path: Step[], value: string, pick: { kind: string; keys: string[] }) {
  const key = id(at, path);
  const text = typing.get(key);
  const no = text ? refusePick(pick, text) : undefined;
  const write = (k: string) => {
    typing.delete(key);
    told.delete(key);
    if (k === value) known.redraw();
    else set(at, path, k);
  };
  const { shown, more } = text === undefined ? { shown: [], more: 0 } : matches(pick.keys, text);
  const small = (tone: Parameters<typeof ink>[0]) => ({ ...type.small, color: ink(tone) });
  return [
    input(key, String(path.at(-1)), value, text, pick.keys, write),
    no && !told.has(key) ? (
      <Text key={`no ${key}`} style={small('danger')}>
        {no}
      </Text>
    ) : null,
    <Text key={`told ${key}`} aria-live="polite" style={small('danger')}>
      {told.has(key) ? no : ''}
    </Text>,
    <View key={`picks ${key}`} style={row}>
      {(pick.keys.length <= SHORT ? pick.keys : shown).map((k) =>
        cloneElement(act(k, () => write(k), undefined, k, k === value) as ReactElement<Press>, {
          onPressIn: () => void (pressing = true),
          onPressOut: () => void (pressing = false),
        }),
      )}
    </View>,
    more > 0 ? (
      <Text key={`more ${key}`} style={small('dim')}>
        {WORDS.more(more)}
      </Text>
    ) : null,
  ];
}

/** The field's input: focus raises the sheet; blur writes an exact key, else holds its refusal. */
function input(
  key: string,
  label: string,
  value: string,
  text: string | undefined,
  keys: string[],
  write: (k: string) => void,
) {
  return (
    <TextInput
      key={`${key} ${value}`} // a write mounts the field again, showing the key
      accessibilityLabel={label}
      defaultValue={text ?? value}
      style={INPUT}
      onFocus={(e) => {
        raise.full();
        (e.target as unknown as Element | null)?.scrollIntoView?.({ block: 'start' });
      }}
      onChangeText={(t) => {
        typing.set(key, t);
        told.delete(key);
        known.redraw();
      }}
      onBlur={() => {
        const t = typing.get(key);
        if (pressing || t === undefined) return;
        if (keys.includes(t)) write(t);
        else (told.add(key), known.redraw());
      }}
    />
  );
}
