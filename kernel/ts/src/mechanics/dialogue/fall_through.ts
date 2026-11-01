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
 * nothing to pass or pay leads to, `entry: false` aside, in key order, with that choice, whose policy `spokenBy` tests.
 */
export const onward = (world: World, d: DialogueDefinition) => {
  const all = Object.values(world.cartridge.dialogues ?? {});
  return Object.values(d.choices).flatMap((choice) => {
    const free =
      !GATES.some((gate) => choice[gate]) &&
      (choice.steps ?? []).every((s) => FREE_STEPS.has(s.op));
    const to = free ? all.find((o) => o.key === choice.then) : undefined;
    return to && to.entry !== false && refString(to.npc) === refString(d.npc)
      ? [{ choice, to }]
      : [];
  });
};

// A speaker with several dialogues has one Talk: the first that opens, else the first with its refusal.
export const oneTalk = <A extends { action_key: string; available: boolean }>(
  set: Record<string, { command: string; speaker?: unknown; dialogue?: unknown }>,
  rows: A[],
) => {
  const spoken = (r: A) => {
    const a = set[r.action_key];
    return a?.command === 'talk' && a.speaker !== undefined && !a.dialogue;
  };
  const talks = rows.filter(spoken);
  const kept = talks.find((r) => r.available) ?? talks[0];
  return rows.filter((r) => !spoken(r) || r === kept);
};
