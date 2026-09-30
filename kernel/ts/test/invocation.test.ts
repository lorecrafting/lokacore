// The P1 identity/outcome adapter (R6P P1; 03 §14; 04 §2, §5.0) through the known-answer runner
// (src/known_answers.ts). Expected values are the hand-checked and Python-computed answers in
// invocation_cases.json (see its description) and literals written from the rule headers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { attempt, run } from '../src/known_answers.ts';
import { INSTALLED } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
const SEED = [1, 2, 3, 4] as RngState;
const world = (fixture: string) => {
  const kat = read(`protocol/fixtures/${fixture}`);
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT, SEED);
};
const items = world('cartridge_items_hash.json');
const { cases } = read('kernel/ts/test/invocation_cases.json');

// Breaks: the command id taken from anything but the trusted scope and invocation id, targets
// sorted or the freshness token in the intent digest, give's targets filled in another order,
// authorization before validation, an unknown field accepted, or a NEW intent resolved to the
// wrong Command or an unoffered action admitted.
test('the adapter matches the invocation known answers', () => {
  assert.deepEqual(run(items, cases), []);
});

// Breaks: a runner that cannot fail, or reports only hashes (pre-release-proof.md, Evidence
// required: per-step canonical state/result bytes).
test('a mismatch reports the step, both results and the state as canonical bytes', () => {
  const take = cases[0].steps[0];
  const wrong = { ...take, result: { kind: 'unauthorized' } };
  const [report, ...rest] = run(items, [{ ...cases[0], steps: [wrong] }]);
  assert.deepEqual(rest, []);
  assert.match(
    report,
    /^take, retry, give in target order step 0\nexpected \{"kind":"unauthorized"\}\n/,
  );
  assert.match(report, /\nactual {3}\{"command_id":"3ee00071-4a05-8a6d-9ba7-fbf2e6211039",/);
  // The satchel in the body after the take (ids: containment.test.ts, ordinals 8 and 1).
  const held = '"d530207e-b845-8be5-9d53-b44b2cf5d8a1":"3d4829ad-9e43-81ef-bc10-66b1b267e157"';
  const [before, after] = report.split('\nstate after  ');
  assert.ok(before.includes('\nstate before {') && !before.includes(held));
  assert.ok(after.includes(held));
});

// Breaks (04 §5.0): a fault reported as a rejection or the reverse, or either one changing the
// world. The bell recipe assigns a value its FactSpec does not allow, which adopt faults
// precondition_failed (recipes.test.ts); the loader rejects such an artifact, so the loaded
// cartridge is changed.
test('a fault stays a fault and a rejection a rejection, neither changing the world', () => {
  const ok = world('cartridge_bell_hash.json');
  const cartridge = structuredClone(ok.cartridge) as any;
  cartridge.recipes['ashmere_bell@0.0.1:recipe/ring_bell'].outcomes.success.sequence[0].value =
    'yes';
  const bad: World = { ...ok, cartridge };
  const invoke = (action_key: string) =>
    attempt(bad, 'story/lineage-1/character-1', {
      invocation_id: 'f6a7b8c9-d0e1-4f2a-8b3c-5d6e7f8a9b0c',
      action_key,
      actor_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9',
      target_ids: [],
      input: {},
    });
  const [fault, rejection] = [invoke('ring_bell'), invoke('take')];
  assert.deepEqual((fault.result as any).decision, { kind: 'fault', code: 'precondition_failed' });
  assert.deepEqual((rejection.result as any).decision, {
    kind: 'rejected',
    code: 'unsupported_capability', // the bell cartridge locks no containment
  });
  assert.equal(fault.world, bad);
  assert.equal(rejection.world, bad);
});
