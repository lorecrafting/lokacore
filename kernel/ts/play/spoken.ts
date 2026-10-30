// The terminal client's words for one narration line: an NPC's emote (G9) from the view's emote table,
// (line_words.ts emoteSentence); an engine key from the shared table
// (mobile/packages/game-view/line_words.ts); else cartridge text.
import { gameView, type Cartridge, type World } from '../src/index.ts';
import { emoteSentence, lineSentence } from '../../../mobile/packages/game-view/line_words.ts';
import { say } from './text.ts';

type Line = {
  key: string;
  bindings?: Readonly<Record<string, unknown>>;
  participants?: Readonly<Record<string, unknown>>;
};

export function spoken(cartridge: Cartridge, t: Line, world: World): string {
  const word = (v: unknown) => say(cartridge, String(v));
  return (
    (t.key === 'emote.performed' && emoted(t, world, word)) ||
    (lineSentence(t, word) ?? say(cartridge, t.key))
  );
}

function emoted(t: Line, world: World, word: (v: unknown) => string) {
  const view = gameView(world);
  const name = view.entities.find((e) => e.id === t.participants?.actor)?.name;
  return name && emoteSentence(t, view.emotes, word, word(name));
}
