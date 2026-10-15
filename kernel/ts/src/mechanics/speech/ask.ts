// Toolbox row FD7 (speech@1 with topics@1; mechanics.md "Ask about a topic"): ask an NPC in the
// actor's room about a topic the actor knows; its first answer that holds, else its unknown line.
import type {
  CharacterId,
  Command,
  CommandPayload,
  DefinitionRef,
  EntityId,
  ErrorCode,
  NpcDefinition,
} from '../../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  event,
  refString,
  rejected,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { npcsIn } from '../death/shared.ts';
import { disposition } from '../disposition.ts';
import { value } from '../fact.ts';
import { grant } from '../topics/shared.ts';
import { answerTo } from './shared.ts';

/** Why `actor` may not ask `target` now, whatever the topic (the GameView's check too). */
export function askRefused(
  world: World,
  actor: CharacterId,
  target: EntityId,
  steps: Steps,
): ErrorCode | undefined {
  const body = bodyOf(world, actor);
  const room = body && world.state.containers[body];
  if (!room) return 'invalid_state'; // a pending conversation drops speech verbs first (actions.ts)
  if (world.knownEntities[target]?.kind !== 'npc') return 'not_found';
  if (!npcsIn(world, [room]).includes(target)) return 'not_present';
  if (!(world.entities[target] as NpcDefinition | undefined)?.ask) return 'invalid_target';
  if (disposition(world, actor, target, steps) === 'hostile') return 'invalid_state';
}

const known = (world: World, actor: CharacterId, topic: DefinitionRef) => {
  const d = world.cartridge.topics?.[refString(topic)];
  return !!d && value(world, actor, d.fact) === true;
};

export function ask(
  world: World,
  command: Omit<Command, 'payload'> & {
    readonly payload: Extract<CommandPayload, { type: 'ask' }>;
  },
  mint: Mint,
  steps: Steps,
) {
  const { actor_id, target_id, topic } = command.payload;
  const code =
    askRefused(world, actor_id, target_id, steps) ??
    (known(world, actor_id, topic) ? undefined : 'invalid_state');
  if (code) return rejected(code);
  const answer = answerTo(world, actor_id, target_id, topic, steps);
  const run = { ops: [], facts: {}, position: 1 }; // the asked event holds position 1
  const ops = answer?.grants ? grant(world, actor_id, run, answer.grants).ops : [];
  const asked = { type: 'asked', entity_id: target_id, topic, answered: !!answer } as const;
  const text = answer?.text ?? (world.entities[target_id] as NpcDefinition).ask!.unknown;
  return accepted(world, 'asked', ops, [event(world, command, mint, 1, asked)], [{ key: text }]);
}
