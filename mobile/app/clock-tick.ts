// A timer stalled this long (sleep, a suspended tab) is an absence, so the away cap applies (save.md).
const STALLED_MS = 60_000;

type Ticks = { draining?: boolean; ticked?: number; stalled?: boolean };

// A stall during a drain turn waits for the drain to end: only a capture can cap it.
export function tickPulse(c: Ticks, now: number) {
  c.stalled ||= now - (c.ticked ?? now) > STALLED_MS;
  c.ticked = now;
  if (c.draining) return 'drain' as const;
  const resume = c.stalled;
  c.stalled = false;
  return resume ? ('resume' as const) : ('active' as const);
}
