// Word bar S2: the GameView's spell_words, one per spell the viewer has learned (its learned fact
// reads true for the viewer; an unlearned spell is never projected), in recipe key order, absent when
// none; its availability is cast's own admission: step's refusal, then the recipe's cooldown and
// costs. And the cartridge's static speech.phrases (say's word chips), absent without them.
import type { CharacterId, SpellWord, Word } from '../contracts.gen.ts';
import { admission, refusal } from '../commands/actions.ts';
import { spellOf } from '../mechanics/action_recipe/shared.ts';
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
  return Object.values(world.cartridge.recipes ?? {})
    .flatMap((r) =>
      r.target.kind === 'spell' && spellOf(world, actor, r.target.word) === r
        ? [{ recipe: r, word: r.target.word }]
        : [],
    )
    .map(({ recipe, word }): SpellWord => {
      const admitted = body ? admission(world, recipe, actor, body) : 'not_found';
      const code =
        refusal(world, { type: 'cast', actor_id: actor, word: word as string as Word }, steps) ??
        (typeof admitted === 'string' ? admitted : undefined);
      return code ? { word, available: false, reason: { code } } : { word, available: true };
    });
}
