// One command through the kernel, as the trace.command entry and the decision-latency
// metric it produces (ADR-075 §3, §4; 11 §13, §15), and one lookup (found).
import { performance } from 'node:perf_hooks';
import { hash } from '../src/foundation/canonical.ts';
import {
  LIMITS,
  type Command,
  type DecisionResult,
  type EntityId,
  type TargetResolution,
} from '../src/contracts.gen.ts';
import { step, stepElapsed, type World } from '../src/index.ts';
import { resolve } from '../src/commands/target.ts';
import { append, line, lookupWords } from './obs.ts';
import { which } from './text.ts';

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
 * RNG draws are not collected yet (unavailable, not_collected). A budget fault's limit goes to
 * diagnostics as evaluation.budget_exceeded (04 §5.4) when `measured`, so a replay, whose ids
 * repeat the run's, adds none.
 */
export function decide(r: Run, command: Command, measured = true) {
  const t0 = performance.now();
  const { decision, world, limit } = step(r.world, command, r.revision + 1);
  const micros = Math.round((performance.now() - t0) * 1000);
  return evaluated(r, command, { decision, world, limit }, micros, measured);
}

/** Replay-only dispatch; its run was bound by the complete trace preflight. */
export function decideReplay(r: Run, command: Command) {
  if (command.payload.type === 'elapsed' && command.payload.run_id !== r.ids.run_id)
    throw new Error('elapsed run differs from trace header');
  const next =
    command.payload.type === 'elapsed'
      ? stepElapsed(r.world, command, r.revision + 1)
      : step(r.world, command, r.revision + 1);
  return evaluated(r, command, next, 0, false);
}

function evaluated(
  r: Run,
  command: Command,
  next: ReturnType<typeof step>,
  micros: number,
  measured: boolean,
) {
  const { decision, world, limit } = next;
  const ids = { ...r.ids, command_id: command.id, revision: r.revision };
  if (limit && measured) {
    const record = { format: 'loka-obs-v1', event: 'evaluation.budget_exceeded', ids };
    const text = line({ ...record, store: 'diagnostics', data: { limit } }); // invalid: throws
    try {
      append('diagnostics', r.ids.run_id, text);
    } catch {} // 04 §5.4: a failed write never changes the decision
  }
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

// The words' unique id, else undefined after telling the player and writing one
// target.unresolved record to diagnostics (owner request, R5 S2) with the words redacted. Past
// selector_cardinality candidates resolve throws; that gets a refusal and no record, whose
// candidates count could not hold it.
export function found(r: Run, words: string, mode?: 'where'): EntityId | undefined {
  let res: TargetResolution;
  try {
    res = resolve(r.world, r.world.character, words, mode);
  } catch (e) {
    if (!String(e).includes('exceed selector_cardinality')) throw e;
    return void process.stdout.write(
      `Over ${LIMITS.selector_cardinality} things here answer to that.\n`,
    );
  }
  if (res.kind === 'unique') return res.target_id;
  const ids = res.kind === 'ambiguous' ? res.candidate_ids : [];
  process.stdout.write(
    ids.length ? which(r.world.cartridge, r.world, ids) : "You don't see that here.\n",
  );
  const { key } = r.world.rooms[r.world.state.containers[r.world.body]];
  const { id, version } = r.world.cartridge.manifest;
  const data = {
    room: { cartridge_id: id, cartridge_version: version, kind: 'room', key },
    outcome: res.kind,
    candidates: ids.length,
    words: lookupWords(words),
    after_ordinal: r.ordinal,
  };
  const record = { format: 'loka-obs-v1', event: 'target.unresolved', store: 'diagnostics' };
  append('diagnostics', r.ids.run_id, line({ ...record, ids: r.ids, data }));
}
