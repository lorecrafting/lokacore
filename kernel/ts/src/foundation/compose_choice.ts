import type { DeltaOp } from '../contracts.gen.ts';
import type { Outcome } from './compose.ts';
import { encode } from './canonical.ts';
import type { Json } from './canonical.ts';

export function attempt(
  op: Extract<DeltaOp, { op: 'choice.attempt' }>,
  row: Json | undefined,
): Outcome {
  const r = row as Record<string, any> | undefined;
  const a = r?.attempts;
  const ok =
    r?.status === 'pending' &&
    r.actor_id === op.actor_id &&
    encode(r.source) === encode(op.source) &&
    r.quest_instance_id === op.quest_instance_id &&
    r.opened_revision === op.expected_revision &&
    Number.isSafeInteger(a?.count) &&
    Number.isSafeInteger(a?.limit) &&
    a.limit > 0 &&
    a.count >= 0 &&
    a.count < a.limit &&
    a.count === op.prior_count;
  return ok
    ? { value: { ...r, attempts: { ...a, count: a.count + 1 } } as Json }
    : { code: 'precondition_failed' };
}

export function choice(
  op: DeltaOp & { op: `choice.${string}` },
  row: Json | undefined,
  initial?: Json,
): Outcome {
  switch (op.op) {
    case 'choice.open': {
      const { actor_id, source, beat, roles, choice_ids } = op;
      const opened = { actor_id, source, beat, roles, choice_ids, status: 'pending' };
      if (op.quest_instance_id) Object.assign(opened, { quest_instance_id: op.quest_instance_id });
      if (op.attempts) Object.assign(opened, { attempts: op.attempts });
      return check(
        row === undefined &&
          (!op.attempts ||
            (op.attempts.count === 0 &&
              Number.isSafeInteger(op.attempts.limit) &&
              op.attempts.limit > 0 &&
              !!op.quest_instance_id)),
        opened as unknown as Json,
      );
    }
    case 'choice.attempt':
      return get(get(initial, 'attempts'), 'count') === op.prior_count
        ? attempt(op, row)
        : { code: 'precondition_failed' };
    case 'choice.resolve': {
      const offered =
        get(row, 'status') === 'pending' &&
        (get(row, 'choice_ids') as string[]).includes(op.choice_id);
      const ok = offered && get(row, 'opened_revision') === op.expected_revision;
      return check(ok, put(row, { status: 'resolved', choice_id: op.choice_id }));
    }
    default:
      return check(get(row, 'status') === 'pending', put(row, { status: 'closed' }));
  }
}

export const pendingAtLimit = (value: Json) => {
  const r = value as any;
  return r.status === 'pending' && r.attempts?.count >= r.attempts?.limit;
};

const get = (row: Json | undefined, field: string) => (row as any)?.[field];
const put = (row: Json | undefined, value: object): Json =>
  ({ ...(row as object), ...value }) as Json;
const check = (ok: boolean, value: Json): Outcome =>
  ok ? { value } : { code: 'precondition_failed' };
