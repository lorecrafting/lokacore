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

// Breaks: a keyboard shortcut chooses the wrong exit or steals an editable control's arrow keys.
test('web keyboard uses offered exits only on an eligible World footer', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalElement = globalThis.Element;
  const listeners = new Map<string, (event: any) => void>();
  class Target {
    editable: boolean;
    constructor(editable = false) {
      this.editable = editable;
    }
    closest() {
      return this.editable ? this : null;
    }
  }
  (globalThis as any).Element = Target;
  (globalThis as any).window = {
    addEventListener: (type: string, listener: (event: any) => void) =>
      listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  (globalThis as any).document = {};
  try {
    const walked: string[] = [];
    const refusals: string[] = [];
    const exits = ['north', 'south', 'west', 'east', 'up', 'down'].map((direction) => ({
      direction,
      available: true,
    }));
    const draw = (keyboardEnabled: boolean) =>
      Footer({
        keyboardEnabled,
        exits,
        text: (key: string) => key,
        go: (direction: string) => walked.push(direction),
        refused: (line: string) => refusals.push(line),
        openMap: () => {},
        learned: { seen: () => true, see: () => {} },
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
    draw(true);
    for (const name of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'])
      assert.equal(key(name), true);
    assert.deepEqual(walked, ['north', 'south', 'west', 'east', 'up', 'down']);
    assert.equal(key('ArrowUp', { target: new Target(true) }), false);
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
    listeners.clear();
    draw(false);
    assert.equal(key('ArrowUp'), false);
    assert.equal(walked.length, 6);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Element = originalElement;
  }
});
