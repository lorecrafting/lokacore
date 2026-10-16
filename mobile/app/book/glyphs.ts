// Placeholder status icon glyphs (BOOK-UI-COMPONENTS.md, Status icon) until the own icon set
// (loka-x6t.63): one character per condition label TextKey, else one by polarity.
// ponytail: text characters, not drawings; the icon set replaces this map.
const byLabel: Record<string, string> = { 'condition.fed': '◡' };
const byKind = { buff: '+', debuff: '−', neutral: '○' }; // signs, not arrows: they sit by the minimap

export const glyph = (label: string, kind?: 'buff' | 'debuff') =>
  byLabel[label] ?? byKind[kind ?? 'neutral'];
