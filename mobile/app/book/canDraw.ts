// No CanvasKit on the web (no WebAssembly, a story without its loader): Skia layers draw nothing.
export const canDraw = () =>
  'CanvasKit' in globalThis || globalThis.navigator?.product === 'ReactNative';
