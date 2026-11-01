// Actual Book routing over real SQLite; native leaves stand in for layout, never device evidence.
import { reactShim } from './__tests__/react-shim.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { elapsedHost, receipts } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import {
  dreamBundle as bundle,
  dreamBed as bed,
} from '../../authority/local-story/__tests__/dream-host.test.ts';
import { control } from './__tests__/control.test.ts';
import { fadeStub } from './__tests__/fade-stub.ts';

const require = createRequire(import.meta.url),
  ts = require('typescript');
registerHooks({
  resolve(specifier, context, next) {
    // The page curl needs Skia and Reanimated; a page_turn.e2e.ts concern, not these tests'.
    if (specifier === './fade.ts') return fadeStub;
    if (specifier === './PageTurn.tsx')
      return {
        url: 'data:text/javascript,export function PageTurn(p){return p.children}',
        shortCircuit: true,
      };
    if (specifier === 'react') return { url: 'test:dream-state', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:dream-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:dream-state')
      return reactShim(
        `({ state: globalThis[Symbol.for('dream-state')], effect: globalThis[Symbol.for('dream-effect')] })`,
      );
    if (url === 'test:dream-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',TextInput='TextInput',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={},Easing={},Animated={View:'View'},PanResponder={};",
      };
    if (!url.endsWith('.tsx')) return next(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  },
});
const { default: Book } = await import('./Book.tsx');
const { openGame } = await import('../../authority/local-story/session.ts');
// The component whose hooks run now, by its place in the tree, as React keys it.
let here = '';
let slot = 0;
function nodes(e: any, at = ''): any[] {
  if (Array.isArray(e)) return e.flatMap((x, i) => nodes(x, `${at}.${x?.key ?? i}`));
  if (!e || typeof e !== 'object') return [];
  if (typeof e.type === 'function') {
    if (e.type.name === 'Footer') return [e];
    const place = `${at}/${e.type.name}`;
    if (e.type.name === 'PageTurn') return [e, ...nodes(e.props.children, place)];
    here = place;
    slot = 0;
    return nodes(e.type(e.props), place);
  }
  return [e, ...nodes(e.props?.children, `${at}/${String(e.type)}`)];
}
const words = (e: any): string =>
  Array.isArray(e)
    ? e.map(words).join('')
    : typeof e === 'string' || typeof e === 'number'
      ? String(e)
      : words(e?.props?.children ?? []);
function render(game: ReturnType<typeof openGame>) {
  const state = new Map<string, any>(),
    effects = new Map<string, { deps: any[]; cleanup?: () => void }>();
  const draw = () => {
    here = 'Book';
    slot = 0;
    const queued: (() => void)[] = [];
    (globalThis as any)[Symbol.for('dream-state')] = (v: any) => {
      const i = `${here}:${slot++}`;
      if (!state.has(i)) state.set(i, typeof v === 'function' ? v() : v);
      return [
        state.get(i),
        (n: any) => {
          state.set(i, typeof n === 'function' ? n(state.get(i)) : n);
        },
      ];
    };
    (globalThis as any)[Symbol.for('dream-effect')] = (f: any, deps: any[]) => {
      const i = `${here}:${slot++}`,
        old = effects.get(i);
      if (old && deps.every((d, j) => Object.is(d, old.deps[j]))) return;
      queued.push(() => {
        old?.cleanup?.();
        effects.set(i, { deps, cleanup: f() });
      });
    };
    const out = nodes(
      Book({
        game,
        startOver: () => undefined,
        shell: { confirm: (f) => f(), learned: { seen: () => true, see: () => {} } },
      }),
    );
    queued.forEach((f) => f());
    return out;
  };
  const labels = () =>
    draw()
      .filter((n) => n.type === 'Pressable' && !n.props.disabled)
      .map((n) => n.props.accessibilityLabel);
  return {
    game,
    presenter: () => state.get('Book:0'),
    draw,
    labels,
    stack: () => state.get('Book:1'),
    text: () =>
      draw()
        .filter((n) => n.type === 'Text')
        .map((n) => words(n.props.children)),
    tap: (shown: string | RegExp) => control(draw(), shown).props.onPress(),
    walk(direction: string) {
      draw()
        .find((n) => n.type.name === 'Footer')
        .props.go(direction);
    },
  };
}

// Breaks: paid Rest opens a fake/modal page, Close/Resume writes truth, aliases leak to World, final memory appears before ack, or cold narration routes to the wrong place, or unavailable bed controls expose raw action keys.
test('live first Rest, nested Close/Resume, captured branches, final ack and cold World resume use the actual bed', (t) => {
  const b = bundle(),
    a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, b);
  t.after(() => a.sql.close());
  const ui = render(a.game);
  ui.draw();
  ui.tap('Maud');
  ui.tap('Rent room, 3p. 3 pennies.');
  ui.tap('Leave');
  ui.walk('up');
  ui.tap('bed, open');
  ui.tap('Rest');
  assert.deepEqual(ui.stack(), [
    { kind: 'notice', id: bed },
    { kind: 'dream', id: bed },
  ]);
  assert.ok(ui.text().includes('The Fen Dream'));
  assert.ok(ui.text().includes('The room falls quiet around you.'));
  const before = receipts(a.sql);
  assert.equal(
    ui
      .presenter()
      .screen()
      .buttons.find((b: any) => b.detail_id?.startsWith('dream:')).action_key,
    'dream_next',
  );
  ui.tap('Close');
  assert.equal(ui.stack().at(-1).kind, 'notice');
  ui.tap('Resume dream');
  assert.equal(receipts(a.sql), before);
  ui.tap('Continue');
  ui.tap('Continue');
  ui.tap('Continue');
  assert.ok(ui.labels().includes('Follow the fox'));
  assert.ok(ui.labels().includes('Wake'));
  const cold = render(openGame(a.db, b, a.host));
  cold.draw();
  assert.deepEqual(cold.stack(), []);
  assert.ok(!cold.labels().includes('Follow the fox'));
  assert.ok(!cold.text().includes('The fox waits at a fork in the reeds.'));
  // The last dream line is in the room log too (book-ui.md Line placement; for the designer pass).
  assert.equal(
    cold.text().filter((t: string) => t.includes('A red fox steps onto the track.')).length,
    1,
  );
  cold.tap('bed, open');
  cold.tap('Resume dream');
  assert.ok(cold.text().includes('A red fox steps onto the track.'));
  assert.deepEqual(
    cold
      .presenter()
      .screen()
      .buttons.filter((b: any) => b.detail_id?.startsWith('dream:'))
      .map((b: any) => b.action_key),
    ['dream_choose', 'dream_choose'],
  );
  cold.tap('Wake');
  assert.ok(cold.text().includes('You turn toward the window and wake.'));
  assert.ok(
    !cold.game.view().view.journal.some((q) => q.state === 'resolved' && q.quest.key === 'a_room'),
  );
  cold.tap('Acknowledge');
  assert.equal(
    cold.game.view().view.journal.find((q) => q.quest.key === 'a_room')!.state,
    'resolved',
  );
  assert.equal(cold.stack().at(-1).kind, 'notice');
  assert.ok(!cold.text().includes('Dream acknowledged.'));
  const rest = cold.draw().find((n) => n.props?.accessibilityLabel === 'Rest');
  assert.ok(rest?.props.accessibilityState?.disabled, 'Rest is an unavailable card');
  assert.equal(rest.props.accessibilityHint, "You can't do that—not now.");
  assert.ok(!cold.labels().includes('Resume dream'));
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 0);
});

// Breaks: an uncertain Rest announces the dream before confirmation, or remount loses first confirmed open while settling the retained invocation.
test('uncertain paid Rest remount opens the first dream only when the original COMMIT settles', (t) => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle());
  t.after(() => a.sql.close());
  const ui = render(a.game);
  ui.draw();
  ui.tap('Maud');
  ui.tap('Rent room, 3p. 3 pennies.');
  ui.tap('Leave');
  ui.walk('up');
  ui.tap('bed, open');
  a.fault.kind = 'lost';
  a.fault.armed = true;
  ui.tap('Rest');
  assert.equal(a.game.pending(), true);
  assert.equal(ui.stack().at(-1).kind, 'notice');
  assert.ok(!ui.text().includes('The Fen Dream'));
  a.fault.reads = false;
  const cold = render(a.game);
  cold.draw();
  assert.deepEqual(cold.stack(), []);
  assert.ok(!cold.text().includes('The Fen Dream'));
  a.game.pulse('drain');
  cold.draw();
  assert.equal(a.game.pending(), false);
  assert.deepEqual(cold.stack(), [
    { kind: 'notice', id: bed },
    { kind: 'dream', id: bed },
  ]);
  assert.equal(receipts(a.sql), 3);
  assert.ok(cold.text().includes('The Fen Dream'));
  cold.tap('Continue');
  assert.equal(receipts(a.sql), 4);
});
