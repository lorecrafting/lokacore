// One command through the kernel, as the trace.command entry and the decision-latency
// metric it produces (ADR-075 §3, §4; 11 §13, §15).
import { performance } from 'node:perf_hooks';
import { hash } from '../src/canonical.ts';
import type { Command, DecisionResult } from '../src/contracts.gen.ts';
import { step, type World } from '../src/index.ts';

/** A run in progress: its ids, current world, last ordinal and authority revision. */
export type Run = {
  ids: { content_hash: string; kernel_version: string; seed: readonly number[]; run_id: string };
  world: World;
  ordinal: number;
  revision: number;
};

/**
 * Decides `command` against the run and advances it. Accepted: committed at the next revision
 * with its events; rejected (no receipt before R6) and fault: commit unavailable, not_applicable.
 * RNG draws are not collected yet (unavailable, not_collected).
 */
export function decide(r: Run, command: Command) {
  const t0 = performance.now();
  const { decision, world } = step(r.world, command);
  const micros = Math.round((performance.now() - t0) * 1000);
  const ids = { ...r.ids, command_id: command.id, revision: r.revision };
  r.world = world;
  r.ordinal += 1;
  const [traced, commit] = outcome(decision, r);
  const trace = {
    format: 'loka-obs-v1',
    event: 'trace.command',
    store: 'game_trace',
    ids,
    data: { ordinal: r.ordinal, command, decision: traced, commit },
  };
  const latency = {
    format: 'loka-obs-v1',
    event: 'kernel.decision_latency',
    store: 'operations',
    ids: {
      kernel_version: r.ids.kernel_version,
      host: 'node',
      run_id: r.ids.run_id,
      command_id: command.id,
    },
    data: { state: 'observed', value: micros },
  };
  return { trace, latency, decision };
}

function outcome(d: DecisionResult, r: Run): [unknown, unknown] {
  const none = { state: 'unavailable', reason: 'not_applicable' };
  if (d.kind !== 'accepted') return [d, none];
  r.revision += 1;
  const traced = {
    kind: 'accepted',
    outcome: d.outcome,
    delta_digest: hash(d.delta as never),
    rng: { state: 'unavailable', reason: 'not_collected' },
    rng_state: d.rng,
  };
  const events = d.events.map((event) => ({ committed_revision: r.revision, event }));
  return [traced, { state: 'committed', revision: r.revision, events, effect_ids: [] }];
}
