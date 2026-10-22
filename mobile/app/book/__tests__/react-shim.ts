// The one React stand-in the Book node tests load in place of 'react' (loka-mluq): a component that
// starts using another hook needs one edit here, not one per test file. `hooks` is a JS expression
// for the test's backing object { state, effect, ref? }, read at each call; without it only
// useContext is replaced. useRef falls back to a state slot, useLayoutEffect runs as useEffect.
const react = import.meta.resolve('react');

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
