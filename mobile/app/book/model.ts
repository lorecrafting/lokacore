import { dreamPages, dreamButtons, dreamAt } from './dreams.ts';
// size: allow 350, current shop quotes join the shared button/freshness builder
import type {
  ActionInput,
  EntityId,
  GameView,
  Intent,
  Key,
} from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
import { corpseButtons, serviceButtons, shopButtons, transportButtons } from './offers.ts';
import { reason, SENTENCE } from './words.ts';
import { things } from './item-pages.ts';
export { things, restoredItemPages } from './item-pages.ts';
type Say = (key: string) => string;
type Press = Omit<Button, 'token'>;
const commandOf = (a: { command?: string; action_key: string }) => a.command ?? a.action_key;

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

export const refused = (e: GameView['exits'][number], text: (key: string) => string) =>
  e.available
    ? ''
    : e.reason.message
      ? text(e.reason.message.key)
      : (SENTENCE[e.reason.code] ?? `The way ${e.direction} is ${why(e, text)}.`);

export const absent = (v: GameView) =>
  !v.choice || v.entities.some((e) => e.id === v.choice!.speaker_id)
    ? ''
    : v.choice.speaker_id
      ? 'They are not here to answer. Find them, or close this.'
      : 'No one is here to answer.';
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

// The pending choice's available answers and its Close (06 §43: never a trap).
function asked(v: GameView, label: Say): Press[] {
  const c = v.choice;
  const answer = (o: {
    choice_id: string;
    label: string;
    patrol?: NonNullable<GameView['choice']>['choices'][number]['patrol'];
  }) => ({
    label: label(o.label),
    action_key: 'choose',
    target_ids: [],
    input: {
      choice_id: o.choice_id,
      continuation_id: c!.continuation_id,
      ...(o.patrol && { patrol: o.patrol }),
    },
  });
  return [
    ...(c?.choices.filter((o) => o.available) ?? []).map(answer),
    ...(c?.closable
      ? [{ label: 'Close', action_key: 'close_choice', target_ids: [], input: {} }]
      : []),
  ];
}

// Ordinary travel carries a direction; combat uses only the projected directionless Flee.
function travel(v: GameView): Press[] {
  return v.combat
    ? []
    : v.exits
        .filter((e) => e.available)
        .map((e) => ({
          label: v.water && e.direction === 'up' ? 'Surface (free)' : `Go ${e.direction}`,
          action_key: 'move',
          target_ids: [],
          input: { direction: e.direction },
        }));
}

// size: allow 60, one offer-to-button conversion serves place/entity/Notice and quoted shop actions
export function buttonsOf(v: GameView, label: Say, text: Say): Press[] {
  const button = (
    a: { action_key: string; label: string; target_ids?: readonly string[]; command?: string },
    name: string,
    id?: string,
  ) => ({
    label: `${label(a.label)}${name}`,
    action_key: a.action_key,
    ...(a.command && { command: a.command }),
    ...(['read', 'refuel', 'pour', 'drink'].includes(commandOf(a)) && id && { detail_id: id }),
    target_ids: a.target_ids ? [...a.target_ids] : id ? [id] : [],
    input: {},
  });
  const place = v.actions.filter(
    (a) => a.available && !a.input.length && (a.target.kind === 'none' || a.target_ids?.length),
  );
  const doors = v.exits.flatMap((e) =>
    (e.door?.actions ?? [])
      .filter((a) => a.available)
      .map((a) => ({
        ...button(a, ` ${text(e.door!.name)} (${e.direction})`),
        input: { direction: e.direction },
      })),
  );
  const projected = things(v);
  const names = new Map(projected.map((e) => [e.id, e.name]));
  const held = projected.flatMap((e) =>
    e.actions
      .filter((a) => a.available && a.action_key !== 'give') // ponytail: Give waits for a touch recipient selector
      .map((a) => {
        const destination = a.target_ids?.[1] && names.get(a.target_ids[1]);
        return button(
          a,
          ` ${text(e.name)}${destination ? ` ${commandOf(a) === 'refuel' ? 'from' : commandOf(a) === 'pour' ? 'into' : 'in'} ${text(destination)}` : ''}`,
          e.id,
        );
      }),
  );
  const placed = place.map((a) => ({
    ...button(a, ''),
    ...(a.target.kind === 'entity' && { place: true as const }),
  }));
  if (v.scene) {
    const next = v.actions.find((a) => a.action_key === 'continue' && a.available);
    if (next)
      placed.push({ ...button(next, ''), input: { scene: v.scene.scene, line: v.scene.index } });
  }
  const notices = noticeButtons(v, button, names, text);
  return [
    ...placed,
    ...corpseButtons(v, text),
    ...notices,
    ...travel(v),
    ...doors,
    ...held,
    ...dreamButtons(v, label),
    ...shopButtons(v, text),
    ...serviceButtons(v, text),
    ...transportButtons(v, text),
    ...asked(v, label),
  ];
}

function noticeButtons(
  v: GameView,
  button: (a: GameView['actions'][number], name: string) => Press,
  names: Map<string, string>,
  text: Say,
) {
  return [...(v.notices ?? []), ...(v.notice_boards ?? []).flatMap((b) => b.notices)].flatMap((n) =>
    (n.actions ?? [])
      .filter(
        (a) => a.available && !a.input.length && (a.target.kind === 'none' || a.target_ids?.length),
      )
      .map((a) => ({
        ...button(a, a.target_ids?.[1] ? ` ${text(names.get(a.target_ids[1]) ?? '')}` : ''),
        detail_id: n.id,
      })),
  );
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
