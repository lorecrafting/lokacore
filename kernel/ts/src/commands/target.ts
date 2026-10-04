// Target resolution (21 §7 TargetSpec / TargetResolution; 04 §17-§18; 14 §R5): the authority's
// Search over what a player names, run before any Command is built, so a Command carries only
// the resolved id and never the player's words.
import {
  LIMITS,
  type CharacterId,
  type EntityId,
  type Key,
  type TargetResolution,
} from '../contracts.gen.ts';
import { bodyOf, COMPASS, refString, type World } from '../runtime/decision.ts';
import { exitOf } from '../mechanics/lookups.ts';
import { cmp } from '../foundation/validate.ts';

/**
 * The player's words as compared: lowercased, split on whitespace, then a leading `at` and a
 * leading article (`the`, `a`, `an`) dropped, in that order (`look at the mooring post` is
 * [mooring, post]).
 */
export function normalize(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words[0] === 'at') words.shift();
  if (['the', 'a', 'an'].includes(words[0])) words.shift();
  return words;
}

/**
 * What `actor` can name (21 §7 scopes: InspectableDetails, room contents, room occupants,
 * inventory): the details of its room, and the items and NPCs in its room or held by its body,
 * with an alias or keyword equal to the normalized words joined by `_` (exact match, never a
 * prefix): none, unique, or ambiguous with the candidate ids in ascending code-point order
 * (invariant target_candidates_ordered). Over the contract's selector_cardinality candidates
 * it throws, never truncating (04 §5.3). ponytail: a loadable cartridge can reach that only
 * with over 1024 same-named items, NPCs and details in reach; the contract has no overflow
 * outcome to report it gracefully (DEFERRED, docs/ROADMAP.md "R7/R8 for chapter one" row).
 */
export function resolve(world: World, actor: CharacterId, text: string): TargetResolution {
  const phrase = normalize(text).join('_');
  const near = (id: string, words: readonly string[]) =>
    words.includes(phrase) && present(world, actor, id);
  // ponytail: scans every detail and entity of the world per lookup; index by room when it shows.
  const ids = [
    ...Object.entries(world.details).filter(([id, d]) => near(id, d.aliases)),
    ...Object.entries(world.entities).filter(([id, e]) => near(id, e.keywords)),
  ]
    .map(([id]) => id as EntityId)
    .sort(cmp);
  if (ids.length === 0) return { kind: 'none' };
  if (ids.length === 1) return { kind: 'unique', target_id: ids[0] };
  if (ids.length > LIMITS.selector_cardinality)
    throw new Error(`${ids.length} candidates exceed selector_cardinality`);
  return { kind: 'ambiguous', candidate_ids: ids };
}

/**
 * Whether `id` is in reach of `actor` (resolve's scopes; target_resolution@1's target_present): a
 * detail of its room, or an entity in its room or held directly by its body.
 */
export function present(world: World, actor: CharacterId, id: string): boolean {
  const body = bodyOf(world, actor);
  if (body === undefined) return false;
  const here = world.state.containers[body];
  const d = world.details[id];
  return d ? d.room === here : [here, body].includes(world.state.containers[id]);
}

/**
 * The directions of the exits of `actor`'s room whose barrier (barrier@1) has a keyword equal to
 * the normalized words joined by `_`, as resolve matches, in compass order: none, one, or several
 * (the player must say which). A direction itself names its exit; the text adapter maps it.
 */
export function doors(world: World, actor: CharacterId, text: string): Key[] {
  const phrase = normalize(text).join('_');
  const body = bodyOf(world, actor);
  if (!body) return [];
  const room = world.rooms[world.state.containers[body]];
  return COMPASS.filter((d) => {
    const barrier = exitOf(room, d)?.barrier;
    return (
      barrier && world.cartridge.barriers![refString(barrier)].keywords.includes(phrase as never)
    );
  });
}
