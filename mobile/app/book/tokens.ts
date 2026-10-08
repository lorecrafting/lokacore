// The Book's design tokens: the one place for its colours, type, spacing, sizes, radius, motion and
// sound. Rules, states and consumers: docs/BOOK-UI-COMPONENTS.md#design-tokens. Values are the
// Chapter 1 mock's base page with every effect off (docs/design/ui-exploration/chapter-one-playable.html,
// `.ph`), consolidated; docs/design/foundation/README.md lists mock against live.
// ponytail: paper.ts still feeds the live Book; the polish phase moves its imports here and deletes it.

const light = {
  bg: '#ebe6d7', // the paper
  fg: '#241f19', // ink
  dim: '#645c4f', // secondary ink: notes, status, unavailable
  line: '#d0c7b0', // hairline rules, card borders, the speech bar
  card: '#e4decd', // action cards and letter tiles
  action: '#7b2d20', // what can be tapped to act
  danger: '#7b2d20', // the danger band, barred ways, refusal tags
  warning: '#8a5a14', // the warning band
};

// The mock's unlit/lamp paper (`.ph.unlit,.ph.lamp`), without its glow.
const dark: typeof light = {
  bg: '#0c0b09',
  fg: '#ecdfc3',
  dim: '#a79a83',
  line: '#2d271f',
  card: '#17140f',
  action: '#e6a650',
  danger: '#eb9676',
  warning: '#e6b35a',
};

export const color = { light, dark };

// Bundled family names (OFL files in ./fonts). `caps` (IM Fell English SC) is not bundled yet.
export const font = { head: 'IMFellEnglish', body: 'EBGaramond', caps: 'IMFellEnglishSC' };

// Text styles without colour; a component adds a colour from the palette.
export const type = {
  body: { fontFamily: font.body, fontSize: 18, lineHeight: 28 }, // prose, entity lines, actions
  log: { fontFamily: font.body, fontSize: 17, lineHeight: 26 }, // event log and detail history
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 19 }, // status line, the tip
  roomTitle: { fontFamily: font.head, fontSize: 22, lineHeight: 24 },
  pageTitle: { fontFamily: font.head, fontSize: 31, lineHeight: 33 },
  runningHead: { fontFamily: font.caps, fontSize: 12, letterSpacing: 1.7 },
  control: { fontFamily: font.caps, fontSize: 14, letterSpacing: 1.1 }, // Back to World, Got it
  tag: { fontFamily: font.caps, fontSize: 13, letterSpacing: 0.7 }, // a refusal's reason tag
  label: { fontFamily: font.caps, fontSize: 11, letterSpacing: 0.7 }, // hp/ma/mv in the status
  speaker: { fontFamily: font.caps, fontSize: 17, letterSpacing: 0.5 }, // a speech line's name
  tile: { fontFamily: font.head, fontSize: 23 }, // a riddle letter on a touch-sized card
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
  underline: 1.5, // fixture and entity links
  minimap: 44, // the endpaper map at rest
  footerRule: 92, // each hairline beside the minimap
};

export const radius = { tag: 3, card: 10 };

export const opacity = { disabled: 0.45 };

// Plain state changes only. `turn` drives page-curl.sksl; `fade` replaces it under reduced motion.
export const motion = {
  quick: { duration: 160, easing: 'ease' }, // minimap zoom, knob return
  turn: { duration: 720, easing: 'inOutQuad' }, // the page curl
  fade: { duration: 160, easing: 'linear' }, // reduced-motion cross-fade
};

// The paper page-turn sound, on by default, off in Settings. No recorded sample is bundled yet; the
// specimen plays the mock's synthesised `pageSound` at this level.
export const sound = { pageTurn: { volume: 1 } };
