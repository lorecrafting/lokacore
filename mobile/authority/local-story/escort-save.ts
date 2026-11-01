// Recover the single actor's original escort and each authored transition receipt.
import type {
  DialogueDefinition,
  DialogueChoice,
  EscortRelation,
  DecisionResult,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
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
    return;
  }
  if (entries.length !== 1) invalid();
  const [actor, escort] = entries[0];
  if (
    validate('EscortRelation', escort).length ||
    actor !== world.character ||
    escort.actor_id !== actor ||
    escort.body_id !== bodyOf(world, world.character) ||
    world.entities[escort.npc_id]?.kind !== 'npc' ||
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
  terminal(world, escort, selected);
}

// The relation is what the latest transition wrote; a death, a departure or a quest end all write it.
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
  if (escort.status !== 'completed') return;
  const quest = world.state.quests![escort.quest_instance_id];
  const completed = selected.filter((s) => s.option.escort!.transition === 'complete');
  const end = completed[0];
  if (
    completed.length !== 1 ||
    !same(end.d.quest, quest!.quest) ||
    quest!.state !== 'resolved' ||
    quest!.outcome !== end.row.choice_id
  )
    invalid();
}
