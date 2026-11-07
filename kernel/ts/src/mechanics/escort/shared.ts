import type {
  CharacterId,
  ContinuationId,
  DeltaOp,
  DefinitionRef,
  DialogueChoice,
  EntityId,
  EscortRelation,
  Key,
} from '../../contracts.gen.ts';
import {
  bodyOf,
  refString,
  type ChoiceRow,
  type World,
  type NpcEntity,
} from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { living, npcsIn } from '../death/shared.ts';
import { questOf } from '../lookups.ts';
import { value } from '../fact.ts';

/** Policy and journal selectors address this actor's exact quest instance. */
export function stateIs(
  world: World,
  actor: CharacterId,
  quest: DefinitionRef,
  state: EscortRelation['status'],
) {
  const escort = world.state.escorts?.[actor];
  return (
    escort?.actor_id === actor &&
    escort.status === state &&
    escort.quest_instance_id === questOf(world, actor, quest)?.[0]
  );
}

/** The retained accepted start proves which NPC this relation follows. */
function original(world: World, escort: EscortRelation) {
  const row = world.state.choices?.[escort.continuation_id];
  const dialogue = row && world.cartridge.dialogues?.[refString(row.source)];
  const effect = dialogue?.choices[escort.choice_id]?.escort;
  const quest = world.state.quests?.[escort.quest_instance_id];
  return (
    row?.status === 'resolved' &&
    row.choice_id === escort.choice_id &&
    row.actor_id === escort.actor_id &&
    effect?.transition === 'start' &&
    row.roles.find((r) => r.role === effect.npc)?.entity_id === escort.npc_id &&
    quest?.scope.kind === 'player' &&
    quest.scope.character_id === escort.actor_id &&
    same(quest.quest, effect.quest)
  );
}

/** A repeatable quest's next acceptance deletes the row this names: that escort has ended (escort@1). */
const retired = (world: World, escort: EscortRelation) =>
  !world.state.quests?.[escort.quest_instance_id];

/** Shared pending-option and Choose admission; only this effect requires the original authored NPC. */
export function refused(world: World, row: ChoiceRow, option: DialogueChoice) {
  const effect = option.escort;
  if (!effect) return;
  const dialogue = world.cartridge.dialogues![refString(row.source)];
  const role = dialogue.roles[effect.npc];
  const npc = row.roles.find((r) => r.role === effect.npc)?.entity_id;
  const body = bodyOf(world, row.actor_id);
  if (!body || role?.role !== 'npc' || npc !== world.entityIds[refString(role.npc)])
    return 'invalid_state' as const;
  if (!living(world, npc) || world.state.containers[npc] !== world.state.containers[body])
    return 'not_present' as const;
  const quest = questOf(world, row.actor_id, effect.quest);
  if (!quest || quest[1].state !== 'active') return 'invalid_state' as const;
  const escort = world.state.escorts?.[row.actor_id];
  if (effect.transition === 'start')
    return escort && (escort.status === 'following' || !retired(world, escort))
      ? ('invalid_state' as const)
      : undefined;
  if (
    !escort ||
    !original(world, escort) ||
    escort.actor_id !== row.actor_id ||
    escort.body_id !== body ||
    escort.npc_id !== npc ||
    escort.quest_instance_id !== quest[0] ||
    escort.status !== (effect.transition === 'rejoin' ? 'separated' : 'following')
  )
    return 'invalid_state' as const;
}

/** Lower the already-admitted effect beside its facts, quest and choice resolution. */
export function transition(
  world: World,
  row: ChoiceRow,
  option: DialogueChoice,
  continuation_id: ContinuationId,
  choice_id: Key,
): DeltaOp[] {
  const effect = option.escort;
  if (!effect) return [];
  const expected = world.state.escorts?.[row.actor_id] ?? null;
  const status = effect.transition === 'complete' ? 'completed' : 'following';
  const value: EscortRelation =
    expected && effect.transition !== 'start'
      ? { ...expected, status }
      : {
          kind: 'escort',
          actor_id: row.actor_id,
          body_id: bodyOf(world, row.actor_id)!,
          npc_id: row.roles.find((r) => r.role === effect.npc)!.entity_id,
          quest_instance_id: questOf(world, row.actor_id, effect.quest)![0],
          continuation_id,
          choice_id,
          status,
        };
  return [{ op: 'escort.transition', writer_group: 0, actor_id: row.actor_id, expected, value }];
}

/** A following escort stays with its player (escort@1: no NPC move detaches it). */
export function escorting(world: World, npc: EntityId) {
  return Object.values(world.state.escorts ?? {}).some(
    (e) => e?.npc_id === npc && e.status === 'following',
  );
}

/** The bond ends with the NPC's life, its presence beside the body or the quest being active. */
function parted(world: World, escort: EscortRelation) {
  const quest = world.state.quests?.[escort.quest_instance_id]?.state;
  return (
    (quest !== 'active' && quest !== 'objectives_complete') ||
    !living(world, escort.npc_id) ||
    world.state.containers[escort.npc_id] !== world.state.containers[escort.body_id]
  );
}

function following(world: World, actor: CharacterId) {
  const escort = world.state.escorts?.[actor];
  if (!escort || escort.status !== 'following' || retired(world, escort)) return;
  if (
    escort.actor_id !== actor ||
    escort.body_id !== bodyOf(world, actor) ||
    !original(world, escort) ||
    world.entities[escort.npc_id]?.kind !== 'npc'
  )
    throw new KernelError('precondition_failed');
  return escort;
}

/** Toolbox row G8: `npc` is in `actor`'s group while world.group.member is true for the pair;
 * row 22a reads the `stay` and `fight` order facts the same way. */
export function member(
  world: World,
  actor: CharacterId,
  npc: EntityId,
  key: 'member' | 'stay' | 'fight' = 'member',
) {
  const fact = world.cartridge.world?.group?.[key];
  return !!fact && value(world, actor, fact, npc) === true;
}

/** Toolbox row 43b: the first living NPC (EntityId order) in `actor`'s body room with a mount
 * declaration and world.mount.riding true for the pair; undefined when on foot. */
export function mounted(world: World, actor: CharacterId) {
  const fact = world.cartridge.world?.mount?.riding;
  const body = bodyOf(world, actor);
  if (!fact || !body) return undefined;
  return npcsIn(world, [world.state.containers[body]!]).find(
    (id) => (world.entities[id] as NpcEntity).mount && value(world, actor, fact, id) === true,
  );
}

/** Move and Flee use the same source, destination, writer group and admission; the escorted NPC,
 * the ridden mount (row 43b) and then the group's members in the source room (EntityId order)
 * not ordered to stay come along. */
export function travel(
  world: World,
  actor: CharacterId,
  source_id: EntityId,
  destination_id: EntityId,
): DeltaOp[] {
  const bound = following(world, actor);
  const escort = bound && !parted(world, bound) ? bound.npc_id : undefined;
  const horse = mounted(world, actor);
  const members = world.cartridge.world?.group
    ? npcsIn(world, [source_id]).filter(
        (id) => member(world, actor, id) && !member(world, actor, id, 'stay'),
      )
    : [];
  // A set: an escort or horse that is also a member, or a horse that is the escort, moves once.
  const movers = new Set([escort, horse, ...members].filter((id) => id !== undefined));
  return [...movers].map((entity_id) => ({
    op: 'entity.transfer',
    writer_group: 0,
    entity_id,
    source_id,
    destination_id,
  }));
}

const separated = (expected: EscortRelation, writer_group: number): DeltaOp => ({
  op: 'escort.transition',
  writer_group,
  actor_id: expected.actor_id,
  expected,
  value: { ...expected, status: 'separated' },
});

/** Fatal player death returns the body alone; the bound NPC remains in the death room. */
export function separate(world: World, actor: CharacterId, writer_group: number): DeltaOp[] {
  const expected = following(world, actor);
  return expected ? [separated(expected, writer_group)] : [];
}

/** What a whole decision left behind: each actor in `held` it parted and did not itself transition. */
export function partings(world: World, held: CharacterId[], writer_group: number): DeltaOp[] {
  return held.flatMap((actor) => {
    const e = world.state.escorts?.[actor];
    return e?.status === 'following' && parted(world, e) ? [separated(e, writer_group)] : [];
  });
}
