// Static known-map and physical Knock declarations; no route or location inference.
import { apiCmp } from './cartridge_installed.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function knowledge(c: Obj, check: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { named, text } = check;
  let hasKnock = false;
  for (const [ref, r] of Object.entries(c.rooms as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    for (const [dir, exit] of Object.entries(r.exits as Obj)) {
      if (exit.knock) {
        hasKnock = true;
        named(exit.knock.npc, 'npc', `${at}.exits.${dir}.knock.npc`);
        named(exit.knock.room, 'room', `${at}.exits.${dir}.knock.room`);
        text(exit.knock, ['answered', 'unanswered'], `${at}.exits.${dir}.knock`);
        if (!exit.barrier || refString(exit.knock.room) !== refString(exit.to))
          out.push(diag('BARRIER_MISMATCH', `${at}.exits.${dir}.knock`));
      }
    }
  }
  if (
    (hasKnock || c.lock.capabilities.knowledge === 1) &&
    apiCmp(c.manifest.requires.kernel_api.at_least, '1.37') < 0
  )
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  mapPositions(c, named, out);
  return out;
}

function mapPositions(c: Obj, named: Checks['named'], out: Diagnostic[]) {
  if (!c.map_positions) return;
  const rooms = c.map_positions.map((p: Obj, i: number) => {
    named(p.room, 'room', `.cartridge.map_positions[${i}].room`);
    return refString(p.room);
  });
  const coords = c.map_positions.map((p: Obj) => JSON.stringify([p.x, p.y, p.z]));
  if (
    new Set(coords).size !== coords.length ||
    rooms.length !== Object.keys(c.rooms).length ||
    new Set(rooms).size !== rooms.length
  )
    out.push(diag('SCHEMA_VIOLATION', '.cartridge.map_positions'));
  if (c.lock.capabilities.knowledge !== 1)
    out.push(diag('UNDECLARED_CAPABILITY', '.cartridge.map_positions'));
}
