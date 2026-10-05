// Recover the single actor's original escort and each authored transition receipt.
import type {
  DialogueDefinition,
  DialogueChoice,
  EscortRelation,
  DecisionResult,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { living } from '../../../kernel/ts/src/mechanics/death/shared.ts';
import {
  bodyOf,
  refString,
  type ChoiceRow,
  type World,
} from '../../../kernel/ts/src/runtime/decision.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import type { Db } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent escort');
};

type Selection = { id: string; row: ChoiceRow; d: DialogueDefinition; option: DialogueChoice };

// Every escort choice keeps its own receipt, including repeated explicit rejoins.
export function escortSave(world: World, db: Db, scope: string, rows: [string, ChoiceRow][]) {
  const selected = rows.flatMap(([id, row]) => {
    const d = world.cartridge.dialogues![refString(row.source)];
    const option = row.status === 'resolved' && d.choices[row.choice_id!];
    return option && option.escort ? [{ id, row, d, option }] : [];
  });
  const entries = Object.entries(world.state.escorts ?? {});
  if (!entries.length) {
    if (selected.length) invalid();
    return new Set<string>();
  }
  if (entries.length !== 1) invalid();
  const [actor, escort] = entries[0];
  if (
    validate('EscortRelation', escort).length ||
    actor !== world.character ||
    escort.actor_id !== actor ||
    escort.body_id !== bodyOf(world, world.character) ||
    world.entities[escort.npc_id]?.kind !== 'npc' ||
    !living(world, escort.npc_id) ||
    !world.rooms[world.state.containers[escort.npc_id]]
  )
    invalid();
  const quest = original(world, escort, selected);
  latest(world, db, scope, escort);
  for (const s of selected) {
    if (
      !same(s.option.escort!.quest, quest!.quest) ||
      s.row.roles.find((r) => r.role === s.option.escort!.npc)?.entity_id !== escort.npc_id
    )
      invalid();
    committedDialogue(world, db, scope, s.id);
  }
  return terminal(world, escort, selected);
}

// A separated row needs its fatal transition; later walking back is not a rejoin.
function latest(world: World, db: Db, scope: string, escort: EscortRelation) {
  const receipt = db.getFirstSync<{ response: string }>(
    `SELECT response FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted'
     AND EXISTS (SELECT 1 FROM json_each(receipt.response,'$.delta.ops') AS op
       WHERE json_extract(op.value,'$.op')='escort.transition'
       AND json_extract(op.value,'$.actor_id')=?) ORDER BY revision DESC LIMIT 1`,
    scope,
    escort.actor_id,
  );
  if (!receipt) invalid();
  const decision: DecisionResult = JSON.parse(receipt!.response);
  if (validate('DecisionResult', decision).length || decision.kind !== 'accepted') return invalid();
  const op = decision.delta.ops
    .filter((o) => o.op === 'escort.transition' && o.actor_id === escort.actor_id)
    .at(-1);
  if (op?.op !== 'escort.transition' || !same(op.value, escort)) return invalid();
  if (escort.status !== 'separated') return;
  const room = world.state.containers[escort.npc_id];
  if (
    !same(op.expected, { ...escort, status: 'following' }) ||
    !decision.events.some(
      (e) =>
        e.payload.type === 'entity_died' &&
        e.payload.victim_id === escort.body_id &&
        e.payload.room_id === room,
    ) ||
    !decision.delta.ops.some(
      (o) =>
        o.op === 'entity.transfer' &&
        o.writer_group === op.writer_group &&
        o.entity_id === escort.body_id &&
        o.source_id === room,
    )
  )
    invalid();
}

function original(world: World, escort: EscortRelation, selected: Selection[]) {
  const starts = selected.filter((s) => s.option.escort!.transition === 'start');
  const start = starts[0];
  const quest = world.state.quests?.[escort.quest_instance_id];
  if (
    starts.length !== 1 ||
    start.id !== escort.continuation_id ||
    start.row.choice_id !== escort.choice_id ||
    !same(quest?.quest, start.option.escort!.quest) ||
    !same(quest?.scope, { kind: 'player', character_id: escort.actor_id })
  )
    invalid();
  return quest!;
}

function terminal(world: World, escort: EscortRelation, selected: Selection[]) {
  const quest = world.state.quests![escort.quest_instance_id];
  const completed = selected.filter((s) => s.option.escort!.transition === 'complete');
  if (escort.status === 'completed') {
    const end = completed[0];
    const speaker = end && world.entityIds[refString(end.d.npc)];
    if (
      completed.length !== 1 ||
      !same(end.d.quest, quest!.quest) ||
      quest!.state !== 'resolved' ||
      quest!.outcome !== end.row.choice_id ||
      !living(world, speaker) ||
      world.state.containers[speaker] !== world.state.containers[escort.npc_id]
    )
      invalid();
    return new Set([refString(quest!.quest)]);
  }
  if (
    completed.length ||
    quest!.state !== 'active' ||
    (escort.status === 'following' &&
      world.state.containers[escort.body_id] !== world.state.containers[escort.npc_id])
  )
    invalid();
  return new Set<string>();
}
