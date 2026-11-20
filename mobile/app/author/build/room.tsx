// The Room sheet and the room title's pencil that opens it (design §7, slice 2.1); its edits are
// roomedit.tsx's.
import { Text, View } from 'react-native';
import type { MapRoom } from '../../../../kernel/ts/play/map.ts';
import { size, space, type } from '../../book/tokens.ts';
import { unwritten } from '../prose_rules.ts';
import { ink } from './build.ts';
import type { Hooks } from './field.tsx';
import { sheets } from './sheet.tsx';
import { exitActs, foot, grows, moveTo, refusal, wire, type Node } from './roomedit.tsx';

const WORDS = {
  edit: (title: string) => `Edit ${title}`,
  exits: (n: number) => (n === 1 ? '1 exit' : `${n} exits`),
  root: 'No area',
};
type Room = MapRoom; // /story's `map` (kernel/ts/play/story.ts `rooms`)
let rooms: Room[] = [];
let nodes: Node[] = []; // /story's graph nodes: the keys a new room must not take
// The latest /story request: a slower, older answer is dropped.
let asked = 0; // mutate-skip: any start value counts the same
const find = (key: string | undefined) => rooms.find((x) => x.key === key);
// An unwritten title shows the key, never `~` (ruling 9).
const named = (r: Room) => (unwritten(r.title) ? r.key : r.title);

/** Reads the map again; `redraw` once it has come. */
export function story(api: Hooks['api'] | undefined, redraw: () => void) {
  wire(api, () => story(api, redraw));
  const n = ++asked;
  void api?.('/story').then(
    ([status, json]) => {
      if (status !== 200 || n !== asked) return;
      const told = json as { map?: Room[]; graph?: { nodes?: Node[] } } | null;
      rooms = Array.isArray(told?.map) ? told.map : [];
      nodes = told?.graph?.nodes ?? [];
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

/** The Room sheet: a refusal, its summary, its exits with their actions, `＋`, Move and Delete. */
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
      refusal(),
      <Text key="summary" style={{ ...text, color: ink('dim') }}>
        {`${r.area ?? WORDS.root} · ${WORDS.exits(r.exits.length)}`}
      </Text>,
      ...r.exits.map((e) => {
        const to = find(e.to);
        return (
          <View
            key={e.dir}
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Text style={{ ...text, minHeight: size.touch }}>
              {`${e.dir} → ${to ? named(to) : e.to}`}
            </Text>
            {exitActs(r, e.dir, rooms)}
          </View>
        );
      }),
      grows(r, nodes),
      moveTo(r),
      foot(r),
    ];
  },
};
