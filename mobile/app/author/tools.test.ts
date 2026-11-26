// The notebook's Tools tab (author/build/tools.tsx, slice 6.2a): its rows as drawn and pressed, the
// cheats and Advance through the real panel.tsx placeHooks over a controlled game.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader
import * as place from './place.ts';
import * as proseRules from './prose_rules.ts';
import * as shown from './shown.ts';

const { toolRows, toolsWith } = await import('./build/tools.tsx');
const settle = () => new Promise((r) => setTimeout(r));
const stored = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => stored.set(k, v),
    removeItem: (k: string) => stored.delete(k),
  },
  fetch: async () => ({ ok: true, json: async () => ['gate'] }),
});
const hold = { toggle: () => {}, pinned: () => false };
const drawn = () => nodes(toolRows());
const typeIn = (label: string, text: string) =>
  drawn()
    .find((n) => n.props?.accessibilityLabel === label)
    .props.onChangeText(text);
const press = (label: string) =>
  drawn()
    .find((n) => n.props?.accessibilityRole === 'button' && words(n) === label)
    .props.onPress();

// Break: a failed checkpoint's verdict dropped (every row reads its name only) or its step and why
// lost, or the failed count not counting it.
test('a checkpoint failed at step 3 says so in its row and counts one failed', async () => {
  toolsWith({
    game: () => undefined,
    hold,
    heard: () => ({ checkpoints: [{ name: 'gate', ok: false, step: 3, why: 'the gate is shut' }] }),
  });
  toolRows(); // the first draw asks for the names
  await settle();
  const text = drawn().map(words).join('|');
  assert.match(text, /step 3, refused: the gate is shut/);
  assert.match(text, /1 checkpoint fails/);
});

/** panel.tsx as the author preview loads it, over a chapter at rate 1 and a game that accepts. */
function panel() {
  const ts = createRequire(import.meta.url)('typescript');
  const js = ts.transpileModule(readFileSync(new URL('panel.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let hooks: any;
  const canonical = JSON.stringify({
    manifest: { id: 'c', version: '1', title: 'c', time_policy: { rate: 1 } },
  });
  const modules: Record<string, unknown> = {
    react: { useRef: (v: unknown) => ({ current: v }), useEffect: (f: () => void) => f() },
    'react-native': { Platform: { OS: 'web' } },
    '../../../protocol/fixtures/toolbox_showcase_hash.json': { sha256: 'h', canonical },
    './live.ts': { listen: () => () => {}, overlay: {} },
    './place.ts': place,
    './shown.ts': shown,
    '../book/words.ts': { worded: {} },
    './prose_rules.ts': proseRules,
    './build/Build.tsx': { install: () => {}, place: (h: unknown) => (hooks = h) },
  };
  const context: { loka_dev_skew?: number } & Record<string, unknown> = {
    exports: {},
    process: { env: { EXPO_PUBLIC_LOKA_DEV_CARTRIDGE: '1' } },
    location: { search: '?dev=1' },
    URLSearchParams,
    localStorage: globalThis.localStorage,
    fetch: (...a: Parameters<typeof fetch>) => globalThis.fetch(...a), // each test's own
    document: { addEventListener: () => {} },
    // the gated in-Book editor, matched by file name: prose_rules.test.ts allows panel.tsx's require only
    require: (name: string) =>
      name.endsWith('/inbook.ts')
        ? { api: {}, start: () => () => {}, heard: () => {} }
        : modules[name],
  };
  context.globalThis = context;
  context.window = Object.assign(context, { addEventListener: () => {} });
  context.window.parent = context.window;
  runInNewContext(js, context);
  const sent: { action_key: string }[] = [];
  const opened = () => ({
    view: () => ({ view: {}, token: 't' }),
    invoke: (i: { action_key: string }) => (
      sent.push(i),
      { kind: 'saved', decision: { kind: 'accepted' } }
    ),
    entityIds: () => ({}),
    pending: () => false,
    subscribe: () => () => {},
    pulse: () => ({ kind: 'ready' }),
  });
  let game = opened();
  const session = { game: () => game };
  const startOver = () => void (game = opened()); // a fresh game, as App.tsx's start over
  (context.exports as any).useAuthorPanel({ redraw: () => {}, session, startOver }, game);
  toolsWith({ game: () => hooks, hold, heard: () => ({}) });
  return { context, hooks, sent };
}

// Break: the tab's Set fact sent past panel.tsx's recording path (an accepted cheat no step, so
// `bin/loka check` and a reload never replay it), or sent as another cheat.
test('Set fact lit true is sent once and recorded as one dev_set_fact step', () => {
  const { hooks, sent } = panel();
  typeIn('fact key', 'lit');
  typeIn('value', 'true');
  press('Set fact');
  assert.equal(sent.length, 1);
  const steps = hooks.place().steps;
  assert.equal(steps.length, 1);
  assert.equal(steps[0].intent.action_key, 'dev_set_fact');
  assert.equal(steps[0].intent.input.value, true);
});

// Break: Save PUTs other steps than the Book's (one dropped), or Replay jumps to other steps than
// the file's (none, or one dropped in tools.tsx or panel.tsx's jump).
test('Save PUTs the Book steps and Replay gate puts the file steps in the Book', async () => {
  const { wire } = await import('./build/roomedit.tsx');
  wire(
    async () => [200, {}],
    () => {},
    () => {},
  ); // run() acts only once wired
  const { hooks } = panel();
  typeIn('fact key', 'lit');
  typeIn('value', 'true');
  press('Set fact');
  await settle();
  const saved = JSON.parse(JSON.stringify(hooks.place().steps)); // out of panel.tsx's realm
  const look = { intent: { action_key: 'look', input: {} } };
  const file = [look, look];
  const real = globalThis.fetch;
  const puts: unknown[] = [];
  globalThis.fetch = (async (_url: string, init?: { method?: string; body: string }) =>
    init?.method === 'PUT'
      ? (puts.push(JSON.parse(init.body)), { ok: true, json: async () => ({}) })
      : {
          ok: true,
          json: async () => (_url.endsWith('/gate') ? { steps: file } : ['gate']),
        }) as any;
  typeIn('checkpoint name', 'gate');
  press('Save checkpoint');
  await settle();
  assert.deepEqual(puts, [{ steps: saved }]);
  press('Replay gate');
  await settle();
  globalThis.fetch = real;
  assert.deepEqual(JSON.parse(JSON.stringify(hooks.place().steps)), file);
});

// Break: a pin only the panel reads (Build's place never starts it, so the Book ignores it), a pin
// replayed over a Book that already has steps, or replayed again on the same load.
test('a Book pinned to gate replays it once, only while it has no steps', async () => {
  const { place } = await import('./build/Build.tsx');
  stored.set('loka.editor.start', 'gate');
  const asked: string[] = [];
  const jumps: unknown[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => (
    asked.push(url),
    { ok: true, json: async () => ({ steps: ['look'] }) }
  )) as any;
  const game = (steps: unknown[]) => ({
    place: () => ({ steps }),
    jump: (s: unknown) => jumps.push([steps.length, s]),
  });
  place(game(['go north']) as any);
  place(game([]) as any);
  place(game([]) as any);
  await settle();
  globalThis.fetch = real;
  stored.delete('loka.editor.start');
  assert.deepEqual(asked, ['/__author/checkpoints/gate']);
  assert.deepEqual(jumps, [[0, ['look']]]); // the fresh Book, not the one with steps
});

// Break: an accepted cheat from the Tools tab returns the Book's old stop note, which the tab then
// shows as the cheat's refusal.
test('an accepted cheat under an old stop note says nothing', () => {
  stored.clear();
  const stopped = { hash: 'h', at: 0, note: 'Place: old stop' };
  stored.set('loka-place', JSON.stringify({ hash: 'h', steps: [], stopped }));
  const { hooks, sent } = panel();
  assert.equal(hooks.cheat({ op: 'set_fact', fact: 'lit', value: true }), '');
  assert.equal(sent.length, 1);
  stored.clear();
});

// Break: the tab's minutes reach the clock as ms, as hours, or unscaled by the cartridge's rate.
test('Advance 90 minutes at rate 1 moves the dev clock 5,400,000 ms', () => {
  const { context } = panel();
  typeIn('minutes', '90');
  press('Advance');
  assert.equal(context.loka_dev_skew, 5_400_000);
});

// Break: Save offered without steps or for a name live.ts refuses (or a digit 9 refused), a failed PUT
// silent, a bad-name line before any name, a replay of a file with no steps list jumping, Pin not toggling, a failed count with no
// checkpoints heard, a zero Advance or an empty room offered, Set level with no attribute withheld,
// or a typed value parsed wrong ("5" a string, a bare word kept, 7 a number).
test('the tools gate their acts on what they need and send what was typed', async () => {
  const { wire } = await import('./build/roomedit.tsx');
  wire(
    async () => [200, {}],
    () => {},
    () => {},
  );
  const [cheats, jumps]: [unknown[], unknown[]] = [[], []];
  let steps: unknown[] = [];
  const game = {
    place: () => ({ steps }),
    loaded: { artifact: 'a', at: 0 },
    jump: (s: unknown) => jumps.push(s),
    advance: () => '',
    cheat: (c: unknown) => (cheats.push(c), ''),
  };
  toolsWith({ game: () => game as any, hold, heard: () => ({}) });
  const labels = () =>
    drawn()
      .filter((n) => n.props?.accessibilityRole === 'button' && !n.props.disabled)
      .map(words);
  const text = () => drawn().map(words).join('|');

  typeIn('checkpoint name', '');
  assert.doesNotMatch(text(), /A name is up to 64/, 'no name typed, no complaint');
  typeIn('checkpoint name', '9gate9');
  assert.ok(!labels().includes('Save checkpoint'), 'no steps, no Save');
  const greyed = drawn().find((n) => n.props?.disabled && words(n) === 'Save checkpoint');
  assert.deepEqual(
    greyed.props.accessibilityState,
    { disabled: true },
    'greyed is a disabled control',
  );
  steps = [{ intent: { action_key: 'look' } }];
  assert.ok(labels().includes('Save checkpoint'), 'one step and 9gate9 save');
  typeIn('checkpoint name', 'Gate');
  assert.ok(!labels().includes('Save checkpoint'), 'a capital is refused');
  assert.match(text(), /A name is up to 64/);
  assert.doesNotMatch(text(), /fail/, 'no checkpoints heard, no failed count');

  const real = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 409, json: async () => ({}) })) as any;
  typeIn('checkpoint name', 'gate');
  press('Save checkpoint');
  await settle();
  assert.match(text(), /Not saved: 409/);
  globalThis.fetch = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as any;
  press('Replay gate');
  await settle();
  assert.match(text(), /Not replayed: 404/);
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({}) })) as any;
  press('Replay gate');
  await settle();
  assert.match(text(), /no steps list/);
  assert.equal(jumps.length, 0);
  globalThis.fetch = real;

  press('Pin');
  assert.equal(stored.get('loka.editor.start'), 'gate');
  const pin = () =>
    drawn().find((n) => n.props?.accessibilityRole === 'button' && words(n) === 'Pin');
  assert.equal(pin().props.accessibilityState.selected, true);
  press('Pin');
  assert.equal(stored.has('loka.editor.start'), false);
  assert.equal(pin().props.accessibilityState.selected, false);

  typeIn('minutes', '0');
  assert.ok(!labels().includes('Advance'), 'zero minutes');
  typeIn('minutes', '1');
  assert.ok(labels().includes('Advance'), 'one minute');
  typeIn('room key', '');
  assert.ok(!labels().includes('Go to room'), 'no room');

  typeIn('level', '2');
  press('Set level');
  typeIn('fact key', 'door');
  for (const v of ['"5"', 'open', '7']) (typeIn('value', v), press('Set fact'));
  await settle();
  assert.deepEqual(cheats, [
    { op: 'set_level', level: 2, points: {} },
    { op: 'set_fact', fact: 'door', value: '5' },
    { op: 'set_fact', fact: 'door', value: 'open' },
    { op: 'set_fact', fact: 'door', value: 7 },
  ]);
});
