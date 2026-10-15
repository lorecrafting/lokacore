// A status tick that takes its holder's hp to 0 (status/job.ts runStatus; row 1, G3).
import type { Command, DefinitionRef, DeltaOp, EntityId, Text } from '../../contracts.gen.ts';
import { accepted, actorOf, type Event, type Mint, type World } from '../../runtime/decision.ts';
import { prefix } from '../combat/round_attack.ts';
import { closeEncounter, engaged, lastOpponent } from '../combat/shared.ts';
import { deathSequence } from '../death/sequence.ts';
import { endStatus } from './shared.ts';

type Adjust = Extract<DeltaOp, { op: 'resource.adjust' }>;

/**
 * Close the holder's encounter (a pack keeps fighting when one member falls, as in combat's own
 * fatal round), end the status and run the death sequence after the tick's `ops` and `events`.
 */
export function fatalTick(
  visit: World,
  command: Pick<Command, 'id'>,
  ops: DeltaOp[],
  events: Event<'status_ticked' | 'status_expired'>[],
  { body, row }: { body: EntityId; row: Parameters<typeof endStatus>[2] },
  status: DefinitionRef,
  mint: Mint,
  narration: Text[],
) {
  const player = actorOf(visit, body) !== undefined;
  const fight = engaged(visit, body);
  if (fight && (player || lastOpponent(fight.row))) ops.push(...closeEncounter(visit, body));
  ops.push(endStatus(body, status, row, 0));
  const died = dies(visit, command, ops, mint);
  const all = [...events, ...died.events.map((e) => ({ ...e, position: 2 }))];
  return accepted(visit, 'job_ran', ops, all, narration, died.rng);
}

// The ordinary death sequence after a fatal tick (its first resource.adjust is the hp loss), with
// no killer; an NPC's drops roll from the world's RNG (row 8).
function dies(visit: World, command: Pick<Command, 'id'>, ops: DeltaOp[], mint: Mint) {
  const now = visit.state.clock;
  const loss = ops.find((o) => o.op === 'resource.adjust') as Adjust;
  const died = deathSequence(
    prefix(visit, ops, now),
    command,
    {
      loss,
      owner_id: actorOf(visit, loss.entity_id) ?? null,
      killer_id: null,
      credited_character_id: null,
    },
    mint,
    visit.state.rng,
  );
  ops.push(...died.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: now } : op)));
  return died;
}
