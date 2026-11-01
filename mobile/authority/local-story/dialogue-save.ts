import { validAttempts } from '../../../kernel/ts/src/mechanics/dialogue/behavior.ts';
import type { EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bind, openable } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import { escortSave } from './escort-save.ts';
import type { Db, Meta } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bound item return');
};

// A row's shape, bindings and receipt are checked. Who wrote a fact or moved an item is not inferred
// from state: a reaction, a book, a death or a theft reaches the same state lawfully, so a forged
// holder or fact loads and plays on (loka-vduxr.10).
export function dialogueSave(world: World, db: Db, meta: Meta) {
  const items = custodyItems(world);
  const escortChoices = Object.values(world.cartridge.dialogues ?? {}).some((d) =>
    Object.values(d.choices).some((o) => o.escort),
  );
  if (!items.size && !escortChoices && !Object.keys(world.state.escorts ?? {}).length) return;
  for (const item of items) if (holderLoop(world, item)) invalid();
  const rows = ordinaryRows(world);
  for (const [id, row] of rows) checkRow(world, id, row);
  const scope = `story/${meta.lineage_id}/${world.character}`;
  escortSave(world, db, scope, rows);
  for (const [id, row] of rows)
    if (row.status === 'resolved' && movesItem(world, row, items))
      committedDialogue(world, db, scope, id);
}

// A holder cycle hangs every holder walk at launch, so it cannot be left to play on.
function holderLoop(world: World, item: EntityId) {
  const seen = new Set<string>();
  for (let at: string | undefined = item; at; at = world.state.containers[at as EntityId]) {
    if (seen.has(at)) return true;
    seen.add(at);
  }
  return false;
}

function movesItem(world: World, row: ChoiceRow, items: Set<EntityId>) {
  const d = world.cartridge.dialogues?.[refString(row.source)];
  const option = d?.choices[row.choice_id!];
  const transfer = option?.receive ?? option?.hand_over;
  const role = transfer && d!.roles[transfer.item];
  return role?.role === 'item' && items.has(world.entityIds[refString(role.item)]);
}

function custodyItems(world: World) {
  return new Set(
    Object.values(world.cartridge.dialogues ?? {}).flatMap((d) =>
      d.quest
        ? []
        : Object.values(d.choices).flatMap((option) => {
            const role = option.receive && d.roles[option.receive.item];
            const item = role?.role === 'item' && world.entityIds[refString(role.item)];
            const entity = item && world.entities[item];
            return entity && entity.kind === 'item' && entity.give_allowed === false ? [item] : [];
          }),
    ),
  );
}

const ordinaryRows = (world: World) =>
  Object.entries(world.state.choices ?? {}).filter(([, r]) => r.source.kind === 'dialogue');

export function checkRow(world: World, id: string, row: ChoiceRow) {
  if (
    !row ||
    validate('ContinuationId', id).length ||
    validate('DefinitionRef', row.source).length ||
    row.actor_id !== world.character ||
    !Number.isSafeInteger(row.opened_revision) ||
    row.opened_revision < 0 ||
    !['pending', 'resolved', 'closed'].includes(row.status) ||
    !Array.isArray(row.roles) ||
    row.roles.some((r) => validate('RoleBinding', r).length)
  )
    invalid();
  const d = world.cartridge.dialogues?.[refString(row.source)];
  if (
    !d ||
    row.beat !== d.key ||
    !same(
      row.roles.filter(
        (r) =>
          !d.quest ||
          !world.cartridge.quests?.[refString(d.quest)]?.exchange ||
          !/^(outgoing|incoming)_\d{2}$/.test(r.role),
      ),
      bind(world, d),
    ) ||
    !openable(world, d, row.choice_ids) ||
    !validAttempts(row, d) ||
    (row.status === 'resolved'
      ? !row.choice_id || !d.choices[row.choice_id] || !row.choice_ids.includes(row.choice_id)
      : row.choice_id !== undefined)
  )
    invalid();
}
