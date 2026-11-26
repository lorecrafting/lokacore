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
    './inbook.ts': { api: {}, start: () => () => {}, heard: () => {} },
    './build/Build.tsx': { install: () => {}, place: (h: unknown) => (hooks = h) },
  };
  const context: { loka_dev_skew?: number } & Record<string, unknown> = {
    exports: {},
    process: { env: { EXPO_PUBLIC_LOKA_DEV_CARTRIDGE: '1' } },
    location: { search: '?dev=1' },
    URLSearchParams,
    localStorage: globalThis.localStorage,
    document: { addEventListener: () => {} },
    require: (name: string) => modules[name],
  };
  context.globalThis = context;
  context.window = Object.assign(context, { addEventListener: () => {} });
  context.window.parent = context.window;
  runInNewContext(js, context);
  const sent: { action_key: string }[] = [];
  const game = {
    view: () => ({ view: {}, token: 't' }),
    invoke: (i: { action_key: string }) => (
      sent.push(i),
      { kind: 'saved', decision: { kind: 'accepted' } }
    ),
    entityIds: () => ({}),
    pending: () => false,
    subscribe: () => () => {},
    pulse: () => ({ kind: 'ready' }),
  };
  const session = { game: () => game };
  (context.exports as any).useAuthorPanel({ redraw: () => {}, session, startOver() {} }, game);
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

// Break: the tab's minutes reach the clock as ms, as hours, or unscaled by the cartridge's rate.
test('Advance 90 minutes at rate 1 moves the dev clock 5,400,000 ms', () => {
  const { context } = panel();
  typeIn('minutes', '90');
  press('Advance');
  assert.equal(context.loka_dev_skew, 5_400_000);
});
