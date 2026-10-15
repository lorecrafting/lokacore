// Toolbox row FD3 (mechanics.md Storylet deck): of the storylet recipes holding for an actor here
// (rooms absent or naming the body's room, policy holding), the one the deck draws: SHA-256 of
// "<actor>:<room key>:<hour index>" (first four bytes, big-endian), modulo the holding weights' sum,
// walked in key order. Derived on every read, never stored and never the authority RNG, so the
// view and the perform it invites agree within the hour and replay draws the same card.
import type { ActionRecipe, CharacterId } from '../../contracts.gen.ts';
import { sha256, utf8 } from '../../foundation/sha256.ts';
import { cmp } from '../../foundation/validate.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { units } from '../calendar.ts';
import { holds } from '../policy.ts';

export function pick(world: World, actor: CharacterId, steps: Steps): ActionRecipe | undefined {
  const body = bodyOf(world, actor);
  const room = body && world.state.containers[body];
  if (room === undefined || !world.rooms[room]) return undefined;
  const deck = Object.values(world.cartridge.recipes ?? {})
    .filter(
      (r) =>
        r.target.kind === 'storylet' &&
        (r.target.rooms?.some((ref) => world.roomIds[refString(ref)] === room) ?? true) &&
        holds(world, actor, r.policy.root, { steps }),
    )
    .sort((a, b) => cmp(a.key, b.key));
  const weight = (r: ActionRecipe) => (r.target.kind === 'storylet' && r.target.weight) || 1;
  const total = deck.reduce((n, r) => n + weight(r), 0);
  if (!total) return undefined;
  const hour = Math.floor(world.state.clock / units(world.cartridge).hour);
  const h = sha256(utf8(`${actor}:${world.rooms[room].key}:${hour}`));
  let r = (((h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!) >>> 0) % total;
  return deck.find((s) => (r -= weight(s)) < 0);
}
