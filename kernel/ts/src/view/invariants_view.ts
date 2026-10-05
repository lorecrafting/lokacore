// The GameView invariant of runtime/invariants.ts (registered in protocol/invariants.json): a STEP check
// of the actor's view before a command against the decision on it; `resolves` maps each action key
// of the actor's set to the Command type it resolves to (commands/actions.ts resolved).
import type {
  AdvertisedAction,
  ContentView,
  EntityView,
  ExitView,
  GameView,
} from '../contracts.gen.ts';
import { MOVES } from '../mechanics/barrier/rule.ts';
import { VERBS as EQUIP_VERBS } from '../mechanics/equipment/rule.ts';
import { VERBS as POSITION_VERBS } from '../mechanics/position/shared.ts';

// Observations are decoded JSON; fields are read loosely, as in invariants.ts.
type Any = any;

// The view's entry for the command (its exit for a move, else its action) and admission agree
// (04 §15, §19): available is never refused with a code the view shows for that entry;
// unavailable is never accepted, and a refusal with such a code is the view's code. A door verb
// (04 §15 as amended by c1-doors) is listed on its exit's door only when admission and the barrier
// rule accept it, under any key that resolves to it: listed, it is never refused with a code they give (not_found aside: a foreign
// actor's or world's command is the envelope's); not listed, it is never accepted. Likewise a door
// verb on the item it targets (a container, c1-locks, nested ones in contents included), and wear
// and remove (protocol.md GameView as amended by c1-equipment) on the item they name, and never
// among the place's actions; a listed take is never refused not_present. A position verb
// (position@1, c1-position) uses the selected action_key when supplied, else any matching place
// action: available, it is never refused invalid_state; unavailable or absent, never accepted.
export const gameview_agrees_with_admission = ({
  view,
  command,
  decision,
  resolves = {},
  action_key,
}: Any): boolean => {
  const code = decision.kind === 'rejected' ? decision.error.code : undefined;
  const type = command.payload.type; // own keys only: an action may be keyed `constructor`
  const commandOf = (a: AdvertisedAction) =>
    Object.hasOwn(resolves, a.action_key) ? resolves[a.action_key] : undefined;
  const equip = (a: AdvertisedAction) => EQUIP_VERBS.includes(commandOf(a));
  if (view.actions?.some(equip)) return false; // a targetless wear or remove is never accepted
  if (DOOR_VERBS.includes(type) || EQUIP_VERBS.includes(type)) {
    const { direction, target_id, item_id } = command.payload;
    const actions = !DOOR_VERBS.includes(type)
      ? entityView(view, item_id)?.actions
      : (direction === undefined) === (target_id === undefined)
        ? undefined // neither or both: never accepted
        : direction !== undefined
          ? view.exits.find((e: ExitView) => e.direction === direction)?.door?.actions
          : entityView(view, target_id)?.actions;
    const listed = actions?.some((a: AdvertisedAction) => commandOf(a) === type);
    return listed ? !VERB_CODES.includes(code) : decision.kind !== 'accepted';
  }
  if (Object.hasOwn(POSITION_VERBS, type)) {
    const listed = view.actions.some(
      (a: AdvertisedAction) =>
        (action_key === undefined || a.action_key === action_key) &&
        a.available &&
        commandOf(a) === type,
    );
    return listed ? code !== 'invalid_state' : decision.kind !== 'accepted';
  }
  const entry = advertised(view, command.payload, action_key, commandOf);
  const shown = Object.hasOwn(SHOWN, type) ? SHOWN[type]! : [];
  if (!entry) return true;
  if (entry.available) return !shown.includes(code);
  return decision.kind !== 'accepted' && (!shown.includes(code) || code === entry.reason.code);
};

// The codes the view can show on an entry: an exit's passage, position (position@1) and fare; a
// recipe's policy and admission. ponytail: an engine verb's policy is always true, so it shows none; a cartridge
// action with a policy on an engine command joins when a cartridge authors one.
const SHOWN: Readonly<Record<string, readonly string[]>> = {
  move: [
    'unsupported_capability',
    'exit_closed',
    'exit_locked',
    'invalid_state',
    'insufficient_resource',
  ],
  perform: ['invalid_state', 'cooldown', 'insufficient_resource'],
  put: ['not_present', 'not_owned', 'invalid_state', 'exit_closed', 'exit_locked'],
  take: ['not_present', 'too_heavy'], // reach and voluntary carrying admission
};

const DOOR_VERBS = Object.keys(MOVES);
const VERB_CODES = [
  'unsupported_capability',
  'invalid_target',
  'invalid_state',
  'exit_locked',
  'not_owned',
  'not_present',
];

function advertised(
  view: GameView,
  p: Any,
  action_key: string | undefined,
  commandOf: (a: AdvertisedAction) => string | undefined,
): ExitView | AdvertisedAction | undefined {
  if (p.type === 'move') return view.exits.find((e) => e.direction === p.direction);
  const id = p.type === 'perform' ? undefined : (p.item_id ?? p.target_id);
  if (id === undefined) {
    const key = p.type === 'perform' ? p.action : p.type;
    return view.actions.find((a) => a.action_key === key);
  }
  return entityView(view, id)?.actions.find((a) =>
    p.type === 'put'
      ? (action_key === undefined || a.action_key === action_key) &&
        (commandOf(a) ?? a.action_key) === 'put' &&
        a.target_ids?.[0] === p.item_id &&
        a.target_ids?.[1] === p.container_id
      : p.type === 'take'
        ? (action_key === undefined || a.action_key === action_key) &&
          (commandOf(a) ?? a.action_key) === 'take'
        : a.action_key === p.type,
  );
}

// The view's entry for an entity id: in the room, held (or inside either, c1-locks), or worn.
const entityView = (view: GameView, id: string): EntityView | ContentView | undefined =>
  [
    ...view.entities,
    ...view.inventory,
    ...[...view.entities, ...view.inventory].flatMap((e) => e.contents ?? []),
    ...(view.equipment ?? []).flatMap((s) => (s.item ? [s.item] : [])),
  ].find((e) => e.id === id);
