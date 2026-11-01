import { validAttempts } from '../../../kernel/ts/src/mechanics/dialogue/behavior.ts';
import type { EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bind, openable } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import {
  refString,
  type ChoiceRow,
  type QuestRow,
  type World,
} from '../../../kernel/ts/src/runtime/decision.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import { escortSave } from './escort-save.ts';
import type { Db, Meta } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bound item return');
};

// A row's shape, bindings and receipt are always checked. A held item or a fact is inferred from
// the rows only where the cartridge leaves one history: an item with one receive and no way back,
// a fact with one writer. Elsewhere only receipts know it (loka-vduxr.10).
// size: allow 50, one load boundary checks the original receive and its current terminal/custody evidence
export function dialogueSave(world: World, db: Db, meta: Meta) {
  const items = custodyItems(world);
  const escortChoices = Object.values(world.cartridge.dialogues ?? {}).some((d) =>
    Object.values(d.choices).some((o) => o.escort),
  );
  if (!items.size && !escortChoices && !Object.keys(world.state.escorts ?? {}).length) return;
  const rows = ordinaryRows(world);
  for (const [id, row] of rows) checkRow(world, id, row);
  const actor = world.character;
  const scope = `story/${meta.lineage_id}/${actor}`;
  const rescued = escortSave(world, db, scope, rows);
  for (const [id, row] of rows)
    if (row.status === 'resolved' && movesItem(world, row, items))
      committedDialogue(world, db, scope, id);
  for (const item of items) {
    answeredOutcomes(world, rows, item, rescued);
    npcHolds(world, item);
  }
  const starts = oneWayStarts(world, items);
  checkAssignments(
    world,
    rows,
    starts.map((s) => s.item),
  );
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
    const terminal = handoff(world, rows, start.item, received);
    const holder = world.state.containers[start.item];
    if (!received) {
      const original = bind(world, start.d).find(
        (r) => r.role === start.option.receive!.from,
      )!.entity_id;
      if (holder !== original || terminal) invalid();
    } else if (!terminal) {
      if (npcHolds(world, start.item)) invalid();
    }
  }
}

// Walks a holder chain to its room or NPC; a chain that ends nowhere or loops is corrupt.
function npcHolds(world: World, start: EntityId) {
  const seen = new Set<string>();
  let at = start;
  while (!world.rooms[at]) {
    if (!at || seen.has(at)) invalid();
    if (world.entities[at]?.kind === 'npc') return true;
    seen.add(at);
    at = world.state.containers[at];
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

// Every authored transfer of the item, to tell a one-way path from one that can come back.
function transfers(world: World, item: EntityId, verb: 'receive' | 'hand_over') {
  return Object.entries(world.cartridge.dialogues ?? {}).flatMap(([key, d]) =>
    Object.entries(d.choices).flatMap(([choice, option]) => {
      const transfer = option[verb];
      const role = transfer && d.roles[transfer.item];
      return role?.role === 'item' && world.entityIds[refString(role.item)] === item
        ? [{ key, d, choice, option, item }]
        : [];
    }),
  );
}

const boundTo = (world: World, d: Dialogue, role: string) =>
  bind(world, d).find((r) => r.role === role)!.entity_id;

// A second receive, a plain hand-back, or a hand-over to the giver makes custody history-dependent.
function oneWayStarts(world: World, items: Set<EntityId>) {
  return [...items].flatMap((item) => {
    const received = transfers(world, item, 'receive');
    const given = transfers(world, item, 'hand_over');
    if (received.length !== 1 || given.some((g) => !g.d.quest)) return [];
    const from = boundTo(world, received[0].d, received[0].option.receive!.from);
    return given.some((g) => boundTo(world, g.d, g.option.hand_over!.to) === from) ? [] : received;
  });
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

type Dialogue = NonNullable<World['cartridge']['dialogues']>[string];

// How many authored steps anywhere in the cartridge write each fact.
function factWriters(node: unknown, counts = new Map<string, number>()) {
  if (Array.isArray(node)) for (const n of node) factWriters(n, counts);
  else if (node && typeof node === 'object') {
    const step = node as { op?: unknown; fact?: Parameters<typeof refString>[0] };
    if (['fact.assign', 'fact.adjust', 'fact.stamp'].includes(step.op as string) && step.fact) {
      const key = refString(step.fact);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const n of Object.values(node)) factWriters(n, counts);
  }
  return counts;
}

// A fact only this answer writes holds its value when selected and the authored default otherwise.
function checkAssignments(world: World, rows: [string, ChoiceRow][], items: EntityId[]) {
  const writers = factWriters(world.cartridge);
  for (const [key, d] of Object.entries(world.cartridge.dialogues ?? {})) {
    for (const [choice, option] of Object.entries(d.choices)) {
      const transfer = option.receive ?? option.hand_over;
      const role = transfer && d.roles[transfer.item];
      if (
        !option.escort &&
        !(role?.role === 'item' && items.includes(world.entityIds[refString(role.item)]))
      )
        continue;
      const selected = rows.some(
        ([, r]) => refString(r.source) === key && r.status === 'resolved' && r.choice_id === choice,
      );
      for (const step of option.steps ?? []) {
        if (step.op !== 'fact.assign' || writers.get(refString(step.fact)) !== 1) continue;
        const expected = selected
          ? step.value
          : world.cartridge.facts[refString(step.fact)].value_type.default;
        if (!same(value(world, world.character, step.fact), expected)) invalid();
      }
    }
  }
}

const answered = (rows: [string, ChoiceRow][], key: string, choice: string) =>
  rows.filter(
    ([, row]) =>
      refString(row.source) === key && row.status === 'resolved' && row.choice_id === choice,
  );

// A quest whose outcome is a hand-over answer is only ever resolved through that answer's row.
function answeredOutcomes(
  world: World,
  rows: [string, ChoiceRow][],
  item: EntityId,
  rescued: Set<string>,
) {
  for (const { key, d, choice } of transfers(world, item, 'hand_over')) {
    if (!d.quest || rescued.has(refString(d.quest))) continue;
    const q = playerQuest(world, d.quest);
    if (q?.state === 'resolved' && q.outcome === choice && !answered(rows, key, choice).length)
      invalid();
  }
}

function handoff(world: World, rows: [string, ChoiceRow][], item: EntityId, received: boolean) {
  let completed = false;
  for (const { key, d, option, choice } of transfers(world, item, 'hand_over')) {
    const matches = answered(rows, key, choice);
    if (matches.length > 1 || (matches.length && (!received || completed))) invalid();
    if (matches.length) {
      handedOver(world, d, option, item, choice, playerQuest(world, d.quest));
      completed = true;
    }
  }
  return completed;
}

const playerQuest = (world: World, quest: Dialogue['quest']) =>
  Object.values(world.state.quests ?? {}).find(
    (q) =>
      q && same(q.quest, quest) && same(q.scope, { kind: 'player', character_id: world.character }),
  );

function handedOver(
  world: World,
  d: Dialogue,
  option: Dialogue['choices'][string],
  item: EntityId,
  choice: string,
  q: QuestRow | undefined,
) {
  const destination = boundTo(world, d, option.hand_over!.to);
  if (
    world.state.containers[item] !== destination ||
    q?.state !== 'resolved' ||
    q.outcome !== choice
  )
    invalid();
}
