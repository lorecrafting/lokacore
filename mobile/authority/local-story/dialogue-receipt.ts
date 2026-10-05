// Dialogue detail routing is derived from a committed command and its retained bound row.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { bodyOf, refString, type ChoiceRow } from '../../../kernel/ts/src/runtime/decision.ts';
import { answerFits, bind, choiceIds } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import type { Story } from './save.ts';

// size: allow 60, one trust boundary checks original command, binding and narration identity
export function dialogueDetail(
  s: Story,
  command_id: string,
  command: Command,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  const invalid = () => {
    throw new Error('malformed JSON: invalid committed dialogue answer');
  };
  if (
    validate('Command', command).length ||
    validate('DecisionResult', d).length ||
    command.id !== command_id ||
    command.world_context_id !== s.world.context ||
    command.payload.type !== 'choose'
  )
    return invalid();
  const p = command.payload;
  const row = s.world.state.choices?.[p.continuation_id];
  if (row && validate('DefinitionRef', row.source).length) return invalid();
  const source = row && s.world.cartridge.dialogues?.[refString(row.source)];
  if (!source?.riddle && p.answer === undefined && d.outcome !== 'riddle_wrong') return;
  const option = source?.choices[p.choice_id];
  if (
    !row ||
    !source ||
    !option ||
    row.actor_id !== p.actor_id ||
    row.beat !== source.key ||
    !same(row.roles, bind(s.world, source)) ||
    !same(row.choice_ids, choiceIds(source))
  )
    return invalid();
  const speaker = Object.entries(source.roles).find(
    ([, r]) => r.role === 'npc' && same(r.npc, source.npc),
  )?.[0];
  const detail = row.roles.find((r) => r.role === speaker)?.entity_id;
  const participants = Object.fromEntries([
    ['actor', bodyOf(s.world, p.actor_id)],
    ...row.roles.map((r) => [r.role, r.entity_id]),
  ]);
  const riddle = source.riddle?.choice_id === p.choice_id ? source.riddle : undefined;
  if (
    riddle ? p.answer === undefined || !answerFits(riddle.bank, p.answer) : p.answer !== undefined
  )
    return invalid();
  const wrong = riddle && p.answer!.toLowerCase() !== riddle.answer;
  const key = wrong ? riddle.wrong : option.narration;
  if (!detail || !same(d.narration?.[0], { key, participants })) return invalid();
  if (!evidence(d, { ...command, payload: p }, row, !!wrong)) return invalid();
  return detail;
}

function evidence(
  d: Extract<DecisionResult, { kind: 'accepted' }>,
  command: Command & { payload: Extract<Command['payload'], { type: 'choose' }> },
  row: ChoiceRow,
  wrong: boolean,
) {
  if (wrong)
    return (
      d.outcome === 'riddle_wrong' &&
      !d.delta.ops.length &&
      !d.events.length &&
      !d.effects.length &&
      d.narration?.length === 1
    );
  const p = command.payload;
  const resolved = d.delta.ops.filter((o) => o.op === 'choice.resolve' && o.writer_group === 0);
  const events = d.events.filter(
    (e) => e.causation_id === (command.id as string) && e.payload.type === 'choice_resolved',
  );
  const event = events[0];
  return (
    d.outcome === p.choice_id &&
    row.status === 'resolved' &&
    row.choice_id === p.choice_id &&
    resolved.length === 1 &&
    same(resolved[0], {
      op: 'choice.resolve',
      writer_group: 0,
      continuation_id: p.continuation_id,
      choice_id: p.choice_id,
      expected_revision: row.opened_revision,
    }) &&
    events.length === 1 &&
    event.actor_id === p.actor_id &&
    event.payload.type === 'choice_resolved' &&
    event.payload.continuation_id === p.continuation_id &&
    event.payload.choice_id === p.choice_id
  );
}
