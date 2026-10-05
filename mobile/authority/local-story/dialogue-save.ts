// Protected nonterminal receipts retain the only authority for subsequent item custody.
import type { DialogueChoice, EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bind, choiceIds } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { dialogueDetail } from './dialogue-receipt.ts';
import type { Story } from './save.ts';
import type { Db, Meta } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bound item return');
};

// Only authored nonterminal receive of a Give-restricted item establishes this durable custody path.
// size: allow 55, one load boundary checks the original receive and its current terminal/custody evidence
export function dialogueSave(world: World, db: Db, meta: Meta) {
  const starts = Object.entries(world.cartridge.dialogues ?? {}).flatMap(([key, d]) =>
    d.quest
      ? []
      : Object.entries(d.choices).flatMap(([choice, option]) => {
          const role = option.receive && d.roles[option.receive.item];
          const item = role?.role === 'item' && world.entityIds[refString(role.item)];
          const entity = item && world.entities[item];
          return entity && entity.kind === 'item' && entity.give_allowed === false
            ? [{ key, d, choice, option, item }]
            : [];
        }),
  );
  if (!starts.length) return;
  const rows = Object.entries(world.state.choices ?? {});
  for (const [id, row] of rows) checkRow(world, id, row);
  const actor = world.character;
  const scope = `story/${meta.lineage_id}/${actor}`;
  for (const start of starts) {
    const resolved = rows.filter(
      ([, row]) =>
        refString(row.source) === start.key &&
        row.actor_id === actor &&
        row.status === 'resolved' &&
        row.choice_id === start.choice,
    );
    if (resolved.length > 1) invalid();
    const received = resolved.length === 1;
    checkAssignments(world, start.option, received);
    if (received) committed(world, db, scope, resolved[0][0]);
    const terminal = handoff(world, db, scope, rows, start.item, received);
    const holder = world.state.containers[start.item];
    if (!received) {
      const original = bind(world, start.d).find(
        (r) => r.role === start.option.receive!.from,
      )!.entity_id;
      if (holder !== original || terminal) invalid();
    } else if (!terminal) {
      const seen = new Set<string>();
      let at = holder;
      while (!world.rooms[at]) {
        if (!at || seen.has(at) || world.entities[at]?.kind === 'npc') invalid();
        seen.add(at);
        at = world.state.containers[at];
      }
    }
  }
}

function checkRow(world: World, id: string, row: ChoiceRow) {
  if (
    !row ||
    validate('ContinuationId', id).length ||
    validate('DefinitionRef', row.source).length ||
    row.actor_id !== world.character ||
    !Number.isSafeInteger(row.opened_revision) ||
    row.opened_revision < 0 ||
    !['pending', 'resolved', 'closed'].includes(row.status)
  )
    invalid();
  const d = world.cartridge.dialogues?.[refString(row.source)];
  if (
    !d ||
    row.beat !== d.key ||
    !same(row.roles, bind(world, d)) ||
    !same(row.choice_ids, choiceIds(d)) ||
    (row.status === 'resolved'
      ? !row.choice_id || !d.choices[row.choice_id]
      : row.choice_id !== undefined)
  )
    invalid();
}

function checkAssignments(world: World, option: DialogueChoice, selected: boolean) {
  for (const step of option.sequence ?? []) {
    if (step.op !== 'fact.assign') continue;
    const current = value(world, world.character, step.fact);
    const expected = selected
      ? step.value
      : world.cartridge.facts[refString(step.fact)].value_type.default;
    if (!same(current, expected)) invalid();
  }
}

function committed(world: World, db: Db, scope: string, continuation: string) {
  const receipts = db.getAllSync<{ command_id: string; command: string; response: string }>(
    `SELECT command_id,command,response FROM receipt WHERE scope=?
     AND json_extract(command,'$.payload.type')='choose'
     AND json_extract(command,'$.payload.continuation_id')=?
     AND json_extract(response,'$.kind')='accepted'
     AND json_extract(response,'$.outcome')!='riddle_wrong'`,
    scope,
    continuation,
  );
  if (receipts.length !== 1) invalid();
  const r = receipts[0];
  if (
    !dialogueDetail({ world } as Story, r.command_id, JSON.parse(r.command), JSON.parse(r.response))
  )
    invalid();
}

// size: allow 45, terminal receipt, quest, status and original custody must agree at one load boundary
function handoff(
  world: World,
  db: Db,
  scope: string,
  rows: [string, ChoiceRow][],
  item: EntityId,
  received: boolean,
) {
  let completed = false;
  for (const [key, d] of Object.entries(world.cartridge.dialogues ?? {})) {
    for (const [choice, option] of Object.entries(d.choices)) {
      const role = option.hand_over && d.roles[option.hand_over.item];
      if (!d.quest || role?.role !== 'item' || world.entityIds[refString(role.item)] !== item)
        continue;
      const matches = rows.filter(
        ([, row]) =>
          refString(row.source) === key && row.status === 'resolved' && row.choice_id === choice,
      );
      const done = matches.length === 1;
      if (matches.length > 1 || (done && (!received || completed))) invalid();
      checkAssignments(world, option, done);
      const q = Object.values(world.state.quests ?? {}).find(
        (q) =>
          q &&
          same(q.quest, d.quest) &&
          same(q.scope, { kind: 'player', character_id: world.character }),
      );
      if (done) {
        const destination = bind(world, d).find((r) => r.role === option.hand_over!.to)!.entity_id;
        if (
          world.state.containers[item] !== destination ||
          q?.state !== 'resolved' ||
          q.outcome !== choice
        )
          invalid();
        committed(world, db, scope, matches[0][0]);
        completed = true;
      } else if ((q && q.state !== 'active') || (received && !q)) invalid();
    }
  }
  return completed;
}
