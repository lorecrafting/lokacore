// The notebook (design §7, slice 2.2; tabs, slice 5.4b): Contents lists every kind New makes (kernel/ts/play/new.json),
// each with its New, then its files; a person or item made, or a file, opens its sheet. Story is story.tsx's,
// World world.tsx's (slice 6.1a), Checks the Checks sheet's, Recent recent.tsx's (slice 6.3b).
// Contents opens with Find (find.tsx).
import { TextInput, View } from 'react-native';
import NEW from '../../../../kernel/ts/play/new.json' with { type: 'json' };
import { create, NAMED, nodeOf } from '../../../../kernel/ts/play/mapedit.ts';
import { size } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, io, refusal, row, run } from './roomedit.tsx';
import { act, sheets } from './sheet.tsx';
import { load } from './generic.tsx';
import { goTo, storyRows } from './story.tsx';
import { WORDS as WORLD, worldRows } from './world.tsx';
import { WORDS as TOOLS, toolRows } from './tools.tsx';
import { findRows } from './find.tsx';
import { WORDS as RECENT, recentRows } from './recent.tsx';

const WORDS = {
  contents: 'Notebook',
  tabs: ['Contents', 'Story', WORLD.tab, 'Checks', RECENT.tab, TOOLS.tab],
  new: (kind: string) => `New ${kind}`,
  // placeholder: the owner writes these words
  go: (room: string) => `Go to ${room}`,
};
const TAB = 'loka-build-tab'; // the open tab survives a reload, as the stack does
let tab = WORDS.tabs.find((t) => t === globalThis.localStorage?.getItem(TAB)) ?? WORDS.tabs[0];
/** The palette's beat row: Contents opens on its Story tab. */
export const toStory = () => void (tab = WORDS.tabs[1]);
const names = new Map<string, string>(); // a NAMED kind's key, as typed
/** `kind`'s JSON source files the last /story named (a `.scene` has no schema sheet): `<kind>.json`,
 * `<kind>/<key>.json` or `areas/<area>/<kind>/<key>.json` (guard.ts `placed`); a cutscene's dir is
 * `scenes` (guard.ts newRefused's map). */
const filesOf = (kind: string, dir = kind === 'cutscene' ? 'scenes' : kind) =>
  [...new Set(Object.values(known.files))]
    .filter((f) => f.endsWith('.json') && (f.split('/').at(-2) ?? f.split('.')[0]) === dir)
    .sort();

/** New `kind`: its starter under a free key (or the typed one), then its sheet: a person's or item's, else its file's. */
export const made = (kind: string) =>
  run(async () => {
    const [, all] = (await known.api?.('/templates')) ?? []; // the templates' keys are taken too
    const temps: { dir: string; key: string }[] = Array.isArray(all) ? all : []; // a refusal is words
    const held = temps.filter((t) => t.dir === kind).map((t) => t.key);
    let files: string[] = []; // the files /new wrote (create keeps only the key)
    const post: typeof io.post = async (route, sent) => {
      const told = await io.post(route, sent);
      files = (told.told as { files?: string[] })?.files ?? [];
      return told;
    };
    const key = await create({ ...io, post }, kind, known.nodes, held, names.get(kind));
    names.delete(kind);
    // its own file (a cutscene's scenes/<key>.json, not its quest), else the one it changed (facts.json)
    const own =
      files.find((f) => f.endsWith(`/${key}.json`)) ?? files.find((f) => f !== 'cartridge.json');
    if (key && (kind === 'npcs' || kind === 'items')) known.open(`${nodeOf(kind)}:${key}`);
    else if (key && own) known.open(`def:${own}`);
  });

sheets.contents = {
  title: () => WORDS.contents,
  body: (host) => [
    <View key="tabs" style={row}>
      {WORDS.tabs.map((t) =>
        act(
          t,
          () => ((tab = t), globalThis.localStorage?.setItem(TAB, t), known.redraw()),
          undefined,
          t,
          tab === t,
        ),
      )}
    </View>,
    ...(tab === WORDS.tabs[1]
      ? storyRows()
      : tab === WORLD.tab
        ? worldRows(load)
        : tab === TOOLS.tab
          ? toolRows()
          : tab === RECENT.tab
            ? recentRows()
            : tab === WORDS.tabs[3]
              ? [sheets.checks.body(host)]
              : [...findRows(), ...kinds()]),
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
      {filesOf(kind).flatMap((f) => [
        act(f, () => known.open(`def:${f}`)),
        ...known.rooms
          .filter((r) => r.file === f) // play from here: the rooms this file defines
          .map((r) => act(WORDS.go(r.key), () => goTo(r.key), undefined, `go ${r.key}`)),
      ])}
    </View>,
  ]),
];
export { WORDS as CONTENTS };
