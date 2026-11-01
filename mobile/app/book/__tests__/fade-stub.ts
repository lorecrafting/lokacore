// The palette fade's module for Book tests in node: no Reanimated, so the palette switches at once,
// as under reduced motion, the night sky holds still and the status ring jumps (a test may set
// globalThis.reducedMotion and collect withTiming durations in globalThis.timings). Resolve './fade.ts'
// to this.
export const fadeStub = {
  url:
    'data:text/javascript,export const usePaletteCurve=()=>undefined,' +
    'useReducedMotion=()=>globalThis.reducedMotion??true,' +
    "Reanimated={View:'View'},Easing={linear:t=>t},useAnimatedStyle=f=>f()," +
    "InkText=p=>({type:'Text',key:null,props:{allowFontScaling:false,...p}}),LiftPressable='Pressable',curveOf=()=>undefined,ReduceMotion={Never:'never'}," +
    'FadeOut={duration:()=>({reduceMotion:()=>undefined})},' +
    'interpolateColor=(v,r,o)=>(v>r[0]?o[1]:o[0]),withDelay=(d,v)=>(globalThis.delays?.push(d),v),withSequence=(...v)=>(globalThis.sequences?.push(v),v.at(-1));' +
    'globalThis.requestAnimationFrame??=()=>0;globalThis.cancelAnimationFrame??=()=>{};export const ' +
    'useSharedValue=value=>globalThis.sharedSlot?.(value)??{value},withTiming=(v,o)=>(globalThis.timings?.push(o.duration),v)',
  shortCircuit: true,
};
