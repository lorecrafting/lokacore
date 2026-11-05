// The status icons' drawings (book-ui.md Conditions details; docs/design/status-line-rulings.md,
// "Below the line, smaller, drawn"): SVG path `d` strings in a 24-unit box, stroke 2.5 with round
// caps and joins, no fill, all ink inside 3 to 21, drawn at 14 px in the look's ink. Keyed by the
// status's label text key; keys sharing a motif share a drawing. A label with no drawing takes its
// polarity's fallback. Hand-drawn; the contact sheet is the review artefact, not a test.

const drop = 'M12 4.5c-2.6 3.6-4.5 5.7-4.5 8.3a4.5 4.5 0 0 0 9 0c0-2.6-1.9-4.7-4.5-8.3z';
const smallDrop = 'M12 4.5c-2 2.8-3.75 4.5-3.75 6.7a3.75 3.75 0 0 0 7.5 0c0-2.2-1.75-3.9-3.75-6.7z';
const wave = 'q2-2 3.5 0t3.5 0 3.5 0 3.5 0';
const bowl = 'M5 12h14a7 7 0 0 1-14 0z';
const eye = 'M4.5 12c3-5.5 12-5.5 15 0c-3 5.5-12 5.5-15 0z';
const sun = 'M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2';
const snowflake = 'M12 5v14M5.94 8.5l12.12 7M5.94 15.5l12.12-7';
const chevronsUp = 'M6 12.5l6-6 6 6M6 18.5l6-6 6 6';
const steamBowl = `${bowl}M9 9.5c-1.5-1.8 1.5-2.7 0-4.5M15 9.5c-1.5-1.8 1.5-2.7 0-4.5`;
const dot = (x: number, y: number) => `M${x} ${y}a.75.75 0 1 0 .01 0`;

export const glyphs: Record<string, string> = {
  // The prologue's five
  'condition.bleeding': `${smallDrop.replace('M12 4.5', 'M13.5 7.5')}${dot(6.5, 6.5)}`,
  'condition.fed': steamBowl,
  'condition.refreshed':
    'M5 7.5h10v8.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM15 10h1.5a2.5 2.5 0 0 1 0 5H15',
  'condition.cold': snowflake,
  'condition.chilled': snowflake,
  'condition.tired': 'M5 10a8 8 0 0 0 14 0M7.5 14l-1.5 2.5M12 15v3M16.5 14l1.5 2.5',
  // Debuffs
  'condition.hungry': `${bowl}M10.5 9.5l6-5`,
  'condition.thirsty': 'M7 5l1.5 14h7L17 5zM9.5 14.5l5-2.5',
  'condition.parched': `${drop}M5.5 18.5l13-13`,
  'condition.poisoned': `M9.5 4.5h5M10.5 4.5v4a5.5 5.5 0 1 0 3 0v-4${dot(12, 14.5)}`,
  'condition.burning':
    'M13 5c-2 3-6 5.5-6 9.5a5 5 0 0 0 10 0c0-2.5-1.5-4-2.5-5.5-.5 1.5-1 2-2 2.5.5-2.5 1-4.5.5-6.5z',
  'condition.shocked': 'M13 4.5l-6 9h5l-1 6 6-9h-5z',
  'condition.stunned': 'M13 12a2 2 0 1 1-4 0a4 4 0 1 1 8 0a6 6 0 1 1-12 0',
  'condition.wet': `${drop}M5 18.5${wave}`,
  'condition.soaked': `M12 4.5c-1.6 2.3-3 3.6-3 5.4a3 3 0 0 0 6 0c0-1.8-1.4-3.1-3-5.4zM5 15${wave}M5 18.5${wave}`,
  'condition.overheated': 'M9.5 13.8V6.75a2.5 2.5 0 0 1 5 0v7.05a3.5 3.5 0 1 1-5 0zM12 10v5.5',
  'condition.windburnt': 'M4.5 9.5h9a2 2 0 1 0-2-2M4.5 13.5h13a2 2 0 1 1-2 2M4.5 17.5h7',
  'condition.afraid': `${eye}${dot(12, 12)}M7 6.5l-1.5-2M17 6.5l1.5-2`,
  'condition.cursed': `M6 19.5V11a6 6 0 0 1 12 0v8.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z${dot(9.5, 11)}${dot(14.5, 11)}`,
  'condition.hushed': 'M5 5h14v10h-7.5L8 18.5V15H5zM6 18.5l13-13',
  'condition.scarred': 'M5 7l14 10M10.65 7.97l-2.9 4.06M13.45 9.97l-2.9 4.06M16.25 11.97l-2.9 4.06',
  'condition.gored': 'M5.5 4.5C4.5 10 7 14.5 12 15.5c5-1 7.5-5.5 6.5-11',
  'condition.bruised': `M6 15.5l9.5-9.5a2.5 2.5 0 0 1 3.5 3.5L9.5 19a2.5 2.5 0 0 1-3.5-3.5zM11 10.5l2 2.5`,
  'condition.notched': 'M10 16V7.5L12 4.5 14 7.5V16zM14 10l-2 1.5 2 1.5M7.5 16h9M12 16v3.5',
  'condition.wanted': `M6.5 7h11v12.5h-11z${dot(12, 4.5)}M9.5 12.5h6`,
  'condition.word_travels': `${dot(6.5, 12)}M11 8a5.5 5.5 0 0 1 0 8M14.5 5a9.5 9.5 0 0 1 0 14`,
  // Buffs
  'condition.well_fed': steamBowl,
  'condition.hearty':
    'M12 18.5c-4.5-3-7-5.8-7-9a3.5 3.5 0 0 1 7-1.3A3.5 3.5 0 0 1 19 9.5c0 3.2-2.5 6-7 9z',
  'condition.well_rested':
    'M14 4.5A7.5 7.5 0 1 0 14 19.5A8.5 8.5 0 0 1 14 4.5zM17.5 5.5v4M15.5 7.5h4',
  'condition.blessed':
    'M7 6.5a5 2 0 1 0 10 0a5 2 0 1 0-10 0M8.5 15.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
  'condition.mighty': chevronsUp,
  'condition.might': chevronsUp,
  'condition.inspired':
    'M12 4.5c.5 5.5 2 7 7.5 7.5-5.5.5-7 2-7.5 7.5-.5-5.5-2-7-7.5-7.5 5.5-.5 7-2 7.5-7.5z',
  'condition.warded': 'M12 4.5l7 2.5v5c0 4-3 6.5-7 7.5-4-1-7-3.5-7-7.5V7z',
  'condition.warm': sun,
  // Neutral
  'condition.hidden': `${eye}M5.5 18.5l13-13`,
  'condition.disguised':
    'M4.5 9c2.5-1 5-1 7.5 0 2.5-1 5-1 7.5 0v3.5c0 3-2 4.5-4 4.5-2 0-3-1.5-3.5-3-.5 1.5-1.5 3-3.5 3-2 0-4-1.5-4-4.5z',
  'condition.hound_dream': `M12 18.5c-2.5 0-4.5-1.5-4.5-3.5 0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5c0 2-2 3.5-4.5 3.5z${dot(7, 7.5)}${dot(12, 5.5)}${dot(17, 7.5)}`,
};

// A label with no drawing: a plain sign of its polarity, never a letter.
export const fallback = {
  buff: 'M7 14l5-5 5 5',
  debuff: 'M7 10l5 5 5-5',
  neutral: 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
};
