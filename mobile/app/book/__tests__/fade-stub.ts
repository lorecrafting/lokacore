// The palette fade's module for Book tests in node: no Reanimated, so the palette switches at once,
// as under reduced motion, the night sky holds still and the status ring jumps (a test may set
// globalThis.reducedMotion and collect withTiming durations in globalThis.timings). Resolve './fade.ts'
// to this.
export const fadeStub = {
  url:
    'data:text/javascript,export const usePaletteCurve=()=>undefined,' +
    'useReducedMotion=()=>globalThis.reducedMotion??true,' +
    "Reanimated={View:'View'},Easing={linear:t=>t},useAnimatedStyle=f=>f()," +
    'useSharedValue=value=>({value}),withTiming=(v,o)=>(globalThis.timings?.push(o.duration),v)',
  shortCircuit: true,
};
