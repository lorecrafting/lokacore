// GameView's offered actions as the book's buttons: place, door, held-item, notice, travel,
// dream, shop, service, transport and conversation answers, each with its exact intent.
import type { GameView } from '../../packages/game-view/session.ts';
import { dreamButtons } from './dreams.ts';
import { things } from './item-pages.ts';
import { corpseButtons, serviceButtons, shopButtons, transportButtons } from './offers.ts';
import type { Button } from './presenter.ts';

type Say = (key: string) => string;
type Press = Omit<Button, 'token'>;
export const commandOf = (a: { command?: string; action_key: string }) => a.command ?? a.action_key;

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
    ...placeButtons(v, button),
    ...corpseButtons(v, text),
    ...noticeButtons(v, button, names, text),
    ...travel(v),
    ...doors,
    ...heldButtons(v, button, projected, names, text),
    ...(v.known_npcs ?? []).map((n) => ({
      label: `Ask where ${text(n.name)} is`,
      action_key: 'where',
      target_ids: [n.id],
      input: {},
    })),
    ...dreamButtons(v, label),
    ...shopButtons(v, text),
    ...serviceButtons(v, text),
    ...transportButtons(v, text),
    ...asked(v, label),
  ];
}

// The place's own actions, then a scene's Continue.
function placeButtons(v: GameView, button: ToButton) {
  const place = v.actions.filter(
    (a) => a.available && !a.input.length && (a.target.kind === 'none' || a.target_ids?.length),
  );
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

function heldButtons(
  v: GameView,
  button: ToButton,
  projected: ReturnType<typeof things>,
  names: Map<string, string>,
  text: Say,
) {
  return projected.flatMap((e) =>
    e.actions
      .filter((a) => a.available && a.action_key !== 'give') // ponytail: Give waits for a touch recipient selector
      .map((a) => {
        const destination = a.target_ids?.[1] && names.get(a.target_ids[1]);
        const offered = button(
          a,
          ` ${text(e.name)}${destination ? ` ${commandOf(a) === 'refuel' ? 'from' : commandOf(a) === 'pour' ? 'into' : 'in'} ${text(destination)}` : ''}`,
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
