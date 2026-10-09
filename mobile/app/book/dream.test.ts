// Actual Book routing over real SQLite; native leaves stand in for layout, never device evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { elapsedHost, receipts } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { dreamBundle as bundle } from '../../authority/local-story/__tests__/dream-host.test.ts';

const require = createRequire(import.meta.url),
  ts = require('typescript'),
  react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    // The page curl needs Skia and Reanimated; a page_turn.e2e.ts concern, not these tests'.
    // No Reanimated in node: the palette switches at once, as under reduced motion.
    if (specifier === './fade.ts')
      return {
        url: 'data:text/javascript,export const usePaletteCurve=()=>undefined',
        shortCircuit: true,
      };
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
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue; export const useState=v=>globalThis[Symbol.for('dream-state')](v); export const useRef=v=>useState(()=>({current:v}))[0]; export const useEffect=(f,d)=>globalThis[Symbol.for('dream-effect')](f,d);`,
      };
    if (url === 'test:dream-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={},Easing={},Animated={View:'View'},PanResponder={};",
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
function nodes(e: any): any[] {
  if (Array.isArray(e)) return e.flatMap(nodes);
  if (!e || typeof e !== 'object') return [];
  if (typeof e.type === 'function') {
    if (e.type.name === 'Footer') return [e];
    if (e.type.name === 'PageTurn') return [e, ...nodes(e.props.children)];
    return nodes(e.type(e.props));
  }
  return [e, ...nodes(e.props?.children)];
}
const words = (e: any): string =>
  Array.isArray(e)
    ? e.map(words).join('')
    : typeof e === 'string' || typeof e === 'number'
      ? String(e)
      : words(e?.props?.children ?? []);
function render(game: ReturnType<typeof openGame>) {
  const state: any[] = [],
    effects = new Map<number, { deps: any[]; cleanup?: () => void }>();
  let slot = 0;
  const draw = () => {
    slot = 0;
    const queued: (() => void)[] = [];
    (globalThis as any)[Symbol.for('dream-state')] = (v: any) => {
      const i = slot++;
      if (!(i in state)) state[i] = typeof v === 'function' ? v() : v;
      return [
        state[i],
        (n: any) => {
          state[i] = typeof n === 'function' ? n(state[i]) : n;
        },
      ];
    };
    (globalThis as any)[Symbol.for('dream-effect')] = (f: any, deps: any[]) => {
      const i = slot++,
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
    presenter: () => state[0],
    draw,
    labels,
    stack: () => state[1],
    text: () =>
      draw()
        .filter((n) => n.type === 'Text')
        .map((n) => words(n.props.children)),
    tap(label: string) {
      const b = draw().find(
        (n) => n.type === 'Pressable' && !n.props.disabled && n.props.accessibilityLabel === label,
      );
      assert.ok(b, `${label}: ${labels()}`);
      b.props.onPress();
    },
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
  ui.tap('Continue');
  ui.tap('Widow Maud, open');
  ui.tap('Rent room — 3p');
  ui.tap('Leave');
  ui.walk('up');
  ui.tap('Bed');
  ui.tap('Rest');
  assert.deepEqual(ui.stack(), [
    { kind: 'notice', id: '41f5d4b9-8494-82cd-b350-2650f8a9efd4' },
    { kind: 'dream', id: '41f5d4b9-8494-82cd-b350-2650f8a9efd4' },
  ]);
  assert.ok(ui.text().includes('The Fen Dream'));
  assert.ok(
    ui
      .text()
      .includes(
        'The Lantern falls quiet around you. Beyond the window, mist gathers over dark water.',
      ),
  );
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
  cold.tap('Continue');
  assert.deepEqual(cold.stack(), []);
  assert.ok(!cold.labels().includes('Follow the fox'));
  assert.ok(!cold.text().includes('The fox waits at a fork in the reeds.'));
  assert.ok(!cold.text().includes('A red fox steps onto the track. It looks back once, waiting.'));
  cold.tap('Bed');
  cold.tap('Resume dream');
  assert.ok(cold.text().includes('A red fox steps onto the track. It looks back once, waiting.'));
  assert.deepEqual(
    cold
      .presenter()
      .screen()
      .buttons.filter((b: any) => b.detail_id?.startsWith('dream:'))
      .map((b: any) => b.action_key),
    ['dream_choose', 'dream_choose'],
  );
  cold.tap('Wake');
  assert.ok(
    cold
      .text()
      .includes(
        'You turn toward the warmth of the Lantern. The fox slips between the reeds as the window brightens.',
      ),
  );
  assert.ok(
    !cold.game
      .view()
      .view.journal.some((q) => q.state === 'resolved' && q.quest.key === 'a_room_at_the_lantern'),
  );
  cold.tap('Acknowledge');
  assert.equal(
    cold.game.view().view.journal.find((q) => q.quest.key === 'a_room_at_the_lantern')!.state,
    'resolved',
  );
  assert.equal(cold.stack().at(-1).kind, 'notice');
  assert.ok(cold.text().includes('Dream acknowledged.'));
  assert.ok(cold.text().includes('Rest: not now'));
  assert.ok(!cold.labels().includes('Resume dream'));
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 0);
});

// Breaks: an uncertain Rest announces the dream before confirmation, or remount loses first confirmed open while settling the retained invocation.
test('uncertain paid Rest remount opens the first dream only when the original COMMIT settles', (t) => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle());
  t.after(() => a.sql.close());
  const ui = render(a.game);
  ui.draw();
  ui.tap('Continue');
  ui.tap('Widow Maud, open');
  ui.tap('Rent room — 3p');
  ui.tap('Leave');
  ui.walk('up');
  ui.tap('Bed');
  a.fault.kind = 'lost';
  a.fault.armed = true;
  ui.tap('Rest');
  assert.equal(a.game.pending(), true);
  assert.equal(ui.stack().at(-1).kind, 'notice');
  assert.ok(!ui.text().includes('The Fen Dream'));
  a.fault.reads = false;
  const cold = render(a.game);
  cold.draw();
  cold.tap('Continue');
  assert.deepEqual(cold.stack(), []);
  assert.ok(!cold.text().includes('The Fen Dream'));
  a.game.pulse('drain');
  cold.draw();
  assert.equal(a.game.pending(), false);
  assert.deepEqual(cold.stack(), [
    { kind: 'notice', id: '41f5d4b9-8494-82cd-b350-2650f8a9efd4' },
    { kind: 'dream', id: '41f5d4b9-8494-82cd-b350-2650f8a9efd4' },
  ]);
  assert.equal(receipts(a.sql), 3);
  assert.ok(cold.text().includes('The Fen Dream'));
  cold.tap('Continue');
  assert.equal(receipts(a.sql), 4);
});
