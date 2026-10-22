// Every refusal an offer can carry reads as a word, not the raw code (pass-1 row 2, docs/CHECKS.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { reason } from './words.ts';

const registry: { code: string; category: string }[] = JSON.parse(
  readFileSync(new URL('../../../protocol/error_registry.json', import.meta.url), 'utf8'),
);
// The host's command-time refusals; no kernel view puts them on an offer.
const COMMAND_ONLY = ['stale_view', 'stale_revision', 'rate_limited'];
// A view greys an offer whose evaluation ran out of budget (kernel/ts/src/view/use.ts).
const offered = [
  ...registry.filter((e) => e.category === 'gameplay_rejection' && !COMMAND_ONLY.includes(e.code)),
  { code: 'budget_exceeded' },
].map((e) => e.code);

test('every refusal code an offer can carry has a reason word', () => {
  assert.deepEqual(
    offered.filter((code) => reason(code) === code.replaceAll('_', ' ')),
    [],
  );
});
