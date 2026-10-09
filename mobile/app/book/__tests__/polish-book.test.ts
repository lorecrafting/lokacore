// The polish tests' Book over a real session: real book components; native hosts are leaves, so
// this is no device/layout proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { openGame } from '../../../authority/local-story/session.ts';
import { elapsedHost } from '../../../authority/local-story/__tests__/elapsed-host.test.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
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
    if (specifier === 'react') return { url: 'test:book-state', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:native-hosts', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:book-state')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue; export const useState = v => globalThis[Symbol.for('loka-book-test-state')](v); export const useRef = v => useState(() => ({ current: v }))[0]; export const useEffect = (f,d) => globalThis[Symbol.for('loka-book-test-effect')](f,d);`,
      };
    if (url === 'test:native-hosts')
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
const { default: Book } = await import('../Book.tsx');
export const bundle = (name = 'containers_cartridge_sampler_hash') =>
  JSON.parse(
    readFileSync(new URL(`../../../../protocol/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
export const fixture = bundle();

// Expand pure components only. Native animation and map gestures are exercised in Simulator review.
export function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') {
    if (element.type.name === 'Footer') return [element];
    if (element.type.name === 'PageTurn') return [element, ...nodes(element.props.children)];
    return nodes(element.type(element.props));
  }
  // A context element (the Book's palette) provides its value to the components below it.
  if (element.type?.$$typeof === Symbol.for('react.context')) {
    const outer = element.type._currentValue;
    element.type._currentValue = element.props.value;
    try {
      return [element, ...nodes(element.props.children)];
    } finally {
      element.type._currentValue = outer;
    }
  }
  return [element, ...nodes(element.props?.children)];
}
export const words = (element: any): string =>
  Array.isArray(element)
    ? element.map(words).join('')
    : typeof element === 'string' || typeof element === 'number'
      ? String(element)
      : words(element?.props?.children ?? []);

export function book(cartridge = fixture, existing?: ReturnType<typeof elapsedHost>) {
  const sql = existing?.sql ?? new DatabaseSync(':memory:');
  const clock = existing?.clock ?? { wall: 10000, mono: 0 };
  let failedNarrationAfter: number | undefined;
  const game =
    existing?.game ??
    openGame(
      {
        execSync: (s) => sql.exec(s),
        isInTransactionSync: () => sql.isTransaction,
        runSync: (s, ...p) => sql.prepare(s).run(...p),
        getFirstSync: (s, ...p) => sql.prepare(s).get(...p) ?? null,
        getAllSync: (s, ...p) => sql.prepare(s).all(...p),
      } as never,
      cartridge,
      {
        newId: randomUUID,
        kernel_version: `loka-kernel@${'0'.repeat(40)}`,
        time: { wall: () => clock.wall, monotonic: () => clock.mono },
      },
    );
  const narration = game.lastNarration;
  game.lastNarration = (command_id?: string) => {
    const revision = sql.prepare('SELECT revision FROM head').get()!.revision as number;
    if (failedNarrationAfter !== undefined && revision > failedNarrationAfter) {
      failedNarrationAfter = undefined;
      sql.exec('SELECT * FROM missing_narration');
    }
    return narration(command_id);
  };
  const state: any[] = [];
  let slot = 0;
  const effects = new Map<number, { deps: unknown[]; cleanup?: () => void }>();
  const queued: (() => void)[] = [];
  const useEffect = (f: () => (() => void) | undefined, deps: unknown[]) => {
    const i = slot++,
      old = effects.get(i);
    if (old && old.deps.length === deps.length && deps.every((d, j) => Object.is(d, old.deps[j])))
      return;
    queued.push(() => {
      old?.cleanup?.();
      effects.set(i, { deps, cleanup: f() });
    });
  };
  const useState = (initial: any) => {
    const i = slot++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (v: any) => {
        state[i] = typeof v === 'function' ? v(state[i]) : v;
      },
    ];
  };
  const draw = () => {
    slot = 0;
    (globalThis as any)[Symbol.for('loka-book-test-state')] = useState;
    (globalThis as any)[Symbol.for('loka-book-test-effect')] = useEffect;
    const rendered = nodes(
      Book({
        game,
        startOver: () => undefined,
        shell: { confirm: (f) => f(), learned: { seen: () => true, see: () => {} } },
      }),
    );
    for (const effect of queued.splice(0)) effect();
    return rendered;
  };
  const buttons = () => draw().filter((n) => n.type === 'Pressable' && !n.props.disabled);
  const labels = () => buttons().map((n) => n.props.accessibilityLabel);
  const tap = (label: string) => {
    const button = buttons().find((n) => n.props.accessibilityLabel === label);
    assert.ok(button, label);
    button.props.onPress();
  };
  const map = () => {
    const footer = draw().find((n) => n.type.name === 'Footer');
    assert.ok(footer);
    footer.props.openMap();
  };
  const text = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map(words);
  draw();
  // actual chapter route callback; the ancestry picker shows first when the run has none yet
  if (game.view().view.chapter && !game.view().view.ancestry_choices) tap('Continue');
  return {
    get p() {
      return state[0];
    },
    get stack() {
      return state[1];
    },
    game,
    sql,
    clock,
    unmount: () => {
      for (const e of effects.values()) e.cleanup?.();
    },
    failNarration: () =>
      (failedNarrationAfter = sql.prepare('SELECT revision FROM head').get()!.revision as number),
    draw,
    labels,
    tap,
    map,
    text,
  };
}
