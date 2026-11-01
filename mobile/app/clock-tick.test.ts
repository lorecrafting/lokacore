import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tickPulse } from './clock-tick.ts';

// Breaks: a stalled timer pulses active, crediting a ticking monotonic clock past the away cap; or a
// drain turn captures, moving the horizon mid catch-up.
test('a tick after a stall resumes; an ordinary one stays active; a drain stays a drain', () => {
  assert.equal(tickPulse(false, 60_001), 'resume');
  assert.equal(tickPulse(false, 60_000), 'active');
  assert.equal(tickPulse(true, 60_001), 'drain');
});
