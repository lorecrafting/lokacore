// Target resolution (21 §7 TargetSpec / TargetResolution; 04 §17-§18; 14 §R5): the authority's
// Search over what a player names, run before any Command is built, so a Command carries only
// the resolved id and never the player's words. Scope: the details of the actor's room.
import type { EntityId, TargetResolution } from './contracts.gen.ts';
import type { World } from './decision.ts';
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
 * The details of the actor's room with an alias equal to the normalized words joined by `_`
 * (exact match, never a prefix): none, unique, or ambiguous with the candidate ids in ascending
 * code-point order (invariant target_candidates_ordered). At most 64 details per room
 * (room.schema.json), so within the contract's 1024.
 */
export function resolve(world: World, text: string): TargetResolution {
  const phrase = normalize(text).join('_');
  const here = world.state.containers[world.body];
  // ponytail: scans every detail of the world per lookup; index details by room when it shows.
  const ids = Object.entries(world.details)
    .filter(([, d]) => d.room === here && (d.aliases as readonly string[]).includes(phrase))
    .map(([id]) => id as EntityId)
    .sort(cmp);
  if (ids.length === 0) return { kind: 'none' };
  if (ids.length === 1) return { kind: 'unique', target_id: ids[0] };
  return { kind: 'ambiguous', candidate_ids: ids };
}
