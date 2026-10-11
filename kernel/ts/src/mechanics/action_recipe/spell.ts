// Toolbox row 29b: a spell's effects, steps only a spell recipe holds (the loaders refuse them on
// any other): status.apply through status@1's shared step (so a first application emits
// status_applied), damage of a G2 kind after the NPC's resistances, and light.ignite through
// light@1's ignite transition. The holders are the named NPC's or item's instance, else the caster.
import type {
  DeltaOp,
  EventPayload,
  EntityId,
  RecipeStep,
  RngState,
  TextKey,
} from '../../contracts.gen.ts';
import {
  event,
  refString,
  type Event,
  type Mint,
  type Rule,
  type World,
} from '../../runtime/decision.ts';
import { key } from '../../foundation/compose.ts';
import { adjust, resourceRef, type Levels } from '../resource.ts';
import { living } from '../death/shared.ts';
import { deathSequence } from '../death/sequence.ts';
import { closeEncounter, engaged, resisted } from '../combat/shared.ts';
import { prefix } from '../combat/round_attack.ts';
import { statusStep } from '../status/shared.ts';
import { transition } from '../light/shared.ts';

export type Effected = {
  readonly ops: readonly DeltaOp[];
  readonly events: readonly Event<
    'custom_event' | 'check_passed' | 'check_failed' | 'status_applied' | 'entity_died'
  >[];
  readonly position: number;
  readonly levels: Levels;
  readonly lines: readonly { key: TextKey }[];
  readonly rng: RngState;
};
type Effect = Extract<RecipeStep, { op: 'status.apply' | 'damage' | 'light.ignite' }>;
type Cast = Parameters<Rule<'action_recipe'>>[1];
type Applied = Extract<EventPayload, { type: 'status_applied' }>;

export function effect<R extends Effected>(
  world: World,
  command: Cast,
  mint: Mint,
  body: EntityId,
  r: R,
  s: Effect,
): R {
  if (s.op === 'light.ignite') {
    const item = world.entityIds[refString(s.item)];
    const lit = item && transition(world, command.payload.actor_id, 'ignite', item);
    // A second ignite of one source reads the same committed fuel row: it writes nothing.
    const again = r.ops.some((o) => o.op === 'fuel.set' && o.item_id === item);
    return lit && typeof lit !== 'string' && !again ? { ...r, ops: [...r.ops, ...lit.ops] } : r;
  }
  const npc = s.npc && world.entityIds[refString(s.npc)];
  if (npc && (!living(world, npc) || slain(world, r.levels, npc))) return r;
  if (s.op === 'damage') return npc ? damage(world, command, mint, body, r, npc, s) : r;
  const events = [...r.events];
  let position = r.position;
  const emit = (payload: Applied) => events.push(event(world, command, mint, ++position, payload));
  // Once per holder and status in the spell, as in a reaction: a write earlier in the run wins.
  const applied = new Set(
    r.ops.flatMap((o) =>
      o.op === 'status.transition' ? [`${o.body_id}|${refString(o.status)}`] : [],
    ),
  );
  const on = [s.npc ? npc : body];
  const done = statusStep(world, s, on, body, 0, { holders: new Map(), applied }, mint, emit);
  const lines = [...r.lines, ...done.narration];
  return { ...r, ops: [...r.ops, ...done.ops], events, position, lines };
}

const hp = (world: World, npc: EntityId) =>
  key({ kind: 'resource', resource: resourceRef(world, 'hp'), entity_id: npc });
// An NPC an earlier damage step of this spell brought to 0 takes no later effect.
const slain = (world: World, levels: Levels, npc: EntityId) => levels[hp(world, npc)] === 0;

// The loss after resistances, stopping at 0; a loss to 0 closes the NPC's encounter when it is the
// only opponent (as a fatal status tick, status/job.ts) and runs the death sequence, the caster the
// killer and credited (row 6b), its drops drawn after the spell's check.
function damage<R extends Effected>(
  world: World,
  command: Cast,
  mint: Mint,
  body: EntityId,
  r: R,
  npc: EntityId,
  s: Extract<Effect, { op: 'damage' }>,
): R {
  const loss = resisted(world, npc, [s.kind], s.amount);
  const { op, levels } = adjust(world, npc, resourceRef(world, 'hp'), -loss, r.levels, true);
  if (op.from === op.to) return r;
  if (op.to > 0) return { ...r, ops: [...r.ops, op], levels };
  const fight = engaged(world, npc);
  const sole = fight && (fight.row.active_ids?.length ?? 1) === 1;
  const ops = [...r.ops, op, ...(sole ? closeEncounter(world, npc) : [])];
  const fatal = {
    loss: op,
    owner_id: null,
    killer_id: body,
    credited_character_id: command.payload.actor_id,
  };
  const died = deathSequence(prefix(world, ops), command, fatal, mint, r.rng);
  const events = died.events.map((e, i) => ({ ...e, position: r.position + 1 + i }));
  return {
    ...r,
    ops: [...ops, ...died.ops],
    events: [...r.events, ...events],
    position: r.position + events.length,
    levels,
    rng: died.rng ?? r.rng,
  };
}
