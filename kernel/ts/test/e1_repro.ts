// E1 simulator repro carries inputs; the generator is never rerun to recover commands.
import { encode, hash } from '../src/foundation/canonical.ts';
import { newWorld, type World } from '../src/index.ts';
import { GENERATOR, KERNEL, replay, type Kernel, type Outcome } from './sim.ts';
import { admitCandidate, sha256 } from './e1_policy.ts';

type Source = { source_sha: string; check_hash: string; policy_hash: string };
export function retainFailure(o: Outcome, source: Source) {
  if (!o.failure) throw new Error('no failed invariant to retain');
  return {
    format: 'loka-e1-repro-v1',
    ...source,
    artifact_sha256: sha256(o.loaded.artifact),
    content_hash: o.loaded.hash,
    generator: GENERATOR,
    seed: o.seed,
    construction: o.drained ? 'adjusted' : 'fresh',
    initial_state: o.start.state,
    initial_state_hash: hash(o.start.state as never),
    logical_clock: o.start.state.clock,
    rng: { algorithm: 'xoshiro128**', state: o.start.state.rng },
    identity: {
      algorithm: 'loka-id-v1',
      context: o.start.context,
      character: o.start.character,
      body: o.start.body,
    },
    commands: o.commands,
    commands_sha256: sha256(encode(o.commands as never)),
    fault_schedule: { kind: 'none', reason: 'pure kernel simulator; no host storage operations' },
    expected_invariant: o.failure.id,
    observed: o.failure,
  };
}
type Repro = ReturnType<typeof retainFailure>;

/** Refuse incomplete evidence before executing; then require the original invariant failure. */
export function reproduce(r: Repro, bytes: Uint8Array, source: Source, kernel: Kernel = KERNEL) {
  const loaded = admitCandidate(bytes);
  verifyRecord(r, loaded, source);
  const fresh = newWorld(loaded.cartridge, r.identity.context, r.rng.state);
  if (fresh.character !== r.identity.character || fresh.body !== r.identity.body)
    throw new Error('repro deterministic identity mismatch');
  const start: World = { ...fresh, state: r.initial_state };
  const observed = replay(start, r.commands, kernel);
  if (
    !observed ||
    observed.id !== r.expected_invariant ||
    encode(observed as never) !== encode(r.observed as never)
  )
    throw new Error('expected invariant failure did not reproduce');
  return observed;
}

function verifyRecord(r: Repro, loaded: ReturnType<typeof admitCandidate>, source: Source) {
  if (
    !r ||
    r.format !== 'loka-e1-repro-v1' ||
    !r.initial_state ||
    !r.identity ||
    !r.rng ||
    !Array.isArray(r.commands) ||
    !r.commands.length ||
    !r.observed ||
    !r.expected_invariant ||
    r.fault_schedule?.kind !== 'none' ||
    !r.fault_schedule.reason ||
    !['fresh', 'adjusted'].includes(r.construction) ||
    !Number.isSafeInteger(r.seed) ||
    !Number.isSafeInteger(r.generator)
  )
    throw new Error('incomplete E1 repro');
  for (const key of ['source_sha', 'check_hash', 'policy_hash'] as const)
    if (!source[key] || r[key] !== source[key]) throw new Error(`repro ${key} mismatch`);
  if (
    r.artifact_sha256 !== sha256(loaded.artifact) ||
    r.content_hash !== loaded.hash ||
    r.commands_sha256 !== sha256(encode(r.commands as never)) ||
    hash(r.initial_state as never) !== r.initial_state_hash ||
    r.logical_clock !== r.initial_state.clock ||
    r.rng.algorithm !== 'xoshiro128**' ||
    encode([...r.rng.state]) !== encode([...r.initial_state.rng]) ||
    r.identity.algorithm !== 'loka-id-v1'
  )
    throw new Error('repro candidate/state/clock/RNG identity mismatch');
  for (const command of r.commands)
    if (
      !command ||
      typeof command.id !== 'string' ||
      typeof command.world_context_id !== 'string' ||
      !command.payload ||
      typeof command.payload.type !== 'string'
    )
      throw new Error('incomplete repro command');
}
