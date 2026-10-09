// The combat tests' Book boundary (combat.test.ts, combat_flow.test.ts): native hosts are leaves;
// native layout and animation proof stays in Simulator.
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { Game, GameView } from '../../../packages/game-view/session.ts';
import { fadeStub } from './fade-stub.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    // The page curl needs Skia and Reanimated; a page_turn.e2e.ts concern, not these tests'.
    if (specifier === './fade.ts') return fadeStub;
    if (specifier === './PageTurn.tsx')
      return {
        url: 'data:text/javascript,export function PageTurn(p){return p.children}',
        shortCircuit: true,
      };
    if (specifier === 'react') return { url: 'test:combat-state', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:combat-hosts', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:combat-state')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue; export const useState=v=>globalThis[Symbol.for('combat-state')](v); export const useRef=v=>useState(()=>({current:v}))[0]; export const useEffect=(f,d)=>globalThis[Symbol.for('combat-effect')](f,d);`,
      };
    if (url === 'test:combat-hosts')
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
export const { color } = await import('../tokens.ts');
export const { default: Book, BookView } = await import('../Book.tsx');

// Expand the persistent shell; page contents, native map and animation have separate tests.
export function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') {
    if (element.type.name === 'Footer') return [element];
    if (element.type.name === 'PageTurn') return [element, ...nodes(element.props.children)];
    return nodes(element.type(element.props));
  }
  return [element, ...nodes(element.props?.children)];
}
export const words = (element: any): string =>
  Array.isArray(element)
    ? element.map(words).join('')
    : typeof element === 'string'
      ? element
      : words(element?.props?.children ?? []);
export const view = (extra = {}) =>
  ({
    actor_id: 'character',
    place: { id: 'room', title: { key: 'room.title' }, description: { key: 'room.description' } },
    time: 10,
    entities: [{ id: 'rat', kind: 'npc', name: 'npc.rat', actions: [] }],
    inventory: [],
    journal: [],
    position: 'sitting',
    actions: [
      {
        action_key: 'flee',
        label: 'action.flee',
        available: true,
        input: [],
        target: { kind: 'none' },
      },
      {
        action_key: 'stand',
        label: 'action.stand',
        available: true,
        input: [],
        target: { kind: 'none' },
      },
    ],
    exits: [
      { direction: 'north', available: true },
      { direction: 'west', available: false, reason: { code: 'exit_locked' } },
    ],
    combat: { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' },
    ...extra,
  }) as unknown as GameView;
export const game = (current: GameView): Game => ({
  view: () => ({ view: current, token: 'view:drawn' }),
  invoke: () => ({ kind: 'stale_view' }),
  pending: () => false,
  pendingInvocation: () => undefined,
  subscribe: () => () => {},
  text: (key) => ({ 'npc.rat': 'a marsh rat', 'combat.result': 'The marsh rat falls.' })[key],
  lastNarration: () => undefined,
});
