// How `bin/loka roam` picks a press (docs/design/story-tooling.md §2b W1): the Book's own buttons, so
// the sampler cannot drift from what a page offers. Split from roam.ts to keep both files under the
// size limit; nothing else writes here.
import type { GameView } from '../src/contracts.gen.ts';
import { buttonsOf, intentOf } from '../../../mobile/app/book/model.ts';
import { sayers } from '../../../mobile/app/book/words.ts';
import type { Gen } from '../test/sim.ts';
import type { Replayable } from '../../../mobile/app/author/place.ts';

/** One press per step, from the Book's own buttons: a random player presses buttons, so the sampler
 * cannot drift from what a page offers (a detail's quest offer, a held thing's use pair, a scene's
 * Continue). A scene admits only its acknowledgement and a pending choice only its answers, so those
 * come alone; `buttonsOf` already offers nothing else in either state. */
export function presses(view: GameView, game: Replayable, g: Gen): object[] {
  const { text, label } = sayers(game as never);
  const all = buttonsOf(view, label, text).map((b) => intentOf(b));
  return shuffle(all, g);
}

/** Fisher-Yates over a copy, so the same seed presses the same buttons. */
function shuffle<T>(items: T[], g: Gen): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = g.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
