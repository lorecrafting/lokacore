import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tickPulse } from './clock-tick.ts';

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
