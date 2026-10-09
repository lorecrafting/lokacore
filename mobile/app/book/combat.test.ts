// Controlled Book boundary inputs; native layout and animation proof stays in Simulator.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Game, GameView, Intent } from '../../packages/game-view/session.ts';
import { group, type Page } from './model.ts';
import { presenter } from './presenter.ts';
import { fadeStub } from './__tests__/fade-stub.ts';

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
const { color } = await import('./tokens.ts');
const { default: Book, BookView } = await import('./Book.tsx');

// Expand the persistent shell; page contents, native map and animation have separate tests.
function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') {
    if (element.type.name === 'Footer') return [element];
    if (element.type.name === 'PageTurn') return [element, ...nodes(element.props.children)];
    return nodes(element.type(element.props));
  }
  return [element, ...nodes(element.props?.children)];
}
const words = (element: any): string =>
  Array.isArray(element)
    ? element.map(words).join('')
    : typeof element === 'string'
      ? element
      : words(element?.props?.children ?? []);
const view = (extra = {}) =>
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
const game = (current: GameView): Game => ({
  view: () => ({ view: current, token: 'view:drawn' }),
  invoke: () => ({ kind: 'stale_view' }),
  pending: () => false,
  pendingInvocation: () => undefined,
  subscribe: () => () => {},
  text: (key) => ({ 'npc.rat': 'a marsh rat', 'combat.result': 'The marsh rat falls.' })[key],
  lastNarration: () => undefined,
});

// Breaks: Combat renders only the primary and hides actual helper presence behind identical template names.
test('combat component shows the exact active pack and marks the current primary', () => {
  const current = view({
    combat: {
      encounter_id: 'fight',
      opponent_id: 'rat',
      name: 'npc.rat',
      active_opponents: [
        { id: 'helper', name: 'npc.rat' },
        { id: 'rat', name: 'npc.rat' },
      ],
    },
  });
  const screen = presenter(game(current)).screen();
  const drawn = nodes(
    BookView({
      palette: color.light,
      screen,
      stack: [],
      flip: { turn: 0, dir: 1 },
      go: () => {},
      press: () => {},
      refused: () => {},
      startOver: () => {},
      shell: { confirm: (f) => f(), learned: { get: () => true } as never },
    }),
  );
  const lines = drawn.filter((n) => n.type === 'Text').map(words);
  assert.ok(lines.includes('a marsh rat (your target)'));
  assert.equal(lines.filter((line) => line === 'a marsh rat').length, 2);
  assert.ok(
    !lines.some(
      (line) => line.includes('helper') || (line.includes('rat') && line.includes('fight')),
    ),
  );
});

// Break: a menu/detail hides escape, Flee invents directions, or controls sit outside the narrative scroll.
test('combat page lists offered controls vertically below history in one scroll', () => {
  const sent: Intent[] = [];
  const p = presenter({
    ...game(
      view({
        actions: [
          ...view().actions,
          { ...view().actions[0], action_key: 'look', label: 'action.look' },
        ],
      }),
    ),
    lastNarration: () =>
      ({ command_id: 'before', lines: [{ key: 'combat.result' }], combat_lines: [0] }) as never,
    invoke: (intent) => (sent.push(intent), { kind: 'stale_view' }),
  });
  const screen = p.screen();
  assert.deepEqual(group(screen.buttons).door('north'), []);
  for (const stack of [[], [{ kind: 'contents' }], [{ kind: 'thing', id: 'rat' }]] as Page[][]) {
    const drawn = nodes(
      BookView({
        palette: color.light,
        screen,
        stack,
        flip: { turn: 0, dir: 1 },
        go: () => {},
        press: (b) => p.press(b),
        refused: () => {},
        startOver: () => {},
        shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      }),
    );
    assert.ok(drawn.some((n) => n.props?.accessibilityRole === 'header' && words(n) === 'Combat'));
    const controls = drawn.filter((n) =>
      ['Stand', 'Look', 'Flee', 'Flee north', 'Flee west'].includes(n.props?.accessibilityLabel),
    );
    assert.deepEqual(
      controls.map((n) => n.props.accessibilityLabel),
      ['Stand', 'Look', 'Flee'],
    );
    const scroll = drawn.find((n) => n.type === 'ScrollView')!;
    const inside = nodes(scroll);
    const narrative = inside.findIndex(
      (n) => n.type === 'Text' && words(n) === 'The marsh rat falls.',
    );
    assert.ok(narrative >= 0);
    for (const control of controls) {
      assert.ok(
        inside.findIndex((n) => n.props?.accessibilityLabel === control.props.accessibilityLabel) >
          narrative,
      );
      control.props.onPress();
    }
    assert.notEqual(scroll.props.contentContainerStyle.flexDirection, 'row');
  }
  assert.deepEqual(
    sent,
    Array.from({ length: 3 }, () => [
      { action_key: 'stand', target_ids: [], input: {}, view_freshness_token: 'view:drawn' },
      { action_key: 'look', target_ids: [], input: {}, view_freshness_token: 'view:drawn' },
      {
        action_key: 'flee',
        target_ids: [],
        input: {},
        view_freshness_token: 'view:drawn',
      },
    ]).flat(),
  );
  assert.deepEqual(
    group(presenter(game(view({ combat: undefined, actions: [] }))).screen().buttons).flee,
    [],
  );
});

// Break: a dead combat opponent is narrated both as killed and as leaving the room.
test('committed opponent death narrates once through the existing subscription', () => {
  let current = view({ combat: undefined }),
    token = 'view:1';
  let last: ReturnType<Game['lastNarration']> = {
    command_id: 'before',
    lines: [{ key: 'room.event' }],
  } as never;
  const p = presenter({
    ...game(current),
    text: (key) =>
      ({
        'room.event': 'The bell rings.',
        'ambient.event': 'A door creaks.',
        'combat.result': 'The marsh rat falls.',
      })[key],
    view: () => ({ view: current, token }),
    lastNarration: () => last,
  });
  current = view();
  token = 'view:onset';
  p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
  current = view({ combat: undefined, entities: [] });
  last = {
    command_id: 'round',
    lines: [{ key: 'combat.result' }, { key: 'ambient.event' }],
    combat_lines: [0],
  } as never;
  for (token of ['view:2', 'view:2', 'view:3'])
    p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
  assert.deepEqual(p.screen().combatLog, ['The marsh rat falls.']);
  assert.deepEqual(p.screen().log, ['The bell rings.', 'A door creaks.']);
});

// Real Book state/effect routing over controlled committed Game projections; no native layout claim.
function mounted(initial: GameView, recovered?: ReturnType<Game['lastNarration']>) {
  let current = initial,
    revision = 1,
    last = recovered,
    pending = false;
  let respond: () => any = () => ({ kind: 'stale_view' });
  let listener: ((event: any) => void) | undefined;
  const state: any[] = [],
    effects: (() => void)[] = [];
  let slot = 0;
  const projection = () => ({ view: current, token: `view:${revision}` });
  const g: Game = {
    ...game(initial),
    view: projection,
    lastNarration: () => last,
    text: (key) =>
      ({
        'room.title': 'The cellar',
        'road.title': 'The road',
        'shrine.title': 'The shrine',
        'npc.rat': 'a marsh rat',
        'combat.hit': 'You strike the marsh rat.',
        'combat.result': 'The marsh rat falls.',
        'combat.flee': 'You escape to the road.',
        'combat.death': 'You wake at the shrine.',
      })[key],
    invoke: () => respond(),
    pending: () => pending,
    pendingInvocation: () => (pending ? 'reservation' : undefined),
    subscribe: (f) => (
      (listener = f),
      f({ kind: 'state', projection: projection(), status: { kind: 'ready' } }),
      () => {
        listener = undefined;
      }
    ),
  };
  (globalThis as any)[Symbol.for('combat-state')] = (initial: any) => {
    const i = slot++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (next: any) => {
        state[i] = typeof next === 'function' ? next(state[i]) : next;
      },
    ];
  };
  (globalThis as any)[Symbol.for('combat-effect')] = (f: () => any, deps: any[]) => {
    const i = slot++,
      before = state[i];
    if (before && deps.every((d, j) => Object.is(d, before.deps[j]))) return;
    effects.push(() => {
      before?.cleanup?.();
      state[i] = { deps, cleanup: f() };
    });
  };
  const draw = () => {
    slot = 0;
    const root = Book({
      game: g,
      shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      startOver: () => undefined,
    });
    effects.splice(0).forEach((f) => f());
    return nodes(root);
  };
  const texts = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map(words);
  return {
    texts,
    tap: (label: string) => {
      const control = draw().find((n) => n.props?.accessibilityLabel === label);
      assert.ok(control, label);
      control.props.onPress();
    },
    publish: (next: GameView, line?: string) => {
      current = next;
      revision++;
      if (line)
        last = {
          command_id: `commit-${revision}`,
          lines: [{ key: line }],
          combat_lines: [0],
        } as never;
      listener?.({ kind: 'state', projection: projection(), status: { kind: 'ready' } });
    },
    answer: (reply: any, next = current, line?: string) => {
      respond = () => {
        current = next;
        revision++;
        pending = reply.kind === 'pending';
        if (line)
          last = {
            command_id: `commit-${revision}`,
            lines: [{ key: line }],
            combat_lines: [0],
          } as never;
        return reply;
      };
    },
    close: () => state.forEach((s) => s?.cleanup?.()),
  };
}

// Break: ending a foreground encounter leaves the old combat/menu page instead of the committed room.
test('confirmed encounter foregrounds another page and closure or death restores the World', () => {
  for (const ending of ['closed', 'opponent_dead', 'player_dead']) {
    const h = mounted(view({ combat: undefined }));
    try {
      h.tap('Contents');
      h.tap('Settings');
      assert.ok(h.texts().includes('Settings'));
      h.publish(view(), 'combat.hit');
      assert.ok(h.texts().includes('Combat'));
      assert.ok(h.texts().includes('You strike the marsh rat.'));
      assert.equal(h.texts().includes('Settings'), false);
      h.publish(
        view({
          combat: undefined,
          entities: ending === 'opponent_dead' ? [] : view().entities,
          ...(ending === 'player_dead'
            ? {
                place: {
                  id: 'shrine',
                  title: { key: 'shrine.title' },
                  description: { key: 'shrine.description' },
                },
              }
            : {}),
        }),
        ending === 'player_dead'
          ? 'combat.death'
          : ending === 'opponent_dead'
            ? 'combat.result'
            : undefined,
      );
      assert.equal(h.texts().includes('Combat'), false);
      for (const text of [
        'You strike the marsh rat.',
        'The marsh rat falls.',
        'You wake at the shrine.',
      ])
        assert.equal(h.texts().includes(text), false);
      assert.ok(h.texts().includes(ending === 'player_dead' ? 'The shrine' : 'The cellar'));
    } finally {
      h.close();
    }
  }
});

// Break: Attack narration stays hidden in NPC detail, or an unconfirmed/refused Flee dismisses combat.
test('Attack opens its committed page; pending and refused Flee stay until committed escape', () => {
  const attack = {
    action_key: 'attack',
    label: 'action.attack',
    available: true,
    input: [],
    target: { kind: 'entity' },
  };
  const quiet = view({
    combat: undefined,
    entities: [{ ...view().entities[0], actions: [attack] }],
  });
  const fighting = view({ entities: quiet.entities });
  const h = mounted(quiet);
  const accepted = (outcome: string, key?: string) => ({
    kind: 'saved',
    decision: { kind: 'accepted', events: [], outcome, narration: key ? [{ key }] : [] },
  });
  try {
    h.tap('a marsh rat, open');
    h.answer(accepted('attacked', 'combat.hit'), fighting, 'combat.hit');
    h.tap('Attack a marsh rat');
    assert.ok(h.texts().includes('Combat'));
    assert.equal(h.texts().filter((s) => s === 'You strike the marsh rat.').length, 1);
    h.answer({ kind: 'pending' });
    h.tap('Flee');
    assert.ok(h.texts().includes('Combat'));
    assert.ok(h.texts().includes('save not confirmed'));
    h.answer({ kind: 'saved', decision: { kind: 'rejected', error: { code: 'exit_locked' } } });
    h.tap('Flee');
    assert.ok(h.texts().includes('Combat'));
    assert.ok(h.texts().includes("You can't do that: locked."));
    const road = view({
      combat: undefined,
      place: { id: 'road', title: { key: 'road.title' }, description: { key: 'road.description' } },
    });
    h.answer(accepted('fled', 'combat.flee'), road, 'combat.flee');
    h.tap('Flee');
    assert.equal(h.texts().includes('Combat'), false);
    assert.ok(h.texts().includes('The road'));
    assert.equal(h.texts().includes('You escape to the road.'), false);
    assert.equal(h.texts().includes('You strike the marsh rat.'), false);
    assert.equal(h.texts().includes("You can't do that: locked."), false);
  } finally {
    h.close();
  }
});

// Break: reopening a saved encounter restores an ordinary chapter/choice page over the live fight.
test('reopening an encounter restores the combat page and last committed narration', () => {
  const h = mounted(view({ chapter: { index: 1, title: 'chapter.title' } }), {
    command_id: 'saved-round',
    lines: [{ key: 'combat.hit' }],
    combat_lines: [0],
  } as never);
  try {
    assert.ok(h.texts().includes('Combat'));
    assert.equal(h.texts().filter((s) => s === 'You strike the marsh rat.').length, 1);
  } finally {
    h.close();
  }
});

// Break: a reopened terminal combat receipt leaks into World because there is no active encounter.
test('reopening after escape or either death never restores combat into the World log', () => {
  for (const key of ['combat.hit', 'combat.result', 'combat.flee', 'combat.death']) {
    const h = mounted(view({ combat: undefined, actions: [] }), {
      command_id: 'closed-round',
      lines: [{ key }],
      combat_lines: [0],
    } as never);
    try {
      assert.ok(h.texts().includes('The cellar'));
      assert.equal(
        h
          .texts()
          .some((line) =>
            [
              'You strike the marsh rat.',
              'The marsh rat falls.',
              'You escape to the road.',
              'You wake at the shrine.',
            ].includes(line),
          ),
        false,
      );
    } finally {
      h.close();
    }
  }
});
