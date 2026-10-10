import { encode, type Json } from './canonical.ts';
import { populationRow } from './compose_population.ts';
import type { MutationTarget } from '../contracts.gen.ts';
import type { Ctx, Obj, State } from './compose.ts';

export const key = (value: unknown): string => encode(value as Json);
export const get = (o: Json | undefined, k: string): Json | undefined =>
  o !== null && typeof o === 'object' && !Array.isArray(o) && Object.hasOwn(o, k)
    ? (o as Obj)[k]
    : undefined;
export const section = (s: State, name: string): Obj => (get(s, name) ?? {}) as Obj;
export const containment = (e: string): MutationTarget =>
  ({ kind: 'containment', entity_id: e }) as MutationTarget;
// size: allow 46, closed row-target dispatch includes actor-owned knowledge and status rows
export function read(t: MutationTarget, ctx: Ctx): Json | undefined {
  const w = ctx.overlay.get(key(t));
  if (w) return w.value;
  const s = ctx.state;
  if (t.kind === 'population_plan' || t.kind === 'population_slot') return populationRow(t, s);
  if (t.kind === 'clock') return s.clock;
  if (t.kind === 'character') return get(section(s, 'characters'), t.character_id);
  if (t.kind === 'fact') return get(section(s, 'facts'), key(t));
  if (t.kind === 'crow') return get(section(s, 'crows'), key(t));
  switch (t.kind) {
    case 'visit':
      return get(section(s, 'visited_rooms'), key(t));
    case 'observation':
      return get(section(s, 'observed_npcs'), key(t));
    case 'entity':
      return get(section(s, 'created'), t.entity_id);
    case 'containment':
      return get(section(s, 'containers'), t.entity_id);
    case 'quest':
      return get(section(s, 'quests'), t.instance_id);
    case 'choice':
      return get(section(s, 'choices'), t.continuation_id);
    case 'job':
      return get(section(s, 'jobs'), t.job_id);
    case 'bleed':
      return get(section(s, 'bleeds'), t.body_id);
    case 'status':
      return get(section(s, 'statuses'), key(t));
    case 'encounter':
      return get(section(s, 'encounters'), t.encounter_id);
    case 'patrol':
    case 'expedition':
      return get(section(s, `${t.kind}s`), t.quest_instance_id);
    case 'water':
      return get(section(s, 'water'), t.actor_id);
    case 'escort':
      return get(section(s, 'escorts'), t.actor_id);
    case 'resource':
    case 'cooldown':
    case 'barrier':
      return get(section(s, `${t.kind}s`), key(t));
    case 'fuel':
    case 'liquid':
      return get(section(s, t.kind === 'fuel' ? 'fuel' : 'liquids'), t.item_id);
  }
}

// ponytail: scans the whole section; add a contents/scope index when a cartridge has many rows.
export function rows(kind: string, name: string, id: string, ctx: Ctx): [string, Json][] {
  const changed = new Map<string, Json>();
  for (const w of ctx.overlay.values())
    if (w.target.kind === kind) changed.set(get(w.target as Json, id) as string, w.value);
  const base = Object.entries(section(ctx.state, name)).filter(([k]) => !changed.has(k));
  return [...base, ...changed];
}
