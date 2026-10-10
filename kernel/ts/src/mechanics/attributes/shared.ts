import type {
  AncestrySpec,
  CharacterId,
  DefinitionRef,
  DerivedStat,
  EntityId,
  Tag,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { divide, saturate } from '../../foundation/int.ts';
import { bodyOf, refString, values, type World } from '../../runtime/decision.ts';
import { activeStatuses } from '../status/shared.ts';

export const initialValues = (world: World, ancestry: AncestrySpec) => {
  const starts = Object.fromEntries(
    Object.entries(world.cartridge.attributes ?? {}).map(([ref, spec]) => [ref, spec.start]),
  );
  const selected = refString(ancestry.attribute);
  return { ...starts, [selected]: starts[selected]! + ancestry.modifier };
};

export const choice = (world: World, actor: CharacterId) => world.state.characters?.[actor];

/**
 * The actor's attribute: its selected (else starting) value plus its allocated levelling points
 * (row 4) plus what its worn items and active statuses grant (rows 3, 2c),
 * saturated to the ResourceInt range so no read outside an action can fault (mechanics.md row 3).
 */
export function value(world: World, actor: CharacterId, attribute: DefinitionRef) {
  const base =
    choice(world, actor)?.attributes[refString(attribute)] ?? world.attributes[key(attribute)];
  const allocated = world.state.levelling?.[actor]?.allocated[refString(attribute)] ?? 0;
  const body = bodyOf(world, actor);
  const bonus = worn(world, actor, attribute) + (body ? modifiers(world, body, attribute) : 0);
  return base === undefined ? base : saturate(base + allocated + bonus);
}

/** The items worn by the actor's body: those in its slot holders (equipment@1). */
function wornItems(world: World, actor: CharacterId) {
  const body = bodyOf(world, actor);
  if (!body) return [];
  const holders = new Set(values(world.slots).filter((h) => world.state.containers[h] === body));
  // ponytail: scans every placement per read; index worn items if worlds with affects grow large.
  return Object.entries(world.state.containers).flatMap(([item, at]) => {
    const e = holders.has(at) ? world.entities[item] : undefined;
    return e?.kind === 'item' ? [e] : [];
  });
}

/** The saturated sum of `attribute`'s affects on the items worn by the actor's body (row 3). */
export function worn(world: World, actor: CharacterId, attribute: DefinitionRef) {
  if (!Object.values(world.cartridge.items ?? {}).some((i) => i.affects)) return 0;
  const ref = refString(attribute);
  let sum = 0; // plain sums of 32-bit amounts stay exact
  for (const e of wornItems(world, actor))
    for (const a of e.affects ?? []) if (refString(a.attribute) === ref) sum += a.modifier;
  return saturate(sum);
}

/** The `wearing` leaf (toolbox row W25): a worn item's definition declares `tag`. */
export const wearing = (world: World, actor: CharacterId, tag: Tag) =>
  wornItems(world, actor).some((e) => e.tags?.includes(tag));

/**
 * The saturated sum of `attribute`'s `modifies` over the statuses active on `holder` (row 2c): one
 * row per holder and status, so the same status never counts twice.
 */
export function modifiers(world: World, holder: EntityId, attribute: DefinitionRef) {
  if (!Object.values(world.cartridge.statuses ?? {}).some((s) => s.modifies)) return 0;
  const ref = refString(attribute);
  let sum = 0;
  for (const { spec } of activeStatuses(world, holder))
    for (const m of spec.modifies ?? []) if (refString(m.attribute) === ref) sum += m.modifier;
  return saturate(sum);
}

/**
 * The NPC instance's attribute (row G3): its definition's declared value, else the attribute's
 * start, plus its active statuses' modifiers (row 2c), read at use.
 */
export function npcValue(world: World, npc: EntityId, attribute: DefinitionRef) {
  const e = world.entities[npc];
  const ref = refString(attribute);
  const declared =
    e?.kind === 'npc' ? e.attributes?.find((a) => refString(a.attribute) === ref) : undefined;
  const base = declared?.value ?? world.attributes[key(attribute)];
  return base === undefined ? base : saturate(base + modifiers(world, npc, attribute));
}

/**
 * A derived stat's attribute bonus (mechanics.md derived stats), floored toward minus infinity. Each
 * term and the sum saturate to the ResourceInt range; clamping the double product is exact, since
 * its rounding is monotone. `read` gives an attribute's value: the player character's by default,
 * an NPC's through npcValue (row G3).
 */
export function derived(
  world: World,
  actor: CharacterId,
  stat: DerivedStat | undefined,
  read = (a: DefinitionRef) => value(world, actor, a)!,
) {
  if (!stat) return 0;
  let sum = 0;
  for (const t of stat.terms) sum += saturate(t.per_point * (read(t.attribute) - t.pivot));
  const [q, r] = divide(saturate(sum), stat.divisor ?? 1);
  return r < 0 ? q - 1 : q;
}

export const darkSight = (world: World, actor: CharacterId) => {
  const selected = choice(world, actor)?.ancestry;
  return selected !== undefined && world.cartridge.ancestries?.[selected]?.dark_sight === true;
};
