// The paper by day (room-view mock, `.ph`) and the two bundled fonts' names (the files, OFL ./fonts/OFL-*.txt, are loaded by App.tsx).
// ponytail: day palette only; the mock's night and lamp palettes wait for a darkness mechanic.
export const paper = {
  bg: '#ebe6d7',
  fg: '#241f19',
  dim: '#645c4f',
  line: '#d0c7b0',
  accent: '#7b2d20',
  mid: '#8a5a14', // the mock's .mid: the condition bands' middle colour tier
};
export const head = 'IMFellEnglish';
export const body = 'EBGaramond';

export const prose = { fontFamily: body, fontSize: 18, lineHeight: 28, color: paper.fg };
export const note = { ...prose, color: paper.dim };
// Small capitals: the status line, Back and Start over.
export const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };
