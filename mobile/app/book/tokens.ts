// The Book's design tokens: the one place for its colours, type, spacing, sizes, radius, motion,
// sound and haptics. Rules, states and consumers: docs/BOOK-UI-COMPONENTS.md#design-tokens. Values are the
// Chapter 1 mock's base page with every effect off (docs/design/ui-exploration/chapter-one-playable.html,
// `.ph`), consolidated.

const light = {
  bg: '#ebe6d7', // the paper
  fg: '#241f19', // ink
  dim: '#645c4f', // secondary ink: notes, status, unavailable
  line: '#d0c7b0', // hairline rules, card borders, the speech bar
  card: '#e4decd', // action cards and letter tiles
  action: '#7b2d20', // what can be tapped to act
  danger: '#6b2160', // the danger band, barred ways: plum against the oxblood action
  warning: '#845512', // the warning band
};

// Night: the mock's moonlit page (`.ph.moon`, the one with its shooting stars), with the lamp's
// amber for `action` (the moon page's pale periwinkle accent would read as ink) and a burnt orange
// `warning`. NightSky.tsx draws the stars over it.
const dark: typeof light = {
  bg: '#10151e',
  fg: '#d9e0ea',
  dim: '#8e9aab',
  line: '#263041',
  card: '#171e2a',
  action: '#e6a650',
  danger: '#e39a88',
  warning: '#d0712a',
};

// Twilight, from the mock's `.dusk` sky overlay (a gradient the page cannot carry flat): dawn its
// rose-over-slate dawn tint on the paper with the day's ink, dusk its violet-navy bottom stop with
// lamp ink, so dusk deepens into the night without a flip.
// Every text role (fg, dim, action, danger, warning) is at least 4.5:1 on `bg` and on `card` in all
// four palettes; `line` is a hairline, not text. Which palette shows: the in-game solar phase,
// docs/system/book-ui.md#world-and-status-entry.
const dawn: typeof light = {
  bg: '#e2d7d7',
  fg: '#1c2128',
  dim: '#474f5c',
  line: '#b9aeb6',
  card: '#d5ccd3',
  action: '#7b2d20',
  danger: '#6b2160',
  warning: '#6f4a10',
};

const dusk: typeof light = {
  bg: '#2c2846',
  fg: '#e8e2ec',
  dim: '#aca5bd',
  line: '#474263',
  card: '#363253',
  action: '#f0b462',
  danger: '#f4a8b8',
  warning: '#e68f50',
};

export const color = { light, dawn, dusk, dark };

// The night sky's star and shooting-star colour (the mock's meteor, rgba(255,255,245)).
export const nightSky = { star: '#fffff5' };

// Bundled family names (OFL files in ./fonts), loaded by App.tsx `fonts` through expo-font.
export const font = { head: 'IMFellEnglish', body: 'EBGaramond', caps: 'IMFellEnglishSC' };

// Reading size steps (docs/system/book-ui.md#world-and-status-entry): every type role scales by
// min(step x the system font scale, cap).
export const reading = { standard: 1, large: 1.15, larger: 1.3, cap: 1.5 };

// Text styles without colour; a component adds a colour from the palette.
export const type = {
  body: { fontFamily: font.body, fontSize: 18, lineHeight: 28 }, // prose, entity lines, actions
  log: { fontFamily: font.body, fontSize: 17, lineHeight: 26 }, // event log and detail history
  small: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    fontVariant: ['oldstyle-nums' as const],
  }, // status line, the tip
  pageTitle: { fontFamily: font.head, fontSize: 26, lineHeight: 30 }, // every page, the room's and Combat's included
  sectionTitle: { fontFamily: font.caps, fontSize: 23, lineHeight: 25, letterSpacing: 0.5 }, // Inside, Held, Worn; the mock's h2
  runningHead: { fontFamily: font.caps, fontSize: 12, lineHeight: 16, letterSpacing: 1.7 }, // the quest objective
  control: { fontFamily: font.caps, fontSize: 14, lineHeight: 20, letterSpacing: 1.1 }, // Back, Back to World, Got it, Start over
  label: { fontFamily: font.caps, fontSize: 11, lineHeight: 16, letterSpacing: 0.7 }, // every resource key in the status
  speaker: { fontFamily: font.caps, fontSize: 17, lineHeight: 24, letterSpacing: 0.5 }, // a speech line's name
  tile: { fontFamily: font.head, fontSize: 23, lineHeight: 28 }, // a riddle letter on a touch-sized card
  chapterLabel: { fontFamily: font.caps, fontSize: 13, lineHeight: 20, letterSpacing: 2.6 }, // the chapter card's "Chapter one" (the mock's `.chapter small`)
  chapterTitle: { fontFamily: font.head, fontSize: 38, lineHeight: 40 }, // the chapter card's title (the mock's `.chapter b`): 38, a step above pageTitle (26)
  // Modifiers over another style: an entity line's name; a verb line and a narrated event.
  named: {
    fontWeight: '500' as const,
    textDecorationLine: 'underline' as const,
    textDecorationStyle: 'dotted' as const,
  },
  italic: { fontStyle: 'italic' as const },
};

export const space = {
  hair: 2,
  xs: 4,
  sm: 6, // between action cards, status items
  md: 8,
  lg: 12, // speech indent, card side padding
  xl: 16, // between blocks on a page
  page: 24, // page margins
};

export const size = {
  touch: 44, // minimum touch target, both axes
  card: 48, // action card minimum height
  rule: 1, // hairline
  speechBar: 2,
  minimap: 56, // the endpaper map at rest
  footerRule: 92, // each hairline beside the minimap
  focus: 2, // the web keyboard focus ring: its outline width and its offset
  chapterRule: 80, // the chapter card's short rule (the mock's `.chapter i`)
  statusIcon: 28, // a status icon's disc, inside a size.touch box
  unseen: 1, // a box a screen reader reads and the eye cannot see (the live region)
  column: 768, // the Book's widest page column (tablet width), centred on a desktop; a phone fills the screen
};

export const radius = { card: 10, chip: 22 }; // chip: a pill, half size.touch

export const opacity = {
  disabled: 0.45,
  press: 0.3, // a lifted card: `line` blended into `card` (rises size.rule)
  wash: 0.18, // the blow wash at its peak, the exemption: BOOK-UI-COMPONENTS.md#design-tokens
  washStill: 0.09, // the same wash under reduced motion
};

// Book motion. `turn` drives page-curl.sksl; `fade` replaces it under reduced motion. `duration` and
// `easing` are the way in; `out` the way back (ms), on `outEasing` if it differs.
export const motion = {
  quick: { duration: 160, easing: 'ease' }, // minimap zoom, knob return, the page turn's picture deadline
  turn: { duration: 500, easing: 'inOutQuad' }, // the page curl; tune the duration on a device
  fade: { duration: 160, easing: 'linear' }, // reduced-motion cross-fade
  palette: { duration: 1500, easing: 'inOutQuad' }, // same-polarity phase change only; flips cut (BOOK-UI-COMPONENTS.md#design-tokens)
  meteor: { duration: 700, easing: 'linear' }, // one shooting star's streak (the mock's .7 s); none under reduced motion
  press: { duration: 90, easing: 'ease', out: 160 }, // ActionCard, Control, Chip, Tap, letter tile -- mutate-skip: uncalibrated design value
  dry: { duration: 240, easing: 'linear', lag: 60 }, // a new log line; lag: a narrated event after its line -- mutate-skip: uncalibrated design value
  pop: {
    duration: 220,
    easing: 'ease',
    from: 0.6,
    hold: 1800, // mutate-skip: uncalibrated design value
    out: 400, // mutate-skip: uncalibrated design value
    outEasing: 'linear',
    rise: space.sm,
  }, // a status icon arriving, scaling up from `from`; the item pop rising `rise`, then held and out -- mutate-skip: uncalibrated design value
  flash: { duration: 120, easing: 'inOutQuad', out: 380, gap: 1000, swell: 1.015 }, // the blow wash; swell: the page's scale at its peak; gap: the Flash limit, a later blow keeps all but the wash -- mutate-skip: uncalibrated design value
  settle: { duration: 400, easing: 'inOutQuad', hold: 600 }, // a resolved running head retiring; hold: gilt's warning ink before it settles -- mutate-skip: uncalibrated design value
  card: {
    duration: 600,
    easing: 'inOutQuad',
    out: 300,
    stagger: 120,
    blurFrom: 6,
    blurTo: 12,
    auto: 4000,
  }, // chapter card over the leaving page's blur (Skia sigma); auto: when it turns itself -- mutate-skip: uncalibrated design value
};

// Each sound by key: its loudness tier, its round-robin variants and the haptic it brings. Files live
// in the asset manifest (loka-p2s8), human-made only. Rules: docs/system/book-ui.md#effects-sound-and-haptics.
export const sound = {
  pageTurn: { tier: 'note', variants: 3 }, // paper; no haptic during a turn -- mutate-skip: uncalibrated design value
  pickup: { tier: 'note', variants: 3, haptic: 'light' }, // a paper flick; a buy plays coin instead -- mutate-skip: uncalibrated design value
  tick: { tier: 'whisper', variants: 1, haptic: 'selection' }, // a debuff arriving; a letter tile's press plays it too -- mutate-skip: uncalibrated design value
  coin: { tier: 'whisper', variants: 1, haptic: 'selection' }, // one purchase, sale or pennies -- mutate-skip: uncalibrated design value
  blow: { tier: 'beat', variants: 3, haptic: 'heavy' }, // a blow taken: the thud -- mutate-skip: uncalibrated design value
  level: { tier: 'note', variants: 1, haptic: 'medium' }, // level up: note high -- mutate-skip: uncalibrated design value
  skillNew: { tier: 'note', variants: 1, haptic: 'light' }, // new skill: note low -- mutate-skip: uncalibrated design value
  questDone: { tier: 'note', variants: 1, haptic: 'light' }, // quest resolved: note low -- mutate-skip: uncalibrated design value
  questFailed: { tier: 'note', variants: 1, haptic: 'warning' }, // quest failed: the close -- mutate-skip: uncalibrated design value
  skillUp: { tier: 'whisper', variants: 1, gap: 30000 }, // skill improves: tone high, at most once per gap (ms) -- mutate-skip: uncalibrated design value
  questGained: { tier: 'note', variants: 1 }, // quest gained: tone low -- mutate-skip: uncalibrated design value
  chapter: { tier: 'chapter', variants: 1, haptic: 'medium' }, // the theme cut, on the music bus -- mutate-skip: uncalibrated design value
};

// Loudness targets (LUFS, uncalibrated until recorded samples are heard), voices per bus, ambience
// ducking under S3 and S4, and the round-robin's pitch spread.
export const mix = {
  tier: { whisper: -24, note: -18, beat: -14, chapter: -12 },
  bus: { ambience: 2, sfx: 4, ui: 2, music: 1 }, // mutate-skip: uncalibrated design value
  duck: { db: -6, duration: 300, out: 1200 },
  spread: 0.04, // no reader yet: pitch spread moves to loka-gj82.8
  coalesce: 300, // small cues of one key inside this many ms are one
};

// Haptic kinds to their web analogue, a navigator.vibrate pattern in ms (uncalibrated); the native
// stub ignores them until loka-k5ci maps the kinds to the device. `gap`: the least ms between two.
export const haptic = {
  gap: 100,
  selection: 10, // mutate-skip: uncalibrated design value
  light: 15,
  medium: 25,
  heavy: 40,
  warning: [20, 60, 20],
  error: [40, 60, 40], // mutate-skip: uncalibrated design value
};
