// The panel's one map editor (mapedit.ts over /__author) and the palette's map commands; a refusal
// shows on the map's footer line (areamap.tsx registers it), else in an alert.
import { ask, templates, type Story } from './author.ts';
import type { MapRoom } from './map.ts';
export { kept } from './map.ts'; // App's /story failure rule
import { editor, freeKey, type Editor } from './mapedit.ts';

const ed = editor({
  post: ask,
  source: (file) =>
    fetch(`/__author/source?file=${encodeURIComponent(file)}`).then(async (r) =>
      r.ok ? r.json() : Promise.reject(new Error(await r.text())),
    ),
});
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

const NODE: Record<string, string> = { cutscene: 'scene', areas: 'room' }; // the graph kind a palette kind compiles to
const NAMED = ['text', 'behaviours']; // no graph node holds their keys: a reused one would merge silently, so the author names it

/** The palette's New <kind>: a free `<kind>_<n>` key, then its card (an outline or layout has one fixed name). */
export async function created(kind: string) {
  const one = kind.replace(/(us)es$|s$/, '$1');
  const node = NODE[kind] ?? one;
  const held = kind === 'npcs' || kind === 'items' ? (await templates()).filter((t) => t.dir === kind).map((t) => t.key) : [];
  const fixed = kind === 'outline' || kind === 'layout';
  const name = fixed ? kind : NAMED.includes(kind) ? prompt(`New ${one} key`) : freeKey(one, node, shown.nodes, held);
  if (!name) return;
  const { ok, told } = await ask('new', { kind, name });
  if (!ok) alert(String(told));
  else if (!(told as { files: string[] }).files.length) alert(`${name} already exists`); // the starter reran on its file
  else if (!fixed && !NAMED.includes(kind)) shown.pick({ kind: node, key: name }); // text and behaviours have no node
}

/** The last map edit's id if it read or wrote `file` (mapedit.ts `newest`). */
export const mapNewest = (file: string) => ed.newest(file);

let queue = Promise.resolve();
/** Runs one map gesture after the ones before it (so undo stays in order); a refusal is told, not thrown. */
export const edit = (gesture: (ed: Editor) => Promise<unknown>) =>
  void (queue = queue
    .then(() => gesture(ed))
    .then(
      () => shown.tell(''),
      (e: Error) => shown.tell(e.message),
    ));

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
