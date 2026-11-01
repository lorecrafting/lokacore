import type { DialogueDefinition } from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';

// What a choice can refuse or charge at the moment it is taken; a fall-through takes no choice, so it passes none of these.
const GATES = [
  'accept',
  'availability',
  'check',
  'escort',
  'exchange',
  'hand_over',
  'lesson_payment',
  'patrol',
  'payment',
  'receive',
] as const;

// The steps that take nothing from the player; any other step counts as a cost.
const FREE_STEPS = new Set<string>(['narrate', 'topic.grant', 'fact.assign']);

/**
 * Where a failed Talk can fall through from `d`: each dialogue of its own speaker that a choice with
 * nothing to pass or pay leads to, in key order, with that choice, whose policy `spokenBy` tests.
 */
export const onward = (world: World, d: DialogueDefinition) => {
  const all = Object.values(world.cartridge.dialogues ?? {});
  return Object.values(d.choices).flatMap((choice) => {
    const free =
      !GATES.some((gate) => choice[gate]) &&
      (choice.steps ?? []).every((s) => FREE_STEPS.has(s.op));
    const to = free ? all.find((o) => o.key === choice.then) : undefined;
    return to && refString(to.npc) === refString(d.npc) ? [{ choice, to }] : [];
  });
};
