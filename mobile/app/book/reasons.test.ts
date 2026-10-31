// Every refusal an offer can carry reads as a word, not the raw code (pass-1 row 2, docs/CHECKS.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { reasonSentence } from './reasons.ts';
import { reason, reasonOf, refusedSentence } from './words.ts';

const read = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../protocol/${file}`, import.meta.url), 'utf8'));
const registry: { code: string; category: string }[] = read('error_registry.json');
const causes: string[] = read('error.schema.json').$defs.RefusalCause.enum;
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

// Breaks: a RefusalCause added to error.schema.json with no word, so the tag falls back to the
// shared code's word ("not now") and the player is not told why.
test('every refusal cause has its own reason word', () => {
  assert.deepEqual(
    causes.filter((c) => reason('invalid_state', c) === reason('invalid_state')),
    [],
  );
});

// An hp-less person's refused Attack (loka-xyyd), as its card and its log line say it where no
// target is known. Breaks: the card reads "You can't do that—cannot be hurt.", or the log line is lost.
test('cannot_be_hurt reads as its own sentence on the card and in the log', () => {
  const r = { code: 'invalid_target', cause: 'cannot_be_hurt' };
  assert.equal(reasonSentence(reasonOf(r)), "That can't be hurt.");
  assert.equal(refusedSentence(r), "That can't be hurt.");
});
