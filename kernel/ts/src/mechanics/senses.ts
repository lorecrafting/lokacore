// sense_cue@1 (toolbox row G6; mechanics.md sense cues): which declared cues reach a room, read by
// the view (GameView cues) and the cue_perceived policy leaf. Projection only: nothing is stored.
// The policy evaluator comes in as `holds`, so this module never imports policy (no import cycle).
import {
  LIMITS,
  type CharacterId,
  type Cue,
  type DomainEvent,
  type EntityId,
  type Key,
  type Policy,
} from '../contracts.gen.ts';
import { bodyOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { cmp } from '../foundation/validate.ts';
import { living } from './death/shared.ts';
import { fuelView } from './light/shared.ts';
import { exitOf, hidden } from './lookups.ts';
import type { holds } from './policy.ts';
import { specOf } from './status/shared.ts';

type Source = { readonly room: string; readonly cue: Cue };
type Near = { readonly d: number; readonly direction?: string };
type Holds = typeof holds;
const over = (steps: Steps) => ++steps.n > LIMITS.query_steps;

// The room holding `id` (itself when a room), through its containers; one step per hop.
function roomOf(w: World, id: string, steps: Steps): string | undefined {
  let at: string | undefined = id;
  while (at !== undefined && !w.rooms[at]) at = over(steps) ? undefined : w.state.containers[at];
  return at;
}

// Each room within two exits of `from`, with its distance and the first exit towards it: breadth
// first, exits in direction-key order, so a tie goes to the first direction. Exits hidden from
// `actor` (row 11) carry nothing; closed doors do (a cue's `when` can read barrier_state).
function around(w: World, actor: CharacterId, from: string, steps: Steps) {
  const near = new Map<string, Near>([[from, { d: 0 }]]);
  let edge = [from];
  for (let d = 1; d <= 2; d++) {
    const next: string[] = [];
    for (const at of edge) {
      const room = w.rooms[at]!;
      for (const direction of Object.keys(room.exits).sort(cmp)) {
        if (over(steps)) return near;
        const to = w.roomIds[refString(exitOf(room, direction)!.to)];
        if (!to || near.has(to) || hidden(w, room, direction, actor)) continue;
        near.set(to, { d, direction: near.get(at)!.direction ?? direction });
        next.push(to);
      }
    }
    edge = next;
  }
  return near;
}

// Every active declared cue with its source room: rooms, details, items and NPCs, lit fuel
// sources and active statuses (from the holder's room). ponytail: authored instances only; a
// created entity (a spawned NPC) carries no cues until a row needs it.
function sources(w: World, steps: Steps): Source[] {
  const out: Source[] = [];
  const add = (room: string | undefined, cues: readonly Cue[] = []) => {
    if (room) for (const cue of cues) out.push({ room, cue });
  };
  for (const [id, r] of Object.entries(w.rooms)) add(id, r.cues);
  for (const d of Object.values(w.details)) add(d.room, d.cues);
  for (const [id, e] of Object.entries(w.entities))
    if (e.cues && (e.kind !== 'npc' || living(w, id as EntityId)))
      add(roomOf(w, id, steps), e.cues);
  for (const [id, f] of Object.entries(w.fuelSpecs))
    if (f.kind === 'source' && f.cues && fuelView(w, id)?.lit) add(roomOf(w, id, steps), f.cues);
  for (const [at, row] of Object.entries(w.state.statuses ?? {})) {
    if (!row.active) continue;
    const { body_id, status } = JSON.parse(at);
    const cues = specOf(w, status)?.cues; // a status without cues costs no step
    if (cues) add(roomOf(w, body_id, steps), cues);
  }
  return out;
}

// The transient cues of the recipe outcome that caused a reaction, from the actor's room;
// undefined when the cause is no recipe outcome event.
function outcomeCues(w: World, actor: CharacterId, cause: DomainEvent | undefined) {
  const p = cause?.payload;
  if (p?.type !== 'check_failed' && p?.type !== 'check_passed' && p?.type !== 'action_completed')
    return undefined;
  const recipe = Object.values(w.cartridge.recipes ?? {}).find((r) =>
    p.type === 'action_completed' ? r.key === p.action : r.check?.key === p.check.key,
  );
  const cues = recipe?.outcomes[p.type === 'check_failed' ? 'failure' : 'success']?.cues ?? [];
  const body = bodyOf(w, actor);
  const room = body && w.state.containers[body];
  return room ? cues.map((cue): Source => ({ room, cue })) : [];
}

/**
 * The cues reaching `room` for `actor`, each with its distance and first direction: within its
 * range and with its `when` holding for the actor, from the declared sources or only `heard`. A
 * cue's `when` never perceives (no recursion). Empty without sense_cue@1, so a cartridge without
 * it pays no step.
 */
export function reaching(
  w: World,
  actor: CharacterId,
  room: string,
  steps: Steps,
  holds: Holds,
  heard?: Source[],
) {
  if (!w.cartridge.lock.capabilities.sense_cue) return [];
  const near = around(w, actor, room, steps);
  return (heard ?? sources(w, steps)).flatMap(({ room: at, cue }) => {
    const n = near.get(at);
    const reached =
      n && n.d <= cue.range && (!cue.when || holds(w, actor, cue.when.root, { steps, cue: true }));
    return reached ? [{ cue, ...n }] : [];
  });
}

/** GameView cues: those reaching the actor's room, nearest first, then by direction and text. */
export function cueViews(w: World, steps: Steps, holds: Holds) {
  const cues = reaching(w, w.character, w.state.containers[w.body]!, steps, holds)
    .sort(
      (a, b) =>
        a.d - b.d || cmp(a.direction ?? '', b.direction ?? '') || cmp(a.cue.text, b.cue.text),
    )
    .map(({ cue, direction }) => ({
      sense: cue.sense,
      text: cue.text,
      ...(direction && { direction: direction as Key }),
    }));
  return cues.length > 0 ? { cues } : {};
}

/**
 * cue_perceived: the living NPC's room is reached by a cue of `sense`; in a reaction to a recipe
 * outcome, only by that outcome's transient cues (the action was heard, not the ambient noise).
 */
export function perceived(
  w: World,
  actor: CharacterId,
  p: Extract<Policy, { op: 'cue_perceived' }>,
  ctx: { steps: Steps; cause?: DomainEvent; cue?: true },
  holds: Holds,
) {
  if (ctx.cue) return false;
  const npc = w.entityIds[refString(p.npc)];
  const room = npc && living(w, npc) ? roomOf(w, npc, ctx.steps) : undefined;
  if (!room) return false;
  const cues = reaching(w, actor, room, ctx.steps, holds, outcomeCues(w, actor, ctx.cause));
  return cues.some(({ cue }) => cue.sense === p.sense) && ctx.steps.n <= LIMITS.query_steps;
}
