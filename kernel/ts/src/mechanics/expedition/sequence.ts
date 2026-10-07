import type {
  CharacterId,
  CommandId,
  DeltaOp,
  DomainEvent,
  EntityId,
  ExpeditionAttempt,
  Key,
  QuestInstanceId,
} from '../../contracts.gen.ts';
import { apply } from '../../runtime/apply.ts';
import {
  bodyOf,
  event,
  refString,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { cmp } from '../../foundation/validate.ts';
import { add } from '../../foundation/int.ts';
import { activation, resolution } from '../quest/lifecycle.ts';
import { assigned, adjusted } from '../fact.ts';
import { admission } from '../combat/behavior.ts';
import { attackRefused, encounterId, npcRef } from '../combat/shared.ts';
import { jobId } from '../schedule/behavior.ts';

type ExpeditionEvent = DomainEvent & {
  payload: Extract<DomainEvent['payload'], { type: 'quest_activated' | 'quest_resolved' }>;
};

type Command = { readonly id: CommandId; readonly payload: { readonly actor_id: CharacterId } };
import { current, definition, refused, type Spec } from './shared.ts';

const transition = (
  before: ExpeditionAttempt | null,
  after: ExpeditionAttempt,
  writer_group = 0,
): DeltaOp => ({
  op: 'expedition.transition',
  writer_group,
  quest_instance_id: after.quest_instance_id,
  expected: before,
  value: after,
});

type Choice = Command & {
  payload: Command['payload'] & {
    transition: 'start' | 'restart' | 'shelter';
    detail_id: EntityId;
    quest_instance_id?: QuestInstanceId;
    attempt_id?: CommandId;
    cursor?: number;
  };
};

export function choose(world: World, command: Choice, mint: Mint, steps: Steps) {
  const { actor_id, transition: action } = command.payload;
  const { detail_id, quest_instance_id, attempt_id, cursor } = command.payload;
  const error = refused(world, actor_id, action, detail_id, quest_instance_id, attempt_id, cursor);
  if (error) return { error };
  const { ref, spec } = definition(world);
  const body_id = bodyOf(world, actor_id)!;
  const now = current(world, actor_id);
  if (action === 'shelter') {
    const before = now!.attempt!;
    return {
      ops: [transition(before, { ...before, sheltered: true })],
      events: [] as ExpeditionEvent[],
      narration: [{ key: spec.narration.shelter, participants: { actor: body_id } }],
    };
  }
  const activated = action === 'start' ? activation(mint, actor_id, ref) : undefined;
  const instance = activated?.payload.instance_id ?? now!.instance_id;
  const before = now?.attempt ?? null;
  const after: ExpeditionAttempt = {
    kind: 'expedition',
    actor_id,
    body_id,
    quest_instance_id: instance,
    attempt_id: command.id,
    cursor: 0,
    sheltered: false,
    status: 'active',
  };
  const hound = houndHere(world, spec, body_id, steps);
  const encounter = hound ? openHound(world, actor_id, body_id, hound, mint, steps) : [];
  return {
    ops: [...(activated?.ops ?? []), transition(before, after), ...encounter],
    events: activated
      ? [event(world, command, mint, 1, activated.payload)]
      : ([] as ExpeditionEvent[]),
    narration: [{ key: spec.narration[action], participants: { actor: body_id } }],
  };
}

function houndHere(world: World, spec: Spec, body: EntityId, steps: Steps) {
  return (
    Object.entries(world.state.created ?? {}) as [
      EntityId,
      NonNullable<World['state']['created']>[string],
    ][]
  )
    .filter(
      ([id, row]) =>
        row.origin.kind === 'spawned' &&
        row.origin.role === 'hound' &&
        same(row.origin.by, spec.hound_population) &&
        world.state.containers[id] === world.state.containers[body] &&
        !attackRefused(world, world.character, id) &&
        admission(world, id, steps)?.includes(id),
    )
    .map(([id]) => id)
    .sort(cmp)[0];
}

function openHound(
  world: World,
  actor: CharacterId,
  body: EntityId,
  hound: EntityId,
  mint: Mint,
  steps: Steps,
): DeltaOp[] {
  const roster = admission(world, hound, steps);
  const job = npcRef(world, hound);
  if (!roster?.includes(hound) || !job) throw new KernelError('precondition_failed');
  const encounter_id = encounterId(mint);
  const job_id = jobId(mint);
  return [
    {
      op: 'encounter.open',
      writer_group: 0,
      encounter_id,
      character_id: actor,
      body_id: body,
      npc_id: hound,
      room_id: world.state.containers[body],
      job_id,
      active_ids: roster,
      next_opponent_id: hound,
    },
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id,
      job,
      encounter_id,
      due_time: add(world.state.clock, world.cartridge.world!.combat!.interval),
    },
  ];
}

/** Invoked only after an accepted actual player Move or Flee transfer. */
export function travel(
  world: World,
  command: Command,
  from: EntityId,
  to: EntityId,
  prefix: readonly DeltaOp[],
  mint: Mint,
  steps: Steps,
) {
  const before = current(world, command.payload.actor_id)?.attempt;
  if (
    !before ||
    before.status !== 'active' ||
    before.body_id !== bodyOf(world, command.payload.actor_id)
  )
    return { ops: [] as DeltaOp[], events: [] as ExpeditionEvent[], narration: [] };
  const { spec, ref } = definition(world);
  const allowed = spec.footprint.some((room) => world.roomIds[refString(room)] === to);
  if (!allowed)
    return {
      ops: [transition(before, { ...before, cursor: 0, sheltered: false, status: 'failed' })],
      events: [] as ExpeditionEvent[],
      narration: [{ key: spec.narration.failed, participants: { actor: before.body_id } }],
    };
  const edge = spec.route[before.cursor];
  if (
    !edge ||
    world.roomIds[refString(edge.from)] !== from ||
    world.roomIds[refString(edge.to)] !== to
  )
    return { ops: [] as DeltaOp[], events: [] as ExpeditionEvent[], narration: [] };
  const final = before.cursor + 1 === spec.route.length;
  const op = transition(before, {
    ...before,
    cursor: before.cursor + 1,
    status: final ? 'completed' : 'active',
  });
  if (!final) return { ops: [op], events: [] as ExpeditionEvent[], narration: [] };
  return complete(world, command, before, [...prefix, op], op, mint, steps);
}

function complete(
  world: World,
  command: Command,
  before: ExpeditionAttempt,
  prefix: readonly DeltaOp[],
  op: DeltaOp,
  mint: Mint,
  steps: Steps,
) {
  const { spec, ref } = definition(world);
  const applied = apply(world, prefix);
  if ('fault' in applied) throw new KernelError(applied.fault.code);
  const resolved = resolution(applied.world, before.actor_id, ref, 'completed' as Key, 0, steps);
  if (typeof resolved === 'string') throw new KernelError(resolved);
  const credited = assigned(
    world,
    before.actor_id,
    { ops: [op, ...resolved.ops], position: 0, facts: {} },
    { fact: spec.survived_fact, value: true },
  );
  const rewarded = adjusted(world, before.actor_id, credited, {
    fact: spec.faction,
    amount: spec.faction_delta,
  });
  if (!rewarded) throw new KernelError('precondition_failed');
  return {
    ops: rewarded.ops,
    events: [event(world, command, mint, 2, resolved.payload)],
    narration: [{ key: spec.narration.completed, participants: { actor: before.body_id } }],
  };
}

export function fail(world: World, actor: CharacterId, writer_group: number): DeltaOp[] {
  const before = current(world, actor)?.attempt;
  return before?.status === 'active'
    ? [
        transition(
          before,
          { ...before, cursor: 0, sheltered: false, status: 'failed' },
          writer_group,
        ),
      ]
    : [];
}
