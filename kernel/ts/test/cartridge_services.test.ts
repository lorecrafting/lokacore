import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, prefix, ref } from './service_fixture.ts';
// Breaks: a dialogue outside the service writes the service's entitlement fact, forging payment.
// The service binding checks themselves are the compiler's (content_services_test.exs).
test('loader refuses a dialogue that writes a service entitlement fact', () => {
  assert.equal(load().ok, true);
  const r = load((c: any) => {
    c.dialogues[`${prefix}:dialogue/aldous_lesson`].choices.learn.sequence = [
      { op: 'fact.assign', fact: ref('fact', 'bed_paid'), value: true },
    ];
  }) as any;
  assert.equal(r.ok, false);
  assert.equal(r.diagnostic.code, 'RESERVED_FACT');
  assert.ok(r.diagnostic.path.endsWith('.sequence[0].fact'), r.diagnostic.path);
});
