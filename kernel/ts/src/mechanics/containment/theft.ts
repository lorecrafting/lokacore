// Toolbox rows 33 and 34 (docs/system/mechanics.md, Theft, fence and witnessed offense): with
// `world.theft` declared, take may lift an item a living NPC in the actor's room directly holds.
// Containment alone sets the item's stolen fact; a seen theft emits custom_event `noticed`.
import type { CharacterId, EntityId, StateDelta } from '../../contracts.gen.ts';
import type { Event, Mint, Steps, World } from '../../runtime/decision.ts';
import { accepted, event } from '../../runtime/decision.ts';
import { npcValue } from '../attributes/shared.ts';
import { living } from '../death/shared.ts';
import { assigned } from '../fact.ts';
import { chainRefused, lockRefused } from '../locks.ts';
import { witnesses } from '../senses.ts';
import { level, practised } from '../skills.ts';
import { carrying } from './shared.ts';

/** Why `actor` may not lift `item` from its NPC holder; not_present unless theft is declared. */
export function theftRefused(
  world: World,
  actor: CharacterId,
  body: EntityId,
  item: EntityId,
  steps: Steps,
) {
  const victim = world.state.containers[item];
  const npc = world.entities[victim];
  if (
    !world.cartridge.world?.theft ||
    npc?.kind !== 'npc' ||
    world.state.containers[victim] !== world.state.containers[body] ||
    !living(world, victim)
  )
    return 'not_present' as const;
  return (
    lockRefused(world, actor, npc.locks?.get, item, steps) ??
    chainRefused(world, actor, item, 'get', steps) ??
    carrying(world, body, steps)(item)
  );
}

/** The accepted take of an admitted theft: the move, the stolen mark, one skill use, the notice. */
export function stolen(
  world: World,
  command: Parameters<typeof event>[1],
  mint: Mint,
  [body, item]: readonly [EntityId, EntityId],
  move: StateDelta['ops'],
  taken: readonly Event<'item_acquired'>[],
) {
  const theft = world.cartridge.world!.theft!;
  const [actor, victim] = [command.payload.actor_id, world.state.containers[item]];
  const run = practised(
    world,
    actor,
    assigned(
      world,
      actor,
      { ops: move, position: 1, facts: {} },
      { fact: theft.stolen, value: true, subject: item },
      'theft',
    ),
    { kind: 'opposed', skill: theft.skill },
  );
  const noticed =
    level(world, actor, theft.skill) < (npcValue(world, victim, theft.attribute) ?? 0);
  if (!noticed && witnesses(world, body, victim).length === 0)
    return accepted(world, 'taken', run.ops, taken, [{ key: theft.narration.unseen }]);
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const notice = event(world, command, mint, run.position + 1, {
    type: 'custom_event',
    event: { cartridge_id, cartridge_version, kind: 'event', key: theft.noticed },
    subject_id: victim,
  });
  return accepted(world, 'taken', run.ops, [...taken, notice], [{ key: theft.narration.seen }]);
}
