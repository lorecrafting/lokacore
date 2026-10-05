// The P1 identity/outcome adapter (R6P P1; 03 §14; 04 §2, §5.0) through the known-answer runner
// (src/known_answers.ts). Expected values are the hand-checked and Python-computed answers in
// invocation_cases.json (see its description) and literals written from the rule headers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { attempt, digests, run } from '../src/runtime/known_answers.ts';
import { INSTALLED } from '../src/runtime/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
const SEED = [1, 2, 3, 4] as RngState;
const world = (fixture: string, seed = SEED) => {
  const kat = read(`protocol/fixtures/${fixture}`);
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT, seed);
};
const items = world('containers_cartridge_items_hash.json');
const { cases, dusk_cases } = read('kernel/ts/test/invocation_cases.json');
// numeric-vectors.json rng_steps[3].state (see invocation_cases.json).
const dusk = world('cartridge_dusk_hash.json', [
  27274249, 25704967, 31982592, 12605441,
] as RngState);

// Breaks: the command id taken from anything but the trusted scope and invocation id, give's
// targets filled in another order,
// authorization before validation, an unknown field accepted, or a NEW intent resolved to the
// wrong Command, an unoffered action admitted, or a failed check reported as a rejection.
test('the adapter matches the invocation known answers', () => {
  assert.deepEqual(run(items, cases), []);
  assert.deepEqual(run(dusk, dusk_cases), []);
});

// Breaks (03 §14): targets sorted, the freshness token or invocation id in the intent digest,
// semantic input (continuation_id) left out, or any other change to the pinned bytes
// (protocol/fixtures/intent_digest.json, computed outside the kernels), or a check that cannot fail.
test('the intent digest matches its pinned known answers', () => {
  const { cases: rows } = read('protocol/fixtures/intent_digest.json');
  assert.deepEqual(digests(rows), []);
  assert.equal(digests([{ ...rows[0], intent_digest: rows[2].intent_digest }]).length, 1);
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
    /^take then give in target order step 0\nexpected \{"kind":"unauthorized"\}\n/,
  );
  assert.match(report, /\nactual {3}\{"command_id":"3ee00071-4a05-8a6d-9ba7-fbf2e6211039",/);
  // The satchel in the body after the take (ids: containment.test.ts, ordinals 8 and 1).
  const held = '"d530207e-b845-8be5-9d53-b44b2cf5d8a1":"3d4829ad-9e43-81ef-bc10-66b1b267e157"';
  const [before, after] = report.split('\nstate after  ');
  assert.ok(before.includes('\nstate before {') && !before.includes(held));
  assert.ok(after.includes(held));
});

// Breaks (04 §5.0): a fault or a failed attempt reported as a rejection or the reverse, a
// rejection or fault changing the world, or a failed attempt not committing its draw. The bell's
// ring_bell is changed in the loaded cartridge (the loader would reject both artifacts): assigning
// a value its FactSpec does not allow, which adopt faults precondition_failed (recipes.test.ts),
// or given a luck check of chance 20, which the seed's first roll of 20 fails, leaving the RNG at
// [7, 0, 1026, 12288] (checks.test.ts, from numeric-vectors.json).
test('fault, rejection and failed attempt stay distinct; only the attempt changes the world', () => {
  const ok = world('cartridge_bell_hash.json');
  const bell = (change: (recipe: any) => void): World => {
    const cartridge = structuredClone(ok.cartridge) as any;
    change(cartridge.recipes['ashmere_bell@0.0.1:recipe/ring_bell']);
    return { ...ok, cartridge };
  };
  const bad = bell((r) => (r.outcomes.success.sequence[0].value = 'yes'));
  const luck = bell((r) => {
    r.check = { key: 'ring_true', kind: 'luck', chance: 20 };
    r.outcomes.failure = { sequence: [], narration: { actor: 'narration.ring_bell.actor' } };
  });
  const invoke = (w: World, action_key: string) =>
    attempt(
      w,
      'story/lineage-1/character-1',
      {
        invocation_id: 'f6a7b8c9-d0e1-4f2a-8b3c-5d6e7f8a9b0c',
        action_key,
        actor_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9',
        target_ids: [],
        input: {},
      },
      1,
    );
  const [fault, rejection, failed] = [
    invoke(bad, 'ring_bell'),
    invoke(bad, 'take'),
    invoke(luck, 'ring_bell'),
  ];
  const decision = (r: { result: unknown }) => (r.result as any).decision;
  assert.deepEqual(decision(fault), { kind: 'fault', code: 'precondition_failed' });
  // The bell cartridge locks no containment.
  assert.deepEqual(decision(rejection), { kind: 'rejected', code: 'unsupported_capability' });
  assert.deepEqual(decision(failed), { kind: 'accepted', outcome: 'failure' });
  assert.equal(fault.world, bad);
  assert.equal(rejection.world, bad);
  assert.deepEqual(failed.world.state.rng, [7, 0, 1026, 12288]);
});
