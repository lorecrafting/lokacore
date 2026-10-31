// The one React stand-in the Book node tests load in place of 'react' (loka-mluq): a component that
// starts using another hook needs one edit here, not one per test file. `hooks` is a JS expression
// for the test's backing object { state, effect, ref? }, read at each call; without it only
// useContext is replaced. useRef falls back to a state slot, useLayoutEffect runs as useEffect.
import { registerHooks } from 'node:module';

const react = import.meta.resolve('react');

// Metro picks a platform file by extensionless import; node has no such step, so the Book's node
// tests get the native stubs. Here because every Book test loads this file.
registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier === './sound' || specifier === './haptic' ? `${specifier}.ts` : specifier,
      context,
    ),
});

export const reactShim = (hooks?: string) => ({
  format: 'module' as const,
  shortCircuit: true,
  source:
    `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue;` +
    (hooks
      ? ` const h = () => ${hooks}; export const useState = v => h().state(v);` +
        ` export const useRef = v => { const o = h(); return o.ref ? o.ref(v) : o.state({ current: v })[0]; };` +
        ` export const useEffect = (f, d) => h().effect(f, d); export const useLayoutEffect = useEffect;`
      : ''),
});
