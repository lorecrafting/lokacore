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
import { questOf } from '../lookups.ts';
import { activation, resolution } from '../quest/lifecycle.ts';
import { scopeOf, value } from '../fact.ts';
import { living } from '../death/shared.ts';
import { standing } from '../position/shared.ts';
import { admission } from '../combat/behavior.ts';
import { attackRefused, engaged, encounterId, npcRef } from '../combat/shared.ts';
import { jobId } from '../schedule/behavior.ts';

type ExpeditionEvent = DomainEvent & {
  payload: Extract<DomainEvent['payload'], { type: 'quest_activated' | 'quest_resolved' }>;
};

type Command = { readonly id: CommandId; readonly payload: { readonly actor_id: CharacterId } };
type Spec = NonNullable<NonNullable<World['cartridge']['quests']>[string]['expedition']>;

export function definition(world: World) {
  const entries = Object.entries(world.cartridge.quests ?? {}).filter(([, q]) => q.expedition);
  if (entries.length !== 1) throw new KernelError('precondition_failed');
  const [text, quest] = entries[0]!;
  return {
    ref: {
      cartridge_id: world.cartridge.manifest.id,
      cartridge_version: world.cartridge.manifest.version,
      kind: 'quest' as const,
      key: quest.key,
    },
    spec: quest.expedition!,
    text,
  };
}

export function current(world: World, actor: CharacterId) {
  if (!Object.values(world.cartridge.quests ?? {}).some((q) => q.expedition)) return undefined;
  const { ref } = definition(world);
  const found = questOf(world, actor, ref);
  return (
    found && {
      instance_id: found[0],
      quest: found[1],
      attempt: world.state.expeditions?.[found[0]],
    }
  );
}

export function detailFor(world: World, spec: Spec, transition: 'start' | 'restart' | 'shelter') {
  const room = transition === 'shelter' ? spec.shelter_room : spec.start_room;
  const detail = transition === 'shelter' ? spec.shelter_detail : spec.start_detail;
  return Object.entries(world.details).find(
    ([, d]) => d.room === world.roomIds[refString(room)] && d.key === detail,
  )?.[0] as EntityId | undefined;
}

/** Shared read-only admission for keyed projection and direct commands. */
export function refused(
  world: World,
  actor: CharacterId,
  transition: 'start' | 'restart' | 'shelter',
  detail_id: EntityId,
  instance_id?: QuestInstanceId,
  attempt_id?: CommandId,
  cursor?: number,
) {
  const { spec } = definition(world);
  const body = bodyOf(world, actor);
  if (!body || actor !== world.character) return 'not_found' as const;
  if (detailFor(world, spec, transition) !== detail_id) return 'invalid_target' as const;
  const room =
    world.roomIds[refString(transition === 'shelter' ? spec.shelter_room : spec.start_room)];
  if (world.state.containers[body] !== room) return 'not_present' as const;
  if (!living(world, body) || !standing(world, actor) || engaged(world, body))
    return 'invalid_state' as const;
  const now = current(world, actor);
  if (transition === 'start') return now ? ('invalid_state' as const) : undefined;
  if (!now || now.instance_id !== instance_id || now.attempt?.attempt_id !== attempt_id)
    return 'invalid_state' as const;
  if (transition === 'restart')
    return now.quest.state === 'active' && now.attempt?.status === 'failed'
      ? undefined
      : ('invalid_state' as const);
  return now.quest.state === 'active' &&
    now.attempt?.status === 'active' &&
    now.attempt.cursor === 3 &&
    cursor === 3 &&
    !now.attempt.sheltered
    ? undefined
    : ('invalid_state' as const);
}

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

export function choose(
  world: World,
  command: Command & {
    payload: Command['payload'] & {
      transition: 'start' | 'restart' | 'shelter';
      detail_id: EntityId;
      quest_instance_id?: QuestInstanceId;
      attempt_id?: CommandId;
      cursor?: number;
    };
  },
  mint: Mint,
  steps: Steps,
) {
  const {
    actor_id,
    transition: action,
    detail_id,
    quest_instance_id,
    attempt_id,
    cursor,
  } = command.payload;
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
  const now = current(world, command.payload.actor_id);
  const before = now?.attempt;
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
  const applied = apply(world, [...prefix, op]);
  if ('fault' in applied) throw new KernelError(applied.fault.code);
  const resolved = resolution(applied.world, before.actor_id, ref, 'completed' as Key, 0, steps);
  if (typeof resolved === 'string') throw new KernelError(resolved);
  const fact: DeltaOp = {
    op: 'fact.assign',
    writer_group: 0,
    fact: spec.survived_fact,
    scope: scopeOf(world, before.actor_id, spec.survived_fact),
    expected: value(world, before.actor_id, spec.survived_fact),
    value: true,
  };
  const f = spec.faction;
  const prior = value(world, before.actor_id, f) as number;
  const factionType = world.cartridge.facts[refString(f)].value_type;
  if (factionType.type !== 'int' || factionType.minimum === undefined)
    throw new KernelError('precondition_failed');
  const floor = factionType.minimum;
  const faction: DeltaOp = {
    op: 'fact.assign',
    writer_group: 0,
    fact: f,
    scope: scopeOf(world, before.actor_id, f),
    expected: prior,
    value: Math.max(floor, prior + spec.faction_delta),
  };
  return {
    ops: [op, ...resolved.ops, fact, faction],
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
