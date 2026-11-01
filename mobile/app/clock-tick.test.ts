import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hidePulses, tickPulse } from './clock-tick.ts';

// Breaks: a stalled timer pulses active, crediting a ticking monotonic clock past the away cap.
test('a tick after a stall resumes once; an ordinary tick stays active', () => {
  const c = { ticked: 0 };
  assert.equal(tickPulse(c, 60_000), 'active');
  assert.equal(tickPulse(c, 120_001), 'resume');
  assert.equal(tickPulse(c, 120_002), 'active');
});

// Breaks: a drain turn erases the stall, so the active tick after the drain credits it uncapped.
test('a stall during a drain resumes when the drain ends', () => {
  const c = { ticked: 0, draining: true };
  assert.equal(tickPulse(c, 60_001), 'drain');
  c.draining = false;
  assert.equal(tickPulse(c, 60_002), 'resume');
});

// Breaks: a hide that is the first code after a stall pauses alone, crediting the gap uncapped.
test('a hide after a stall resumes first, whether or not a tick noticed it', () => {
  assert.deepEqual(hidePulses({ ticked: 0 }, 60_000), ['pause']);
  assert.deepEqual(hidePulses({ ticked: 0 }, 60_001), ['resume', 'pause']);
  assert.deepEqual(hidePulses({ ticked: 60_001, stalled: true }, 60_002), ['resume', 'pause']);
  assert.deepEqual(hidePulses({}, 60_001), ['pause']);
});
