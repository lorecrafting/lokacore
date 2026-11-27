// The Builder's Cmd-K palette (slice 6.5b, the panel's palette.tsx): kernel palette.ts's rows (each
// command, the definitions, /find's text keys and the `~` lines) and the Story's beats, each run as
// the Builder gesture it names. Its keys, over the Book while Build is on: Cmd-K opens it, Esc
// closes it, Cmd-Z presses the Undo chip, Cmd-E opens the top sheet's source (POST /open).
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { type MapRoom } from '../../../../kernel/ts/play/map.ts';
import { COMMANDS, items, rank, words } from '../../../../kernel/ts/play/palette.ts';
import { fromRef, storyItems, type Item } from '../../../../kernel/ts/play/storylist.ts';
import { space, type } from '../../book/tokens.ts';
import { textField } from '../prose_rules.ts';
import { ink } from './build.ts';
import { made, toStory } from './contents.tsx';
import { opens } from './find.tsx';
import { rootFile } from './generic.tsx';
import { chosen } from './map.tsx';
import { held, known } from './room.tsx';
import { addTo, dropIn } from './roomedit.tsx';
import { act, parts, sheets } from './sheet.tsx';
import { sheetOf } from './story.tsx';

// placeholder: the owner writes these words
const WORDS = { title: 'Commands', find: 'Type a command, a key or words' };

type Hooks = {
  on: () => boolean;
  top: () => string | undefined;
  close: () => void;
  undo: () => boolean; // presses the Undo chip; false when there is none
  placeholders: () => Record<string, string>;
  hold: { toggle: () => void };
  startIn: (room: string) => void;
};
let hooks: Hooks;
export { COMMANDS }; // the rows palette.test.ts counts (mobile tests reach the kernel only through here)

/** The top sheet's definition: its key and source file; a sheet with no file has none. */
const selection = (id = hooks.top() ?? '') => {
  const [s, arg] = parts(id);
  const file = s?.file?.(arg);
  return (
    file && {
      id,
      file,
      key: id.startsWith('def:') ? file.replace(/^.*\//, '').replace(/\.\w+$/, '') : arg,
    }
  );
};
/** On the map's selected room; none selected, the map opens to pick one. */
const onRoom = (then: (r: MapRoom) => unknown) => () => {
  const r = chosen();
  return r ? then(r) : known.open('map');
};
const exits = onRoom((r) => known.open(`room:${r.key}`)); // its exits' edits are the room sheet's
const add = (dir: 'npcs' | 'items') =>
  onRoom((r) => addTo(r, dir, known.nodes, held(), known.open));
const undo = () => hooks.undo();

/** Each command's gesture, by COMMANDS id. */
export const RUN: Record<string, () => unknown> = {
  ...Object.fromEntries(
    COMMANDS.filter((c) => c.id.startsWith('new-')).map((c) => [c.id, () => made(c.id.slice(4))]),
  ),
  delete: () => {
    const s = selection();
    return s && !rootFile(s.file) && dropIn(s.key, s.file, s.id); // a further file it takes is asked in its sheet
  },
  hold: () => (hooks.hold.toggle(), known.redraw()),
  undo,
  go: onRoom((r) => hooks.startIn(r.key)),
  'map-grow': () => known.open('map'), // ＋ and Area… take a direction or an area on the map
  'map-area': () => known.open('map'),
  'map-npc': add('npcs'),
  'map-item': add('items'),
  'map-unlink': exits,
  'map-one-way': exits,
  'map-door': exits,
  'map-lock': exits,
  'map-undo': undo, // a map edit is a gesture: the Undo chip puts it back
};

/** A row's gesture: a command, a definition's sheet, a line's file, a Story row's sheet. */
export function pick(i: Item) {
  const ref = fromRef(i.id);
  if (i.kind === 'command') return RUN[i.id]?.();
  if (i.kind === 'todo') return opens(i.detail ?? '', i.id);
  if (i.kind === 'text') return known.open('def:text.json');
  if (i.kind === 'key' && ref && ['room', 'npc', 'item'].includes(ref.kind))
    return known.open(`${ref.kind}:${ref.key}`);
  if (i.kind === 'key') return known.open(sheetOf(i.id) ?? 'contents');
  if (i.id.startsWith('beat:')) return (toStory(), known.open('contents'));
  if (i.id.startsWith('story:')) return known.open(sheetOf(i.id.slice(6)) ?? 'contents');
  return known.open(i.id); // trace:, consequences:, facts: are sheets of their own
}

/** /find's text keys for `q`, one ask per pause (the panel's useFound). */
function useFound(q: string) {
  const [text, setText] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true; // a slower reply to an older query never overwrites a newer one
    const ask = () =>
      known.api?.(`/find?q=${encodeURIComponent(q.trim())}`).then(
        ([status, f]) => live && status === 200 && setText(words(f?.hits ?? [])),
        () => {},
      );
    const typing = q.trim() ? setTimeout(ask, 150) : undefined; // mutate-skip: a pause, no boundary to test
    return () => ((live = false), clearTimeout(typing));
  }, [q]);
  return q.trim() ? text : {};
}

function Palette() {
  const [q, setQ] = useState('');
  const story = known.story;
  const rows = rank(q, [
    ...items(known.nodes, useFound(q), hooks.placeholders(), story?.names),
    ...(story ? storyItems(story) : []),
  ]);
  const run = (i?: Item) => i && (hooks.close(), pick(i));
  return [
    <TextInput
      key="q"
      autoFocus
      value={q}
      onChangeText={setQ}
      onSubmitEditing={() => run(rows[0])} // ponytail: Enter runs the first row; no Up/Down yet
      placeholder={WORDS.find}
      accessibilityLabel={WORDS.find}
      style={{ ...type.body, color: ink('fg'), padding: space.md }}
    />,
    ...rows.map((i) =>
      act(
        i.kind === 'command' ? i.label : `${i.label} · ${i.detail}`,
        () => run(i),
        undefined,
        `${i.kind} ${i.id}`,
      ),
    ),
  ];
}
sheets.palette = { title: () => WORDS.title, body: () => <Palette /> };

const mod = (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && !e.altKey;
/** Whether the Builder took key `e`: off Build, or with nothing to do, the Book and panel get it. */
function took(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  if (!hooks.on()) return false;
  if (mod(e) && k === 'k') return (known.open('palette'), true);
  if (e.key === 'Escape') return hooks.top() === 'palette' && (hooks.close(), true);
  if (mod(e) && k === 'z' && !e.shiftKey)
    return !textField(e.target as HTMLElement) && hooks.undo();
  if (!mod(e) || k !== 'e') return false;
  const s = selection();
  return !!s && (void known.api?.('/open', { file: s.file, key: s.key }).catch(() => {}), true);
}
/** The palette's keys, ahead of the Book's own (capture on the window). */
export const keys = (e: KeyboardEvent) => took(e) && (e.preventDefault(), e.stopPropagation());
/** Build.tsx's call: its state and gestures; then the keys listen. */
export function paletteWith(given: Hooks) {
  hooks = given;
  globalThis.addEventListener?.('keydown', keys, true);
}
