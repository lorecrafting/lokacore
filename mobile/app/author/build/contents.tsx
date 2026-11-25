// The notebook (design §7, slice 2.2; tabs, slice 5.4b): Contents lists every kind New makes (kernel/ts/play/new.json),
// each with its New, then its files; a person or item made, or a file, opens its sheet. Story is story.tsx's,
// World world.tsx's (slice 6.1a).
import { TextInput, View } from 'react-native';
import NEW from '../../../../kernel/ts/play/new.json' with { type: 'json' };
import { create, NAMED, nodeOf } from '../../../../kernel/ts/play/mapedit.ts';
import { size } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, io, refusal, row, run } from './roomedit.tsx';
import { act, sheets } from './sheet.tsx';
import { load } from './generic.tsx';
import { storyRows } from './story.tsx';
import { WORDS as WORLD, worldRows } from './world.tsx';

const WORDS = {
  contents: 'Notebook',
  tabs: ['Contents', 'Story', WORLD.tab],
  new: (kind: string) => `New ${kind}`,
};
let tab = WORDS.tabs[0]; // the open tab
const names = new Map<string, string>(); // a NAMED kind's key, as typed
/** `kind`'s JSON source files the last /story named (a `.scene` has no schema sheet): `<kind>.json`,
 * `<kind>/<key>.json` or `areas/<area>/<kind>/<key>.json` (guard.ts `placed`). */
const filesOf = (kind: string) =>
  [...new Set(Object.values(known.files))]
    .filter((f) => f.endsWith('.json') && (f.split('/').at(-2) ?? f.split('.')[0]) === kind)
    .sort();

/** New `kind`: its starter under a free key (or the typed one); a person or item opens its sheet. */
const made = (kind: string) =>
  run(async () => {
    const [, all] = (await known.api?.('/templates')) ?? []; // the templates' keys are taken too
    const temps: { dir: string; key: string }[] = Array.isArray(all) ? all : []; // a refusal is words
    const held = temps.filter((t) => t.dir === kind).map((t) => t.key);
    const key = await create(io, kind, known.nodes, held, names.get(kind));
    names.delete(kind);
    if (key && (kind === 'npcs' || kind === 'items')) known.open(`${nodeOf(kind)}:${key}`);
  });

sheets.contents = {
  title: () => WORDS.contents,
  body: () => [
    <View key="tabs" style={row}>
      {WORDS.tabs.map((t) => act(t, () => ((tab = t), known.redraw()), undefined, t, tab === t))}
    </View>,
    ...(tab === WORDS.tabs[1] ? storyRows() : tab === WORLD.tab ? worldRows(load) : kinds()),
  ],
};
const kinds = () => [
  refusal(),
  ...NEW.flatMap((kind) => [
    <View key={kind} style={row}>
      {NAMED.includes(kind) ? (
        <TextInput
          accessibilityLabel={kind}
          placeholder={kind}
          defaultValue={names.get(kind)}
          onChangeText={(v) => void names.set(kind, v)}
          style={{ ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
        />
      ) : null}
      {act(WORDS.new(kind), () => void made(kind))}
    </View>,
    <View key={`${kind}/`} style={row}>
      {filesOf(kind).map((f) => act(f, () => known.open(`def:${f}`)))}
    </View>,
  ]),
];
export { WORDS as CONTENTS };
