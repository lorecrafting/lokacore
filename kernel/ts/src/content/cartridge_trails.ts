// The compiler-added trail FactSpecs (toolbox row W13), read by cartridge_position.ts expectedFacts.
import type { Obj } from './cartridge_refs.ts';

const EXITS = ['none', 'north', 'south', 'east', 'west', 'up', 'down'];

const exitSpec = (name: string, meaning: string, scope: string) => ({
  key: name,
  version: 1,
  value_type: { type: 'enum', values: EXITS, default: 'none' },
  scopes: [scope],
  per_subject: true,
  meaning: `The exit ${meaning} last left the subject room by (row W13): only trails write it.`,
});

const atSpec = (name: string, meaning: string, scope: string) => ({
  key: name,
  version: 1,
  value_type: { type: 'int', default: 0, minimum: 0 },
  scopes: [scope],
  per_subject: true,
  meaning: `When ${meaning} last left the subject room (row W13): only trails write it.`,
});

const plans = (c: Obj): [string, Obj][] => Object.entries((c.populations ?? {}) as Obj);

/** The FactSpecs the compiler adds for trails (trails.ex specs), byte for byte, by key. */
export function trailFacts(c: Obj): Obj {
  const out: Obj = {};
  for (const [, p] of plans(c))
    if (p.trail && p.key.length <= 53) {
      out[`trail_${p.key}_exit`] = exitSpec(`trail_${p.key}_exit`, `plan ${p.key}`, 'instance');
      out[`trail_${p.key}_at`] = atSpec(`trail_${p.key}_at`, `plan ${p.key}`, 'instance');
    }
  if (plans(c).some(([, p]) => p.hunts)) {
    out.trail_exit = exitSpec('trail_exit', 'a character', 'instance');
    out.trail_at = atSpec('trail_at', 'a character', 'instance');
  }
  return out;
}
