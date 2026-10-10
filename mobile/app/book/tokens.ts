// The Book's design tokens: the one place for its colours, type, spacing, sizes, radius, motion and
// sound. Rules, states and consumers: docs/BOOK-UI-COMPONENTS.md#design-tokens. Values are the
// Chapter 1 mock's base page with every effect off (docs/design/ui-exploration/chapter-one-playable.html,
// `.ph`), consolidated.

const light = {
  bg: '#ebe6d7', // the paper
  fg: '#241f19', // ink
  dim: '#645c4f', // secondary ink: notes, status, unavailable
  line: '#d0c7b0', // hairline rules, card borders, the speech bar
  card: '#e4decd', // action cards and letter tiles
  action: '#7b2d20', // what can be tapped to act
  danger: '#7b2d20', // the danger band, barred ways, refusal tags
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
  danger: '#7b2d20',
  warning: '#6f4a10',
};

const dusk: typeof light = {
  bg: '#2c2846',
  fg: '#e8e2ec',
  dim: '#aca5bd',
  line: '#474263',
  card: '#363253',
  action: '#f0b462',
  danger: '#f2a07f',
  warning: '#e68f50',
};

export const color = { light, dawn, dusk, dark };

// The night sky's star and shooting-star colour (the mock's meteor, rgba(255,255,245)).
export const nightSky = { star: '#fffff5' };

// Bundled family names (OFL files in ./fonts), loaded by App.tsx `fonts` through expo-font.
export const font = { head: 'IMFellEnglish', body: 'EBGaramond', caps: 'IMFellEnglishSC' };

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
  roomTitle: { fontFamily: font.head, fontSize: 22, lineHeight: 24 }, // the room's fixed Look title
  pageTitle: { fontFamily: font.head, fontSize: 31, lineHeight: 33 }, // every page, Combat's included
  sectionTitle: { fontFamily: font.caps, fontSize: 23, lineHeight: 25, letterSpacing: 0.5 }, // Inside, Held, Worn; the mock's h2
  runningHead: { fontFamily: font.caps, fontSize: 12, letterSpacing: 1.7 }, // the quest objective
  control: { fontFamily: font.caps, fontSize: 14, letterSpacing: 1.1 }, // Back, Back to World, Got it, Start over
  tag: { fontFamily: font.caps, fontSize: 13, letterSpacing: 0.7 }, // a refusal's reason tag
  label: { fontFamily: font.caps, fontSize: 11, letterSpacing: 0.7 }, // every resource key in the status
  speaker: { fontFamily: font.caps, fontSize: 17, letterSpacing: 0.5 }, // a speech line's name
  tile: { fontFamily: font.head, fontSize: 23 }, // a riddle letter on a touch-sized card
  chapterLabel: { fontFamily: font.caps, fontSize: 13, letterSpacing: 2.6 }, // the chapter card's "Chapter one" (the mock's `.chapter small`)
  chapterTitle: { fontFamily: font.head, fontSize: 38, lineHeight: 40 }, // the chapter card's title (the mock's `.chapter b`): 38 above the mock's scaled 33 so it steps above pageTitle
  // Modifiers over another style: an entity line's name; a verb line and a system log line.
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
  block: 14, // between blocks on a detail page
  xl: 16,
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
};

export const radius = { tag: 3, card: 10 };

export const opacity = { disabled: 0.45 };

// Plain state changes only. `turn` drives page-curl.sksl; `fade` replaces it under reduced motion.
export const motion = {
  quick: { duration: 160, easing: 'ease' }, // minimap zoom, knob return, the page turn's picture deadline
  turn: { duration: 500, easing: 'inOutQuad' }, // the page curl; tune the duration on a device
  fade: { duration: 160, easing: 'linear' }, // reduced-motion cross-fade
  palette: { duration: 1500, easing: 'inOutQuad' }, // same-polarity phase change only; flips cut (BOOK-UI-COMPONENTS.md#design-tokens)
  meteor: { duration: 700, easing: 'linear' }, // one shooting star's streak (the mock's .7 s); none under reduced motion
};

// The paper page-turn sound, on by default, off in Settings. The mock's synthesised `pageSound` plays
// at this level until a recorded CC0 sample (under 1 s, bundled) replaces it.
export const sound = { pageTurn: { volume: 1 } };
