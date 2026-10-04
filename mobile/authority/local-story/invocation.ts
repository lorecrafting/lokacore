// One privately preflighted player invocation behind a fixed elapsed horizon.
import { encode, decode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  identify,
  resolve,
  INTENT_DIGEST_VERSION,
  type Identified,
} from '../../../kernel/ts/src/commands/invocation.ts';
import { step } from '../../../kernel/ts/src/runtime/world.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { Reply } from './authority.ts';
import type { ClockDriver } from './elapsed.ts';
import { fenced, traceAfter, reached } from './delivery.ts';
import { budget, ids, save, scope, stale, token, type Story, type Trace } from './save.ts';
import { receipt } from './store.ts';
import { observe } from './trace.ts';
import type { ActionInvocation } from '../../../kernel/ts/src/contracts.gen.ts';
import type { Intent, Reply as SharedReply } from '../../packages/game-view/session.ts';
export const SESSION_ID_PREFIX = '00000000-0000-4000-8000-';
export type SessionAttempt = { invocation?: ActionInvocation; catching: boolean; sent: number };
const copied = (i: ActionInvocation) => decode(encode(i as never)) as unknown as ActionInvocation;

/** The shared session retains only validated bounded data; an unknown save retries its original. */
export function sessionInvoke(
  held: SessionAttempt,
  actor_id: ActionInvocation['actor_id'],
  intent: Intent,
  attempt: () => SharedReply,
): SharedReply {
  if (held.invocation && !held.catching) return attempt();
  const value = {
    ...intent,
    actor_id,
    invocation_id:
      held.invocation?.invocation_id ??
      (`${SESSION_ID_PREFIX}${(++held.sent).toString(16).padStart(12, '0')}` as ActionInvocation['invocation_id']),
  };
  const errors = validate('ActionInvocation', value);
  if (held.invocation) {
    if (errors.length) return { kind: 'invalid' };
    if (intentBytes(value) !== intentBytes(held.invocation)) return { kind: 'conflict' };
  } else held.invocation = errors.length ? value : copied(value);
  return attempt();
}
const intentBytes = (i: ActionInvocation) =>
  encode([i.action_key, i.actor_id, i.target_ids, i.input] as never);

type Reservation = { id: Identified; run_id: string; target: number };
const reservations = new WeakMap<Story, Reservation>();
export function invoke(s: Story, value: unknown, driver?: ClockDriver): Reply {
  s.beforeWorld = s.world;
  s.beforeToken = token(s);
  if (fenced(s) || (driver && !driver.check(s.meta.run_id))) return { kind: 'pending' };
  const id = identify(scope(s), s.world.character, value);
  if (id.kind !== 'identified') return id;
  const { invocation: i, command_id, intent_digest } = id;
  const old = receipt(s.db, scope(s), i.invocation_id);
  // ponytail: one digest version; a receipt of another fails closed until a second exists.
  const same = old?.intent_digest_version === INTENT_DIGEST_VERSION;
  if (old) {
    const intact = !validate('DecisionResult', old.response).length; // never decided again
    if (!same || !intact || old.intent_digest !== intent_digest) return { kind: 'conflict' };
    if (reservations.get(s)?.id.invocation.invocation_id === i.invocation_id)
      reservations.delete(s);
    return { kind: 'saved', replay: true, revision: old.revision, decision: old.response };
  }
  return reserved(s, id, driver);
}

function reserved(s: Story, id: Identified, driver?: ClockDriver): Reply {
  const { invocation: i, intent_digest } = id;
  const held = reservations.get(s);
  if (
    held &&
    (held.run_id !== s.meta.run_id ||
      held.id.invocation.invocation_id !== i.invocation_id ||
      held.id.intent_digest !== intent_digest)
  )
    return { kind: 'conflict' };
  if (!held && stale(s, i.view_freshness_token)) return { kind: 'stale_view' };
  if (driver) {
    if (!held) {
      // Copy only bounded intent data so callers cannot mutate a preflighted reservation.
      const privateId = { ...id, invocation: copied(i) };
      reservations.set(s, { id: privateId, run_id: s.meta.run_id, target: -1 });
    }
    const reserved = reservations.get(s)!;
    const status =
      reserved.target < 0
        ? driver.reserve(reserved.run_id)
        : driver.pulse('drain', reserved.run_id);
    if (reserved.target < 0) reserved.target = driver.target();
    if (status.kind === 'pending') return { kind: 'pending' };
    if (status.kind === 'fault') {
      reservations.delete(s);
      return status;
    }
    if (s.world.state.clock < reserved.target)
      return { kind: 'catching_up', invocation_id: i.invocation_id };
    return finish(s, reserved.id);
  }
  return finish(s, id);
}

function finish(s: Story, id: Identified): Reply {
  s.beforeWorld = s.world;
  s.beforeToken = token(s);
  const { invocation: i, command_id, intent_digest } = id;
  const { command, next, timed } = decided(s, id);
  const d = next.decision;
  // A rejection before a Command existed has no trace entry: TraceEntry needs the Command.
  const trace: Trace = (at, ...states) => {
    if (!('kind' in command)) traceAfter(s, command, d, at, states);
  };
  if (d.kind === 'fault') {
    trace(s.revision, 'unavailable');
    if (next.limit) observe(s.db, budget(s, command_id, next.limit));
    reservations.delete(s);
    return timed({ kind: 'fault', code: d.code });
  }
  // ponytail: no rule emits effects yet; the outbox (03 §16) comes with the first that does.
  if (d.kind === 'accepted' && d.effects.length) throw new Error('effect outbox not built');
  const r = { scope: scope(s), invocation_id: i.invocation_id, command_id, actor_id: i.actor_id };
  const reply = save(s, next, trace, reached(s, d, s.revision + 1), {
    ...r,
    intent_digest_version: INTENT_DIGEST_VERSION,
    intent_digest,
    command: 'kind' in command ? null : (command as never),
    revision: d.kind === 'accepted' ? s.revision + 1 : s.revision,
    response: d as never,
  });
  if (reply.kind !== 'pending') reservations.delete(s);
  return timed(reply); // not if pending: the sink's transaction would roll back the open COMMIT
}

// A NEW invocation resolved and decided (03 §14); `timed` observes how long (11 §13) if clocked.
function decided(s: Story, id: Identified) {
  const t0 = s.host.latency?.now();
  const command = resolve(s.world, id);
  const next: ReturnType<typeof step> =
    'kind' in command
      ? { world: s.world, decision: command }
      : step(s.world, command, s.revision + 1, id.invocation.action_key);
  const value = s.host.latency && Math.round((s.host.latency.now() - t0!) * 1000);
  const { kernel_version, run_id } = ids(s);
  const head = { format: 'loka-obs-v1', event: 'kernel.decision_latency', store: 'operations' };
  const timed = (reply: Reply) => {
    if (s.host.latency && reply.kind !== 'pending')
      observe(s.db, {
        ...head,
        ids: { kernel_version, host: s.host.latency.host, run_id, command_id: id.command_id },
        data: { state: 'observed', value },
      });
    return reply;
  };
  return { command, next, timed };
}

export const cancel = (s: Story) => reservations.delete(s);
