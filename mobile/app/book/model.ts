// How the book view sorts the controller's flat button list (presenter.ts `buttons`): the place's look,
// the exits (a move button carries input.direction), the pending choice's answers and Close, other
// place actions, and a thing's own actions.
import type { GameView } from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
import { reason, SENTENCE } from './words.ts';

export type Exit = { direction: string; button: Button };
export type Thing =
  GameView['entities'][number] | NonNullable<GameView['entities'][number]['contents']>[number];
export type Page =
  | {
      kind:
        | 'contents'
        | 'character'
        | 'journal'
        | 'carrying'
        | 'map'
        | 'settings'
        | 'chapter'
        | 'position';
    }
  | { kind: 'thing'; id: string }
  | { kind: 'dialogue'; speaker?: string };

export const npcPage = (page: Page | undefined, view: GameView) =>
  page?.kind === 'dialogue' ||
  (page?.kind === 'thing' && view.entities.some((e) => e.id === page.id && e.kind === 'npc'));

// Only projected items: contents are already flattened and filtered for reach by the engine.
export const things = (v: GameView): Thing[] =>
  [
    ...v.entities,
    ...v.inventory,
    ...(v.equipment ?? []).flatMap((s) => (s.item ? [s.item] : [])),
  ].flatMap((e) => [e, ...(e.contents ?? [])]);

// Keep the page after a same-room action, stopping at the first item page that disappeared.
export function pagesAfter(stack: Page[], before: GameView, after: GameView): Page[] {
  if (after.chapter && before.chapter?.index !== after.chapter.index) return [{ kind: 'chapter' }];
  if (before.place.id !== after.place.id) return [];
  const visible = things(after);
  const gone = stack.findIndex((p) => p.kind === 'thing' && !visible.some((e) => e.id === p.id));
  return gone < 0 ? stack : stack.slice(0, gone);
}

const OWN = ['look', 'choose', 'close_choice', 'continue', 'stand', 'sit', 'rest', 'sleep']; // drawn in their own places, not as place actions

export function group(buttons: Button[]) {
  const dir = (b: Button) => (b.input as { direction?: string }).direction;
  const aimed = (b: Button) => b.target_ids.length > 0;
  return {
    look: buttons.find((b) => b.action_key === 'look' && !aimed(b)),
    exits: buttons.flatMap((b) =>
      b.action_key === 'move' && dir(b) ? [{ direction: dir(b)!, button: b }] : [],
    ),
    door: (direction: string) =>
      buttons.filter((b) => b.action_key !== 'move' && dir(b) === direction),
    continue: buttons.find((b) => b.action_key === 'continue'),
    position: buttons.filter((b) => ['stand', 'sit', 'rest', 'sleep'].includes(b.action_key)),
    choice: buttons.filter((b) => b.action_key === 'choose' || b.action_key === 'close_choice'),
    // scan: the engine verb stays, but the phone shows nothing for it yet (DIFFERENCES 3), so no button.
    place: buttons.filter(
      (b) => !aimed(b) && !dir(b) && !OWN.includes(b.action_key) && b.action_key !== 'scan',
    ),
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

// The log line for a drag toward a closed exit: the reason's own message (a sentence), else the
// code's own sentence (words.ts), else its code's words in a sentence.
export const refused = (e: GameView['exits'][number], text: (key: string) => string) =>
  e.available
    ? ''
    : e.reason.message
      ? text(e.reason.message.key)
      : (SENTENCE[e.reason.code] ?? `The way ${e.direction} is ${why(e, text)}.`);

// Under an open choice whose speaker is not here (the answers may also be closed for another
// reason, a dropped lantern, so this keys on the speaker, not on the answers' not_present). A
// choice with no speaker: no one answers it.
export const absent = (v: GameView) =>
  !v.choice || v.entities.some((e) => e.id === v.choice!.speaker_id)
    ? ''
    : v.choice.speaker_id
      ? 'They are not here to answer. Find them, or close this.'
      : 'No one is here to answer.';

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
export const bandPhrase = (r: Pool, text: (key: string) => string | undefined) => {
  const key = `band.${r.band}`;
  const phrase = text(key);
  return phrase && phrase !== key ? phrase : r.band.replaceAll('_', ' ');
};
export const said = (
  rs: readonly Pool[],
  text: (key: string) => string | undefined = () => undefined,
) =>
  `Character, ${rs.map((r) => (r.resource.key === 'hp' ? `${amount(r)}, ${bandPhrase(r, text)}` : amount(r))).join(', ')}`;

// The status line's time: the double hour's earthly branch, 子 from 23:00 to 01:00, then one
// per two hours, with English words for VoiceOver (owner decision, untimed Lantern record). The
// clock is logical seconds; the day's sexagenary name waits for a later status pane.
const ANIMALS = 'Rat Ox Tiger Rabbit Dragon Snake Horse Goat Monkey Rooster Dog Pig'.split(' ');
const STARTS = ['eleven', 'one', 'three', 'five', 'seven', 'nine'];
export const branch = (t: number) => {
  const i = Math.floor(((Math.floor(t / 3600) + 1) % 24) / 2);
  const label = `Hour of the ${ANIMALS[i]}, ${STARTS[i % 6]} to ${STARTS[(i + 1) % 6]}`;
  return { glyph: '子丑寅卯辰巳午未申酉戌亥'[i]!, label };
};

export const initialPages = (v: GameView): Page[] =>
  v.chapter ? [{ kind: 'chapter' }] : v.choice ? [conversation(v)] : [];

// Recover only the actual saved choice: a projected speaker has an ordinary entity page.
export const conversation = (v: GameView): Page =>
  v.entities.some((e) => e.id === v.choice?.speaker_id)
    ? { kind: 'thing', id: v.choice!.speaker_id! }
    : { kind: 'dialogue', speaker: v.choice?.speaker_id };

// A first-run hint's "seen" flag in a key-value store (the shell's key-value store: its own file, not the
// save). A store that throws falls back to this session's memory: a hint never stops the book.
type Store = { getItemSync(key: string): string | null; setItemSync(key: string, v: string): void };
export type Hint = ReturnType<typeof hint>;
export function hint(store: Store, key: string) {
  let seen = false;
  return {
    seen: () => {
      try {
        return seen || store.getItemSync(key) !== null;
      } catch {
        return seen;
      }
    },
    see: () => {
      seen = true;
      try {
        store.setItemSync(key, '1');
      } catch {} // ponytail: the next launch shows the hint again
    },
  };
}
