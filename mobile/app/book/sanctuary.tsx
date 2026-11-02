import { ActionCard } from './actions.tsx';
import { why } from './model.ts';

type Offer = Parameters<typeof why>[0];

// A sanctuary's refused Attack stays, teaching the rule (book-ui.md, Unavailable actions).
export const sanctuaryCards = (actions: Offer[], text: Parameters<typeof why>[1]) =>
  actions
    .filter((a) => !a.available && a.reason.cause === 'sanctuary')
    .map((a) => <ActionCard key={a.action_key} label={text(a.label)} reason={why(a, text)} />);
