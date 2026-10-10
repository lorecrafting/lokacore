// Toolbox row G11: an NPC's disposition toward the player, derived when read from its declared
// conditions (NpcDefinition.disposition), never stored; read by talk (dialogue/selection.ts),
// trade (commerce/shared.ts) and entry (movement/sequence.ts, engage below).
import type { CharacterId, DeltaOp, EntityId, NpcDefinition, Text } from '../contracts.gen.ts';
import { add } from '../foundation/int.ts';
import { cmp } from '../foundation/validate.ts';
import { type Mint, type Steps, type World } from '../runtime/decision.ts';
import { holds } from './policy.ts';
import { living } from './death/shared.ts';
import { engaged, encounterId, npcRef } from './combat/shared.ts';
import { jobId } from './schedule/behavior.ts';
import { attacked } from './crow/behavior.ts';
import { running } from './scene/shared.ts';

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
  const d = npc === undefined ? undefined : (world.entities[npc] as NpcDefinition)?.disposition;
  const ctx = { target: npc, steps };
  if (d?.hostile && holds(world, actor, d.hostile.root, ctx)) return 'hostile';
  return d?.friendly && holds(world, actor, d.friendly.root, ctx) ? 'friendly' : 'wary';
}

/**
 * The encounter a hostile NPC opens on `actor`'s body walking into `there` (`hostileAt`), as
 * Attack opens one: the first round at now + the interval, no draw; the receipt says `engage`.
 */
export function engage(
  world: World,
  actor: CharacterId,
  body: EntityId,
  there: EntityId,
  mint: Mint,
  steps: Steps,
): { ops: DeltaOp[]; narration: Text[] } {
  const npc = hostileAt(world, actor, there, steps);
  const job = npc && npcRef(world, npc);
  if (!npc || !job) return { ops: [], narration: [] };
  const encounter_id = encounterId(mint);
  const job_id = jobId(mint);
  return {
    ops: [
      {
        op: 'encounter.open',
        writer_group: 0,
        encounter_id,
        character_id: actor,
        body_id: body,
        npc_id: npc,
        room_id: there,
        job_id,
      },
      {
        op: 'job.schedule',
        writer_group: 0,
        job_id,
        job,
        encounter_id,
        due_time: add(world.state.clock, world.cartridge.world!.combat!.interval),
      },
      ...attacked(world, npc, encounter_id),
    ],
    narration: [{ key: (world.entities[npc] as NpcDefinition).disposition!.engage! }],
  };
}

/**
 * The first NPC in `there`, in EntityId order, living, unengaged, with an attack and an engage
 * line, hostile to `actor`; none in a sanctuary, during a scene or without combat.
 * ponytail: read before the move's own writes (the room, an expedition's faction fact), so a room- or presence-relative
 * leaf reads the room left; read after them when a sampler needs one.
 */
function hostileAt(world: World, actor: CharacterId, there: EntityId, steps: Steps) {
  if (!world.cartridge.world?.combat || world.rooms[there]?.sanctuary || running(world, actor))
    return;
  const candidates = Object.keys(world.entities)
    .filter((id) => {
      const npc = world.entities[id] as NpcDefinition;
      return (
        world.state.containers[id] === there &&
        npc.attack &&
        npc.disposition?.engage &&
        living(world, id) &&
        !engaged(world, id as EntityId)
      );
    })
    .sort(cmp) as EntityId[];
  return candidates.find((id) => disposition(world, actor, id, steps) === 'hostile');
}
