// The panel's one map editor (mapedit.ts over /__author) and the palette's map commands; a refusal
// shows on the map's footer line (areamap.tsx registers it), else in an alert.
import { ask } from './author.ts';
import type { MapRoom } from './map.ts';
import { editor, type Editor } from './mapedit.ts';

const ed = editor({
  post: ask,
  source: (file) =>
    fetch(`/__author/source?file=${encodeURIComponent(file)}`).then(async (r) =>
      r.ok ? r.json() : Promise.reject(new Error(await r.text())),
    ),
});
/** What the mounted map shows: its footer line and its rooms (the palette's map commands need both). */
export const alone = (why: string): void => void (why && alert(why));
export const shown = { tell: alone, rooms: [] as MapRoom[] };

let queue = Promise.resolve();
/** Runs one map gesture after the ones before it (so undo stays in order); a refusal is told, not thrown. */
export const edit = (gesture: (ed: Editor) => Promise<unknown>) =>
  void (queue = queue.then(() => gesture(ed)).then(
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
  const dir = given ?? prompt(`${r.key}: which direction?`);
  if (!dir) return;
  if (id === 'map-unlink') return edit((e) => e.unlink(r, dir, shown.rooms));
  if (id === 'map-one-way') return edit((e) => e.oneWay(r, dir, shown.rooms));
  const name = prompt(id === 'map-grow' ? 'New room key' : 'Barrier key');
  if (!name) return;
  if (id === 'map-grow') return edit((e) => e.grow(r, dir, name));
  edit((e) => e.barrier(r, dir, shown.rooms, name, id === 'map-lock'));
}
