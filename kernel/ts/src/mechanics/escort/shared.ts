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
import { bodyOf, refString, type ChoiceRow, type World } from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { living } from '../death/shared.ts';
import { questOf } from '../lookups.ts';

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
  if (effect.transition === 'start') return escort ? ('invalid_state' as const) : undefined;
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
  const value: EscortRelation = expected
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

function following(world: World, actor: CharacterId) {
  const escort = world.state.escorts?.[actor];
  if (!escort || escort.status !== 'following') return;
  if (
    escort.actor_id !== actor ||
    escort.body_id !== bodyOf(world, actor) ||
    !original(world, escort) ||
    world.state.quests?.[escort.quest_instance_id]?.state !== 'active' ||
    world.entities[escort.npc_id]?.kind !== 'npc' ||
    !living(world, escort.npc_id) ||
    world.state.containers[escort.npc_id] !== world.state.containers[escort.body_id]
  )
    throw new KernelError('precondition_failed');
  return escort;
}

/** Move and Flee use the same source, destination, writer group and admission. */
export function travel(
  world: World,
  actor: CharacterId,
  source_id: EntityId,
  destination_id: EntityId,
): DeltaOp[] {
  const escort = following(world, actor);
  return escort
    ? [
        {
          op: 'entity.transfer',
          writer_group: 0,
          entity_id: escort.npc_id,
          source_id,
          destination_id,
        },
      ]
    : [];
}

/** Fatal player death returns the body alone; the bound NPC remains in the death room. */
export function separate(world: World, actor: CharacterId, writer_group: number): DeltaOp[] {
  const expected = following(world, actor);
  return expected
    ? [
        {
          op: 'escort.transition',
          writer_group,
          actor_id: actor,
          expected,
          value: { ...expected, status: 'separated' },
        },
      ]
    : [];
}
