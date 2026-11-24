// Ghost lines and See as (docs/rnd/in-game-builder-mode-2026-11-19.md §4.5, slice 2.5): under the
// room page's title in Build, what this room holds that the page does not draw, each opening its
// sheet; on the Room sheet, each variant not in force redraws the room's words as it would. See as
// only swaps the words the Book reads (panel.tsx `played`); it never writes, invokes or ticks, and
// any write, page change or live message ends it. Labels are placeholders, the owner's to replace.
import { Text, View } from 'react-native';
import type { GameSubscription, GameView } from '../../../packages/game-view/session.ts';
import { ghosts, type Cartridge, type Ghost } from '../../../../kernel/ts/play/ghosts.ts';
import { size, space, type } from '../../book/tokens.ts';
import { overlay } from '../live.ts';
import { ink } from './build.ts';
import { act } from './sheet.tsx';

const WORDS = {
  see: 'See as',
  seeing: (when: string) => `Seeing: ${when} · Back`,
  ghost: (words: string, reason: string, edit: boolean) =>
    `${words}, ${reason}${edit ? ', edit' : ''}`,
  hidden: (n: number) => `${n} not shown`,
  more: (n: number) => `${n} not shown, open`,
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
let as: { base: string; ghost: Ghost; at: string } | undefined; // the drawn words' key, the variant, the place
/** Build.tsx hands in the game (per game) and the Book's and strip's redraw. */
export const seeWith = (game: Game, again: () => void) => (
  (as = undefined),
  (given = game),
  (redraw = again)
); // a new game (a jump, a start over) ends it
/** A key's words as the Book draws them: a live edit's, else the game's. */
const said = (key: string) => overlay[key] ?? given?.game.text(key) ?? key;

/** This room's ghosts, none before a game, off a room or for a place with no game (a test's). */
function here(): Ghost[] {
  const room = given?.here();
  if (!given?.game || !room) return [];
  const { game, canon } = given;
  return ghosts(game.view().view, canon(), room, game.entityIds());
}

/** The key the Book draws for `key`: while See as is on, the variant's in place of the room's words. */
export const drawn = (key: string) => (as?.base === key ? as.ghost.words : key);
/** Ends See as; true when it was on (the press that ended it does nothing more). */
export function unsee() {
  if (!as) return false;
  as = undefined;
  redraw();
  return true;
}
/** A game update: a new room (a page change) or new words in force end See as; the clock's pulses do not. */
export const updated = (u: GameSubscription) =>
  u.kind === 'state' &&
  (u.projection.view.place.id !== as?.at || u.projection.view.place.description.key !== as?.base) &&
  unsee();

type Open = (id: string) => void;
type Sheet = (g: Ghost) => string | undefined;
/** The Room sheet's ghost rows for `room`, wrapped whole, each opening its sheet, a variant's (this
 * sheet) none but See as; only for the page's own room. */
export function ghostRows(room: string, open: Open, sheet: Sheet) {
  const shown = room === given?.here() ? here() : [];
  if (!shown.length) return [];
  const { place } = given!.game.view().view;
  const elsewhere: Sheet = (g) => (g.kind === 'variant' ? undefined : sheet(g));
  return shown.map((g, i) => (
    <View key={`as:${i}`} style={ROW}>
      {ghostLine(g, open, elsewhere, WRAP)}
      {g.kind === 'variant' &&
        act(WORDS.see, () => see(place.description.key, g, place.id), undefined, `see:${i}`)}
    </View>
  ));
}

const see = (base: string, ghost: Ghost, at: string) => ((as = { base, ghost, at }), redraw());
/** The strip's chip while See as is on: what is seen, and a press goes back to the page's words. */
export const chip = () => (as ? act(WORDS.seeing(as.ghost.reason), unsee) : null);

/** Under the room title, one line: its one ghost, else `N not shown` opening the Room sheet, so
 * the fixed header grows by at most a touch target. */
export function ghostLines(open: Open, sheet: Sheet) {
  const all = here();
  if (all.length < 2) return all.map((g) => ghostLine(g, open, sheet));
  const id = `room:${given!.here()}`;
  return line(WORDS.hidden(all.length), WORDS.more(all.length), () => open(id));
}
function ghostLine(g: Ghost, open: Open, sheet: Sheet, wrap?: object) {
  const id = sheet(g);
  const words = said(g.words);
  return line(
    `${words} · ${g.reason}`,
    WORDS.ghost(words, g.reason, !!id),
    id ? () => open(id) : undefined,
    wrap,
  );
}
const line = (shown: string, label: string, press?: () => void, wrap?: object) => (
  <Text
    key={`ghost:${shown}`}
    numberOfLines={wrap ? undefined : 1}
    accessibilityRole={press ? 'button' : undefined}
    accessibilityLabel={label}
    onPress={press && ((e) => (e.stopPropagation(), press()))}
    style={{ ...GHOST, borderColor: ink('dim'), color: ink('dim'), ...wrap }}
  >
    {shown}
  </Text>
);
const ROW = { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md } as const;
const WRAP = { flex: 1, lineHeight: type.small.lineHeight, paddingVertical: space.sm }; // mutate-skip: style
const GHOST = {
  ...type.small,
  display: 'block' as 'flex', // web: its own line under the title; a flex box draws no ellipsis
  lineHeight: size.touch,
  borderLeftWidth: size.speechBar,
  borderStyle: 'dashed',
  paddingLeft: space.sm,
} as const;
