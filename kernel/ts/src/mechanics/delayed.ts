// Row FD1 (docs/system/mechanics.md, delayed reactions): a reaction job's run_job.
import type {
  CharacterId,
  CommandId,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  JobId,
} from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';
import {
  accepted,
  refString,
  type Decision,
  type Mint,
  type Steps,
  type World,
} from '../runtime/decision.ts';
import { sequence } from './reaction.ts';

/** The advance's writer group of each row written so far (proposal.ts holders) and its latest
 * group; the run takes the next one. Its fire counts in the advance's delivery and step budget. */
export type Joins = {
  holders: Map<string, number>;
  group: number;
  deliveries: number;
  steps: Steps;
};

/** The job completes; then its rule runs for the stored actor at the due time, as a delivery whose
 * event has no subject. A rule gone from the cartridge, a `when` that fails then, or a step that
 * faults or throws then (a quest no longer active, a durable fact), writes only the completion: a
 * pending job would fault every later advance (a fact guard cancels it). */
export function runDelayed(
  world: World,
  command: { id: CommandId },
  job_id: JobId,
  row: { job: DefinitionRef; actor_id?: CharacterId; due_time: number },
  mint: Mint,
  steps: Steps,
  joins: Joins = { holders: new Map(), group: -1, deliveries: 0, steps },
): Decision<never> {
  const { holders, group: last } = joins;
  joins.deliveries++;
  const group = last + 1;
  const done: DeltaOp = { op: 'job.complete', writer_group: group, job_id };
  const rule = world.cartridge.reactions?.[refString(row.job)];
  // A stand-in cause: no subject field (custom_event names none), the job's time.
  const cause = { id: command.id, logical_time: row.due_time, position: 0 };
  const stand = { ...cause, payload: { type: 'custom_event' } } as unknown as DomainEvent;
  const ran =
    rule &&
    fire(() =>
      sequence(world, row.actor_id!, rule, stand, group, joins.steps, mint, {
        holders,
        fired: true,
      }),
    );
  const ok = ran?.kind === 'accepted' ? ran : undefined;
  const [ops, events] = ok ? [ok.delta.ops, ok.events] : [[], []];
  return accepted(world, 'job_ran', [done, ...ops], events as never[], ok?.narration);
}

function fire<T>(run: () => T): T | undefined {
  try {
    return run();
  } catch (e) {
    if (!(e instanceof KernelError)) throw e;
    return undefined;
  }
}
