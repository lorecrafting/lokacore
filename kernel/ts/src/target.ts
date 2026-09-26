// Target resolution (21 §7 TargetSpec / TargetResolution; 04 §17-§18; 14 §R5): the authority's
// Search over what a player names, run before any Command is built, so a Command carries only
// the resolved id and never the player's words.
import type { CharacterId, EntityId, TargetResolution } from './contracts.gen.ts';
import { bodyOf, type World } from './decision.ts';
import { cmp } from './validate.ts';

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
 * (invariant target_candidates_ordered). ponytail: at most 64 details per room
 * (room.schema.json) plus one entity per item or NPC definition in reach, so over the contract's
 * 1024 candidates only if a cartridge puts that many same-named definitions in one room; add
 * an overflow outcome when stacking or spawning can.
 */
export function resolve(world: World, actor: CharacterId, text: string): TargetResolution {
  const phrase = normalize(text).join('_');
  const body = bodyOf(world, actor);
  const here = body && world.state.containers[body];
  const named = (words: readonly string[]) => words.includes(phrase);
  // ponytail: scans every detail and entity of the world per lookup; index by room when it shows.
  const ids = [
    ...Object.entries(world.details).filter(([, d]) => d.room === here && named(d.aliases)),
    ...Object.entries(world.entities).filter(
      ([id, e]) => [here, body].includes(world.state.containers[id]) && named(e.keywords),
    ),
  ]
    .map(([id]) => id as EntityId)
    .sort(cmp);
  if (ids.length === 0) return { kind: 'none' };
  if (ids.length === 1) return { kind: 'unique', target_id: ids[0] };
  return { kind: 'ambiguous', candidate_ids: ids };
}
