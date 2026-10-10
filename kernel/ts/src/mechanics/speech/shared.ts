// speech@1 (toolbox row G9): who hears a word and whether it is an authored keyword.
import type { CharacterId, EntityId, SpokenKeyword } from '../../contracts.gen.ts';
import { cmp } from '../../foundation/validate.ts';
import { refString, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { spokenBy } from '../dialogue/shared.ts';
import { around } from '../senses.ts';

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

/** Who hears: a whisper its addressee; a say the room's NPCs; a shout those within one exit. */
export const hearers = (
  w: World,
  p: { type: 'say' | 'shout' | 'whisper'; actor_id: CharacterId; target_id?: EntityId },
  room: string,
  steps: Steps,
) =>
  p.type === 'whisper'
    ? [p.target_id!]
    : npcsIn(w, p.type === 'shout' ? [...around(w, p.actor_id, room, steps, 1).keys()] : [room]);

/**
 * The dialogue a say or whisper of `word` opens: of the dialogues keyed by it, in key order, the
 * first whose speaker hears and answers (its policy holds, not hostile; spokenBy).
 */
export function answer(
  w: World,
  actor: CharacterId,
  heard: readonly EntityId[],
  word: string,
  steps: Steps,
) {
  const keyed = Object.values(w.cartridge.dialogues ?? {})
    .filter((d) => d.keyword === word)
    .sort((a, b) => cmp(a.key, b.key));
  for (const { npc } of keyed) {
    const speaker = w.entityIds[refString(npc)]!;
    const d = heard.includes(speaker) && spokenBy(w, actor, speaker, steps, undefined, word);
    if (d) return d;
  }
  return undefined;
}
