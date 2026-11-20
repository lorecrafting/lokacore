// The Room sheet's edits (design §7, slice 2.1): an exit's One-way and Delete, `＋` a new room on a
// free side (born `~`), Move to area and Delete room. The gestures are the panel's own
// (kernel/ts/play/mapedit.ts, drop.ts) over the same write routes; no words are written here.
import { Text, TextInput, View } from 'react-native';
import type { MapRoom } from '../../../../kernel/ts/play/map.ts';
import { BACK, editor, freeKey, type Io } from '../../../../kernel/ts/play/mapedit.ts';
import { drop } from '../../../../kernel/ts/play/drop.ts';
import { space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import type { Hooks } from './field.tsx';
import { act } from './sheet.tsx';

const WORDS = {
  oneWay: 'One-way',
  unlink: 'Delete',
  grow: (dir: string) => `＋ ${dir}`,
  area: 'Area',
  move: 'Move to area',
  drop: (key: string) => `Delete ${key}`,
  also: (files: string[]) => `Also deletes ${files.join(', ')}`,
  yes: 'Delete all',
  no: 'Keep',
  noFile: (key: string) => `${key}: no source file`,
};
export type Node = { kind: string; ref: string };

let api: Hooks['api'] | undefined;
let after = () => {}; // reads the map again and redraws (room.tsx `story`)
let close = () => {}; // closes the top sheet (Build.tsx `back`)
let busy = false; // one gesture at a time: a press while one runs does nothing
let said = ''; // the last refusal, shown at the sheet's top until the next press
let asking: { key: string; files: string[]; answer: (yes: boolean) => void } | undefined;
const drafts = new Map<string, string>(); // each room's Move field, as typed

/** mapedit's Io over the builder's /__author calls: a missing source rejects, as the panel's does. */
export const io: Io = {
  post: async (route, sent) => {
    const [status, told] = await api!(`/${route}`, sent);
    return { ok: status >= 200 && status < 300, told };
  },
  source: async (file) => {
    const [status, json] = await api!(`/source?file=${encodeURIComponent(file)}`);
    return status === 200 ? json : Promise.reject(new Error(`${file}: not found`));
  },
};
// ponytail: one editor per page; its Undo history and freeKey's handed-out keys end with a reload
const ed = editor(io);

export function wire(a: Hooks['api'] | undefined, then: () => void, shut: () => void) {
  api = a;
  after = then;
  close = shut;
}

/** Runs one gesture; a refusal (a thrown or returned reason) shows in the sheet. */
export async function run(go: () => Promise<unknown>) {
  if (asking) {
    const { answer } = asking; // another press answers a pending Delete question Keep
    asking = undefined;
    answer(false);
  }
  if (busy || !api) return;
  busy = true;
  said = '';
  try {
    const why = await go();
    if (typeof why === 'string') said = why;
  } catch (e) {
    said = (e as Error).message;
  } finally {
    busy = false;
    after();
  }
}

const text = { ...type.small, color: ink('fg'), paddingHorizontal: space.md };
// mutate-skip: layout; the acts in a row stand apart and line up with the sheet's text
export const row = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: space.md,
  paddingHorizontal: space.md,
} as const;

/** The refusal line, when the last gesture was refused. */
export const refusal = () =>
  said ? (
    <Text key="said" accessibilityRole="alert" style={{ ...text, color: ink('danger') }}>
      {said}
    </Text>
  ) : null;

/** An exit's actions: One-way (drops the way back) and Delete (both legs). */
export const exitActs = (r: MapRoom, dir: string, rooms: MapRoom[]) => [
  act(WORDS.oneWay, () => void run(() => ed.oneWay(r, dir, rooms))),
  act(WORDS.unlink, () => void run(() => ed.unlink(r, dir, rooms))),
];

/** `＋` on each side with no exit: a new room that way, its words `~`, in this room's area. */
export const grows = (r: MapRoom, nodes: Node[]) => (
  <View key="grow" style={row}>
    {Object.keys(BACK)
      .filter((dir) => !r.exits.some((e) => e.dir === dir))
      .map((dir) =>
        act(
          WORDS.grow(dir),
          () => void run(() => ed.grow(r, dir, freeKey('room', 'room', nodes, []))),
        ),
      )}
  </View>
);

/** Move to area: the field's area, or the root when it is empty. */
export const moveTo = (r: MapRoom) => (
  <View key={`move:${r.key}`} style={row}>
    <TextInput
      defaultValue={r.area ?? ''}
      placeholder={WORDS.area}
      accessibilityLabel={WORDS.area}
      onChangeText={(d) => void drafts.set(r.key, d)}
      style={{ ...text, paddingHorizontal: 0, flex: 1 }} // mutate-skip: layout; the field takes the row's free width
    />
    {act(
      WORDS.move,
      () => void run(() => ed.move(r, (drafts.get(r.key) ?? r.area ?? '').trim() || null)),
    )}
  </View>
);

/** The sheet's foot: Delete, then the other files it takes, asked in the sheet. */
export function foot(r: MapRoom) {
  if (asking?.key === r.key) {
    const { files, answer } = asking;
    const say = (yes: boolean) => () => ((asking = undefined), answer(yes));
    return (
      <View key="foot" style={row}>
        <Text style={{ ...text, paddingHorizontal: 0 }}>{WORDS.also(files)}</Text>
        {act(WORDS.yes, say(true))}
        {act(WORDS.no, say(false))}
      </View>
    );
  }
  const ask = (files: string[]) =>
    new Promise<boolean>((answer) => ((asking = { key: r.key, files, answer }), after()));
  return (
    <View key="foot" style={row}>
      {act(
        WORDS.drop(r.key),
        () =>
          void run(async () => {
            if (!r.file) return WORDS.noFile(r.key);
            let yes = true;
            const why = await drop(io, r.key, r.file, (files) => ask(files).then((y) => (yes = y)));
            if (why === '' && yes) close(); // the room is gone: its sheet goes too
            return why;
          }),
      )}
    </View>
  );
}
