// The palette fade's module for Book tests in node: no Reanimated, so the palette switches at once,
// as under reduced motion, and the night sky holds still. Resolve './fade.ts' to this.
export const fadeStub = {
  url: 'data:text/javascript,export const usePaletteCurve=()=>undefined,useReducedMotion=()=>true',
  shortCircuit: true,
};
