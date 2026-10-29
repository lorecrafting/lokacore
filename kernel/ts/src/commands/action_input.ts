// Exact command, primary target, scope and captured input binding.
import type { CharacterId, CommandPayload, EntityId, Key } from '../contracts.gen.ts';
import { same } from '../foundation/compose.ts';
import { bodyOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { KernelError } from '../foundation/error.ts';
import { reach } from '../mechanics/lookups.ts';
import { wornIn } from '../mechanics/equipment/rule.ts';
import type { Offered } from './actions.ts';
import { value as factValue } from '../mechanics/fact.ts';
import { definition as expeditionDefinition } from '../mechanics/expedition/shared.ts';
import { spellOf } from '../mechanics/scripted_action/shared.ts';
import { visible } from '../mechanics/light/shared.ts';

// Payload fields that are ActionInput parameters (action.schema.json ActionInput).
const INPUTS: readonly string[] = [
  'ancestry',
  'attribute',
  'word',
  'topic',
  'direction',
  'choice_id',
  'continuation_id',
  'until',
  'answer',
  'scene',
  'line',
  'quoted_price',
  'method',
  'effect_generation',
  'service',
  'route',
  'quoted_fare',
  'dream',
  'patrol',
  'transition',
  'quest_instance_id',
  'attempt_id',
  'cursor',
];

/** Match the exact command, primary target/scope and input contract.
 * Engine rules own their target checks; scripted actions, quests and dialogue bind their own identities.
 */
export function accepts(
  world: World,
  actor: CharacterId,
  a: Offered,
  payload: CommandPayload,
  steps: Steps = { n: 0 },
): boolean {
  if (a.command !== payload.type) return false;
  if (payload.type === 'expedition') {
    if (expeditionDefinition(world).spec.actions[payload.transition] !== a.key) return false;
  }
  if (payload.type === 'accept_quest') return a.quest !== undefined && same(a.quest, payload.quest);
  if (payload.type === 'close_choice') return payload.continuation_id === a.continuation;
  if (payload.type === 'talk' && payload.dialogue && !same(a.dialogue, payload.dialogue))
    return false;
  const bound = boundAction(world, payload, a.key);
  if (bound !== a.key) return false;
  if (a.engine || a.scripted?.target.kind === 'spell') return true;
  const id = primaryTarget(payload);
  if (a.speaker !== undefined && id !== a.speaker) return false;
  const inputs = Object.keys(payload).filter(
    (k) => INPUTS.includes(k) && !(a.command === 'choose' && ['answer', 'patrol'].includes(k)),
  );
  if (inputs.length !== a.input.length || !a.input.every((i) => inputs.includes(i))) return false;
  if (a.target.kind === 'none') return id === undefined;
  const body = bodyOf(world, actor);
  const at = id === undefined ? undefined : world.state.containers[id];
  const kind = id === undefined ? undefined : world.entities[id]?.kind;
  const scope = {
    self: id !== undefined && id === body,
    inspectable_details:
      id !== undefined && world.details[id]?.room === world.state.containers[body!],
    inventory: at !== undefined && inventory(world, body, id!, at, a.command, steps),
    room_contents: kind === 'item' && at === world.state.containers[body!],
    room_occupants: kind === 'npc' && at === world.state.containers[body!],
  };
  return a.target.scopes.some((s) => scope[s]);
}

function boundAction(world: World, payload: CommandPayload, fallback: string) {
  return payload.type === 'use_service'
    ? world.cartridge.services?.[refString(payload.service)]?.action
    : payload.type === 'use_transport'
      ? world.cartridge.transports?.[refString(payload.route)]?.action
      : payload.type === 'harvest' && payload.method
        ? world.details[payload.target_id]?.harvest?.careful?.action
        : payload.type === 'cast'
          ? aimed(world, payload)
          : fallback;
}

/** The learned aimed spells (loka-x6t.109), each offered on its targets and cast by its word. */
export const aimedOffers = (world: World, actor: CharacterId): [string, Offered][] =>
  Object.values(world.cartridge.scripted_actions ?? {}).flatMap((scripted) => {
    const { key, name: label, priority, policy, target: t } = scripted;
    if (t.kind !== 'spell' || !t.aimed || factValue(world, actor, t.learned) !== true) return [];
    const target = { kind: 'entity', scopes: t.aimed.scopes } as const;
    return [
      [key, { key, label, target, input: [], priority, policy, command: 'cast' as Key, scripted }],
    ];
  });

/** A cast at a target binds to the learned aimed spell of that word, any other to the engine verb (loka-x6t.109). */
function aimed(world: World, payload: Extract<CommandPayload, { type: 'cast' }>) {
  const spell = payload.target_id && spellOf(world, payload.actor_id, payload.word);
  return spell && spell.target.kind === 'spell' && spell.target.aimed ? spell.key : 'cast';
}

function inventory(
  world: World,
  body: EntityId | undefined,
  id: EntityId,
  at: EntityId,
  command: string,
  steps: Steps,
) {
  if (at === body) return true;
  if (command === 'remove') return wornIn(world, at, body);
  if (command !== 'read' || !body) return false;
  const reached = reach(world, body, id, steps, true);
  if (typeof reached === 'string') throw new KernelError(reached);
  return reached;
}

export function primaryTarget(payload: CommandPayload): EntityId | undefined {
  if (payload.type === 'expedition') return payload.detail_id;
  if (payload.type === 'use_service') return payload.provider_id;
  if (payload.type === 'use_transport') return payload.endpoint_id;
  if (payload.type === 'fill' || payload.type === 'pour') return payload.source_id;
  if (payload.type === 'drink') return payload.vessel_id;
  const p = payload as { target_id?: EntityId; item_id?: EntityId };
  return p.target_id ?? p.item_id;
}

/** Whether a target the payload names is unseen by its actor (commands/actions.ts refusal: not_present). */
export function hiddenTarget(world: World, payload: CommandPayload, steps: Steps) {
  if (payload.type === 'where') return false;
  const p = payload as { actor_id: CharacterId } & Partial<
    Record<
      'target_id' | 'item_id' | 'recipient_id' | 'container_id' | 'provider_id' | 'crow_id',
      EntityId
    >
  >;
  const ids = [p.target_id, p.item_id, p.recipient_id, p.container_id, p.provider_id, p.crow_id];
  if (payload.type === 'fill') ids.push(payload.source_id, payload.vessel_id);
  if (payload.type === 'pour') ids.push(payload.source_id, payload.receiver_id);
  if (payload.type === 'drink') ids.push(payload.vessel_id);
  return ids.some((id) => id && !visible(world, p.actor_id, id, steps));
}
