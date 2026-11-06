// dev@1 (capability_registry.json; cartridge.md Author preview): the author preview's go-to-room,
// set-fact and set-level. Only stepDev reaches this rule, and only a host that says `dev` calls
// stepDev, so a release refuses them; they are ordinary receipted Commands, so a reopen and `bin/loka check`
// re-decide them under the same seed and clock. Each refusal keeps a world invariant.
import { KernelError } from '../../foundation/error.ts';
import {
  accepted,
  bodyOf,
  entries,
  event,
  refString,
  rejected,
  type Rule,
  values,
  type World,
} from '../../runtime/decision.ts';
import type { CharacterId, Command, EntityId } from '../../contracts.gen.ts';
import { engaged } from '../combat/shared.ts';
import { travel } from '../escort/shared.ts';
import { current } from '../expedition/shared.ts';
import { assigned, subjective, typed, value } from '../fact.ts';
import { levelling, write } from '../levelling/shared.ts';
import { standing } from '../position/shared.ts';
import { settleMaxima } from '../resource.ts';
import { running } from '../scene/shared.ts';

/** True while moving the body alone would leave a fight, a ride, a group or a walked route wrong. */
const heldInPlace = (world: World, actor: CharacterId, body: EntityId, here: EntityId) =>
  !!engaged(world, body) ||
  !standing(world, actor) ||
  values(world.state.choices ?? {}).some((c) => c.actor_id === actor && c.status === 'pending') ||
  !!running(world, actor) ||
  !!world.state.water?.[actor]?.room_id ||
  travel(world, actor, here, here).length > 0 ||
  current(world, actor)?.attempt?.status === 'active' ||
  values(world.state.patrols ?? {}).some(
    (p) => p.actor_id === actor && ['together', 'awaiting'].includes(p.status),
  );

type SetFact = Extract<Command['payload'], { type: 'dev_set_fact' }>;

// A reopen checks these against its mechanic's receipts (mobile expedition-save, deadline-save), so a cheated value would leave the save unopenable.
const provenFacts = (world: World) => {
  const { quests } = world.cartridge;
  return [
    ...values(quests ?? {}).flatMap((q) =>
      q.expedition ? [q.expedition.survived_fact, q.expedition.faction] : [],
    ),
    ...values(quests ?? {}).flatMap((q) =>
      q.deadline?.fact
        ? [q.deadline.fact, ...(q.deadline.trust_fact ? [q.deadline.trust_fact] : [])]
        : [],
    ),
  ];
};

const setFact = (world: World, payload: SetFact): ReturnType<Rule<'dev'>> => {
  const { actor_id, fact, value: to } = payload;
  const spec = world.cartridge.facts[refString(fact)];
  if (!spec) return rejected('not_found');
  const reserved =
    (fact.key === 'position' && world.cartridge.lock.capabilities.position) ||
    values(world.cartridge.scenes ?? {}).some((s) => fact.key === `scene_${s.key}`) ||
    provenFacts(world).some((f) => refString(f) === refString(fact));
  if (
    reserved ||
    subjective(world, fact) ||
    !typed(to, spec.value_type) ||
    value(world, actor_id, fact) === to
  )
    return rejected('invalid_state');
  try {
    const run = assigned(world, actor_id, { ops: [], position: 0, facts: {} }, { fact, value: to });
    return accepted(world, 'dev_fact_set', run.ops, []);
  } catch (e) {
    if (e instanceof KernelError && e.code === 'precondition_failed')
      return rejected('invalid_state'); // another mechanic owns this fact
    throw e;
  }
};

type SetLevel = Extract<Command['payload'], { type: 'dev_set_level' }>;

// Toolbox row 4: experience at the level's threshold; a count never falls (compose_levelling).
const setLevel = (
  world: World,
  { actor_id, level, allocated = [] }: SetLevel,
): ReturnType<Rule<'dev'>> => {
  const spec = world.cartridge.world?.levelling;
  const row = levelling(world, actor_id)?.row ?? { experience: 0, allocated: {} };
  if (allocated.some((a) => !world.cartridge.attributes?.[refString(a.attribute)]))
    return rejected('not_found');
  if (!spec || level > spec.thresholds.length + 1) return rejected('invalid_state');
  if (allocated.some((a) => a.points < (row.allocated[refString(a.attribute)] ?? 0)))
    return rejected('invalid_state');
  const next = allocated.reduce<Record<string, number>>(
    (o, a) => (a.points ? { ...o, [refString(a.attribute)]: a.points } : o),
    row.allocated,
  );
  const experience = spec.thresholds[level - 2] ?? 0;
  const spent = values(next).reduce((a, n) => a + n, 0);
  const same =
    experience === row.experience && entries(next).every(([a, n]) => row.allocated[a] === n);
  if (same || spent > spec.points_per_level * (level - 1)) return rejected('invalid_state');
  const ops = [...settleMaxima(world), write(world, actor_id, { experience, allocated: next }, 0)]; // mutate-skip: the decision's only write group
  return accepted(world, 'dev_level_set', ops, []);
};

export const decide: Rule<'dev'> = (world, command, mint) => {
  const { payload } = command;
  const { actor_id } = payload;
  if (payload.type === 'dev_go_to_room') {
    const there = world.roomIds[refString(payload.room)];
    const body = bodyOf(world, actor_id);
    if (!there || !body) return rejected('not_found');
    const here = world.state.containers[body]!;
    // waterValid: a route bottom holds exactly the bodies with a water row, which only a swim opens.
    const underwater = world.cartridge.world?.water?.routes.some(
      (r) => world.roomIds[refString(r.bottom)] === there,
    );
    if (here === there || underwater || heldInPlace(world, actor_id, body, here))
      return rejected('invalid_state');
    const op = {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: body,
      source_id: here,
      destination_id: there,
    } as const;
    const entered = event(world, command, mint, 1, {
      type: 'entity_entered_room',
      entity_id: body,
      room_id: there,
    });
    return accepted(world, 'dev_moved', [op], [entered]);
  }
  return payload.type === 'dev_set_fact' ? setFact(world, payload) : setLevel(world, payload);
};
