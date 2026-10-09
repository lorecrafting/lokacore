import { dreamPages, dreamAt } from './dreams.ts';
import type {
  ActionInput,
  EntityId,
  GameView,
  Intent,
  Key,
} from '../../packages/game-view/session.ts';
import type { Button, DetailLine } from './presenter.ts';
import { commandOf } from './buttons.ts';
export { buttonsOf } from './buttons.ts';
import { reason, SENTENCE } from './words.ts';
import { things } from './item-pages.ts';
export { things, restoredItemPages } from './item-pages.ts';
type Say = (key: string) => string;
export const bleedingLine = (b: NonNullable<GameView['bleeding']>, time: number, text: Say) =>
  `${text(b.label)} · ${Math.max(0, b.ends_at - time)}s remaining · ${b.hp_loss} HP each ${b.tick_every}s`;
export const expeditionLine = (
  e: NonNullable<GameView['journal'][number]['expedition']>,
  text: Say,
) =>
  e.status === 'active' && e.next_title
    ? e.direction
      ? `Next: ${e.direction} to ${text(e.next_title)}.`
      : `Next checkpoint: ${text(e.next_title)}.`
    : '';

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
        | 'combat';
    }
  | { kind: 'thing' | 'board' | 'notice' | 'dream'; id: string }
  | { kind: 'dialogue'; speaker?: string };

export const npcPage = (page: Page | undefined, view: GameView) =>
  page?.kind === 'dialogue' ||
  (page?.kind === 'thing' && view.entities.some((e) => e.id === page.id && e.kind === 'npc'));

export { nextPosition, POSITION_ACTIONS } from './positions.ts';

export function pagesAfter(stack: Page[], before: GameView, after: GameView): Page[] {
  if (after.combat) return stack.at(-1)?.kind === 'combat' ? stack : [{ kind: 'combat' }];
  if (before.combat || stack.some((page) => page.kind === 'combat')) return [];
  if (after.chapter && before.chapter?.index !== after.chapter.index) return [{ kind: 'chapter' }];
  if (before.place.id !== after.place.id) return [];
  const dreaming = dreamPages(stack, before, after);
  if (dreaming) return dreaming;
  const visible = things(after);
  const boards = after.notice_boards ?? [];
  const notices = [...(after.notices ?? []), ...boards.flatMap((b) => b.notices)];
  const missing = stack.findIndex(
    (p) =>
      (p.kind === 'board' && !boards.some((b) => b.id === p.id)) ||
      (p.kind === 'notice' && !notices.some((n) => n.id === p.id)),
  );
  if (missing >= 0) return stack.slice(0, missing);
  const gone = stack.findIndex((p) => p.kind === 'thing' && !visible.some((e) => e.id === p.id));
  if (gone < 0) return stack;
  const page = stack[gone];
  if (page.kind === 'thing' && after.choice?.speaker_id === page.id)
    return [...stack.slice(0, gone), { kind: 'dialogue', speaker: page.id }];
  return stack.slice(0, gone);
}
const OWN = ['flee', 'look', 'choose', 'close_choice', 'continue', 'stand', 'sit', 'rest', 'sleep'];

export function group(buttons: Button[]) {
  const dir = (b: Button) => (b.input as { direction?: string }).direction;
  const aimed = (b: Button) => b.target_ids.length > 0;
  return {
    look: buttons.find((b) => b.action_key === 'look' && !aimed(b)),
    exits: buttons.flatMap((b) =>
      b.action_key === 'move' && dir(b) ? [{ direction: dir(b)!, button: b }] : [],
    ),
    door: (direction: string) =>
      buttons.filter((b) => !['move', 'flee'].includes(b.action_key) && dir(b) === direction),
    flee: buttons.filter((b) => b.action_key === 'flee'),
    bandage: buttons.filter((b) => b.action_key === 'bandage'),
    continue: buttons.find((b) => b.action_key === 'continue'),
    position: buttons.filter(
      (b) => !b.detail_id && ['stand', 'sit', 'rest', 'sleep'].includes(commandOf(b)),
    ),
    choice: buttons.filter((b) => b.action_key === 'choose' || b.action_key === 'close_choice'),
    place: buttons.filter(
      (b) =>
        !b.detail_id &&
        (!aimed(b) || b.place) &&
        !dir(b) &&
        !OWN.includes(b.action_key) &&
        b.action_key !== 'scan',
    ),
    on: (id: string) =>
      buttons.filter((b) => (b.detail_id ? b.detail_id === id : b.target_ids.includes(id))),
  };
}
export const plain = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

type Offered =
  | GameView['exits'][number]
  | GameView['actions'][number]
  | NonNullable<GameView['choice']>['choices'][number];
export const why = (e: Offered, text: (key: string) => string) =>
  e.available ? '' : e.reason.message ? text(e.reason.message.key) : reason(e.reason.code);

// A closed exit's log line: its reason word as the tag, then the cartridge's sentence or the frame.
export const refused = (
  e: Extract<GameView['exits'][number], { available: false }>,
  text: (key: string) => string,
): DetailLine => ({
  kind: 'refused',
  reason: reason(e.reason.code),
  text: e.reason.message
    ? text(e.reason.message.key)
    : (SENTENCE[e.reason.code] ?? `The way ${e.direction} is ${why(e, text)}.`),
});

export const absent = (v: GameView) =>
  !v.choice || v.entities.some((e) => e.id === v.choice!.speaker_id)
    ? ''
    : v.choice.speaker_id
      ? 'They are not here to answer. Find them, or close this.'
      : 'No one is here to answer.';
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Pool = NonNullable<GameView['resources']>[number];
// Band colours mark only the condition pools, never pennies (book-ui.md#world-and-status-entry).
export const toneOf = (r: Pool) =>
  ['hp', 'ma', 'mv'].includes(r.resource.key) ? r.tone : 'normal';
export const bandPhrase = (r: Pool, text: (key: string) => string | undefined) => {
  const key = `band.${r.band}`;
  const phrase = text(key);
  return phrase && phrase !== key ? phrase : r.band.replaceAll('_', ' ');
};
export const said = (
  rs: readonly Pool[],
  text: (key: string) => string | undefined = () => undefined,
) =>
  [
    rs.map((r) => `${r.resource.key} ${r.current}/${r.maximum}`).join(' '),
    ...rs.filter((r) => r.resource.key === 'hp').map((r) => `hp ${bandPhrase(r, text)}`),
  ].join('; ');

// Logical seconds: 子 spans 23:00–01:00; English double-hour names serve VoiceOver.
const ANIMALS = 'Rat Ox Tiger Rabbit Dragon Snake Horse Goat Monkey Rooster Dog Pig'.split(' ');
const STARTS = ['eleven', 'one', 'three', 'five', 'seven', 'nine'];
export const branch = (t: number) => {
  const i = Math.floor(((Math.floor(t / 3600) + 1) % 24) / 2);
  const label = `Hour of the ${ANIMALS[i]}, ${STARTS[i % 6]} to ${STARTS[(i + 1) % 6]}`;
  return { glyph: '子丑寅卯辰巳午未申酉戌亥'[i]!, label };
};

export const initialPages = (v: GameView): Page[] =>
  v.combat
    ? [{ kind: 'combat' }]
    : v.chapter
      ? [{ kind: 'chapter' }]
      : v.choice
        ? [conversation(v)]
        : [];

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

export function actionContext(
  view: GameView,
  b: Pick<Button, 'action_key' | 'command' | 'target_ids' | 'input' | 'detail_id'>,
  generation: number,
) {
  const exit = view.exits.find(
    (e) => e.direction === (b.input as { direction?: string }).direction,
  );
  return JSON.stringify([
    generation,
    b.action_key,
    b.command,
    b.target_ids,
    b.detail_id,
    Object.entries(b.input)
      .filter(([key]) => !(b.action_key === 'choose' && key === 'answer'))
      .sort(([a], [z]) => a.localeCompare(z)),
    b.detail_id?.startsWith('dream:') ? dreamAt(view, b.detail_id.slice('dream:'.length)) : null,
    view.actor_id,
    view.place.id,
    view.choice,
    view.scene,
    view.combat,
    commandOf(b) === 'use_transport'
      ? view.notices?.find((n) => n.id === b.detail_id)?.transport
      : null,
    ['fill', 'pour', 'drink', 'use_service'].includes(commandOf(b))
      ? things(view)
          .filter((e) => b.target_ids.includes(e.id))
          .map((e) => [e.id, e.liquid, 'services' in e ? e.services : undefined])
      : null,
    ['stand', 'sit', 'rest', 'sleep'].includes(b.action_key) ? view.position : null,
    exit ? [exit.sight?.room, exit.door?.state] : null,
  ]);
}

export const intentOf = ({ action_key, target_ids, input, token }: Button): Intent => ({
  action_key: action_key as Key,
  target_ids: target_ids as EntityId[],
  input: input as ActionInput,
  ...(token && { view_freshness_token: token }),
});
