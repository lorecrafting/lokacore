// Controlled React leaves exercise the real NPC tile controls; this is not native layout proof.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { presenter } from './presenter.ts';
import { group } from './model.ts';
const require = createRequire(import.meta.url),
  ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:riddle-react', shortCircuit: true };
    if (specifier === 'react-native') return { url: 'test:riddle-native', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:riddle-react')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue; export const useState=v=>globalThis[Symbol.for('riddle-state')](v); export const useRef=v=>({current:v});`,
      };
    if (url === 'test:riddle-native')
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
const { NpcPage } = await import('./Npc.tsx');
const bundle = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v010_hash.json', import.meta.url),
    'utf8',
  ),
);
const ids = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v010_ids.json', import.meta.url),
    'utf8',
  ),
);
const words = (e: any): string =>
  Array.isArray(e)
    ? e.map(words).join('')
    : typeof e === 'string'
      ? e
      : words(e?.props?.children ?? []);

// Breaks: bank order/multiplicity, editing, input transmission or detail chronology regresses.
test('NPC detail tiles edit a bounded word and submit retry/correct results after history', (t) => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const go = (action: string, target: string[] = [], input: object = {}) => {
    const reply = a.game.invoke({ action_key: action, target_ids: target, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  const choose = (choice_id: string) =>
    go('choose', [], { choice_id, continuation_id: a.game.view().view.choice!.continuation_id });
  const move = (...directions: string[]) =>
    directions.forEach((direction) => go('move', [], { direction }));
  go('elspeth', [ids['npc/elspeth']]);
  choose('accept');
  move('north', 'north');
  go('take', [ids['item/fox_drawing']]);
  move('south', 'south');
  go('a_elspeth_report', [ids['npc/elspeth']]);
  choose('report');
  move('south', 'south');
  go('study_tracks');
  move('south', 'south');
  go('a_vesper_meeting', [ids['npc/vesper']]);
  choose('meet_wren');
  // Presenter records the actual pending prompt using its normal Talk button.
  const talk = book.screen().buttons.find((b) => b.action_key === 'b_vesper_riddle')!;
  book.press(talk, ids['npc/vesper']);
  const states = new Map<string, any[]>();
  let key = '',
    slot = 0;
  (globalThis as any)[Symbol.for('riddle-state')] = (initial: any) => {
    const state = states.get(key) ?? [];
    states.set(key, state);
    const index = slot++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state[index],
      (v: any) => {
        state[index] = typeof v === 'function' ? v(state[index]) : v;
      },
    ];
  };
  const nodes = (e: any): any[] => {
    if (Array.isArray(e)) return e.flatMap(nodes);
    if (!e || typeof e !== 'object') return [];
    if (typeof e.type === 'function') {
      key = `${e.type.name}:${e.key}`;
      slot = 0;
      return nodes(e.type(e.props));
    }
    return [e, ...nodes(e.props?.children)];
  };
  const draw = () => {
    const s = book.screen();
    return nodes(
      NpcPage({
        view: s.view,
        npc: s.view.entities.find((e) => e.id === ids['npc/vesper']),
        text: s.text,
        g: group(s.buttons),
        press: (b) => book.press(b, ids['npc/vesper']),
        log: s.detail(ids['npc/vesper']),
        leave: () => {},
      }),
    );
  };
  const labels = () =>
    draw()
      .filter((n) => n.type === 'Pressable')
      .map((n) => n.props.accessibilityLabel);
  const text = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map((n) => words(n.props.children));
  const tap = (label: string) => {
    const b = draw().find((n) => n.type === 'Pressable' && n.props.accessibilityLabel === label);
    assert.ok(b, label);
    b.props.onPress();
  };
  const used = (label: string) =>
    draw().find((n) => n.type === 'Pressable' && n.props.accessibilityLabel === label)!.props
      .disabled;
  const initial = text();
  assert.ok(
    initial.indexOf(bundle.value.text['npc.vesper.description']) <
      initial.indexOf(bundle.value.text['dialogue.b_vesper_riddle.prompt']),
  );
  assert.ok(
    initial.indexOf(bundle.value.text['dialogue.b_vesper_riddle.prompt']) <
      initial.indexOf('Choose letters to answer.'),
  );
  assert.deepEqual(
    labels().filter((s) => /^., tile \d+$/.test(s)),
    [
      'R, tile 1',
      'N, tile 2',
      'A, tile 3',
      'O, tile 4',
      'L, tile 5',
      'T, tile 6',
      'E, tile 7',
      'N, tile 8',
      'S, tile 9',
    ],
  );
  assert.ok(!labels().includes('Submit'));
  tap('N, tile 2');
  tap('N, tile 8');
  assert.ok(text().includes('NN'));
  // A used tile keeps its place, disabled; a second pick of it does not add a letter.
  assert.equal(used('N, tile 2'), true);
  tap('N, tile 2');
  assert.ok(!text().includes('NNN'));
  tap('Backspace');
  assert.ok(text().includes('N'));
  assert.equal(used('N, tile 8'), false);
  tap('Clear');
  assert.ok(!labels().includes('Submit'));
  for (const label of ['S, tile 9', 'T, tile 6', 'O, tile 4', 'N, tile 2', 'E, tile 7']) tap(label);
  tap('Submit');
  assert.ok(text().includes(bundle.value.text['narration.vesper_wrong']));
  assert.ok(!book.screen().log.includes(bundle.value.text['narration.vesper_wrong']));
  assert.ok(
    text().indexOf(bundle.value.text['narration.vesper_wrong']) <
      text().indexOf('Choose letters to answer.'),
  );
  for (const label of [
    'L, tile 5',
    'A, tile 3',
    'N, tile 2',
    'T, tile 6',
    'E, tile 7',
    'R, tile 1',
    'N, tile 8',
  ])
    tap(label);
  tap('Submit');
  assert.ok(text().includes(bundle.value.text['narration.b_vesper_riddle']));
  assert.ok(!labels().some((s) => /^., tile \d+$/.test(s)));
  assert.equal(
    a.game.view().view.journal.find((q) => q.quest.key === 'missing_child')!.state,
    'active',
  );
});
