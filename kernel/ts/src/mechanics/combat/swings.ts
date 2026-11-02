// An opportunity's swings (loka-kgd.200, mechanics.md "Swings"): the round's draws, each swing's
// hit, defense and damage, and the summary line that tells several of them.
import { status } from '../skills.ts';
import type {
  AttackProfile,
  CombatSettings,
  DefinitionRef,
  EncounterRow,
  EntityId,
  Tag,
  Text,
  TextKey,
} from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { add, mul } from '../../foundation/int.ts';
import { uniformCounted } from '../../foundation/rng.ts';
import { standing } from '../position/shared.ts';
import { equipped } from '../lookups.ts';
import type { Worn } from './durability.ts';
import type { Round } from './round.ts';
import { resisted } from './shared.ts';

// `ammo`: the pool a row 17 shot spends, set only on the player's shot profile; `worn`: the
// wielded weapon a row 21 hit wears, set only on its own durable attack.
export type Profile = AttackProfile & { tags?: readonly Tag[]; ammo?: DefinitionRef; worn?: Worn };

export function draw(r: Round, bound: number) {
  const [value, rng, spent] = uniformCounted(r.rng, bound, r.budget - r.draws);
  r.rng = rng;
  r.draws += spent;
  return value;
}

/** Each swing rolls its own hit, defense and damage; the damages sum. A swing spends at most four
 * draws (hit, dodge, block, damage), so each one past the first grows the round's budget by four. */
export function swings(
  world: World,
  row: EncounterRow,
  target_id: EntityId,
  profile: Profile,
  foe: boolean,
  r: Round,
) {
  const count = profile.attacks ?? 1;
  r.budget += 4 * (count - 1);
  let hits = 0;
  let damage = 0;
  let prevented_by: 'dodge' | 'block' | undefined;
  for (let i = 0; i < count; i++) {
    const roll = draw(r, 100);
    const accurate = roll < profile.chance;
    prevented_by = accurate && foe ? defend(world, row, r) : undefined;
    if (!accurate || prevented_by) continue;
    hits++;
    damage = add(damage, dealt(world, target_id, profile, roll, damageRoll(r, profile)));
  }
  // a dodge or block line tells a single swing only; several unhit swings tell the miss line
  return { count, hits, damage, prevented_by: count === 1 ? prevented_by : undefined };
}

/** The summary line before a multi-swing strike line, when its perspective's key is declared. */
export function volleyLine(
  words: CombatSettings['narration'],
  striker: string,
  volley: { count: number; hits: number } | undefined,
  named: { bindings?: Record<string, TextKey> },
): Text[] {
  const tail = volley?.hits === volley?.count ? '_all' : volley?.hits === 1 ? '_one' : '';
  const key = volley && (words as Record<string, TextKey | undefined>)[`${striker}_volley${tail}`];
  return key
    ? [{ key, bindings: { ...named.bindings, count: volley.count, hits: volley.hits } }]
    : [];
}

function damageRoll(r: Round, profile: AttackProfile) {
  return add(
    profile.damage_min,
    profile.damage_min === profile.damage_max
      ? 0
      : draw(r, add(profile.damage_max - profile.damage_min, 1)),
  );
}

// Toolbox row G2: a critical hit is the hit draw below crit.chance (no extra draw: a foe's swing
// may already spend hit, dodge, block and damage). Order: the crit multiplier, then the target's
// resistances, its NPC definition's and (status reader 5) its active statuses' summed before the
// one clamp; attack() then applies the sleep multiplier and the HP cap to the swings' sum.
function dealt(world: World, target: EntityId, profile: Profile, roll: number, damage: number) {
  const crit =
    profile.crit && roll < profile.crit.chance ? mul(damage, profile.crit.multiplier) : damage;
  return resisted(world, target, [profile.kind, ...(profile.tags ?? [])], crit);
}

function defend(world: World, row: EncounterRow, r: Round): 'dodge' | 'block' | undefined {
  if (!standing(world, row.character_id)) return;
  const dodge = world.cartridge.world!.combat!.dodge;
  if (
    dodge &&
    status(world, row.character_id, dodge.skill, r.steps).usable &&
    draw(r, 100) < dodge.chance
  )
    return 'dodge';
  const shield = equipped(world, row.body_id, 'off_hand')?.item;
  if (shield?.block_chance !== undefined && draw(r, 100) < shield.block_chance) return 'block';
}
