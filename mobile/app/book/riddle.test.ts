// Controlled React leaves exercise the real NPC tile controls; this is not native layout proof.
import { reactShim } from './__tests__/react-shim.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { presenter } from './presenter.ts';
import { group } from './model.ts';
import { fadeStub } from './__tests__/fade-stub.ts';
import {
  bundle,
  entity,
  genesis,
  prefix,
} from '../../authority/local-story/__tests__/riddle-fixture.ts';
const require = createRequire(import.meta.url),
  ts = require('typescript');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './fade.ts') return fadeStub;
    if (specifier === 'react') return { url: 'test:riddle-react', shortCircuit: true };
    if (specifier === 'react-native') return { url: 'test:riddle-native', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:riddle-react')
      return reactShim(
        `({ state: globalThis[Symbol.for('riddle-state')], ref: v => ({ current: v }), effect: () => {} })`,
      );
    if (url === 'test:riddle-native')
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
const { NpcPage } = await import('./Npc.tsx');
const words = (e: any): string =>
  Array.isArray(e)
    ? e.map(words).join('')
    : typeof e === 'string'
      ? e
      : words(e?.props?.children ?? []);
// The riddle fragment's texts (kernel/ts/test/riddle_fixture.ts); the bank gains a second E so two
// tiles share a letter.
const wrong = 'The sphinx shakes its head.',
  right = 'The sphinx nods.',
  prompt = 'What comes in twice a day?';

// Breaks: bank order/multiplicity, editing, input transmission or detail chronology regresses.
test('NPC detail tiles edit a bounded word and submit retry/correct results after history', (t) => {
  const b = bundle((c) => {
    c.dialogues[`${prefix}:dialogue/riddle`].riddle.bank = ['T', 'E', 'I', 'D', 'E'];
  });
  const sphinx = entity(genesis(), 'npc', 'sphinx');
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, b);
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const go = (action: string, target: string[] = []) => {
    const reply = a.game.invoke({ action_key: action, target_ids: target, input: {} } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  go('lantern');
  go('take', [entity(genesis(), 'item', 'lantern')]);
  // Presenter records the actual pending prompt using its normal Talk button.
  const talk = book.screen().buttons.find((b) => b.action_key === 'riddle')!;
  book.press(talk, sphinx);
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
        npc: s.view.entities.find((e) => e.id === sphinx),
        text: s.text,
        g: group(s.buttons),
        press: (b) => book.press(b, sphinx),
        log: s.detail(sphinx),
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
  assert.ok(initial.indexOf('A sphinx.') < initial.indexOf(prompt));
  assert.ok(initial.indexOf(prompt) < initial.indexOf('Choose letters to answer.'));
  assert.deepEqual(
    labels().filter((s) => /^., tile \d+$/.test(s)),
    ['T, tile 1', 'E, tile 2', 'I, tile 3', 'D, tile 4', 'E, tile 5'],
  );
  assert.ok(!labels().includes('Submit'));
  tap('E, tile 2');
  tap('E, tile 5');
  assert.ok(text().includes('EE'));
  // A used tile keeps its place, disabled; a second pick of it does not add a letter.
  assert.equal(used('E, tile 2'), true);
  tap('E, tile 2');
  assert.ok(!text().includes('EEE'));
  tap('Backspace');
  assert.ok(text().includes('E'));
  assert.equal(used('E, tile 5'), false);
  tap('Clear');
  assert.ok(!labels().includes('Submit'));
  for (const label of ['E, tile 2', 'D, tile 4', 'I, tile 3', 'T, tile 1']) tap(label);
  tap('Submit');
  assert.ok(text().includes(wrong));
  assert.equal(book.screen().log.filter((l) => l === wrong).length, 1); // in place
  assert.ok(text().indexOf(wrong) < text().indexOf('Choose letters to answer.'));
  for (const label of ['T, tile 1', 'I, tile 3', 'D, tile 4', 'E, tile 5']) tap(label);
  tap('Submit');
  assert.ok(text().includes(right));
  assert.ok(!labels().some((s) => /^., tile \d+$/.test(s)));
});
