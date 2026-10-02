// How the book view sorts the controller's flat button list (smoke.ts `buttons`): the place's look,
// the exits (a move button carries input.direction), the pending choice's answers and Close, other
// place actions, and a thing's own actions.
import type { Button, GameView } from '../../authority/local-story/smoke.ts';
import { reason } from '../../authority/local-story/words.ts';

export type Exit = { direction: string; button: Button };

const OWN = ['look', 'choose', 'close_choice']; // drawn in their own places, not as place actions

export function group(buttons: Button[]) {
  const dir = (b: Button) => (b.input as { direction?: string }).direction;
  const aimed = (b: Button) => b.target_ids.length > 0;
  return {
    look: buttons.find((b) => b.action_key === 'look' && !aimed(b)),
    exits: buttons.flatMap((b) => (dir(b) ? [{ direction: dir(b)!, button: b }] : [])),
    choice: buttons.filter((b) => b.action_key === 'choose' || b.action_key === 'close_choice'),
    place: buttons.filter((b) => !aimed(b) && !dir(b) && !OWN.includes(b.action_key)),
    on: (id: string) => buttons.filter((b) => b.target_ids.includes(id)),
  };
}

// Cartridge text marks touch details as [label](detail_key); the controller has no detail action
// yet, so show the label as plain prose. ponytail: details become tappable when one is offered.
export const plain = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

// Why an exit or a choice is closed: the reason's own message if it has one, else its code in words.
type Offered = GameView['exits'][number] | NonNullable<GameView['choice']>['choices'][number];
export const why = (e: Offered, text: (key: string) => string) =>
  e.available ? '' : e.reason.message ? text(e.reason.message.key) : reason(e.reason.code);

// The log line for a drag toward a closed exit: the reason's own message (a sentence), else its
// code's words in a sentence.
export const refused = (e: GameView['exits'][number], text: (key: string) => string) =>
  !e.available && e.reason.message
    ? text(e.reason.message.key)
    : `The way ${e.direction} is ${why(e, text)}.`;

// Under an open choice whose speaker is not here (the answers may also be closed for another
// reason, a dropped lantern, so this keys on the speaker, not on the answers' not_present).
export const absent = (v: GameView) =>
  v.choice && !v.entities.some((e) => e.id === v.choice!.speaker_id)
    ? 'They are not here to answer. Find them, or close this.'
    : '';

// Under the log once every quest in the journal is over (the Lantern's ending). ponytail: a
// chapter's real end comes from the story, not from its quests (an OWNER item: an ending page).
const OVER = ['resolved', 'failed', 'abandoned'];
export const ended = (v: GameView) =>
  v.journal.length > 0 && v.journal.every((q) => OVER.includes(q.state))
    ? 'The story ends here. Start over is in Settings.'
    : '';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The status line's character label: each resource's amount, the hp band's name after hp only (the
// owner's bands decision shows the phrase on hp only and colours every pool).
export type Pool = NonNullable<GameView['resources']>[number];
const amount = (r: Pool) => `${r.resource.key} ${r.current} of ${r.maximum}`;
export const said = (rs: readonly Pool[]) =>
  `Character, ${rs.map((r) => (r.resource.key === 'hp' ? `${amount(r)}, ${r.band.replaceAll('_', ' ')}` : amount(r))).join(', ')}`;
