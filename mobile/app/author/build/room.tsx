// The Room sheet and the room title's pencil that opens it (design §7, slice 2.1). Editing exits,
// Move and Delete are slice 2.1's second half: they wait on the map editor's move into
// kernel/ts/play (slice 4.1).
import { Text } from 'react-native';
import { size, space, type } from '../../book/tokens.ts';
import { unwritten } from '../prose_rules.ts';
import { ink } from './build.ts';
import type { Hooks } from './field.tsx';
import { sheets } from './sheet.tsx';

const WORDS = {
  edit: (title: string) => `Edit ${title}`,
  exits: (n: number) => (n === 1 ? '1 exit' : `${n} exits`),
  root: 'No area',
};
/** A room on the editor map (/story's `map`, kernel/ts/play/story.ts `rooms`). */
type Room = {
  key: string;
  area: string | null;
  title: string;
  exits: { dir: string; to: string }[];
};
let rooms: Room[] = [];
// The latest /story request: a slower, older answer is dropped.
let asked = 0; // mutate-skip: any start value counts the same
const find = (key: string | undefined) => rooms.find((x) => x.key === key);
// An unwritten title shows the key, never `~` (ruling 9).
const named = (r: Room) => (unwritten(r.title) ? r.key : r.title);

/** Reads the map again; `redraw` once it has come. */
export function story(api: Hooks['api'] | undefined, redraw: () => void) {
  const n = ++asked;
  void api?.('/story').then(
    ([status, json]) => {
      if (status !== 200 || n !== asked) return;
      const map = (json as { map?: Room[] } | null)?.map;
      rooms = Array.isArray(map) ? map : [];
      redraw();
    },
    () => {}, // the server down: the pencil waits for the next message
  );
}

/** The pencil after the room page's own title (`here`'s), which opens its Room sheet. */
export function pencil(shown: string, here: string | undefined, open: (id: string) => void) {
  const r = find(here);
  if (!r || (r.title !== shown && !(unwritten(r.title) && unwritten(shown)))) return undefined; // `~` is drawn tagged
  const press = () => open(`room:${r.key}`);
  return (
    <Text
      key="pencil"
      accessibilityRole="button"
      accessibilityLabel={WORDS.edit(named(r))}
      onPress={(e) => (e.stopPropagation(), press())} // not the title's own look
      {...({
        onKeyDown: (e: KeyboardEvent) =>
          (e.key === 'Enter' || e.key === ' ') &&
          (e.preventDefault(), e.stopPropagation(), press()),
      } as object)}
      style={{ ...PENCIL, color: ink('action') }}
    >
      ✎
    </Text>
  );
}
const PENCIL = {
  ...type.control,
  display: 'inline-flex' as 'flex', // web: an inline box can take the touch size
  minWidth: size.touch,
  minHeight: size.touch,
  alignItems: 'center',
  justifyContent: 'center',
  verticalAlign: 'middle',
} as const;

/** The Room sheet: its summary, then its exits. */
sheets.room = {
  title: (key) => {
    const r = find(key);
    return r ? named(r) : key;
  },
  body: (key) => {
    const r = find(key);
    if (!r) return null;
    const text = { ...type.small, color: ink('fg'), paddingHorizontal: space.md };
    return [
      <Text key="summary" style={{ ...text, color: ink('dim') }}>
        {`${r.area ?? WORDS.root} · ${WORDS.exits(r.exits.length)}`}
      </Text>,
      ...r.exits.map((e) => {
        const to = find(e.to);
        return (
          <Text key={e.dir} style={{ ...text, minHeight: size.touch }}>
            {`${e.dir} → ${to ? named(to) : e.to}`}
          </Text>
        );
      }),
    ];
  },
};
