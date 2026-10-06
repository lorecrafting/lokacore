import { validAttempts } from '../../../kernel/ts/src/mechanics/dialogue/behavior.ts';
// Protected nonterminal receipts retain the only authority for subsequent item custody.
import type { EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bind, choiceIds } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import { escortSave } from './escort-save.ts';
import { bellSave } from './bell-save.ts';
import type { Db, Meta } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bound item return');
};

// Only authored nonterminal receive of a Give-restricted item establishes this durable custody path.
// size: allow 56, one load boundary checks the original receive and its current terminal/custody evidence
export function dialogueSave(world: World, db: Db, meta: Meta) {
  const starts = custodyStarts(world);
  const escortChoices = Object.values(world.cartridge.dialogues ?? {}).some((d) =>
    Object.values(d.choices).some((o) => o.escort),
  );
  if (!starts.length && !escortChoices && !Object.keys(world.state.escorts ?? {}).length) return;
  const rows = ordinaryRows(world);
  for (const [id, row] of rows) checkRow(world, id, row);
  const actor = world.character;
  const scope = `story/${meta.lineage_id}/${actor}`;
  const lost = bellSave(world, db, scope, rows);
  const rescued = escortSave(world, db, scope, rows);
  checkAssignments(
    world,
    rows,
    starts.map((s) => s.item),
    lost,
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
    if (received) committedDialogue(world, db, scope, resolved[0][0]);
    const terminal = handoff(world, db, scope, rows, start.item, received, rescued, lost);
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

function custodyStarts(world: World) {
  return Object.entries(world.cartridge.dialogues ?? {}).flatMap(([key, d]) =>
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
    !same(row.choice_ids, choiceIds(d)) ||
    !validAttempts(row, d) ||
    (row.status === 'resolved'
      ? !row.choice_id || !d.choices[row.choice_id]
      : row.choice_id !== undefined)
  )
    invalid();
}

function checkAssignments(
  world: World,
  rows: [string, ChoiceRow][],
  items: EntityId[],
  lost: boolean,
) {
  const expected = new Map<
    string,
    { fact: Parameters<typeof value>[2]; value: unknown; selected: boolean }
  >();
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
      for (const step of option.sequence ?? []) {
        if (step.op !== 'fact.assign') continue;
        const key = refString(step.fact);
        const prior = expected.get(key);
        if (selected && prior?.selected && !same(prior.value, step.value)) invalid();
        if (selected || !prior)
          expected.set(key, {
            fact: step.fact,
            selected,
            value: selected ? step.value : world.cartridge.facts[key].value_type.default,
          });
      }
    }
  }
  for (const e of expected.values())
    if (
      !(lost && e.fact.key === 'village_child_status') &&
      !same(value(world, world.character, e.fact), e.value)
    )
      invalid();
}

// size: allow 46, terminal receipt, quest, status and original custody must agree at one load boundary
function handoff(
  world: World,
  db: Db,
  scope: string,
  rows: [string, ChoiceRow][],
  item: EntityId,
  received: boolean,
  rescued: Set<string>,
  lost: boolean,
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
        committedDialogue(world, db, scope, matches[0][0]);
        completed = true;
      } else if (
        !rescued.has(refString(d.quest)) &&
        !lost &&
        ((q && q.state !== 'active') || (received && !q))
      )
        invalid();
    }
  }
  return completed;
}
