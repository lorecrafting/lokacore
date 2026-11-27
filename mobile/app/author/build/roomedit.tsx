// The Room sheet's edits (design §7, slice 2.1): an exit's One-way and Delete, `＋` a new room on a
// free side (born `~`), Move to area and Delete room. The gestures are the panel's own
// (kernel/ts/play/mapedit.ts, drop.ts) over the same write routes; no words are written here.
import { Text, View } from 'react-native';
import { grows as sides, type MapRoom } from '../../../../kernel/ts/play/map.ts';
import {
  BACK,
  childKey,
  editor,
  freeKey,
  nodeOf,
  type Io,
} from '../../../../kernel/ts/play/mapedit.ts';
import { drop } from '../../../../kernel/ts/play/drop.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import type { Hooks } from './field.tsx';
import { referredBy } from './find.tsx';
import { act, greyed } from './sheet.tsx';

// placeholders: the owner writes these words
const WORDS = {
  door: 'Door',
  lock: 'Lock',
  barred: (key: string) => `has ${key}`,
  oneWayOnly: 'one-way: no way back to bar',
  oneWay: 'One-way',
  unlink: 'Delete',
  grow: (dir: string) => `＋ ${dir}`,
  drop: (key: string, refs?: number) =>
    refs === undefined ? `Delete ${key}` : `Delete ${key} · ${WORDS.refs(refs)}`,
  refs: (n: number) => `${n} referrers`,
  also: (files: string[]) => `Also deletes ${files.join(', ')}`,
  yes: 'Delete all',
  no: 'Keep',
  noFile: (key: string) => `${key}: no source file`,
  add: '＋ Add here',
  npcs: 'Person',
  items: 'Item',
};
export type Node = { kind: string; ref: string };
export type Template = { dir: 'npcs' | 'items'; key: string }; // /templates' abstract NPC or item

let api: Hooks['api'] | undefined;
let after = () => {}; // reads the map again and redraws (room.tsx `story`)
let close = (_id: string) => {}; // closes a sheet by id (Build.tsx `back`)
let busy = false; // one gesture at a time: a press while one runs does nothing
let ran: Promise<void> = Promise.resolve(); // the gesture running now
let said = ''; // the last refusal, shown at the sheet's top until the next press
let asking: { key: string; files: string[]; answer: (yes: boolean) => void } | undefined;
let saved = (_ids: number[]) => {}; // Build.tsx's Undo chip

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
export const ed = editor(io);

export function wire(a: Hooks['api'] | undefined, then: () => void, shut: (id: string) => void) {
  api = a;
  after = then;
  close = shut;
}

/** Build.tsx's Undo chip: shown after each gesture that wrote. */
export const onSaved = (chip: (ids: number[]) => void) => void (saved = chip);
/** A gesture still writing, and the last refusal: Build's chip waits on the one and shows the other. */
export const running = () => busy;
export const refused = () => said;

/** Shows refusal `why`, nothing sent; one arriving while a gesture writes is kept, not dropped. */
export const tell = (why: string) =>
  busy ? void ((said = why), after()) : void run(async () => why);

/** Runs one gesture; a refusal (a thrown or returned reason) shows in the sheet. Resolves whether it
 * went through: false when refused, or never run (no api; another gesture writing, said only as
 * `busyNote`, as a press pressed twice is a double-tap; loka-x1frg). */
export async function run(go: () => Promise<unknown>, busyNote = ''): Promise<boolean> {
  if (asking) {
    const { answer } = asking; // another press answers a pending Delete question Keep, then goes on
    asking = undefined;
    answer(false);
    await ran;
  }
  if (!api) return false;
  if (busy) return (busyNote && tell(busyNote), false);
  busy = true;
  said = '';
  let wrote = false;
  ran = (async () => {
    const was = ed.undoable();
    try {
      const why = await go();
      if (typeof why === 'string') said = why;
      else {
        wrote = true;
        if (ed.undoable() > was) saved(ed.last());
      }
    } catch (e) {
      said = (e as Error).message;
    } finally {
      busy = false;
      after();
    }
  })();
  return ran.then(() => wrote);
}

const text = { ...type.small, color: ink('fg'), paddingHorizontal: space.md };
export const inRow = { ...text, paddingHorizontal: 0 }; // mutate-skip: layout; a row already pads its edges
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

/** An exit's actions: Door and Lock (a new closed or locked barrier on both faces; greyed where
 * mapedit `barrier` refuses), One-way (drops the way back) and Delete (both legs). */
export const exitActs = (r: MapRoom, dir: string, rooms: MapRoom[], nodes: Node[]) => {
  const e = r.exits.find((x) => x.dir === dir);
  const there = rooms.find((x) => x.key === e?.to);
  const why = e?.barrier
    ? WORDS.barred(e.barrier)
    : there?.exits.some((x) => x.dir === BACK[dir] && x.to === r.key)
      ? ''
      : WORDS.oneWayOnly;
  const bar = (label: string, locked: boolean) =>
    why
      ? greyed(label, locked ? '' : why, label) // the reason once, on Door
      : act(label, () => {
          const key = freeKey('barrier', 'barrier', nodes, []);
          void run(() => ed.barrier(r, dir, rooms, key, locked));
        });
  return [
    bar(WORDS.door, false),
    bar(WORDS.lock, true),
    act(WORDS.oneWay, () => void run(() => ed.oneWay(r, dir, rooms))),
    act(WORDS.unlink, () => void run(() => ed.unlink(r, dir, rooms))),
  ];
};

/** `＋` on each side with no exit and, when placed, no room on the cell: a new room that way,
 * its words `~`, in this room's area. */
export const grows = (r: MapRoom, nodes: Node[], rooms: MapRoom[]) => (
  <View key="grow" style={row}>
    {(r.at
      ? sides(r, rooms)
      : Object.keys(BACK).filter((dir) => !r.exits.some((e) => e.dir === dir))
    ).map((dir) =>
      act(
        WORDS.grow(dir),
        () => void run(() => ed.grow(r, dir, freeKey('room', 'room', nodes, []))),
      ),
    )}
  </View>
);

/** `＋ Add here`: a new person or item (`npc_<n>`, `item_<n>`), or a child of each template
 * (`<template>_<n>`), placed in this room, its words `~`; then its sheet opens. */
export function addHere(r: MapRoom, nodes: Node[], held: Template[], open: (id: string) => void) {
  const add = (dir: Template['dir'], up?: string) =>
    act(
      up ?? WORDS[dir],
      () => void addTo(r, dir, nodes, held, open, up),
      undefined,
      `${dir}:${up ?? ''}`, // a template named in both kinds, or `Person`, keeps its own button
    );
  return (
    <View key="add" style={row}>
      <Text style={inRow}>{WORDS.add}</Text>
      {add('npcs')}
      {add('items')}
      {held.map((t) => add(t.dir, t.key))}
    </View>
  );
}

/** Adds to room `r` a new `dir` (or a child of template `up`), its words `~`; then its sheet opens. */
export const addTo = (
  r: MapRoom,
  dir: Template['dir'],
  nodes: Node[],
  held: Template[],
  open: (id: string) => void,
  up?: string,
) =>
  run(async () => {
    const taken = held.filter((t) => t.dir === dir).map((t) => t.key);
    const key = up
      ? childKey(dir, up, nodes, taken)
      : freeKey(nodeOf(dir), nodeOf(dir), nodes, taken);
    await ed.made(r, dir, key, up);
    open(`${nodeOf(dir)}:${key}`);
  });

/** Deletes `key` from `file`, asking in sheet `shut` for the other files it takes; once it is
 * gone, `shut` and the key's other sheets close (the foot's Delete, and the palette's). */
export const dropIn = (key: string, file: string | undefined, shut: string) =>
  run(async () => {
    if (!file) return WORDS.noFile(key);
    const ask = (files: string[]) =>
      new Promise<boolean>((answer) => ((asking = { key: shut, files, answer }), after()));
    let yes = true;
    const why = await drop(io, key, file, (files) => ask(files).then((y) => (yes = y)));
    // it is gone: its sheets go too (kind and definition), wherever they sit
    const sheets = new Set([shut, `${nodeOf(file.split('/').at(-2) ?? '')}:${key}`, `def:${file}`]);
    if (why === '' && yes) sheets.forEach((id) => close(id));
    return why;
  });

/** A sheet's foot: Delete `key` (`refs` definitions name it, when known), then the other files it
 * takes, asked in the sheet; once it is gone, sheet `shut` and the key's other sheets close. */
export function foot(key: string, file: string | undefined, shut: string, refs?: number) {
  if (asking?.key === shut) {
    const { files, answer } = asking;
    const say = (yes: boolean) => () => ((asking = undefined), answer(yes));
    return (
      <View key="foot" style={row}>
        <Text style={inRow}>{WORDS.also(files)}</Text>
        {act(WORDS.yes, say(true))}
        {act(WORDS.no, say(false))}
      </View>
    );
  }
  const press = () => void dropIn(key, file, shut);
  // named elsewhere: greyed, still pressable so the server's refusal names the referrers
  return (
    <View key="foot" style={row}>
      {refs
        ? greyed(WORDS.drop(key), WORDS.refs(refs), 'drop', press)
        : act(WORDS.drop(key, refs), press)}
      {refs && file ? referredBy(file) : null}
    </View>
  );
}
