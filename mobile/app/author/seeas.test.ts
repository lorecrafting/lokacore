// Build's ghost lines and See as (docs/rnd/in-game-builder-mode-2026-11-19.md §4.5, slice 2.5) on a real
// game: the ghosts under the room's title, and See as leaving the save as it was. The ghosts' rules
// themselves: kernel/ts/test/ghosts.test.ts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';
import { bind, tagged } from './prose_rules.ts';

const kept = new Map([[BUILD, '{"on":true}']]);
const sent: string[] = []; // every path the page asks for but /story
const seen = new Map<string, string>();
const said = new Map<string, string>();
const tick = () => new Promise((r) => setTimeout(r));
const LANDING = { key: 'ferry_landing', area: null, title: 'Ferry Landing', exits: [] };
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener() {},
  fetch: async (path: string) => {
    if (path === '/__author/story') return { status: 200, json: async () => ({ map: [LANDING] }) };
    sent.push(path.split('?')[0]);
    return { status: 200, json: async () => null };
  },
});
const build = await import('./build/Build.tsx');
const { RoomPage } = await import('../book/Body.tsx');
const api = async (path: string): Promise<[number, any]> => {
  const r = await fetch(`/__author${path}`);
  return [r.status, await r.json()];
};

const host = elapsedHost(); // 18:00 at the ferry landing: Bram and the lantern are drawn
const { game } = host;
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ferry_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const LANDING_AT = ref('room', 'ferry_landing');
const NIGHT = { op: 'time_window', from: 20, to: 6 } as const;
// The compiled cartridge as the dev artifact gives it, with a hidden person and a night variant here.
const CANON = {
  npcs: {
    'ferry_sampler@0.0.1:npc/bram': { key: 'bram', name: 'npc.bram.short', room: LANDING_AT },
    'ferry_sampler@0.0.1:npc/shade': {
      key: 'shade',
      name: 'npc.shade.short',
      room: LANDING_AT,
      perception: { discovered: ref('fact', 'saw_shade') },
    },
  },
  rooms: {
    'ferry_sampler@0.0.1:room/ferry_landing': {
      key: 'ferry_landing',
      variants: [{ when: NIGHT, description: 'room.village_green.description' }],
    },
  },
};
build.place({
  place: () => ({ steps: [] }),
  here: () => 'ferry_landing',
  drop() {},
  back() {},
  startIn() {},
  game,
  canon: () => CANON,
});
build.install({ seen, said, redraw() {}, api });
await tick(); // the map

/** The room page as panel.tsx draws it: See as's words, else the game's, each line bound. */
function page() {
  const text = (key: string) => {
    const words = build.seeing(key) ?? game.text(key) ?? key;
    const shown = tagged(key, words);
    bind(seen, shown, key);
    said.set(key, words);
    return shown;
  };
  const view = game.view().view;
  const g = { place: [], door: () => [] };
  return nodes(
    RoomPage({ view, text, log: [], g, press() {}, open() {}, links: new Map() } as any),
  );
}
const strip = () => nodes(build.Strip({ children: 'book' }));
const button = (label: string) =>
  strip().find((n) => n.type === 'Pressable' && n.props.children?.props?.children === label);
const ghosts = () =>
  page().filter((n) => n.props?.accessibilityLabel?.match(/, (hidden|only when).*, edit$/));
const top = () => JSON.parse(kept.get(BUILD)!).sheets?.at(-1);
const tables = () =>
  (host.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(
    ({ name }) => host.sql.prepare(`SELECT * FROM "${name}"`).all(),
  );
/** The save: every table, the view it draws and the other stored keys (the place a reload replays). */
const hash = () =>
  createHash('sha256')
    .update(JSON.stringify([tables(), game.view(), [...kept].filter(([k]) => k !== BUILD)]))
    .digest('hex');

// Breaks: no ghost for a person the room holds but its perception gate hides, the gate's reason not
// said, a ghost drawn twice (as its own title line too) or out of Build, a tap opening no sheet or
// another's.
test("the room's title has one ghost per hidden thing, with its reason; a tap opens its sheet", () => {
  const lines = ghosts().map((n) => n.props.accessibilityLabel);
  assert.deepEqual(lines, [
    'npc.shade.short, hidden: until fact saw_shade, edit',
    'An old elm shades a patch of trodden grass., only when: the time of day is from 20 to 6, edit',
  ]);
  ghosts()[0].props.onPress({ stopPropagation() {} });
  assert.equal(top(), 'npc:shade');
  button('Back')?.props.onPress();
  button('✎ Build').props.onPress(); // Build off
  assert.deepEqual(ghosts(), [], 'a ghost out of Build');
  button('Build').props.onPress();
});

// Breaks: See as writing to the save, ticking the clock or invoking (the hash moves); See as not
// redrawing the room's words as the night variant draws them; Back not ending it; a tap on the
// line while seeing opening the field (a /line request) instead of ending See as.
test('See as at night redraws the words and leaves the save hash unchanged', async () => {
  const description = game.view().view.place.description.key;
  const day = game.text(description);
  const night = game.text('room.village_green.description');
  const before = hash();
  const drawn = (words?: string) =>
    page().some((n) => n.props?.accessibilityLabel === `${words}, edit`);
  const seeAs = () => {
    ghosts()[1].props.onPress({ stopPropagation() {} }); // the variant's ghost opens the Room sheet
    assert.equal(top(), 'room:ferry_landing');
    button('See as').props.onPress();
    assert.ok(
      drawn(night) && !build.seeing('room.x'),
      "the night's words not drawn, or not only there",
    );
  };
  seeAs();
  assert.ok(!drawn(day), "the day's words still drawn");
  button('Seeing: only when: the time of day is from 20 to 6 · Back').props.onPress();
  assert.equal(build.seeing(description), undefined);
  assert.equal(hash(), before, 'See as changed the save');

  seeAs();
  const line = page().find((n) => n.props?.accessibilityLabel === `${night}, edit`);
  line.props.onPress();
  await tick();
  assert.deepEqual(
    [build.seeing(description), sent.includes('/__author/line')],
    [undefined, false],
  );
  assert.equal(hash(), before);
});
