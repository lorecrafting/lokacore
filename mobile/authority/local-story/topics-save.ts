import type {
  DefinitionRef,
  Command,
  DecisionResult,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { value, scopeOf } from '../../../kernel/ts/src/mechanics/fact.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { detailOf } from '../../../kernel/ts/src/commands/actions.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import { checkRow } from './dialogue-save.ts';
import { invalidRiddle } from './riddle-save.ts';
import type { Db, Meta } from './store.ts';

export function topicsSave(world: World, db: Db, meta: Meta) {
  const scope = `story/${meta.lineage_id}/${world.character}`;
  const facts = new Map<string, DefinitionRef>();
  for (const t of Object.values(world.cartridge.topics ?? {})) facts.set(refString(t.fact), t.fact);
  for (const d of Object.values(world.cartridge.dialogues ?? {}))
    if (d.riddle?.wrong_limit !== undefined)
      for (const s of d.choices[d.riddle.choice_id].sequence ?? [])
        if (s.op === 'fact.assign') facts.set(refString(s.fact), s.fact);
  for (const n of Object.values(world.cartridge.npcs ?? {}))
    if (n.perception) facts.set(refString(n.perception.discovered), n.perception.discovered);
  for (const fact of facts.values()) factProof(world, db, scope, fact);
}

function factProof(world: World, db: Db, scope: string, fact: DefinitionRef) {
  const receipts = db.getAllSync<{ command_id: string; command: string; response: string }>(
    `SELECT command_id,command,response FROM receipt
    WHERE scope=? AND json_extract(response,'$.kind')='accepted' AND EXISTS
    (SELECT 1 FROM json_each(json_extract(response,'$.delta.ops')) WHERE json_extract(value,'$.op')='fact.assign'
     AND json_extract(value,'$.fact.key')=?) LIMIT 2`,
    scope,
    fact.key,
  );
  if ((value(world, world.character, fact) === true) !== (receipts.length === 1)) invalidRiddle();
  if (!receipts.length) return;
  const r = receipts[0],
    command = JSON.parse(r.command) as Command,
    d = JSON.parse(r.response) as Extract<DecisionResult, { kind: 'accepted' }>;
  if (
    validate('Command', command).length ||
    validate('DecisionResult', d).length ||
    command.id !== r.command_id ||
    command.world_context_id !== world.context ||
    !('actor_id' in command.payload) ||
    command.payload.actor_id !== world.character
  )
    invalidRiddle();
  const ops = d.delta.ops.filter((o) => o.op === 'fact.assign' && same(o.fact, fact));
  if (
    ops.length !== 1 ||
    ops[0].op !== 'fact.assign' ||
    ops[0].expected !== false ||
    ops[0].value !== true ||
    !same(ops[0].scope, scopeOf(world, world.character, fact))
  )
    invalidRiddle();
  grantSource(world, db, scope, fact, command, d);
}

function seekProof(
  world: World,
  command: Command,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
  fact: DefinitionRef,
) {
  const p = command.payload as Extract<Command['payload'], { type: 'perform' }>;
  const recipe = Object.values(world.cartridge.recipes ?? {}).find((r) => r.key === p.action);
  const check = recipe?.check,
    subject = recipe && detailOf(world, recipe.target);
  if (
    !recipe ||
    check?.kind !== 'attribute_threshold' ||
    d.outcome !== 'success' ||
    world.attributes[key(check.attribute)] < check.difficulty ||
    (p.target_id !== undefined && p.target_id !== subject) ||
    !(recipe.outcomes.success.sequence ?? []).some(
      (s) => s.op === 'fact.assign' && same(s.fact, fact) && s.value === true,
    ) ||
    !d.events.some(
      (e) =>
        e.actor_id === p.actor_id &&
        e.causation_id === (command.id as string) &&
        e.payload.type === 'check_passed' &&
        same(e.payload.check, {
          cartridge_id: world.cartridge.manifest.id,
          cartridge_version: world.cartridge.manifest.version,
          kind: 'check',
          key: check.key,
        }) &&
        e.world_context_id === world.context &&
        e.correlation_id === (command.id as string) &&
        e.payload.subject_id === subject,
    )
  )
    invalidRiddle();
}

function grantSource(
  world: World,
  db: Db,
  scope: string,
  fact: DefinitionRef,
  command: Command,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  const p = command.payload;
  if (p.type === 'choose') {
    const row = world.state.choices?.[p.continuation_id];
    const source = row && world.cartridge.dialogues?.[refString(row.source)];
    const option = source?.choices[p.choice_id];
    if (
      !row ||
      row.status !== 'resolved' ||
      !option ||
      !(option.sequence ?? []).some((s) =>
        s.op === 'fact.assign'
          ? same(s.fact, fact) && s.value === true
          : s.op === 'topic.grant' &&
            same(world.cartridge.topics?.[refString(s.topic)]?.fact, fact),
      )
    )
      invalidRiddle();
    checkRow(world, p.continuation_id, row);
    committedDialogue(world, db, scope, p.continuation_id);
  } else if (p.type === 'read') {
    const item = world.entities[p.target_id];
    if (
      item?.kind !== 'item' ||
      !item.readable?.topic ||
      !same(world.cartridge.topics?.[refString(item.readable.topic)]?.fact, fact)
    )
      invalidRiddle();
    // Historical held custody and exact response are checked by receiptHistory, never today's lid or room.
  } else if (p.type === 'perform') seekProof(world, command, d, fact);
  else invalidRiddle();
}
