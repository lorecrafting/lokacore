// The GameView invariant of invariants.ts (registered in protocol/invariants.json): a STEP check
// of the actor's view before a command against the decision on it; `resolves` maps each action key
// of the actor's set to the Command type it resolves to (actions.ts resolved).
import type { AdvertisedAction, EntityView, ExitView, GameView } from './contracts.gen.ts';
import { MOVES } from './rules/barrier.ts';

// Observations are decoded JSON; fields are read loosely, as in invariants.ts.
type Any = any;

// The view's entry for the command (its exit for a move, else its action) and admission agree
// (04 §15, §19): available is never refused with a code the view shows for that entry;
// unavailable is never accepted, and a refusal with such a code is the view's code. A door verb
// (04 §15 as amended by c1-doors) is listed on its exit's door only when admission and the barrier
// rule accept it, under any key that resolves to it: listed, it is never refused with a code they give (not_found aside: a foreign
// actor's or world's command is the envelope's); not listed, it is never accepted. Likewise wear
// and remove (protocol.md GameView as amended by c1-equipment) on the item they name.
export const gameview_agrees_with_admission = ({
  view,
  command,
  decision,
  resolves,
}: Any): boolean => {
  const code = decision.kind === 'rejected' ? decision.error.code : undefined;
  const type = command.payload.type; // own keys only: an action may be keyed `constructor`
  if (DOOR_VERBS.includes(type) || EQUIP_VERBS.includes(type)) {
    const actions = DOOR_VERBS.includes(type)
      ? view.exits.find((e: ExitView) => e.direction === command.payload.direction)?.door?.actions
      : entityView(view, command.payload.item_id)?.actions;
    const listed = actions?.some(
      (a: AdvertisedAction) =>
        Object.hasOwn(resolves, a.action_key) && resolves[a.action_key] === type,
    );
    return listed ? !VERB_CODES.includes(code) : decision.kind !== 'accepted';
  }
  const entry = advertised(view, command.payload);
  const shown = Object.hasOwn(SHOWN, type) ? SHOWN[type]! : [];
  if (!entry) return true;
  if (entry.available) return !shown.includes(code);
  return decision.kind !== 'accepted' && (!shown.includes(code) || code === entry.reason.code);
};

// The codes the view can show on an entry: an exit's passage and fare; a recipe's policy and
// admission. ponytail: an engine verb's policy is always true, so it shows none; a cartridge
// action with a policy on an engine command joins when a cartridge authors one.
const SHOWN: Readonly<Record<string, readonly string[]>> = {
  move: ['exit_closed', 'exit_locked', 'insufficient_resource'],
  perform: ['invalid_state', 'cooldown', 'insufficient_resource'],
};

const DOOR_VERBS = Object.keys(MOVES);
const EQUIP_VERBS = ['wear', 'remove'];
const VERB_CODES = [
  'unsupported_capability',
  'invalid_target',
  'invalid_state',
  'exit_locked',
  'not_owned',
];

function advertised(view: GameView, p: Any): ExitView | AdvertisedAction | undefined {
  if (p.type === 'move') return view.exits.find((e) => e.direction === p.direction);
  const id = p.type === 'perform' ? undefined : (p.item_id ?? p.target_id);
  if (id === undefined) {
    const key = p.type === 'perform' ? p.action : p.type;
    return view.actions.find((a) => a.action_key === key);
  }
  return entityView(view, id)?.actions.find((a) => a.action_key === p.type);
}

// The view's entry for an entity id: in the room, held, or worn.
const entityView = (view: GameView, id: string): EntityView | undefined =>
  [
    ...view.entities,
    ...view.inventory,
    ...(view.equipment ?? []).flatMap((s) => (s.item ? [s.item] : [])),
  ].find((e) => e.id === id);
