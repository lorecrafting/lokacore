// The room page's own action list (pages.tsx draws it after the storylet).
import type { GameView } from '../../packages/game-view/session.ts';
import { commandOf, refusedPlace } from './buttons.ts';
import { notVerb, why, type group } from './model.ts';
import type { Button } from './presenter.ts';
import { cardKey } from './presenter.ts';
import { ActionCard, VerbLine } from './actions.tsx';

type Say = (key: string) => string;

// The place's own actions, then those it lists unavailable as `label: reason` notes, never dropped
// (pass-1 R2); a notice's actions stay on its notice page; the storylet has its card.
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
  const verb = (a: { action_key: string; target_ids?: readonly string[] }) =>
    a.action_key !== view.storylet && !notices.some((n) => a.target_ids?.includes(n.id));
  return [
    ...g.place
      .filter(verb)
      .map((b) => <VerbLine key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={press} />),
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
