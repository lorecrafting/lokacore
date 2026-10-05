import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:keyboard-react', shortCircuit: true };
    if (specifier === 'react-native') return { url: 'test:keyboard-native', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:keyboard-react')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useState = v => [typeof v === 'function' ? v() : v, () => {}]; export const useRef = v => ({ current: v }); export const useEffect = f => f();`,
      };
    if (url === 'test:keyboard-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={announceForAccessibility:()=>{}},Easing={},Animated={View:'View',Value:class {}},PanResponder={create:()=>({panHandlers:{}})};",
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
const { Footer } = await import('./Footer.tsx');
const { BookView } = await import('./Book.tsx');

function browser(t: { after: (cleanup: () => void) => void }) {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalElement = globalThis.Element;
  const listeners = new Map<string, (event: any) => void>();
  class Target {
    tag: string;
    role?: string;
    constructor(tag = 'div', role?: string) {
      this.tag = tag;
      this.role = role;
    }
    closest(selector: string) {
      const choices = selector.split(',').map((part) => part.trim());
      return choices.includes(this.tag) || (this.role && choices.includes(`[role="${this.role}"]`))
        ? this
        : null;
    }
  }
  (globalThis as any).Element = Target;
  (globalThis as any).window = {
    addEventListener: (type: string, listener: (event: any) => void) =>
      listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  (globalThis as any).document = {};
  t.after(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Element = originalElement;
  });
  const key = (name: string, more: Record<string, unknown> = {}) => {
    let prevented = false;
    listeners.get('keydown')?.({
      key: name,
      target: new Target(),
      defaultPrevented: false,
      preventDefault: () => {
        prevented = true;
      },
      ...more,
    });
    return prevented;
  };
  return { listeners, key, Target };
}

// Breaks: a shortcut chooses the wrong exit or steals a focused input's arrow keys.
test('web keyboard uses offered exits and keeps focused controls', (t) => {
  const { key, Target } = browser(t);
  const walked: string[] = [];
  const refusals: string[] = [];
  const exits = ['north', 'south', 'west', 'east', 'up', 'down'].map((direction) => ({
    direction,
    available: true,
  }));
  Footer({
    keyboardEnabled: true,
    exits,
    text: (key: string) => key,
    go: (direction: string) => walked.push(direction),
    refused: (line: string) => refusals.push(line),
    openMap: () => {},
    learned: { seen: () => true, see: () => {} },
  });
  for (const name of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'])
    assert.equal(key(name), true);
  assert.deepEqual(walked, ['north', 'south', 'west', 'east', 'up', 'down']);
  for (const tag of ['input', 'textarea', 'select'])
    assert.equal(key('ArrowUp', { target: new Target(tag) }), false);
  assert.equal(key('ArrowUp', { target: new Target('div', 'dialog') }), false);
  assert.equal(key('ArrowUp', { ctrlKey: true }), false);
  assert.equal(key('ArrowUp', { defaultPrevented: true }), false);
  assert.equal(key('Home'), false);
  assert.equal(walked.length, 6);
  exits.pop(); // no down exit is offered here
  assert.equal(key('PageDown'), false);
  exits[0] = { direction: 'north', available: false, reason: { code: 'exit_closed' } } as any;
  assert.equal(key('ArrowUp'), true);
  assert.equal(walked.length, 6);
  assert.deepEqual(refusals, ['The way north is closed.']);
});

// Breaks: Book installs a World keyboard handler while a detail or save state owns input.
test('Book captures movement keys only on an active World page', (t) => {
  const { listeners, key } = browser(t);
  const pressed: string[] = [];
  const move = {
    label: 'North',
    action_key: 'move',
    target_ids: [],
    input: { direction: 'north' },
  };
  const screen = {
    buttons: [move],
    view: {
      place: { id: 'room' },
      time: 0,
      position: 'standing',
      exits: [{ direction: 'north', available: true }],
    },
    text: (key: string) => key,
    log: [],
    pending: false,
    catchingUp: false,
    fault: undefined,
  };
  const attempt = (change: Record<string, unknown> = {}, stack: unknown[] = []) => {
    listeners.clear();
    const current = { ...screen, ...change, view: { ...screen.view, ...(change.view as object) } };
    const book = BookView({
      screen: current as any,
      stack: stack as any,
      flip: { turn: 0, dir: 1 },
      go: () => {},
      press: (button: any) => pressed.push(button.input.direction),
      refused: () => {},
      startOver: () => {},
      shell: { confirm: () => {}, learned: { seen: () => true, see: () => {} } },
    });
    const bottom = book.props.children[1];
    const footer = bottom
      .type(bottom.props)
      .props.children.find((child: any) => child?.type === Footer);
    if (footer) Footer(footer.props);
    return key('ArrowUp');
  };
  assert.equal(attempt(), true);
  assert.deepEqual(pressed, ['north']);
  for (const change of [
    { pending: true },
    { catchingUp: true },
    { fault: 'save failed' },
    { view: { scene: {} } },
    { view: { combat: {} } },
  ])
    assert.equal(attempt(change), false);
  for (const page of [{ kind: 'dialogue' }, { kind: 'thing', id: 'npc' }, { kind: 'chapter' }])
    assert.equal(attempt({}, [page]), false);
  assert.deepEqual(pressed, ['north']);
});
