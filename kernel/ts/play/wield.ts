// A weapon under test for the fight report (cartridge.md "Fight matrix and encounter rating"): the
// state override that puts one cartridge item in its slot's holder with its skill acquired, so
// every fight is fought with it in hand (docs/rnd/gui-editor-design-2026-11-04.md §4.2).
import { key } from '../src/foundation/compose.ts';
import { acquisition } from '../src/mechanics/skill_level.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { refString, type World } from '../src/runtime/decision.ts';

/** Where to move an item and which facts to set, or undefined when `itemKey` is not a weapon this
 * cartridge can wield. A skill must be acquired to be usable (skills.ts, `usable = acquired &&
 * qualified`), so handing over the weapon alone would leave the base attack in place. */
export function wielded(
  w: World,
  itemKey: string,
): { move: [EntityId, EntityId]; facts: NonNullable<World['state']['facts']> } | undefined {
  // `items` is keyed by the full ref (`<cartridge>@<version>:item/<key>`) while the author names the
  // bare key; the entity's own ref is that same string.
  const ref = Object.keys(w.cartridge.items ?? {}).find((r) => r.endsWith(`:item/${itemKey}`));
  const item = ref ? w.cartridge.items![ref] : undefined;
  const skill = item?.weapon?.skill;
  const holder = item?.slot && w.slots[item.slot];
  const id = ref && w.entityIds[ref];
  // Only the acquisition is granted, never `qualified`: combat re-reads `usable = acquired &&
  // qualified` itself (round_attack.ts:220), so a weapon whose skill the player cannot qualify for
  // still falls back to the base attack. Do not add a qualification gate here — review 759 #2
  // removed one and every fight came out the same, so it would only be dead code.
  if (!skill || !w.cartridge.skills?.[refString(skill)] || !holder || !id) return undefined;
  const at = key({
    kind: 'fact',
    fact: acquisition(skill),
    scope: { kind: 'player', character_id: w.character },
  });
  return { move: [id, holder], facts: { ...w.state.facts, [at]: true } };
}
