// dev@1 (capability_registry.json; cartridge.md Author preview): the author preview's go-to-room
// and set-fact. Only stepDev reaches this rule, and only a host that says `dev` calls stepDev, so a
// release refuses both; they are ordinary receipted Commands, so a reopen and `bin/loka check`
// re-decide them under the same seed and clock. Each refusal keeps a world invariant.
import { KernelError } from '../../foundation/error.ts';
import {
  accepted,
  bodyOf,
  event,
  refString,
  rejected,
  type Rule,
  values,
  type World,
} from '../../runtime/decision.ts';
import type { CharacterId, Command, EntityId } from '../../contracts.gen.ts';
import { engaged } from '../combat/shared.ts';
import { pending } from '../dialogue/shared.ts';
import { travel } from '../escort/shared.ts';
import { current } from '../expedition/shared.ts';
import { assigned, subjective, typed, value } from '../fact.ts';
import { standing } from '../position/shared.ts';
import { running } from '../scene/shared.ts';

/** True while moving the body alone would leave a fight, a ride, a group or a walked route wrong. */
const heldInPlace = (world: World, actor: CharacterId, body: EntityId, here: EntityId) =>
  !!engaged(world, body) ||
  !standing(world, actor) ||
  !!pending(world, actor) ||
  !!running(world, actor) ||
  !!world.state.water?.[actor]?.room_id ||
  travel(world, actor, here, here).length > 0 ||
  current(world, actor)?.attempt?.status === 'active' ||
  values(world.state.patrols ?? {}).some(
    (p) => p.actor_id === actor && ['together', 'awaiting'].includes(p.status),
  );

type SetFact = Extract<Command['payload'], { type: 'dev_set_fact' }>;

const setFact = (world: World, payload: SetFact): ReturnType<Rule<'dev'>> => {
  const { actor_id, fact, value: to } = payload;
  const spec = world.cartridge.facts[refString(fact)];
  if (!spec) return rejected('not_found');
  const reserved =
    (fact.key === 'position' && world.cartridge.lock.capabilities.position) ||
    values(world.cartridge.scenes ?? {}).some((s) => fact.key === `scene_${s.key}`);
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

export const decide: Rule<'dev'> = (world, command, mint) => {
  const { payload } = command;
  const { actor_id } = payload;
  if (payload.type === 'dev_go_to_room') {
    const there = world.roomIds[refString(payload.room)];
    const body = bodyOf(world, actor_id);
    if (!there || !body) return rejected('not_found');
    const here = world.state.containers[body]!;
    if (here === there || heldInPlace(world, actor_id, body, here))
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
  return setFact(world, payload);
};
