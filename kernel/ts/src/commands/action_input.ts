// Exact command, primary target, scope and captured input binding.
import type { CharacterId, CommandPayload, EntityId } from '../contracts.gen.ts';
import { same } from '../foundation/compose.ts';
import { bodyOf, refString, type World } from '../runtime/decision.ts';
import { wornIn } from '../mechanics/equipment/rule.ts';
import type { Offered } from './actions.ts';

// Payload fields that are ActionInput parameters (action.schema.json ActionInput).
const INPUTS: readonly string[] = [
  'direction',
  'choice_id',
  'continuation_id',
  'until',
  'answer',
  'scene',
  'line',
  'quoted_price',
  'service',
  'patrol',
];

/** Match the exact command, primary target/scope and input contract.
 * Engine rules own their target checks; recipes, quests and dialogue bind their own identities.
 */
export function accepts(
  world: World,
  actor: CharacterId,
  a: Offered,
  payload: CommandPayload,
): boolean {
  if (a.command !== payload.type) return false;
  if (payload.type === 'accept_quest') return a.quest !== undefined && same(a.quest, payload.quest);
  if (payload.type === 'close_choice') return payload.continuation_id === a.continuation;
  if (payload.type === 'talk' && payload.dialogue && !same(a.dialogue, payload.dialogue))
    return false;
  if (
    payload.type === 'use_service' &&
    world.cartridge.services?.[refString(payload.service)]?.action !== a.key
  )
    return false;
  if (a.engine) return true;
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
    inventory:
      at !== undefined && (at === body || (a.command === 'remove' && wornIn(world, at, body))),
    room_contents: kind === 'item' && at === world.state.containers[body!],
    room_occupants: kind === 'npc' && at === world.state.containers[body!],
  };
  return a.target.scopes.some((s) => scope[s]);
}

export function primaryTarget(payload: CommandPayload): EntityId | undefined {
  if (payload.type === 'use_service') return payload.provider_id;
  if (payload.type === 'fill' || payload.type === 'pour') return payload.source_id;
  if (payload.type === 'drink') return payload.vessel_id;
  const p = payload as { target_id?: EntityId; item_id?: EntityId };
  return p.target_id ?? p.item_id;
}
