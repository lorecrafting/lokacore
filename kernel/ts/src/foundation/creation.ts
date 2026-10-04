import { validate } from './validate.ts';
import { encode, type Json } from './canonical.ts';
import type { DeltaOp } from '../contracts.gen.ts';
import type { State } from './compose.ts';
type Obj = { readonly [key: string]: Json };
const section = (state: State, name: string): Obj => (state[name] ?? {}) as Obj;
const key = (value: Json): string => encode(value);

/** Narrow pinned provenance guard for durable corpse identities; used again on save hydration. */
export function creationValid(identity: Json, state: State): boolean {
  if (validate('EntityIdentity', identity).length) return false;
  const i = identity as Obj;
  const origin = i.origin as Obj;
  const victim = section(state, 'known_entities')[origin.victim_id as string] as Obj | undefined;
  const template = section(state, 'corpse_templates')[key(i.definition)];
  return (
    !Object.hasOwn(section(state, 'known_entities'), i.id as string) &&
    !Object.hasOwn(section(state, 'containers'), i.id as string) &&
    i.scope === undefined &&
    i.audience === undefined &&
    origin.kind === 'death' &&
    (template === 'player'
      ? victim?.kind === 'body' && origin.owner_id === victim.owner_id
      : template === 'npc' && victim?.kind === 'npc' && origin.owner_id === null)
  );
}

export function initialPair(op: DeltaOp, next: DeltaOp | undefined): boolean {
  return (
    op.op !== 'entity.create' ||
    (next?.op === 'entity.transfer' &&
      next.entity_id === op.identity.id &&
      next.source_id === null &&
      next.writer_group === op.writer_group)
  );
}

export function initialPlacement(
  op: DeltaOp & { op: 'entity.transfer' },
  row: Json | undefined,
  group: number | undefined,
  state: State,
): boolean {
  return (
    row === undefined &&
    group === op.writer_group &&
    (section(state, 'known_entities')[op.destination_id] as Obj | undefined)?.kind === 'room'
  );
}
