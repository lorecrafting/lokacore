// Toolbox row G11: an NPC's disposition toward the player, derived when read from its declared
// conditions (NpcDefinition.disposition), never stored; read by talk (dialogue/selection.ts),
// trade (commerce/shared.ts) and entry (movement/sequence.ts, engage below).
import type { CharacterId, CommandId, DeltaOp, EntityId, Text } from '../contracts.gen.ts';
import { add } from '../foundation/int.ts';
import { cmp } from '../foundation/validate.ts';
import {
  bodyOf,
  event,
  refString,
  type Event,
  type Mint,
  type Steps,
  type World,
  type NpcEntity,
} from '../runtime/decision.ts';
import { holds } from './policy.ts';
import { living } from './death/shared.ts';
import { engaged, encounterId, npcRef } from './combat/shared.ts';
import { jobId } from './schedule/daily.ts';
import { attacked } from './crow/behavior.ts';
import { running } from './scene/shared.ts';
import { activeStatuses, concealed, cureOps } from './status/shared.ts';
import { separate } from './escort/shared.ts';

export type Disposition = 'hostile' | 'wary' | 'friendly';

/**
 * `npc`'s disposition toward `actor`: hostile while its hostile condition holds, else friendly
 * while its friendly one holds, else wary (also for anything without a disposition). Each
 * condition reads `actor` as the actor and `npc` as the target; each leaf adds to `steps.n`.
 */
export function disposition(
  world: World,
  actor: CharacterId,
  npc: EntityId | undefined,
  steps: Steps = { n: 0 },
): Disposition {
  const d = npc === undefined ? undefined : (world.entities[npc] as NpcEntity)?.disposition;
  const ctx = { target: npc, steps };
  if (d?.hostile && holds(world, actor, d.hostile, ctx)) return 'hostile';
  return d?.friendly && holds(world, actor, d.friendly, ctx) ? 'friendly' : 'wary';
}

type Actor = { readonly id: CommandId; readonly payload: { readonly actor_id: CharacterId } };

/**
 * The encounter a hostile NPC opens on the actor's body walking into `there` (`hostileAt`), as
 * Attack opens one: the first round at now + the interval, no draw; the receipt says `engage`.
 * An NPC declaring `arrest` (toolbox row 35) instead moves the body to `arrest.to`, saying its
 * narration, with one entity_entered_room at `position`; nothing when `there` is `to` or
 * `arrests` is false (the caller's fall).
 */
export function engage(
  world: World,
  command: Actor,
  body: EntityId,
  there: EntityId,
  mint: Mint,
  steps: Steps,
  position: number,
  arrests = true,
): { ops: DeltaOp[]; narration: Text[]; events: Event<'entity_entered_room'>[] } {
  const actor = command.payload.actor_id;
  const npc = hostileAt(world, actor, there, steps, arrests);
  const d = npc && (world.entities[npc] as NpcEntity).disposition!;
  const to = d?.arrest && world.roomIds[refString(d.arrest.to)];
  const ops = to
    ? [arrived(body, there, to), ...separate(world, actor, 0)]
    : npc
      ? opened(world, actor, body, npc, mint, world.state.clock)
      : [];
  if (!ops.length) return { ops: [], narration: [], events: [] };
  // Row 16: a spotted entrant is caught; its concealment ends with the encounter or the arrest.
  const hiding = activeStatuses(world, body)
    .filter(({ spec }) => spec.concealment)
    .map(({ status }) => status);
  return {
    ops: [...ops, ...cureOps(world, body, hiding)],
    narration: [{ key: to ? d!.arrest!.narration : d!.engage! }],
    events: to
      ? [
          event(world, command, mint, position, {
            type: 'entity_entered_room',
            entity_id: body,
            room_id: to,
          }),
        ]
      : [],
  };
}

const arrived = (body: EntityId, there: EntityId, to: EntityId) =>
  ({
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: body,
    source_id: there,
    destination_id: to,
  }) as const;

/**
 * The first NPC in `there`, in EntityId order, living, unengaged, with an attack and an engage
 * line (with combat) or an arrest (row 35), hostile to `actor` and seeing its body (status
 * reader 8); none in a sanctuary or during a scene.
 * ponytail: read before the move's own writes (the room, an expedition's faction fact), so a room- or presence-relative
 * leaf reads the room left; read after them when a sampler needs one.
 */
function hostileAt(
  world: World,
  actor: CharacterId,
  there: EntityId,
  steps: Steps,
  arrests: boolean,
) {
  if (world.rooms[there]?.sanctuary || running(world, actor)) return;
  const combat = !!world.cartridge.world?.combat;
  const candidates = Object.keys(world.entities)
    .filter((id) => {
      const npc = world.entities[id] as NpcEntity;
      return (
        world.state.containers[id] === there &&
        ((combat && npc.attack && npc.hp && npc.disposition?.engage) || // no hp, no fight (loka-xyyd)
          // An arrest skipped (a fall, or `to` is this room) lets a later fighter engage.
          (arrests &&
            npc.disposition?.arrest &&
            world.roomIds[refString(npc.disposition.arrest.to)] !== there)) &&
        living(world, id) &&
        !engaged(world, id as EntityId) &&
        !concealed(world, bodyOf(world, actor)!, id as EntityId) // status reader 8
      );
    })
    .sort(cmp) as EntityId[];
  return candidates.find((id) => disposition(world, actor, id, steps) === 'hostile');
}

/** `npc`'s encounter with `actor`'s body in its room, the first round an interval after `from`
 * (row 29b, loka-kgd.101: a spell's hit, from the cast's end); none for an NPC without a round job. */
export function opened(
  world: World,
  actor: CharacterId,
  body: EntityId,
  npc: EntityId,
  mint: Mint,
  from: number,
): DeltaOp[] {
  const job = npcRef(world, npc);
  if (!job) return [];
  const encounter_id = encounterId(mint);
  const job_id = jobId(mint);
  return [
    {
      op: 'encounter.open',
      writer_group: 0,
      encounter_id,
      character_id: actor,
      body_id: body,
      npc_id: npc,
      room_id: world.state.containers[npc]!,
      job_id,
    },
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id,
      job,
      encounter_id,
      due_time: add(from, world.cartridge.world!.combat!.interval),
    },
    ...attacked(world, npc, encounter_id),
  ];
}
