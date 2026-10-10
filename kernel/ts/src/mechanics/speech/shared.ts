// speech@1 (toolbox row G9): who hears a word and whether it is an authored keyword.
import type { CharacterId, EntityId, SpokenKeyword } from '../../contracts.gen.ts';
import { cmp } from '../../foundation/validate.ts';
import type { Steps, World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { spokenBy } from '../dialogue/shared.ts';

/**
 * The word case-folded, or undefined unless it is 1 to 32 ASCII letters. Free text (toolbox trap
 * 9): it reaches an event only as an authored keyword and never narration. ponytail: one word.
 */
export const folded = (word: string) =>
  /^[a-zA-Z]{1,32}$/.test(word) ? (word.toLowerCase() as SpokenKeyword) : undefined;

/** The living NPCs directly in one of `rooms`, in EntityId order. */
export const npcsIn = (w: World, rooms: readonly string[]) =>
  Object.keys(w.knownEntities)
    .filter(
      (id) =>
        w.knownEntities[id]!.kind === 'npc' &&
        rooms.includes(w.state.containers[id]!) &&
        living(w, id),
    )
    .sort(cmp) as EntityId[];

/** An authored keyword: a dialogue's, or the word a spoken reaction filters on. */
export const authored = (w: World, word: string) =>
  Object.values(w.cartridge.dialogues ?? {}).some((d) => d.keyword === word) ||
  Object.values(w.cartridge.reactions ?? {}).some(
    (r) => r.on.event === 'spoken' && r.on.word === word,
  );

/** The keyed dialogue of the first hearer, in order, that answers `word` for `actor`. */
export function answer(
  w: World,
  actor: CharacterId,
  hearers: readonly EntityId[],
  word: string,
  steps: Steps,
) {
  for (const npc of hearers) {
    const d = spokenBy(w, actor, npc, steps, undefined, word);
    if (d) return d;
  }
  return undefined;
}
