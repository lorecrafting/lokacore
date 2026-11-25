// The notebook's World tab (slice 6.1a, the panel's World button and card): the root files, each
// opening its def:<file> sheet, then each capability cartridge.json lacks with its Turn on; and the
// World card's block, which a root field the registry gives to world.tsx draws as (generic.tsx `claims`).
import { View } from 'react-native';
import {
  newEntry,
  pickable,
  refusePick,
  rootNames,
  ROOTS,
} from '../../../../kernel/ts/play/world_card.ts';
import CAPS from '../../../../protocol/capability_registry.json' with { type: 'json' };
import { block } from './form.tsx';
import type { Block, Ops } from './formwrite.ts';
import { known } from './room.tsx';
import { ed, refusal, row, run } from './roomedit.tsx';
import { act } from './sheet.tsx';

export const WORDS = {
  tab: 'World',
  on: (cap: string) => `Turn on ${cap}`,
};
const FILES = ['cartridge.json', 'facts.json', 'resources.json', 'attributes.json', 'text.json']; // guard.ts ROOTS, the map's layout aside; the /story names none
type Read = (file: string) => { doc: unknown; was: string } | undefined;
type Cart = { requires?: { capabilities?: object } };

/** The World tab: each root file `read` finds, then the capabilities cartridge.json lacks. */
export function worldRows(read: Read) {
  const cart = read('cartridge.json');
  const caps = (cart?.doc as Cart | undefined)?.requires?.capabilities ?? {};
  return [
    refusal(),
    <View key="files" style={row}>
      {FILES.filter((f) => read(f)).map((f) => act(f, () => known.open(`def:${f}`)))}
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
    // a room, item or person stays free text here (the panel's datalist; 6.1b's pickers)
    const pick = (p: (string | number)[], v: unknown) => {
      const got = pickable(p, known.nodes, named, v);
      return got && Object.hasOwn(named, got.kind) ? got : undefined;
    };
    const gate = (o: Ops) =>
      o
        .map((x) =>
          typeof x.value === 'string' ? refusePick(pick(x.path, x.value), x.value) : undefined,
        )
        .find(Boolean) ?? at.gate?.(o);
    return block({ ...at, pick: (p, v) => pick(p, v)?.keys, gate }, path, node, value, removable);
  };
