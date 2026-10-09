// Real Item/ThingPage components and GameSession; native hosts are leaves, not layout proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { group } from './model.ts';
import { presenter } from './presenter.ts';

const ts = createRequire(import.meta.url)('typescript');
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    // Components are called outside React: the palette context reads its default (light).
    if (specifier === 'react') return { url: 'test:item-react', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:item-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:item-react')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue;`,
      };
    if (url === 'test:item-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',AccessibilityInfo={};",
      };
    if (!url.endsWith('.tsx')) return next(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
  },
});
const { Item } = await import('./Menu.tsx');

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return typeof element.type === 'function'
    ? nodes(element.type(element.props))
    : [element, ...nodes(element.props?.children)];
}

// Breaks: Item drops the detail target, ThingPage hides/reverses history or puts it after options,
// or the empty history adds a heading/placeholder. Expected page text is independent literals.
test('retained item results appear chronologically between description and options, empty log omitted', (t) => {
  const bundle = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/containers_cartridge_sampler_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  for (const label of ['Go north', 'Go east', 'Go up', 'Take a wool cloak'])
    book.press(book.screen().buttons.find((b) => b.label === label) ?? assert.fail(label));
  const id = a.game.view().view.inventory.find((e) => e.name === 'item.wool_cloak.short')!.id;
  const draw = () => {
    const screen = book.screen();
    return nodes(
      Item({ id, screen, g: group(screen.buttons), press: book.press, open() {}, world() {} }),
    );
  };
  const text = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map((n) => n.props.children);
  const tap = (label: string) => {
    const button = draw().find(
      (n) => n.type === 'Pressable' && n.props.accessibilityLabel === label,
    );
    assert.ok(button, label);
    button.props.onPress();
  };
  const cloak = ['A wool cloak', 'Heavy grey wool. Rain runs off it.'];
  assert.deepEqual(text(), [...cloak, 'Drop a wool cloak', 'Wear a wool cloak', 'Leave']);
  tap('Wear a wool cloak');
  assert.deepEqual(text(), [...cloak, 'You put it on.', 'Remove a wool cloak', 'Leave']);
  tap('Remove a wool cloak');
  assert.deepEqual(text(), [
    ...cloak,
    'You put it on.',
    'You take it off.',
    'Drop a wool cloak',
    'Wear a wool cloak',
    'Leave',
  ]);
  assert.equal(book.screen().returnWorld, false);
  assert.deepEqual(book.screen().log, ['You pick up a wool cloak.']);
});
