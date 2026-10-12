// Hireling wages (toolbox row 22b; docs/system/mechanics.md Hireling wages): one world job pays
// every living group member its wage from the player's purse, on a fixed grid; an unpaid member
// leaves the group (member false). Nothing is minted: the wage resource is conserved.
import type { DeltaOp, EntityId, JobId } from '../../contracts.gen.ts';
import { type Cartridge, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';
import { adjust, level, resourceSpec, type Levels } from '../resource.ts';
import { assigned } from '../fact.ts';
import { living } from '../death/shared.ts';
import { member } from './shared.ts';
import { regrid } from '../containment/job.ts';

/** A fresh world's wage job, first due at clock + every, when world.group declares a wage. */
export function firstWage(cartridge: Cartridge, clock: number, mint: Mint) {
  const wage = cartridge.world?.group?.wage;
  if (!wage) return {};
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  const job = { cartridge_id, cartridge_version, kind: 'wage', key: 'group' };
  return { [mint()]: { job, due_time: clock + wage.every, status: 'pending' } as JobRow };
}

// The living NPCs whose member fact is true for the character, in EntityId order.
const members = (world: World) =>
  (Object.keys(world.entities).sort(cmp) as EntityId[]).filter(
    (id) =>
      world.entities[id]!.kind === 'npc' && member(world, world.character, id) && living(world, id),
  );

/**
 * One run at `at`: pay the longest EntityId-order prefix of living members the purse covers (one
 * threaded adjust per side), set member false for every other living member, complete the job
 * and schedule the next at `at + every` (regrid).
 */
export function runWage(world: World, job_id: JobId, row: JobRow, mint: Mint, at: number) {
  const group = world.cartridge.world!.group!;
  const { resource, amount, every } = group.wage!;
  const purse = world.body;
  let levels: Levels = {};
  let run = { ops: [] as readonly DeltaOp[], position: 0, facts: {} };
  let balance = level(world, purse, resource);
  for (const npc of members(world)) {
    const to = level(world, npc, resource);
    if (
      balance !== undefined &&
      to !== undefined &&
      balance - amount >= resourceSpec(world, purse, resource).minimum &&
      to + amount <= resourceSpec(world, npc, resource).maximum
    ) {
      balance -= amount;
      const out = adjust(world, purse, resource, -amount, levels);
      const into = adjust(world, npc, resource, amount, out.levels);
      levels = into.levels;
      run = { ...run, ops: [...run.ops, out.op, into.op] };
    } else {
      balance = undefined; // the paid members are a prefix
      run = assigned(world, world.character, run, {
        fact: group.member,
        value: false,
        subject: npc,
      });
    }
  }
  return regrid(world, job_id, row, mint, at + every, [...run.ops]);
}
