// GameView's offered actions as the book's buttons: place, door, held-item, notice, travel,
// dream, shop, service, transport and conversation answers, each with its exact intent.
import type { GameView } from '../../packages/game-view/session.ts';
import { dreamButtons } from './dreams.ts';
import { things } from './item-pages.ts';
import { corpseButtons, serviceButtons, shopButtons, transportButtons } from './offers.ts';
import type { Button } from './presenter.ts';
import { LABEL } from './labels.ts';
import { NOTED, why } from './words.ts';

type Say = (key: string) => string;
type Press = Omit<Button, 'token'>;
export const commandOf = (a: { command?: string; action_key: string }) => a.command ?? a.action_key;

// Detail-page option groups (book-ui.md; pass-1 UR): act (unlisted), move, store or hand, ask.
const RANK = ['take drop', 'put give', 'ask where use_service'];
export const rank = (b: { command?: string; action_key: string }) =>
  RANK.findIndex((g) => g.split(' ').includes(commandOf(b))); // unlisted: -1, first

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
      ? [{ label: LABEL.close, action_key: 'close_choice', target_ids: [], input: {} }]
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

// A projected action as a button: `name` follows its label; `id` is its owner's detail page.
const toButton =
  (label: Say) =>
  (
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
type ToButton = ReturnType<typeof toButton>;

export function buttonsOf(v: GameView, label: Say, text: Say): Press[] {
  const button = toButton(label);
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
  return [
    ...(v.ancestry_choices ?? []).map((a) => ({
      label: label(a.label),
      action_key: 'choose_ancestry',
      target_ids: [],
      input: { ancestry: a.key },
    })),
    ...raiseButtons(v),
    ...placeButtons(v, button),
    ...corpseButtons(v, text),
    ...noticeButtons(v, button, names, text),
    ...travel(v),
    ...doors,
    ...heldButtons(v, button, projected, names, text),
    ...(v.known_npcs ?? []).map((n) => ({
      label: `${LABEL.askWhere} ${text(n.name)} is`,
      action_key: 'where',
      target_ids: [n.id],
      input: {},
    })),
    ...dreamButtons(v, label),
    ...shopButtons(v, text),
    ...[askButtons, wordButtons, serviceButtons, transportButtons].flatMap((f) => f(v, text)),
    ...asked(v, label),
  ];
}

// One Raise card per authored attribute while the single raise_attribute action is offered (row 4).
const raiseButtons = (v: GameView): Press[] =>
  v.actions.some((a) => a.action_key === 'raise_attribute' && a.available)
    ? (v.attributes ?? []).map((a) => ({
        label: `Raise ${a.attribute.key.toUpperCase()}`,
        action_key: 'raise_attribute',
        target_ids: [],
        input: { attribute: a.attribute },
      }))
    : [];

// One Ask about card per known topic on each NPC offering ask, in projected order (row FD7).
const askButtons = (v: GameView, text: Say): Press[] =>
  v.entities.flatMap((e) =>
    e.actions
      .filter((a) => a.action_key === 'ask' && a.available)
      .flatMap((a) =>
        (v.topics ?? []).map((t) => ({
          label: `${LABEL.askAbout} ${text(t.label)}`,
          action_key: a.action_key,
          target_ids: [e.id],
          input: { topic: t.topic },
        })),
      ),
  );

// The word field's sends (book-ui.md, Word bar): only while no combat, scene or conversation is open.
export const WORDS = ['say', 'whisper', 'shout', 'cast'];
export const wordless = (v: GameView) => Boolean(v.combat || v.scene || v.choice);
// The spell words known here: none unless Cast is offered here.
export const castWords = (v: GameView) =>
  !wordless(v) && v.actions.some((a) => a.action_key === 'cast') ? (v.spell_words ?? []) : [];
// The word field's chips (the Realm's): the known phrases, then the spell words castable here.
export const knownWords = (v: GameView) => [
  ...new Set([
    ...(v.phrases ?? []),
    ...castWords(v)
      .filter((s) => s.available)
      .map((s) => s.word),
  ]),
];
// Say, shout, cast and each whisper without a word: the live twins of every typed word
// (actionContext): the Realm's word field, the Character page's spell cards and the NPC page's Whisper send them.
function wordButtons(v: GameView, text: Say): Press[] {
  if (wordless(v)) return [];
  const offered = (key: string) => v.actions.some((a) => a.action_key === key && a.available);
  const twin = (key: string, to?: { id: string; name: string }) => ({
    label: `, ${to ? `whisper to ${text(to.name)}` : key}`,
    action_key: key,
    target_ids: to ? [to.id] : [],
    input: {},
  });
  return [
    ...['say', 'shout', 'cast'].filter(offered).map((key) => twin(key)),
    ...v.entities.flatMap((e) =>
      e.actions.some((a) => a.action_key === 'whisper' && a.available) ? [twin('whisper', e)] : [],
    ),
  ];
}

// A place offer: no typed input, and no target or a named one.
const placeOffer = (a: GameView['actions'][number]) =>
  !a.input.length && (a.target.kind === 'none' || !!a.target_ids?.length);

// The place's own actions, then a scene's Continue.
function placeButtons(v: GameView, button: ToButton) {
  const place = v.actions.filter((a) => a.available && placeOffer(a));
  const placed: Press[] = place.map((a) => ({
    ...button(a, ''),
    ...(a.target.kind === 'entity' && { place: true as const }),
  }));
  const scene = v.scene;
  const next = scene && v.actions.find((a) => a.action_key === 'continue' && a.available);
  if (scene && next)
    placed.push({ ...button(next, ''), input: { scene: scene.scene, line: scene.index } });
  return placed;
}

const JOIN: Record<string, string> = { refuel: 'from', pour: 'into' };
// Two-target commands that are no use pair (kernel commands/invocation.ts TARGETS); Put keeps its card.
// ponytail: an authored key aliasing one of these, with no projected command, reads as a use pair.
const NOT_USE = ['fill', 'pour', 'refuel', 'put', 'buy', 'sell'];
// The other object of a use pair (G4: [target, tool], on the tool) or a Give pair ([item, person]);
// a use pair resting between uses (cooldown) stays a Pick list row (book-ui.md, Pick a second thing).
export const other = (
  a: { action_key: string; command?: string; target_ids?: readonly string[] },
  id: string,
) =>
  a.target_ids?.length === 2 &&
  !NOT_USE.includes(commandOf(a)) &&
  (a.target_ids[1] === id ? a.target_ids[0] : commandOf(a) === 'give' && a.target_ids[1]);
// A use or Give pair is a Pick list row on both its pages (pick.ts), its label the scripted action's.
const pickRows = (row: Press, reason: string, ids: string[]) =>
  ids.map((id) => ({ ...row, pick: reason ? { reason } : {}, detail_id: id }));

// An offer a held thing's page draws: offered, an aimed spell (refused, its row), or a resting use pair.
const held = (a: ReturnType<typeof things>[number]['actions'][number], id: string) =>
  a.available || commandOf(a) === 'cast' || (!!other(a, id) && a.reason?.code === 'cooldown');

function heldButtons(
  v: GameView,
  button: ToButton,
  projected: ReturnType<typeof things>,
  names: Map<string, string>,
  text: Say,
) {
  return projected.flatMap((e) =>
    e.actions
      .filter((a) => held(a, e.id) && !['ask', 'whisper'].includes(a.action_key)) // whisper is wordButtons, ask is askButtons
      // An unauthored Wear on a wield-slot item reads Wield (book-ui.md, Equipment and skills).
      .map((o) =>
        o.label === 'action.wear' && e.slot === 'wield' ? { ...o, label: 'action.wield' } : o,
      )
      .flatMap((a) => {
        // An aimed spell is a Cast a spell… row on its target, an unavailable `Lux` row when refused (pick.ts).
        if (commandOf(a) === 'cast') return pickRows(button(a, ''), why(a, text), [e.id]);
        const two = other(a, e.id);
        // the Book never shows a thing the view does not project (PM ruling, loka-x6t.109.4)
        if (two)
          return names.has(two)
            ? pickRows(button(a, ''), a.available ? '' : `${NOTED.cooldown}.`, [e.id, two])
            : [];
        const destination = a.target_ids?.[1] && names.get(a.target_ids[1]);
        const join = JOIN[commandOf(a)] ?? 'in';
        const offered = button(
          a,
          ` ${text(e.name)}${destination ? ` ${join} ${text(destination)}` : ''}`,
          e.id,
        );
        return a.action_key === 'bandage' && v.bleeding
          ? { ...offered, input: { effect_generation: v.bleeding.generation } }
          : offered;
      }),
  );
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
        (a) =>
          a.available &&
          (!a.input.length ||
            a.command === 'expedition' ||
            (a.command === 'harvest' && a.input.length === 1 && a.input[0] === 'method')) &&
          (a.target.kind === 'none' || a.target_ids?.length),
      )
      .map((a) => ({
        ...button(a, a.target_ids?.[1] ? ` ${text(names.get(a.target_ids[1]) ?? '')}` : ''),
        ...(a.input.includes('method') && { input: { method: 'careful' } }),
        ...(a.command === 'expedition' && { input: expeditionInput(v, a.input) }),
        detail_id: n.id,
      })),
  );
}

function expeditionInput(v: GameView, fields: readonly string[]) {
  if (!fields.includes('attempt_id')) return { transition: 'start' };
  const row = v.journal.find((q) => q.expedition)?.expedition;
  if (!row) return {};
  return fields.includes('cursor')
    ? {
        transition: 'shelter',
        quest_instance_id: row.quest_instance_id,
        attempt_id: row.attempt_id,
        cursor: row.cursor,
      }
    : {
        transition: 'restart',
        quest_instance_id: row.quest_instance_id,
        attempt_id: row.attempt_id,
      };
}
