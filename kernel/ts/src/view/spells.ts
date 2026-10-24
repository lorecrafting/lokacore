// Word bar S2: the GameView's spell_words, one per spell the viewer has learned (its learned fact
// reads true for the viewer; an unlearned spell is never projected), in recipe key order, absent when
// none; its availability is cast's own admission: step's refusal, then the recipe's cooldown and
// costs. And the cartridge's static speech.phrases (say's word chips), absent without them.
import type { CharacterId, Key, SpellWord, Word } from '../contracts.gen.ts';
import { admission, refusalReason, resolved } from '../commands/actions.ts';
import { value as factValue } from '../mechanics/fact.ts';
import { unpaid } from '../mechanics/resource.ts';
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';

export function wordViews(world: World, actor: CharacterId, steps: Steps) {
  const words = spellWords(world, actor, steps);
  return {
    ...(words.length > 0 && { spell_words: words }),
    ...(world.cartridge.speech && { phrases: world.cartridge.speech.phrases }),
  };
}

function spellWords(world: World, actor: CharacterId, steps: Steps): SpellWord[] {
  const body = bodyOf(world, actor);
  const set = resolved(world, actor);
  return Object.values(world.cartridge.recipes ?? {}).flatMap((r): SpellWord[] => {
    if (r.target.kind !== 'spell' || r.target.aimed) return []; // an aimed spell is offered on its target
    if (factValue(world, actor, r.target.learned) !== true) return [];
    const word = r.target.word;
    const cast = { type: 'cast', actor_id: actor, word: word as string as Word } as const;
    const admitted = body ? admission(world, r, actor, body) : 'not_found';
    const reason =
      refusalReason(world, cast, steps, 'cast' as Key, set) ??
      // the unpaid cost names itself, as on action lists (pass-2 R1)
      (typeof admitted === 'string'
        ? { code: admitted, ...(body && unpaid(world, body, admitted, r.costs ?? [])) }
        : undefined);
    return [reason ? { word, available: false, reason } : { word, available: true }];
  });
}
