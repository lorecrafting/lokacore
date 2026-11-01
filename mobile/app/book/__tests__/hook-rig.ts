// A small hook rig for real components: it keeps slots and honours effect deps, as React does.
const g = globalThis as any;
type After = { after: (f: () => void) => void };

/** Collects withTiming durations, delays and device calls; `reduced` is the reduced-motion answer. */
export function effects(t: After, reduced = false) {
  g.reducedMotion = reduced;
  g.timings = [];
  g.delays = [];
  g.sequences = [];
  g.bookDevice = [];
  t.after(() => {
    g.reducedMotion = g.timings = g.delays = g.sequences = g.bookDevice = g.sharedSlot = undefined;
  });
}

/** One mounted component: each call is a render; `.shared` holds its shared values in order. */
export function rig(t: After) {
  const slots: any[] = [];
  const stops = new Map<number, () => void>();
  const shared: { value: any }[] = [];
  t.after(() => unmount());
  let at = 0; // mutate-skip: test rig, hook slot cursor
  const queued: (() => void)[] = [];
  const render = <T>(body: () => T): T => {
    at = 0; // mutate-skip: test rig, hook slot cursor
    g[Symbol.for('loka-book-test-state')] = (v: any) => {
      const i = at++;
      if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v;
      return [slots[i], (n: any) => (slots[i] = typeof n === 'function' ? n(slots[i]) : n)];
    };
    g[Symbol.for('loka-book-test-effect')] = (f: () => () => void, deps: unknown[]) => {
      const i = at++;
      if (!slots[i]?.every((d: unknown, j: number) => Object.is(d, deps[j]))) {
        slots[i] = deps;
        queued.push(() => {
          stops.get(i)?.();
          stops.delete(i);
          const stop = f();
          if (typeof stop === 'function') stops.set(i, stop);
        });
      }
    };
    // A shared value lives as long as its component, as Reanimated's does.
    g.sharedSlot = (value: unknown) =>
      g[Symbol.for('loka-book-test-state')](() => {
        const made = { value };
        shared.push(made);
        return made;
      })[0];
    const out = body();
    for (const f of queued.splice(0)) f();
    return out;
  };
  const unmount = () => {
    stops.forEach((stop) => stop());
    stops.clear();
  };
  return Object.assign(render, { shared, unmount });
}

export const flat = (style: any) => Object.assign({}, ...[style].flat());
