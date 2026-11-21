// The panel's one map editor (mapedit.ts over /__author) and the palette's map commands; a refusal
// shows on the map's footer line (areamap.tsx registers it), else in an alert.
import { io, templates, type Story } from './author.ts';
import type { MapRoom } from '../../../kernel/ts/play/map.ts';
export { kept } from '../../../kernel/ts/play/map.ts'; // App's /story failure rule
import { create, editor, freeKey, NAMED, nodeOf, type Editor } from '../../../kernel/ts/play/mapedit.ts';

const ed = editor(io);
/** The mounted map's footer line, else an alert; the last story's rooms (App.tsx useStory), so the
 * palette's and the Room card's map commands work with the map closed; App's selection (`pick`). */
export const alone = (why: string): void => void (why && alert(why));
export const shown = {
  tell: alone,
  pick: (_: { kind: string; key: string }): void => {},
  rooms: [] as MapRoom[],
  nodes: [] as Story['graph']['nodes'],
  shorts: [] as string[],
};

/** The palette's New <kind> (mapedit.ts `create`), then its card; text and behaviours have no node. */
export async function created(kind: string) {
  const held = kind === 'npcs' || kind === 'items' ? (await templates()).filter((t) => t.dir === kind).map((t) => t.key) : [];
  const named = NAMED.includes(kind) ? (prompt(`New ${kind.replace(/(us)es$|s$/, '$1')} key`) ?? '') : '';
  const name = await create(io, kind, shown.nodes, held, named).catch((e: Error) => void alert(e.message));
  if (name && name !== kind && !NAMED.includes(kind)) shown.pick({ kind: nodeOf(kind), key: name });
}

/** The last map edit's id if it read or wrote `file` (mapedit.ts `newest`). */
export const mapNewest = (file: string) => ed.newest(file);

let queue: Promise<boolean> = Promise.resolve(true);
/** Runs one map gesture after the ones before it (so undo stays in order); a refusal is told, not
 * thrown. Resolves whether it landed. */
export const edit = (gesture: (ed: Editor) => Promise<unknown>) =>
  (queue = queue
    .then(() => gesture(ed))
    .then(
      () => (shown.tell(''), true),
      (e: Error) => (shown.tell(e.message), false),
    ));

/** The Room card's Add exit: `key`'s exit `dir` to the room `to`, both ways (the map's Shift-drag
 * link, but any level and no layout needed). */
export function linkTo(key: string, dir: string, to: string) {
  const [a, b] = [key, to].map((k) => shown.rooms.find((o) => o.key === k));
  if (!a || !b) return Promise.resolve((shown.tell(`No room ${a ? to : key}`), false));
  return edit((e) => e.link(a, dir, b));
}

/** A map command (shell.ts COMMANDS `map-*`) on the selected room, its arguments by `prompt` (the plainest; see the PR's list) unless given. */
export function mapCommand(id: string, key: string | undefined, given?: string) {
  if (id === 'map-undo') return edit((e) => e.undo());
  const r = shown.rooms.find((o) => o.key === key);
  if (!r) return shown.tell('Select a room on the map first');
  if (id === 'map-area') {
    const area = prompt(`Move ${r.key} to area (empty: the root)`);
    return area === null ? undefined : edit((e) => e.move(r, area || null));
  }
  if (id === 'map-npc' || id === 'map-item') {
    const [kind, one] = id === 'map-npc' ? (['npcs', 'npc'] as const) : (['items', 'item'] as const);
    return edit(async (e) => {
      const key = freeKey(one, one, shown.nodes, (await templates()).map((t) => t.key));
      await e.made(r, kind, key);
      shown.pick({ kind: one, key });
    });
  }
  const dir = given ?? prompt(`${r.key}: which direction?`);
  if (!dir) return;
  if (id === 'map-unlink') return edit((e) => e.unlink(r, dir, shown.rooms));
  if (id === 'map-one-way') return edit((e) => e.oneWay(r, dir, shown.rooms));
  if (id === 'map-grow')
    return edit(async (e) => {
      const key = freeKey('room', 'room', shown.nodes, []);
      await e.grow(r, dir, key);
      shown.pick({ kind: 'room', key });
    });
  const name = prompt('Barrier key');
  if (!name) return;
  edit((e) => e.barrier(r, dir, shown.rooms, name, id === 'map-lock'));
}
