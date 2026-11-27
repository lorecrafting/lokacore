// The Builder's palette and keys (slice 6.5b): a gesture for every command, Cmd-Z as the Undo chip,
// and the map's keys on its ground (mapcontrols.tsx `mapKey`). The rows' ranking: kernel/ts/test/palette.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';

// a reload after a field's write: its chip kept
const kept = new Map([
  [BUILD, '{"on":true}'],
  [
    'loka-build-undo',
    JSON.stringify({
      w: { id: 7, key: 'gate', words: 'Old', file: 'text.json' },
      end: Date.now() + 60_000,
    }),
  ],
]);
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener() {},
});
const build = await import('./build/Build.tsx');
const { COMMANDS, RUN, keys } = await import('./build/palette.tsx');
const { mapKey } = await import('./build/mapcontrols.tsx');
const { known } = await import('./build/room.tsx');
const sent: [string, unknown][] = [];
const api = async (path: string, body?: unknown): Promise<[number, any]> => (
  sent.push([path, body]),
  [200, null]
);
build.install({ seen: new Map(), said: new Map(), redraw() {}, api } as never);

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => {
  const e = {
    key: k,
    target: { tagName: 'DIV' },
    preventDefault() {},
    stopPropagation() {},
    ...mods,
  };
  keys(e as never);
};

test('every palette command runs one Builder gesture: one handler per COMMANDS id, none else', () => {
  assert.deepEqual(Object.keys(RUN).sort(), COMMANDS.map((c) => c.id).sort());
});

test('Cmd-Z presses the Undo chip: one /undo of the last write, then nothing', async () => {
  key('z', { metaKey: true });
  key('z', { metaKey: true }); // the chip is gone
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(
    sent.filter(([p]) => p === '/undo'),
    [['/undo', { id: 7, key: 'gate', words: 'Old' }]],
  );
});

test("Delete from the palette drops the top sheet's definition, never a root file", async () => {
  // a drop reads the file's source first (kernel drop.ts), then posts delete with its sha
  const asked = (file: string) =>
    sent.filter(([p]) => p === `/source?file=${encodeURIComponent(file)}`);
  for (const file of ['text.json', 'rooms/hall.json']) {
    known.open(`def:${file}`);
    RUN.delete();
    await new Promise((r) => setTimeout(r));
  }
  assert.equal(asked('text.json').length, 0);
  assert.notEqual(asked('rooms/hall.json').length, 0);
});

const room = (key: string, x: number, y: number) =>
  ({ ref: key, key, area: null, title: key, exits: [], at: { x, y, z: 0 } }) as const;
const rooms = [room('hall', 0, 0), room('east', 2, 0), room('west', -1, 0), room('north', 0, -1)];
const acts = () => {
  const did: unknown[] = [];
  const a = {
    pick: (k: string) => void did.push(['pick', k]),
    goTo: (k: string) => void did.push(['go', k]),
    step: (by: number) => void did.push(['step', by]),
    zoom: (f: number) => void did.push(['zoom', f]),
    fit: () => void did.push(['fit']),
  };
  return { did, a };
};
const press = (k: string, mods: object = {}) => {
  const { did, a } = acts();
  const e = { key: k, preventDefault() {}, stopPropagation() {}, ...mods };
  mapKey(e as never, rooms as never, 0, 'hall', undefined, a);
  return did;
};

test('map keys: ArrowRight selects the east neighbour, Enter selects, Shift-Enter goes', () => {
  assert.deepEqual(press('ArrowRight'), [['pick', 'east']]);
  assert.deepEqual(press('Enter'), [['pick', 'hall']]);
  assert.deepEqual(press('Enter', { shiftKey: true }), [['go', 'hall']]);
});

test("map keys: + and - zoom by M.step (1.25), 0 fits; Cmd-0 and Cmd-+ stay the browser's", () => {
  assert.deepEqual(
    [...press('+'), ...press('-'), ...press('0')],
    [['zoom', 1.25], ['zoom', 1 / 1.25], ['fit']],
  );
  assert.deepEqual([...press('0', { metaKey: true }), ...press('+', { ctrlKey: true })], []);
});
