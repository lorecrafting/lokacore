// The GameView invariant of runtime/invariants.ts (registered in protocol/invariants.json): a STEP check
// of the actor's view before a command against the decision on it; `resolves` maps each action key
// of the actor's set to the Command type it resolves to (commands/actions.ts resolved).
import { same } from '../foundation/compose.ts';
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
  world_context_id = command.world_context_id,
  decision,
  resolves = {},
  action_key,
}: Any): boolean => {
  const code = decision.kind === 'rejected' ? decision.error.code : undefined;
  const type = command.payload.type;
  if (type === 'use_service')
    return serviceAgrees(view, command, decision, world_context_id, action_key);
  if (command.world_context_id !== world_context_id) return code === 'not_found';
  if (type === 'continue' || (type === 'choose' && command.payload.dream))
    return dreamAgrees(view, command.payload, decision, action_key);
  if (['fill', 'pour', 'drink'].includes(type))
    return liquidAgrees(view, command.payload, decision, action_key); // own keys only: an action may be keyed `constructor`
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
  if (type === 'read' || Object.hasOwn(POSITION_VERBS, type))
    return placeAgrees(view, command.payload, decision, action_key, commandOf);
  const entry = advertised(view, command.payload, action_key, commandOf);
  const shown = Object.hasOwn(SHOWN, type) ? SHOWN[type]! : [];
  if (!entry) return type !== 'perform' || decision.kind !== 'accepted';
  if (entry.available) return !shown.includes(code);
  return decision.kind !== 'accepted' && (!shown.includes(code) || code === entry.reason.code);
};

// Read targets one concrete detail; position targets the place. Respect the selected action key.
function placeAgrees(
  view: GameView,
  payload: Any,
  decision: Any,
  action_key: string | undefined,
  commandOf: (a: AdvertisedAction) => string | undefined,
) {
  const listed = view.actions.some(
    (a) =>
      (action_key === undefined || a.action_key === action_key) &&
      a.available &&
      commandOf(a) === payload.type &&
      (payload.type !== 'read' ||
        (a.target_ids?.length === 1 && a.target_ids[0] === payload.target_id)),
  );
  const code = decision.kind === 'rejected' ? decision.error.code : undefined;
  const refusals = payload.type === 'read' ? VERB_CODES : ['invalid_state'];
  return listed ? !refusals.includes(code) : decision.kind !== 'accepted';
}

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

const DOOR_VERBS = [...Object.keys(MOVES), 'knock'];
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
    const actions =
      p.type === 'perform'
        ? [
            ...view.actions,
            ...(view.notices ?? []).flatMap((n) => n.actions ?? []),
            ...(view.notice_boards ?? []).flatMap((b) => b.notices.flatMap((n) => n.actions ?? [])),
          ]
        : view.actions;
    return actions.find((a) => a.action_key === key);
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

function liquidAgrees(view: GameView, p: Any, decision: Any, key?: string): boolean {
  const targets =
    p.type === 'fill'
      ? [p.source_id, p.vessel_id]
      : p.type === 'pour'
        ? [p.source_id, p.receiver_id]
        : [p.vessel_id];
  const source =
    p.type === 'fill'
      ? (view.notices ?? []).find((n) => n.id === p.source_id)
      : entityView(view, targets[0]);
  const offers = source?.actions?.filter(
    (a) =>
      (key === undefined || a.action_key === key) &&
      (a.command ?? a.action_key) === p.type &&
      JSON.stringify(a.target_ids) === JSON.stringify(targets),
  );
  if (!offers?.length) return decision.kind !== 'accepted';
  if (offers.some((a) => a.available))
    return decision.kind === 'accepted' || decision.kind === 'fault';
  return (
    decision.kind === 'rejected' &&
    offers.some((a) => !a.available && decision.error.code === a.reason.code)
  );
}

function serviceAgrees(
  view: GameView,
  command: Any,
  decision: Any,
  world_context_id: string,
  action_key?: string,
) {
  const code = decision.kind === 'rejected' ? decision.error.code : undefined;
  if (view.ancestry_choices?.length) return code === 'invalid_state';
  if (command.id === '00000000-0000-0000-0000-000000000000') return code === 'permission_denied';
  const payload = command.payload;
  if (command.world_context_id !== world_context_id || payload.actor_id !== view.actor_id)
    return code === 'not_found';
  const offer = view.entities
    .find((e: EntityView) => e.id === payload.provider_id)
    ?.services?.find(
      (s: any) =>
        same(s.service, payload.service) &&
        s.price === payload.quoted_price &&
        (action_key === undefined || s.action.action_key === action_key),
    );
  if (!offer) return decision.kind !== 'accepted';
  return offer.action.available
    ? decision.kind === 'accepted' || decision.kind === 'fault'
    : decision.kind === 'rejected' && decision.error.code === offer.action.reason.code;
}

function dreamAgrees(view: Any, p: Any, decision: Any, key?: string) {
  if (p.type === 'continue' && view.scene) {
    const matched = same(view.scene.scene, p.scene) && view.scene.index === p.line;
    return matched ? decision.kind !== 'rejected' : decision.kind !== 'accepted';
  }
  const dream = view.notices
    ?.map((n: Any) => n.dream)
    .find((d: Any) => d && same(d.scene, p.type === 'continue' ? p.scene : p.dream?.scene));
  const entry =
    p.type === 'continue'
      ? dream?.index === p.line
        ? dream?.action
        : undefined
      : dream?.choice?.choices.find(
          (c: Any) =>
            c.choice_id === p.choice_id &&
            dream.choice.continuation_id === p.continuation_id &&
            same(c.dream, p.dream),
        );
  if (!entry || (key && entry.action_key !== key)) return decision.kind !== 'accepted';
  return entry.available
    ? decision.kind === 'accepted' || decision.kind === 'fault'
    : decision.kind === 'rejected' && decision.error.code === entry.reason.code;
}
