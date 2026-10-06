import { defenseEvidence } from './combat-receipt.ts';
// The local Story authority's in-memory story and the save of one NEW attempt (03 §§14-15):
// commit, then adopt, or fence an unknown COMMIT until the store settles it.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import type { NarrationRecord } from '../../packages/game-view/session.ts';
import { dreamDetail } from './dream-receipt.ts';
import { dialogueDetail } from './dialogue-receipt.ts';
import { detailOf } from '../../../kernel/ts/src/commands/actions.ts';
import { bodyOf } from '../../../kernel/ts/src/runtime/decision.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Host, Release, Reply } from './authority.ts';
import { commit, load, receipt, reconcile, identityOf } from './store.ts';
import type { Captured, Db, Meta, Receipt } from './store.ts';
import {
  ElapsedRecoveryError,
  changedRun,
  readElapsed,
  sameCheckpoint,
  type Checkpoint,
} from './elapsed-store.ts';
import type { CommitState, RunIds } from './trace.ts';

export type Trace = (at: number, ...states: CommitState[]) => void;
export type Story = {
  readonly db: Db;
  readonly releases: readonly [Release, ...Release[]];
  fresh: World; // the open save's release
  readonly host: Host;
  world: World;
  revision: number;
  meta: Meta; // undefined only on a corrupt save, until its new game is adopted
  // The fence of a new game whose COMMIT outcome is unknown, and its run.
  game?: { fence: () => undefined; run_id: string } | undefined;
  elapsed?: Checkpoint;
  corruptFile?: boolean; // actual SQLite corruption while opening, never an invented identity
  recoveryHeader?: { format: string; run_id?: string } | null;
  beforeWorld?: World;
  beforeToken?: string;
  blocked?: ElapsedRecoveryError;
  behind: boolean; // the trace misses a committed entry or its header; catch up before the next
  // Settles the attempt whose COMMIT outcome is unknown, throwing while it still is; no decision
  // runs until it has.
  fence?: (() => Receipt | undefined) | undefined;
};

/** Commits a NEW attempt's decision, then adopts it; the reply never claims an unknown save. */
export function save(
  s: Story,
  next: { world: World; decision: DecisionResult },
  trace: Trace,
  reports: Captured[],
  r: Receipt,
  checkpoint?: Checkpoint,
): Reply {
  const at = r.revision;
  let committed: boolean;
  try {
    committed = commit(s.db, next.world, next.decision, r, reports, checkpoint);
  } catch (e) {
    if (e instanceof ElapsedRecoveryError) block(s, e);
    trace(at, 'failed');
    throw e;
  }
  if (committed) {
    [s.world, s.revision] = [next.world, at];
    if (checkpoint) s.elapsed = checkpoint;
    trace(at, 'committed');
    return { kind: 'saved', replay: false, revision: at, decision: r.response };
  }
  s.fence = () => {
    const got = reconciled(s, r, checkpoint);
    if (got) adopt(s);
    // Traced once settled, with its follow-up; a process that dies while fenced traces neither.
    trace(at, 'unknown', got ? 'committed' : 'failed');
    return got;
  };
  let settled: Receipt | undefined;
  try {
    settled = settle(s);
  } catch (e) {
    if (e instanceof ElapsedRecoveryError) block(s, e);
    return { kind: 'pending' };
  }
  if (!settled) throw new Error('COMMIT failed; nothing was saved');
  return { kind: 'saved', replay: false, revision: settled.revision, decision: settled.response };
}

function reconciled(s: Story, r: Receipt, checkpoint?: Checkpoint) {
  return reconcile(s.db, () => {
    if (s.elapsed) {
      const changed = changedRun(identityOf(s.db), s.meta.run_id);
      if (changed) throw changed;
    }
    const got = receipt(s.db, r.scope, r.invocation_id);
    if (s.elapsed) {
      const row = readElapsed(s.db, s.meta.run_id, s.world.state.clock);
      if (!row || !sameCheckpoint(row, got ? (checkpoint ?? s.elapsed) : s.elapsed))
        throw new ElapsedRecoveryError(
          'save_corrupt',
          'unexpected elapsed checkpoint; recovery required',
        );
    }
    return got;
  });
}

/** The fenced attempt's receipt once settled from the store, undefined if not committed. */
export function settle(s: Story): Receipt | undefined {
  const r = s.fence!(); // throws while still unknown
  s.fence = undefined;
  return r;
}

/** Memory takes the saved head, identity and world, after a commit it did not write itself. */
export function adopt(s: Story) {
  const saved = load(s.db, s.fresh, () => {
    throw new Error('no save');
  });
  if (!saved) throw new ElapsedRecoveryError('save_corrupt', 'save corrupt');
  Object.assign(s, saved);
}

/**
 * The latest committed narration in this story's receipts, shown again on reopen after a crash
 * before display (06 §43): read from storage, never memory; no acknowledgement is stored. None
 * while a transaction is open (an unknown COMMIT whose ROLLBACK failed).
 */
export function narration(s: Story, command_id?: string): NarrationRecord | undefined {
  if (s.db.isInTransactionSync()) return undefined; // its rows may be uncommitted (03 §15)
  let before: number | null = null;
  while (true) {
    const r: {
      revision: number;
      command_id: string;
      command: string;
      response: string;
    } | null = s.db.getFirstSync(
      `SELECT revision, command_id, command, response FROM receipt WHERE scope = ?
       AND (json_array_length(response, '$.narration') > 0
         OR json_extract(response, '$.outcome') = 'taken')
       AND (? IS NULL OR command_id = ?)
       AND (? IS NULL OR revision < ?) ORDER BY revision DESC LIMIT 1`,
      scope(s),
      command_id ?? null,
      command_id ?? null,
      before,
      before,
    );
    if (!r) return undefined;
    const d = JSON.parse(r.response) as Extract<DecisionResult, { kind: 'accepted' }>;
    if (!Array.isArray(d.events) || d.events.some((e) => typeof e?.payload?.type !== 'string'))
      throw new Error('malformed JSON: invalid committed event evidence');
    defenseEvidence(d.events);
    const root =
      ['engaged', 'fled'].includes(d.outcome) &&
      d.delta.ops.some(
        (o) => o.writer_group === 0 && (o.op === 'encounter.open' || o.op === 'encounter.close'),
      );
    const keys = d.events.some((e) => e.payload.type === 'attack_result')
      ? Object.values(s.world.cartridge.world?.combat?.narration ?? {})
      : [];
    const packKeys = Object.values(s.world.cartridge.populations ?? {}).flatMap((plan) => {
      const n = plan.pack?.narration;
      return n
        ? [n.helper_joined, n.primary_changed, n.pack_withdrew, ...Object.values(n.enemy_fled)]
        : [];
    });
    const lines = d.narration ?? [];
    const combat_lines = lines.flatMap((line, i) =>
      root || keys.includes(line?.key) || packKeys.includes(line?.key) ? [i] : [],
    );
    const pickup = corpsePickup(s, r, d);
    if (!lines.length && !pickup) {
      if (command_id) return undefined;
      before = r.revision;
      continue;
    }
    const detail_id = pickup?.corpse_id ?? receiptDetail(s, r, d);
    return {
      command_id: r.command_id,
      lines,
      ...(combat_lines.length && { combat_lines }),
      ...(detail_id && { detail_id }),
      ...(pickup && { pickup_name: s.world.entities[pickup.item_id].short }),
    } as NarrationRecord;
  }
}

function corpsePickup(
  s: Story,
  r: { command_id: string; command: string },
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  if (d.kind !== 'accepted' || d.outcome !== 'taken') return;
  const command = JSON.parse(r.command) as Command;
  const p = command?.payload;
  if (validate('Command', command).length || command.id !== r.command_id || p.type !== 'take')
    throw new Error('malformed JSON: invalid committed Take');
  const transfer = d.delta.ops.find((o) => o.op === 'entity.transfer' && o.entity_id === p.item_id);
  if (transfer?.op !== 'entity.transfer' || !transfer.source_id) return;
  const corpse = s.world.state.created?.[transfer.source_id];
  if (corpse?.origin.kind !== 'death') return;
  const body = bodyOf(s.world, p.actor_id);
  if (
    transfer.destination_id !== body ||
    !d.events.some(
      (e) =>
        e.causation_id === r.command_id &&
        e.payload.type === 'item_acquired' &&
        e.payload.item_id === p.item_id &&
        e.payload.holder_id === body,
    )
  )
    throw new Error('malformed JSON: invalid corpse pickup evidence');
  return { corpse_id: transfer.source_id, item_id: p.item_id };
}

// Routing belongs to this receipt's committed command/evidence, never text or current room.
function receiptDetail(
  s: Story,
  r: { command_id: string; command: string },
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  if (d.kind !== 'accepted') return;
  const command = JSON.parse(r.command) as Command | null;
  const dream = dreamDetail(s, command);
  if (dream) return dream;
  if (
    command?.payload?.type === 'choose' ||
    d.outcome === 'riddle_wrong' ||
    d.events.some((e) => e.causation_id === r.command_id && e.payload.type === 'choice_resolved')
  )
    return dialogueDetail(s, r.command_id, command!, d);
  if (command?.payload?.type === 'buy' || command?.payload?.type === 'sell') {
    if (validate('Command', command).length || command.id !== r.command_id)
      throw new Error('malformed JSON: invalid committed shop exchange');
    return command.payload.provider_id;
  }
  if (command?.payload?.type === 'use_transport') {
    if (
      validate('Command', command).length ||
      command.id !== r.command_id ||
      d.outcome !== 'transport_used'
    )
      throw new Error('malformed JSON: invalid committed transport');
    return command.payload.endpoint_id;
  }
  if (command?.payload?.type === 'use_service') {
    if (
      validate('Command', command).length ||
      command.id !== r.command_id ||
      d.outcome !== 'service_used'
    )
      throw new Error('malformed JSON: invalid committed service');
    return command.payload.provider_id;
  }
  if (d.outcome === 'harvested' && command?.payload?.type === 'harvest')
    return command.payload.target_id;
  const p = command?.payload;
  if (p?.type === 'fill' || p?.type === 'pour' || p?.type === 'drink') {
    if (validate('Command', command).length || command?.id !== r.command_id)
      throw new Error('malformed JSON: invalid committed liquid action');
    return p.type === 'drink' ? p.vessel_id : p.source_id;
  }
  return readableDetail(s, r, command, d);
}

// The run is in it, so an old run's token is never current again after newGame.
export const token = (s: Story) => `view:${s.meta.run_id}:${s.revision}`;
export const stale = (s: Story, view?: string) => !!view?.startsWith('view:') && view !== token(s);
export const scope = (s: Story) => `story/${s.meta.lineage_id}/${s.world.character}`;
export const ids = (s: Story): RunIds => ({
  content_hash: s.meta.pin.content_hash,
  kernel_version: s.host.kernel_version,
  seed: s.meta.seed as number[],
  run_id: s.meta.run_id,
});

/** A budget fault's evaluation.budget_exceeded (04 §5.4): the run's ids, its command and revision. */
export const budget = (s: Story, command_id: string, limit: string) => ({
  format: 'loka-obs-v1',
  event: 'evaluation.budget_exceeded',
  store: 'diagnostics',
  ids: { ...ids(s), command_id, revision: s.revision },
  data: { limit },
});

export function block(s: Story, e: ElapsedRecoveryError): never {
  s.blocked = e;
  s.fence = undefined;
  throw e;
}

function readableDetail(
  s: Story,
  r: { command_id: string },
  command: Command | null,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  if (!['read', 'performed', 'success'].includes(d.outcome)) return;
  if (d.outcome === 'read') {
    if (
      validate('Command', command).length ||
      command?.id !== r.command_id ||
      command.payload.type !== 'read'
    )
      throw new Error('malformed JSON: invalid committed Read');
    return command.payload.target_id;
  }
  return recipeDetail(s, r, command, d);
}

function recipeDetail(
  s: Story,
  r: { command_id: string },
  command: Command | null,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  const completed = d.events.filter(
    (e) => e.payload.type === 'action_completed' && e.causation_id === r.command_id,
  );
  const action = command?.payload?.type === 'perform' ? command.payload.action : undefined;
  const recipe = Object.values(s.world.cartridge.recipes ?? {}).find((r) => r.key === action);
  const subject = recipe && detailOf(s.world, recipe.target);
  const readable = subject && s.world.details[subject]?.readable;
  const readableEvidence = completed.some(
    (e) => e.payload.type === 'action_completed' && s.world.details[e.payload.subject_id]?.readable,
  );
  if (!readable && !readableEvidence) return;
  const event = completed[0];
  if (
    validate('Command', command).length ||
    command?.id !== r.command_id ||
    !readable ||
    completed.length !== 1 ||
    event.payload.type !== 'action_completed' ||
    event.payload.action !== action ||
    event.payload.subject_id !== subject ||
    (command?.payload?.type === 'perform' && event.actor_id !== command.payload.actor_id) ||
    (command?.payload?.type === 'perform' &&
      command.payload.target_id !== undefined &&
      command.payload.target_id !== subject)
  )
    throw new Error('malformed JSON: invalid readable recipe receipt');
  return subject;
}
