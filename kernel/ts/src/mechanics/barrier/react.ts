// Toolbox row W22 (Beads loka-kgd.96; docs/system/mechanics.md reaction@1): a reaction's
// barrier.set moves its named barrier, or each barrier tagged `tag` on an exit of the event's
// rooms (direction-key order, each once), to `to` from any state, with no key, opens_when or reach
// check. Each legal step on the way (BarrierState: open, closed, locked) is one barrier.transition
// and one barrier_changed, in the writer group an earlier write of this advance gave the row.
import type {
  BarrierState,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EventPayload,
  ReactionRule,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { cmp } from '../../foundation/validate.ts';
import { refString, type World } from '../../runtime/decision.ts';
import { barrierState, eventRooms } from '../lookups.ts';

const LINE: readonly BarrierState[] = ['open', 'closed', 'locked'];

export function setBarrier(
  world: World,
  step: Extract<ReactionRule['apply'][number], { op: 'barrier.set' }>,
  cause: DomainEvent,
  subject: string | undefined,
  group: number,
  { holders, doors }: { holders: Map<string, number>; doors: Map<string, BarrierState> },
  emit: (payload: EventPayload) => void,
): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const rooms = step.barrier ? [] : eventRooms(world, cause, subject);
  for (const barrier of step.barrier ? [step.barrier] : tagged(world, rooms, step.tag!)) {
    const row = key({ kind: 'barrier', barrier });
    const writer_group = holders.get(row) ?? group;
    let at = LINE.indexOf(doors.get(row) ?? barrierState(world, barrier));
    const end = LINE.indexOf(step.to);
    const way = Math.sign(end - at);
    if (way) holders.set(row, writer_group);
    for (; at !== end; at += way) {
      const [from, to] = [LINE[at]!, LINE[at + way]!];
      ops.push({ op: 'barrier.transition', writer_group, barrier, from, to });
      emit({ type: 'barrier_changed', barrier, from, to });
    }
    doors.set(row, step.to);
  }
  return ops;
}

// The barriers on the rooms' exits whose definitions carry the tag, each once.
function tagged(world: World, rooms: readonly string[], tag: string) {
  const found = new Map<string, DefinitionRef>();
  for (const room of rooms)
    for (const [, exit] of Object.entries(world.rooms[room]!.exits).sort(([a], [b]) => cmp(a, b))) {
      const b = (exit as { barrier?: DefinitionRef }).barrier;
      if (b && world.cartridge.barriers?.[refString(b)]?.tags?.includes(tag as never))
        found.set(refString(b), b);
    }
  return [...found.values()];
}
