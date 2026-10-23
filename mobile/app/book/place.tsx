// The room page's own action list (pages.tsx draws it after the storylet).
import type { GameView } from '../../packages/game-view/session.ts';
import { commandOf, refusedPlace } from './buttons.ts';
import { notVerb, why, type group } from './model.ts';
import type { Button } from './presenter.ts';
import { cardKey } from './presenter.ts';
import { ActionCard, VerbLine } from './actions.tsx';

type Say = (key: string) => string;

// The place's own actions, then those it lists unavailable as `label: reason` notes, never dropped
// (pass-1 R2); the storylet has its card. An action aimed at a thing or notice with its own page
// draws there, not here (owner 2026-10-23); a refused one keeps its note here.
export const placeActions = (
  view: GameView,
  g: ReturnType<typeof group>,
  press: (b: Button) => void,
  text: Say,
  label: Say,
) => {
  const notices = [
    ...(view.notices ?? []),
    ...(view.notice_boards ?? []).flatMap((b) => b.notices),
  ];
  const paged = new Set<string>([...notices, ...view.entities].map((t) => t.id)); // each has its own page
  const verb = (a: { action_key: string; target_ids?: readonly string[] }) =>
    a.action_key !== view.storylet && !notices.some((n) => a.target_ids?.includes(n.id));
  const own = (b: Button) => verb(b) && !b.target_ids.some((id) => paged.has(id));
  return [
    ...g.place.filter(own).map((b) => <VerbLine key={cardKey(b)} b={b} press={press} />),
    ...refusedPlace(view)
      .filter((a) => !notVerb(a.action_key) && verb(a))
      .map((a) => (
        <ActionCard key={a.label + a.target_ids} label={label(a.label)} reason={why(a, text)} />
      )),
    // A shut door's way through, also here (pass-1 R4): the Map's own cards, its labels.
    ...view.exits
      .flatMap((e) => g.door(e.direction))
      .filter((b) => ['open', 'unlock'].includes(commandOf(b)))
      .map((b) => <ActionCard key={cardKey(b)} b={b} press={press} />),
  ];
};
