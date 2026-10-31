// Quest offers as actions of the set, and what an offer's target adds (loka-vx2v; cartridge.md
// Quest offer target).
import type {
  CharacterId,
  DefinitionRef,
  EntityId,
  Key,
  QuestDefinition,
  ScriptedTarget,
} from '../contracts.gen.ts';
import { bodyOf, refString, type World } from '../runtime/decision.ts';
import { living } from '../mechanics/death/shared.ts';
import { questOf } from '../mechanics/lookups.ts';
import type { Offered } from './actions.ts';

type OfferTarget = NonNullable<NonNullable<QuestDefinition['offer']>['target']>;

/** The target id of a scripted action's detail (the compiler checks it exists). */
export const detailOf = (world: World, t: Extract<ScriptedTarget, { kind: 'detail' }>): EntityId =>
  Object.keys(world.details).find(
    (id) =>
      world.details[id].room === world.roomIds[refString(t.room)] &&
      world.details[id].key === t.detail,
  ) as EntityId;

// What a quest offer's target adds to it; undefined drops the offer, its target not here.
function offerOn(world: World, actor: CharacterId, t?: OfferTarget): Partial<Offered> | undefined {
  if (!t) return {};
  const here = world.state.containers[bodyOf(world, actor)!];
  if (t.kind === 'detail') {
    // The room first: this runs per resolved() and the scan rarely matches this room.
    return world.roomIds[refString(t.room)] === here ? { detail: detailOf(world, t) } : undefined;
  }
  const speaker = world.entityIds[refString(t.npc)]!;
  if (!living(world, speaker) || world.state.containers[speaker] !== here) return undefined;
  return { speaker, target: { kind: 'entity', scopes: ['room_occupants'] } };
}

/** The actor's open quest offers, each `accept_quest` of its quest. */
export function questOffers(world: World, actor: CharacterId): [string, Offered][] {
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  return Object.values(world.cartridge.quests ?? {}).flatMap(({ key, offer }) => {
    const quest = { cartridge_id, cartridge_version, kind: 'quest', key } as DefinitionRef;
    if (!offer || questOf(world, actor, quest)) return [];
    const on = offerOn(world, actor, offer.target);
    if (!on) return [];
    const command = 'accept_quest' as Key;
    const o = {
      key,
      ...offer,
      target: { kind: 'none' },
      ...on,
      input: [],
      priority: 0,
      command,
      quest,
    };
    return [[key, o] as [string, Offered]];
  });
}
