// An unavailable card's reason as one sentence (book-ui.md, Unavailable actions): the code's own
// sentence (SENTENCE, the log's too), a Book word's, a cartridge's line with its stop, else the log's frame.
import { LABEL } from './labels.ts';
import { BUY, NOTED, SENTENCE, reason } from './words.ts';

const SAID: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SENTENCE).map(([k, v]) => [reason(k, k), v])),
  [NOTED.permission_denied!]: "It's not yours.",
  [BUY.not_owned!]: "It's sold out.",
  [BUY.insufficient_resource!]: "You can't afford it.",
  [LABEL.notHere]: "You can't do that here.",
  '': "You can't do that.",
};
const said = (r: string) =>
  (/^[A-Z]/.test(r) ? r : `You can't do that—${r}`).replace(/[.!?]?$/, (m) => m || '.');
export const reasonSentence = (r = '') => SAID[r] ?? said(r);
// A refused Attack names its target where the card knows it: "You can't hurt the Reeve." (loka-xyyd).
export const cannotHurt = (target: string) => `You can't hurt ${target}.`;
