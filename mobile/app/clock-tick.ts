// A timer stalled this long (sleep, a suspended tab) is an absence, so the away cap applies (save.md).
const STALLED_MS = 60_000;

export const tickPulse = (draining: boolean, gapMs: number) =>
  draining ? ('drain' as const) : gapMs > STALLED_MS ? ('resume' as const) : ('active' as const);
