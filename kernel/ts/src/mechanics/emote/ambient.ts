// Ambient emotes (emote@1; docs/system/mechanics.md#ambient-emotes): over an advance from → to, the
// reader's room and each visible item and living NPC directly in it tell at most one line from their
// active set (the first whose `when` holds, read with the entity as target; a room has none). The set
// is due when the clock crosses a multiple of `every`; SHA-256 of "<ref>:<set index>:<boundary>"
// rolls the chance (bytes 4-7) and picks the line (bytes 0-3), never the authority RNG, so reload and
// replay tell the same line. Skipped boundaries of a long advance stay silent. Writes nothing.
// ponytail: authored entities only (world.entityIds); a spawned population member has no ambient.
import type {
  AmbientSet,
  CharacterId,
  EntityId,
  NpcAmbientSet,
  Text,
} from '../../contracts.gen.ts';
import { sha256, utf8 } from '../../foundation/sha256.ts';
import { bodyOf, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { visible } from '../light/shared.ts';
import { engineLine } from '../line.ts';
import { holds } from '../policy.ts';

type Set = AmbientSet | NpcAmbientSet;

export function ambient(
  w: World,
  actor: CharacterId,
  from: number,
  to: number,
  steps: Steps,
): Text[] {
  const body = bodyOf(w, actor);
  const here = body && w.state.containers[body];
  if (!here || to <= from) return [];
  const line = (ref: string, sets: readonly Set[] | undefined, target?: EntityId): Text[] => {
    const i = sets?.findIndex((s) => holds(w, actor, s.when, { target, steps })) ?? -1;
    const set = sets?.[i];
    const n = set && Math.floor(to / set.every);
    if (!set || n! <= Math.floor(from / set.every)) return [];
    const h = sha256(utf8(`${ref}:${i}:${n}`));
    const u32 = (k: number) =>
      ((h[k]! << 24) | (h[k + 1]! << 16) | (h[k + 2]! << 8) | h[k + 3]!) >>> 0;
    if (u32(4) % 100 >= (set.chance ?? 100)) return [];
    if (set.lines) return [{ key: set.lines[u32(0) % set.lines.length]! }];
    const emotes = (set as NpcAmbientSet).emotes!;
    return [
      engineLine(
        'emote.performed',
        { actor: target! },
        { emote: emotes[u32(0) % emotes.length]!.key },
      ),
    ];
  };
  const room = Object.entries(w.roomIds).find(([, id]) => id === here);
  const out = room ? line(room[0], w.rooms[here]?.ambient) : [];
  for (const [ref, id] of Object.entries(w.entityIds)) {
    const e = w.entities[id];
    if (!e?.ambient || w.state.containers[id] !== here) continue;
    if ((e.kind === 'npc' && !living(w, id)) || !visible(w, actor, id, steps)) continue;
    out.push(...line(ref, e.ambient, id as EntityId));
  }
  return out;
}
