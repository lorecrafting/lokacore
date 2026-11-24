// The Room sheet and the room title's pencil that opens it (design §7, slice 2.1); its edits are
// roomedit.tsx's.
import { Text, View } from 'react-native';
import type { MapRoom } from '../../../../kernel/ts/play/map.ts';
import { size, space, type } from '../../book/tokens.ts';
import { unwritten } from '../prose_rules.ts';
import { ink } from './build.ts';
import type { Hooks } from './field.tsx';
import type { Ghost } from '../../../../kernel/ts/play/ghosts.ts';
import { ghostRows } from './seeas.tsx';
import { sheets } from './sheet.tsx';
import {
  exitActs,
  foot,
  grows,
  moveTo,
  inRow,
  refusal,
  row,
  addHere,
  wire,
  type Node,
  type Template,
} from './roomedit.tsx';

const WORDS = {
  edit: (title: string) => `Edit ${title}`,
  exits: (n: number) => (n === 1 ? '1 exit' : `${n} exits`),
  root: 'No area',
};
type Room = MapRoom; // /story's `map` (kernel/ts/play/story.ts `rooms`)
/** The last /story's rooms, graph nodes (the keys a new definition must not take) and source file
 * per node ref; /templates' abstract NPCs and items; the Book's redraw, a sheet's open and the api. */
export const known = {
  rooms: [] as Room[],
  nodes: [] as Node[],
  files: {} as Record<string, string>,
  hidden: [] as string[], // skills no add menu offers (story.ts `hidden`)
  unlinkable: {} as Record<string, string>, // dialogues no then may name, with why (story.ts `unlinkable`)
  held: [] as Template[],
  redraw: () => {},
  open: (_id: string) => {},
  api: undefined as Hooks['api'] | undefined,
};
let listed: object | undefined; // the /story the templates were asked under

/** /templates' abstract NPCs and items, asked again once under each new /story; then the Book redraws. */
function held() {
  if (listed !== known.files) {
    listed = known.files;
    void known.api?.('/templates').then(
      ([status, all]) =>
        status === 200 && Array.isArray(all) && ((known.held = all), known.redraw()),
      () => {}, // the server down: Add here offers no templates until the next /story
    );
  }
  return known.held;
}
type Story = {
  map?: Room[];
  graph?: { nodes?: Node[] };
  files?: Record<string, string>;
  hidden?: string[];
  unlinkable?: Record<string, string>;
};
// The latest /story request: a slower, older answer is dropped.
let asked = 0; // mutate-skip: any start value counts the same
const find = (key: string | undefined) => known.rooms.find((x) => x.key === key);
// An unwritten title shows the key, never `~` (ruling 9).
const named = (r: Room) => (unwritten(r.title) ? r.key : r.title);

/** Reads the map again; `redraw` once it has come. `close` shuts a sheet by id (a deleted room's),
 * `open` opens one (a new person's). */
export function story(
  api: Hooks['api'] | undefined,
  redraw: () => void,
  close: (id: string) => void,
  open = (_id: string) => {},
) {
  wire(api, () => story(api, redraw, close, open), close);
  Object.assign(known, { redraw, open, api });
  const n = ++asked;
  void api?.('/story').then(
    ([status, json]) => {
      if (n !== asked) return;
      if (status === 200) {
        const told = json as Story | null;
        known.rooms = Array.isArray(told?.map) ? told.map : [];
        known.nodes = told?.graph?.nodes ?? [];
        known.files = told?.files ?? {};
        known.hidden = told?.hidden ?? [];
        known.unlinkable = told?.unlinkable ?? {};
      }
      redraw(); // a refusal or question still shows when the map does not come (a compile error)
    },
    () => {}, // the server down: the pencil waits for the next message
  );
}

/** The pencil after the room page's own title (`here`'s), which opens its Room sheet. */
export function pencil(shown: string, here: string | undefined, open: (id: string) => void) {
  const r = find(here);
  if (!r || (r.title !== shown && !(unwritten(r.title) && unwritten(shown)))) return undefined; // `~` is drawn tagged
  return pen(WORDS.edit(named(r)), () => open(`room:${r.key}`));
}

/** A ghost line's sheet: its person's, item's or room's, else its definition's file (none unlisted). */
export function ghostSheet(g: Ghost) {
  if (g.kind === 'npc' || g.kind === 'item') return `${g.kind}:${g.key}`;
  if (g.kind === 'variant') return `room:${g.key}`;
  return known.files[g.ref] && `def:${known.files[g.ref]}`;
}

/** A pencil labelled `label` after a page title, pressed by touch, click, Enter or Space. */
export function pen(label: string, press: () => void) {
  return (
    <Text
      key="pencil"
      accessibilityRole="button"
      accessibilityLabel={label}
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
          <View key={e.dir} style={row}>
            <Text style={{ ...inRow, minHeight: size.touch }}>
              {`${e.dir} → ${to ? named(to) : e.to}`}
            </Text>
            {exitActs(r, e.dir, known.rooms)}
          </View>
        );
      }),
      ...ghostRows(r.key, known.open, ghostSheet),
      grows(r, known.nodes, known.rooms),
      addHere(r, known.nodes, held(), known.open),
      moveTo(r),
      foot(r),
    ];
  },
};
