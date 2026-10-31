// The polish tests' Book over a real session: real book components; native hosts are leaves, so
// this is no device/layout proof.
import { reactShim } from './react-shim.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { openGame } from '../../../authority/local-story/session.ts';
import { elapsedHost } from '../../../authority/local-story/__tests__/elapsed-host.test.ts';
import { control, pressable } from './control.test.ts';
import { fadeStub } from './fade-stub.ts';
import type { Button } from '../presenter.ts';
import type { GameView } from '../../../packages/game-view/session.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
registerHooks({
  resolve(specifier, context, next) {
    // The page curl needs Skia and Reanimated; a page_turn.e2e.ts concern, not these tests'.
    if (specifier === './fade.ts') return fadeStub;
    // Metro picks the platform file; here each device module records what the Book tells it.
    if (specifier === './sound')
      return {
        url: 'data:text/javascript,export const setMuted=(g,m)=>globalThis.bookDevice?.push([g,m])',
        shortCircuit: true,
      };
    if (specifier === './haptic')
      return {
        url: "data:text/javascript,export const hapticsOn=(o)=>globalThis.bookDevice?.push(['haptics',o]);export const onPulse=()=>()=>{}",
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
      return reactShim(
        `({ state: globalThis[Symbol.for('loka-book-test-state')], effect: globalThis[Symbol.for('loka-book-test-effect')] })`,
      );
    if (url === 'test:native-hosts')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',TextInput='TextInput',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={announceForAccessibility(){}},Easing={},Animated={View:'View',Value:class{},timing:()=>({start:f=>globalThis[Symbol.for('loka-animation-end')]=f})},PanResponder={};",
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
const { doorPick, pressDoor } = await import('../Footer.tsx');
const { commandOf } = await import('../buttons.ts');

// Every World-level action has a control: a door verb is drawn (a pressable reading its label) or is
// a shut door's release pick, a targetless action is a notice's; the rest are undrawn on purpose
// (book-ui.md, Verbs the Book does not draw, and Room page anatomy). Runs on every draw.
const UNDRAWN_VERBS = ['close', 'lock'];
// ponytail: temporary; quest offers have no target field yet (loka-vx2v). Drop when content gives them one.
const UNTARGETED_QUESTS = ['lantern', 'oar', 'cull', 'find_key', 'apprentice'];
let room: { g: { place: Button[] }; view: GameView } | undefined; // RoomPage's props: World shows
function stranded(rendered: any[]) {
  const f = rendered.find((n) => n.type?.name === 'Footer')?.props;
  const drawn = rendered.filter(pressable).map((n) => n.props.accessibilityLabel);
  const has = (b: Button) => UNDRAWN_VERBS.includes(commandOf(b)) || drawn.includes(b.label);
  for (const e of f?.exits ?? [])
    for (const b of f.door(e.direction))
      assert.ok(
        has(b) || (!e.available && b === doorPick(f.door(e.direction))),
        `door verb ${b.label} has no control`,
      );
  const v = room?.view;
  const notice = [...(v?.notices ?? []), ...(v?.notice_boards ?? []).flatMap((n) => n.notices)];
  for (const b of room?.g.place.filter((b) => !b.target_ids.length) ?? [])
    assert.ok(
      has(b) ||
        UNTARGETED_QUESTS.includes(b.action_key) ||
        notice.some((n) => n.actions?.some((a) => a.action_key === b.action_key)),
      `targetless action ${b.label} has no control`,
    );
}
type Shell = Parameters<typeof Book>[0]['shell'];
export const bundle = (name = 'containers_cartridge_sampler_hash') =>
  JSON.parse(
    readFileSync(new URL(`../../../../protocol/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
export const fixture = bundle();
// A component drawn outside book() (nodes() alone) gets stateless hooks; book()'s draw sets its own.
(globalThis as any)[Symbol.for('loka-book-test-state')] = (v: any) => [
  typeof v === 'function' ? v() : v,
  () => {},
];
(globalThis as any)[Symbol.for('loka-book-test-effect')] = () => {};

// Expand pure components only. Native animation and map gestures are exercised in Simulator review.
let owner: unknown; // the component whose hooks run now: a slot another component held starts fresh
// ponytail: keyed by type, not instance, and state only (effects: Book's alone today); key by element if a story needs it.
export function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') {
    if (element.type.name === 'Footer') return [element];
    // The live region repeats page lines for a screen reader: page text leaves it out (live_region.test.ts reads it).
    if (element.type.name === 'Heard') return [element];
    if (element.type.name === 'PageTurn') return [element, ...nodes(element.props.children)];
    owner = element.type;
    if (element.type.name === 'RoomPage') room = element.props;
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

// `newId`: stories/scenarios.ts seeds it so a replayed route writes the same rows.
export function book(
  cartridge = fixture,
  existing?: ReturnType<typeof elapsedHost>,
  newId: () => string = randomUUID,
  subscribed?: (on: boolean) => void,
  reading?: Shell['reading'],
  chips?: Shell['effects'],
) {
  const sql = existing?.sql ?? new DatabaseSync(':memory:');
  const clock = existing?.clock ?? { wall: 10000, mono: 0 };
  let failedNarrationAfter: number | undefined;
  const game =
    existing?.game ??
    openGame(
      {
        execSync: (s: string) => sql.exec(s),
        isInTransactionSync: () => sql.isTransaction,
        runSync: (s: string, ...p: never[]) => sql.prepare(s).run(...p),
        getFirstSync: (s: string, ...p: never[]) => sql.prepare(s).get(...p) ?? null,
        getAllSync: (s: string, ...p: never[]) => sql.prepare(s).all(...p),
      } as never,
      cartridge,
      {
        newId,
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
  const owners: unknown[] = [];
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
    if (owners[i] !== owner) {
      owners[i] = owner;
      state[i] = typeof initial === 'function' ? initial() : initial;
    }
    return [
      state[i],
      (v: any) => {
        state[i] = typeof v === 'function' ? v(state[i]) : v;
      },
    ];
  };
  const draw = () => {
    slot = 0;
    owner = Book;
    (globalThis as any)[Symbol.for('loka-book-test-state')] = useState;
    (globalThis as any)[Symbol.for('loka-book-test-effect')] = useEffect;
    room = undefined;
    const rendered = nodes(
      Book({
        game,
        startOver: () => undefined,
        shell: {
          confirm: (f) => f(),
          learned: { seen: () => true, see: () => {} },
          subscribed,
          reading,
          effects: chips,
        },
      }),
    );
    for (const effect of queued.splice(0)) effect();
    stranded(rendered);
    return rendered;
  };
  const buttons = () => draw().filter(pressable);
  const labels = () => buttons().map((n) => n.props.accessibilityLabel);
  const tap = (shown: string | RegExp) => control(draw(), shown).props.onPress();
  // Press an unavailable Action card (book-ui.md, Unavailable actions): it reads its plain label.
  const refuse = (shown: string) => {
    const card = draw().find(
      (n) => n.props?.accessibilityState?.disabled && n.props.accessibilityLabel === shown,
    );
    assert.ok(card, `no unavailable ${shown}`);
    card.props.onPress();
  };
  const footer = () => {
    const f = draw().find((n) => n.type.name === 'Footer');
    assert.ok(f);
    return f.props;
  };
  const map = () => footer().openMap();
  // One step as the minimap's arrow key takes it (Footer's walker): an open exit walks, a shut door
  // presses its offered Unlock, else Open.
  const go = (direction: string) => {
    const f = footer();
    const e = f.exits.find((x: { direction: string }) => x.direction === direction);
    assert.ok(e, `no exit ${direction}`);
    if (e.available) f.go(direction);
    else assert.ok(pressDoor(f.door(direction), f.press), `the way ${direction} is shut`);
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
    refuse,
    map,
    go,
    text,
  };
}
