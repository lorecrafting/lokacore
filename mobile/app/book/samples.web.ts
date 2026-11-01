// The recorded samples, on the web only: Metro and Vite both give each file's URL. Rows, licences and
// credits: sounds/manifest.json (bin/check_sounds.py). Which file each name plays: audio-listening-list.md.
import { sources } from './sound';
import chapter from './sounds/mus-theme-chapter-01.m4a';
import coin from './sounds/sfx-coin-clink-01.m4a';
import noteHigh from './sounds/sfx-harp-note-high-01.m4a';
import noteLow from './sounds/sfx-harp-note-low-01.m4a';
import toneHigh from './sounds/sfx-harp-tone-high-01.m4a';
import toneLow from './sounds/sfx-harp-tone-low-01.m4a';
import close from './sounds/sfx-paper-close-01.m4a';
import thud from './sounds/sfx-paper-thud-01.m4a';
import flick from './sounds/ui-paper-flick-01.m4a';
import tick from './sounds/ui-paper-tick-01.m4a';
import turn1 from './sounds/ui-paper-turn-01.m4a';
import turn2 from './sounds/ui-paper-turn-02.m4a';
import turn3 from './sounds/ui-paper-turn-03.m4a';

sources({
  pageTurn: [turn1, turn2, turn3],
  pickup: [flick],
  tick: [tick],
  coin: [coin],
  blow: [thud],
  level: [noteHigh],
  skillNew: [noteLow],
  questDone: [noteLow],
  questFailed: [close],
  skillUp: [toneHigh],
  questGained: [toneLow],
  chapter: [chapter],
});
