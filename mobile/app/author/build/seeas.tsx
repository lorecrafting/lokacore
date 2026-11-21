// Ghost lines and See as (docs/rnd/in-game-builder-mode-2026-11-19.md §4.5, slice 2.5): under the
// room page's title in Build, what this room holds that the page does not draw, each opening its
// sheet; on the Room sheet, each variant not in force redraws the room's words as it would. See as
// only swaps the words the Book reads (panel.tsx `played`); it never writes, invokes or ticks, and
// any write, page change or live message ends it. Labels are placeholders, the owner's to replace.
import { Text, View } from 'react-native';
import type { GameView } from '../../../packages/game-view/session.ts';
import { ghosts, type Cartridge, type Ghost } from '../../../../kernel/ts/play/ghosts.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { act } from './sheet.tsx';

const WORDS = {
  see: 'See as',
  seeing: (when: string) => `Seeing: ${when} · Back`,
  ghost: (words: string, reason: string) => `${words}, ${reason}, edit`,
};
/** The game and compiled cartridge a ghost reads; panel.tsx hands them in per game. */
export type Game = {
  game: {
    view: () => { view: GameView };
    text: (key: string) => string | undefined;
    entityIds: () => Readonly<Record<string, string>>;
  };
  canon: () => Cartridge;
  here: () => string | undefined; // the Book's room key
};
let given: Game | undefined;
let redraw = () => {};
let as: { base: string; ghost: Ghost } | undefined; // the drawn description key, and the variant seen
/** Build.tsx hands in the game (per game) and the Book's and strip's redraw. */
export const seeWith = (game: Game, again: () => void) => ((given = game), (redraw = again));

/** This room's ghosts, none before a game, off a room or for a place with no game (a test's). */
function here(): Ghost[] {
  const room = given?.here();
  if (!given?.game || !room) return [];
  const { game, canon } = given;
  return ghosts(game.view().view, canon(), room, game.entityIds());
}

/** The variant's words while See as shows it in place of `key`, the room's drawn words. */
export const seeing = (key: string) =>
  as?.base === key ? (given?.game.text(as.ghost.words) ?? as.ghost.words) : undefined;
/** Ends See as; true when it was on (the press that ended it does nothing more). */
export function unsee() {
  if (!as) return false;
  as = undefined;
  redraw();
  return true;
}

/** The Room sheet's variant rows for `room`, each with See as; only for the page's own room. */
export function variantRows(room: string) {
  const shown = room === given?.here() ? here().filter((g) => g.kind === 'variant') : [];
  const base = shown.length ? given!.game.view().view.place.description.key : '';
  return shown.map((g) => (
    <View key={`as:${g.words}`} style={ROW}>
      <Text style={{ ...type.small, color: ink('dim'), flex: 1 }}>{g.reason}</Text>
      {act(WORDS.see, () => ((as = { base, ghost: g }), redraw()), undefined, `see:${g.words}`)}
    </View>
  ));
}

/** The strip's chip while See as is on: what is seen, and a press goes back to the page's words. */
export const chip = () => (as ? act(WORDS.seeing(as.ghost.reason), unsee) : null);

/** The ghost lines under the room title; `sheet` is a ghost's sheet id, undefined when it has none. */
export function ghostLines(open: (id: string) => void, sheet: (g: Ghost) => string | undefined) {
  return here().map((g) => {
    const id = sheet(g);
    const words = given!.game.text(g.words) ?? g.words;
    return (
      <Text
        key={`ghost:${g.kind}:${g.key}:${g.words}`}
        accessibilityRole={id ? 'button' : undefined}
        accessibilityLabel={WORDS.ghost(words, g.reason)}
        onPress={id ? (e) => (e.stopPropagation(), open(id)) : undefined}
        style={{ ...GHOST, borderColor: ink('dim'), color: ink('dim') }}
      >
        {`${words} · ${g.reason}`}
      </Text>
    );
  });
}
const ROW = { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md } as const;
const GHOST = {
  ...type.small,
  display: 'flex' as const, // web: each ghost on its own line under the title
  minHeight: size.touch,
  alignItems: 'center',
  borderLeftWidth: size.speechBar,
  borderStyle: 'dashed',
  paddingLeft: space.sm,
} as const;
