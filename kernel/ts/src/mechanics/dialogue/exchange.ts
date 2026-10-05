// Exact funded item exchange; quest tuning supplies every family, quantity and faction value.
import { selected } from '../containment/stock.ts';
import {
  LIMITS,
  type CharacterId,
  type Command,
  type DefinitionRef,
  type DialogueDefinition,
  type EntityId,
  type RoleBinding,
} from '../../contracts.gen.ts';
import {
  event,
  bodyOf,
  refString,
  type ChoiceRow,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { questOf } from '../lookups.ts';
import { living } from '../death/shared.ts';
import { carryingExchange } from '../containment/shared.ts';
import { value, adjusted, assigned, type Assigned } from '../fact.ts';
import { same } from '../../foundation/compose.ts';

export const exchangeDefinition = (world: World, quest: DefinitionRef) =>
  world.cartridge.quests?.[refString(quest)]?.exchange;

/** Acceptance, continuation binding and turn-in share funded current-custody readiness. */
// size: allow 50, shared funded readiness rechecks exact bound stock and final load
export function ready(
  world: World,
  actor: CharacterId,
  quest: DefinitionRef,
  steps: Steps,
  exact?: { outgoing: readonly EntityId[]; incoming: readonly EntityId[] },
) {
  const x = exchangeDefinition(world, quest);
  const body = bodyOf(world, actor);
  if (!x || !body) return 'invalid_state' as const;
  const npc = world.entityIds[refString(x.npc)];
  if (!living(world, npc) || world.state.containers[npc] !== world.state.containers[body])
    return 'not_present' as const;
  const count = exact ? Math.max(x.outgoing.length, x.incoming.length) : x.quantity;
  const eligibleOut = selected(world, x.outgoing, body, count, steps);
  const eligibleIn = selected(world, x.incoming, npc, count, steps);
  if (typeof eligibleOut === 'string' || typeof eligibleIn === 'string')
    return 'budget_exceeded' as const;
  if (
    exact &&
    (exact.outgoing.some((id) => !eligibleOut.includes(id)) ||
      exact.incoming.some((id) => !eligibleIn.includes(id)))
  )
    return 'not_owned' as const;
  const outgoing = exact ? [...exact.outgoing] : eligibleOut;
  const incoming = exact ? [...exact.incoming] : eligibleIn;
  if (outgoing.length !== x.quantity || incoming.length !== x.quantity)
    return 'quest_requirement' as const;
  const code = carryingExchange(world, body, outgoing, incoming, steps);
  if (code) return code;
  const capacity = world.capacities[npc];
  if (capacity !== undefined) {
    let held = 0;
    for (const at of Object.values(world.state.containers)) {
      if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
      if (at === npc) held++;
    }
    if (held - incoming.length + outgoing.length > capacity) return 'invalid_state' as const;
  }
  if (!contribution(world, actor, quest, { ops: [], position: 0, facts: {} }))
    return 'precondition_failed' as const;
  return { npc, body, outgoing, incoming };
}

export function exchangeRoles(
  world: World,
  actor: CharacterId,
  d: DialogueDefinition,
  steps: Steps,
): RoleBinding[] {
  if (!d.quest || !Object.values(d.choices).some((o) => o.exchange)) return [];
  const result = ready(world, actor, d.quest, steps);
  if (typeof result === 'string') return [];
  return (['outgoing', 'incoming'] as const).flatMap((kind) =>
    result[kind].map(
      (entity_id, i) =>
        ({ role: `${kind}_${String(i).padStart(2, '0')}`, entity_id }) as RoleBinding,
    ),
  );
}

export function exchangeBlocked(world: World, row: ChoiceRow, quest: DefinitionRef, steps: Steps) {
  const prior = questOf(world, row.actor_id, quest);
  if (
    !prior ||
    prior[0] !== row.quest_instance_id ||
    !['active', 'objectives_complete'].includes(prior[1].state)
  )
    return 'invalid_state' as const;
  const x = exchangeDefinition(world, quest)!;
  const bound = (kind: 'outgoing' | 'incoming') =>
    row.roles.filter((r) => r.role.startsWith(`${kind}_`));
  const outgoing = bound('outgoing'),
    incoming = bound('incoming');
  for (const [kind, rows] of [
    ['outgoing', outgoing],
    ['incoming', incoming],
  ] as const)
    if (
      rows.length !== x.quantity ||
      rows.some((r, i) => r.role !== `${kind}_${String(i).padStart(2, '0')}`) ||
      !same(
        rows.map((r) => r.entity_id),
        rows.map((r) => r.entity_id).sort(),
      )
    )
      return 'invalid_state' as const;
  const ids = [...outgoing, ...incoming].map((r) => r.entity_id);
  if (new Set(ids).size !== ids.length) return 'invalid_state' as const;
  const result = ready(world, row.actor_id, quest, steps, {
    outgoing: outgoing.map((r) => r.entity_id),
    incoming: incoming.map((r) => r.entity_id),
  });
  if (typeof result === 'string') return result;
}

/** Saturation consumes only positive faction gain actually awarded by this quest. */
export function contribution(
  world: World,
  actor: CharacterId,
  quest: DefinitionRef,
  run: Assigned,
): Assigned | undefined {
  const x = exchangeDefinition(world, quest)!;
  const spec = world.cartridge.facts[refString(x.contribution)];
  const type = spec?.value_type;
  const accumulated = value(world, actor, x.contribution);
  const before = value(world, actor, x.faction);
  if (
    type?.type !== 'int' ||
    !Number.isSafeInteger(accumulated) ||
    typeof accumulated !== 'number' ||
    accumulated < type.minimum! ||
    accumulated > type.maximum! ||
    typeof before !== 'number'
  )
    return;
  const next = adjusted(world, actor, run, {
    fact: x.faction,
    amount: Math.min(x.increment, type.maximum! - accumulated),
  });
  if (!next) return;
  const after = next.ops.at(-1);
  if (after?.op !== 'fact.assign' || typeof after.value !== 'number') return;
  return assigned(world, actor, next, {
    fact: x.contribution,
    value: accumulated + Math.max(0, after.value - before),
  });
}

export function exchangeTransfers(
  world: World,
  command: Command & { payload: Extract<Command['payload'], { type: 'choose' }> },
  mint: Mint,
  row: ChoiceRow,
  body: EntityId,
  quest: DefinitionRef,
) {
  const npc = world.entityIds[refString(exchangeDefinition(world, quest)!.npc)];
  const items = row.roles.filter((r) => /^(outgoing|incoming)_\d{2}$/.test(r.role));
  const ops = items.map((r) => ({
    op: 'entity.transfer' as const,
    writer_group: 0,
    entity_id: r.entity_id,
    source_id: r.role.startsWith('outgoing_') ? body : npc,
    destination_id: r.role.startsWith('outgoing_') ? npc : body,
  }));
  const events = ops.map((op, i) =>
    event(world, command, mint, i + 1, {
      type: 'item_acquired',
      item_id: op.entity_id,
      holder_id: op.destination_id,
    }),
  );
  return { ops, events };
}
