// The hotbar slots' drawings (book-ui.md, Combat hotbar; docs/design/icon-style-guide.md): statusGlyphs'
// frame (SVG path `d` in a 24-unit box, stroke 2.5, round caps and joins, no fill, ink inside 3 to 21),
// keyed by a scripted action's action_key or a spell word. Keys sharing a motif (the showcase's
// `force_*`, `search_*`, `turn_wheel_*`) share one drawing, as the status glyphs do. A key with no
// drawing takes the neutral fallback at render; hotbar.test.ts fails for any showcase slot key missing
// here that is not on its fallback list. What each depicts: icon-style-guide.md, "Drawings".
import { fallback, glyphs } from './statusGlyphs.ts';

const dot = (x: number, y: number) => `M${x} ${y}a.75.75 0 1 0 .01 0`;
const bubble = 'M5 5h14v10h-7.5L8 18.5V15H5z'; // hushed's bubble, unstruck
const pry = 'M5.5 18.5L14 10a2.5 2.5 0 1 1 3 3'; // a bar with a hooked head
const key = 'M5.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M10.5 12h8.5M15.5 12v3.5M19 12v3';
const thought = `M7.5 8a4.5 4.5 0 0 1 9 0a3 3 0 0 1 0 6h-9a3 3 0 0 1 0-6z${dot(14.5, 16.5)}${dot(17, 19)}`;
const loupe = 'M7 10a4 4 0 1 0 8 0a4 4 0 1 0-8 0M14 13l4.5 4.5';
const lever = `M5.5 18.5h11M11 18.5L16.5 6${dot(16.5, 6)}`;
const wheel = 'M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0M12 7.5v9M7.5 12h9';
const toss = `M5.5 18.5Q7 7 16 8.5${dot(18.5, 6)}`;
const note = 'M7 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M12 17V5l5 3';
const heap = `M5 18.5h14M8 18.5q4-9 8 0${dot(13.5, 7)}`;
const needle = 'M5.5 18.5L17.5 6.5M17.5 6.5q2 4.5-1 8.5t-6 3';
// fed's bowl redrawn with a curve: hotbar.test.ts widens an arc's end by its radius, so fed's r7 arc fails there.
const cook = 'M5 11.5h14q0 7-7 7t-7-7zM9 9c-1.5-1.8 1.5-2.7 0-4.5M15 9c-1.5-1.8 1.5-2.7 0-4.5';

export const actionGlyphs: Record<string, string> = {
  // Spell words
  ward: glyphs['condition.warded']!,
  mend: needle,
  // Showcase scripted actions, by motif
  shout_warning: bubble,
  shout_begone: bubble,
  shout_begone_cellar: bubble,
  hide: glyphs['condition.hidden']!,
  yard_hide: glyphs['condition.hidden']!,
  force_grate: pry,
  force_hall_cupboard: pry,
  force_iron_door: pry,
  force_strongbox: pry,
  force_tollhouse_door: pry,
  pick_hall_strongbox: key,
  pick_strongbox: key,
  think_hall_lectern: thought,
  think_lectern: thought,
  think_letter: thought,
  search_cellar: loupe,
  search_cleft: loupe,
  search_floor: loupe,
  search_pool_cleft: loupe,
  look_about: loupe,
  pull_a: lever,
  pull_b: lever,
  pull_c: lever,
  lift_store_bar: lever,
  turn_wheel_1: wheel,
  turn_wheel_2: wheel,
  turn_wheel_3: wheel,
  throw_bones: toss,
  throw_fold_bones: toss,
  play_song: note,
  play_fold_song: note,
  cook_feast: cook,
  cook_stew: cook,
  cook_stew_croft: cook,
  gather_ash: heap,
  gather_attic_ash: heap,
};

// The opener's drawing: three dots on the midline.
export const OPENER = [7, 12, 17].map((x) => dot(x, 12)).join(''); // mutate-skip: drawing coordinates

export const actionGlyph = (key: string) => actionGlyphs[key] ?? fallback.neutral;
