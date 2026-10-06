import type {
  Command,
  DecisionResult,
  DeltaOp,
  ExpeditionAttempt,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { definition, detailFor } from '../../../kernel/ts/src/mechanics/expedition/shared.ts';

export const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent expedition receipt');
};
export type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;
export type Receipt = {
  command_id: string;
  actor_id: string;
  command: string;
  response: string;
  revision: number;
};
type Change = Extract<DeltaOp, { op: 'expedition.transition' }>;

export function checked(world: World, r: Receipt, last: number, head: number) {
  const command = JSON.parse(r.command) as Command;
  const decision = JSON.parse(r.response) as DecisionResult;
  if (
    validate('Command', command).length ||
    validate('DecisionResult', decision).length ||
    command.id !== r.command_id ||
    r.actor_id !== world.character ||
    ('actor_id' in command.payload && command.payload.actor_id !== world.character) ||
    command.world_context_id !== world.context ||
    r.revision < last ||
    r.revision > head
  )
    invalid();
  return { command, decision };
}

export function cause(
  world: World,
  command: Command,
  decision: Accepted,
  attempt: ExpeditionAttempt | null,
) {
  const { spec } = definition(world);
  const bodyMove = decision.delta.ops.find(
    (op): op is Extract<DeltaOp, { op: 'entity.transfer' }> =>
      op.op === 'entity.transfer' && op.entity_id === world.body,
  );
  const died = decision.events.some(
    (event) =>
      event.payload.type === 'entity_died' &&
      event.payload.victim_id === world.body &&
      String(event.causation_id) === String(command.id),
  );
  const outside =
    !!bodyMove &&
    !spec.footprint.some((room) => world.roomIds[refString(room)] === bodyMove.destination_id);
  const edge = attempt && spec.route[attempt.cursor];
  const next =
    !!bodyMove &&
    !!edge &&
    bodyMove.source_id === world.roomIds[refString(edge.from)] &&
    bodyMove.destination_id === world.roomIds[refString(edge.to)] &&
    (command.payload.type === 'move' || command.payload.type === 'flee');
  return { bodyMove, died, outside, next };
}

export function exact(
  world: World,
  command: Command,
  changed: Change,
  attempt: ExpeditionAttempt | null,
  why: ReturnType<typeof cause>,
) {
  const { spec } = definition(world);
  const payload = command.payload;
  const expected =
    payload.type === 'expedition'
      ? payload.transition === 'shelter'
        ? attempt && { ...attempt, sheltered: true }
        : {
            kind: 'expedition',
            actor_id: world.character,
            body_id: world.body,
            quest_instance_id: changed.quest_instance_id,
            attempt_id: command.id,
            cursor: 0,
            sheltered: false,
            status: 'active',
          }
      : attempt &&
        (why.died || why.outside
          ? { ...attempt, cursor: 0, sheltered: false, status: 'failed' }
          : {
              ...attempt,
              cursor: attempt.cursor + 1,
              status: attempt.cursor + 1 === spec.route.length ? 'completed' : 'active',
            });
  if (
    !same(changed.expected, attempt) ||
    !same(changed.value, expected) ||
    changed.value.quest_instance_id !== changed.quest_instance_id ||
    changed.writer_group !== (why.bodyMove?.writer_group ?? changed.writer_group)
  )
    invalid();
}

export function userAction(
  world: World,
  p: Extract<Command['payload'], { type: 'expedition' }>,
  d: Accepted,
  changed: Change,
  attempt: ExpeditionAttempt | null,
) {
  const { spec, ref } = definition(world);
  const stage = p.transition;
  const target = detailFor(world, spec, stage);
  if (
    p.detail_id !== target ||
    spec.actions[stage] === undefined ||
    (stage === 'start' && attempt) ||
    (stage === 'restart' &&
      (attempt?.status !== 'failed' ||
        p.quest_instance_id !== attempt.quest_instance_id ||
        p.attempt_id !== attempt.attempt_id)) ||
    (stage === 'shelter' &&
      (attempt?.status !== 'active' ||
        attempt.cursor !== 3 ||
        attempt.sheltered ||
        p.cursor !== 3 ||
        p.quest_instance_id !== attempt.quest_instance_id ||
        p.attempt_id !== attempt.attempt_id))
  )
    invalid();
  if (
    stage === 'start' &&
    !d.delta.ops.some(
      (op) =>
        op.op === 'quest.activate' &&
        op.instance_id === changed.quest_instance_id &&
        same(op.quest, ref) &&
        same(op.scope, { kind: 'player', character_id: world.character }),
    )
  )
    invalid();
}

export function entered(
  world: World,
  command: Command,
  d: Accepted,
  why: ReturnType<typeof cause>,
) {
  if (
    !d.events.some(
      (e) =>
        e.payload.type === 'entity_entered_room' &&
        e.payload.entity_id === world.body &&
        e.payload.room_id === why.bodyMove!.destination_id &&
        String(e.causation_id) === String(command.id),
    )
  )
    invalid();
}

export function completion(
  world: World,
  command: Command,
  d: Accepted,
  row: ExpeditionAttempt,
  prior: unknown,
) {
  const { spec } = definition(world);
  const group = d.delta.ops.find((op) => op.op === 'expedition.transition')!.writer_group;
  const assignments = d.delta.ops.filter(
    (op): op is Extract<DeltaOp, { op: 'fact.assign' }> => op.op === 'fact.assign',
  );
  const fact = assignments.find((op) => same(op.fact, spec.survived_fact));
  const faction = assignments.find((op) => same(op.fact, spec.faction));
  const type = world.cartridge.facts[refString(spec.faction)].value_type;
  if (type.type !== 'int') return invalid();
  const floor = type.minimum ?? invalid();
  if (
    !fact ||
    !faction ||
    fact.writer_group !== group ||
    fact.value !== true ||
    fact.expected !== false ||
    faction.writer_group !== group ||
    faction.expected !== prior ||
    faction.value !== Math.max(floor, (prior as number) + spec.faction_delta)
  )
    invalid();
  terminal(command, d, row, group);
}

function terminal(command: Command, d: Accepted, row: ExpeditionAttempt, group: number) {
  if (
    !d.delta.ops.some(
      (op) =>
        op.op === 'quest.transition' &&
        op.instance_id === row.quest_instance_id &&
        op.from === 'objectives_complete' &&
        op.to === 'resolved' &&
        op.writer_group === group,
    ) ||
    !d.events.some(
      (e) =>
        e.payload.type === 'quest_resolved' &&
        e.payload.instance_id === row.quest_instance_id &&
        String(e.causation_id) === String(command.id),
    )
  )
    invalid();
}
