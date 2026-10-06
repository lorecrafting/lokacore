import { diag, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { same } from '../foundation/compose.ts';
import type { Diagnostic } from '../contracts.gen.ts';

const REQUIRED = [
  'water',
  'skills',
  'resource',
  'schedule',
  'death',
  'containment',
  'movement',
  'position',
];

export function water(c: Obj, { named, text }: Checks): Diagnostic[] {
  const w = c.world?.water;
  if (!w) return [];
  const out: Diagnostic[] = [],
    at = '.cartridge.world.water';
  const bad = (path: string) =>
    out.push(diag('SCHEMA_VIOLATION', path, { error: 'invalid_value' }));
  for (const cap of REQUIRED)
    if (c.lock.capabilities[cap] !== 1)
      out.push(diag('UNDECLARED_CAPABILITY', at, { capability: cap }, [`${cap}@1`]));
  if (!c.world.death || !c.world.carry) bad(at);
  if (c.manifest.time_policy?.profile !== 'real_elapsed') bad('.cartridge.manifest.time_policy');
  named(w.skill, 'skill', `${at}.skill`);
  text(w, ['warning', 'drowned'], at);
  const seen = new Set<string>();
  for (const [i, r] of w.routes.entries()) {
    const path = `${at}.routes[${i}]`;
    named(r.surface, 'room', `${path}.surface`);
    named(r.bottom, 'room', `${path}.bottom`);
    const surface = c.rooms[refString(r.surface)],
      bottom = c.rooms[refString(r.bottom)];
    if (same(r.surface, r.bottom) || [r.bottom, r.surface].some((s) => seen.has(refString(s))))
      bad(path);
    seen.add(refString(r.surface));
    seen.add(refString(r.bottom));
    if (surface && (!same(surface.exits.down?.to, r.bottom) || surface.exits.down?.barrier))
      bad(`${path}.surface`);
    if (
      bottom &&
      (Object.keys(bottom.exits).length !== 1 ||
        !same(bottom.exits.up?.to, r.surface) ||
        bottom.exits.up?.barrier)
    )
      bad(`${path}.bottom`);
  }
  return out;
}
