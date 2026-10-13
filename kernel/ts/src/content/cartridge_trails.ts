// The loader's trail checks (toolbox row W13; cartridge.md Trail declarations), twin of
// lib/loka/content/trails.ex: the compiler-added trail facts, world.trails' leads, a plan's
// `trail` and `hunts`, a track check's plan, and the 1.85 floor.
import type { Diagnostic } from '../contracts.gen.ts';
import { apiCmp } from './cartridge_installed.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

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
    out.trail_exit = exitSpec('trail_exit', 'the player', 'player');
    out.trail_at = atSpec('trail_at', 'the player', 'player');
  }
  return out;
}

/** The trail declarations' diagnostics (cartridge.md Trail declarations). */
export function trails(c: Obj, { text }: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const t = c.world?.trails;
  const unresolved = (at: string, target: string) =>
    out.push(diag('UNRESOLVED_REFERENCE', at, { target }));
  if (t) {
    text(t.leads, Object.keys(t.leads), '.cartridge.world.trails.leads');
    const used = new Set(
      Object.values((c.rooms ?? {}) as Obj).flatMap((r) => Object.keys(r.exits)),
    );
    for (const d of EXITS)
      if (used.has(d) && !t.leads[d]) unresolved('.cartridge.world.trails.leads', d);
  }
  for (const [ref, p] of plans(c)) {
    const at = `.cartridge.populations${step(ref)}`;
    for (const field of ['trail', 'hunts'])
      if (p[field] && !t) unresolved(`${at}.${field}`, 'trails');
    if (p.trail && p.key.length > 53)
      out.push(diag('SCHEMA_VIOLATION', `${at}.key`, { error: 'invalid_value' }));
  }
  const tracks = Object.entries((c.recipes ?? {}) as Obj).filter(
    ([, r]) => r.check?.kind === 'track',
  );
  for (const [ref, r] of tracks)
    if (!plans(c).some(([, p]) => p.key === r.check.plan && p.trail))
      unresolved(`.cartridge.recipes${step(ref)}.check.plan`, r.check.plan);
  const used = t || tracks.length || plans(c).some(([, p]) => p.trail || p.hunts);
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.85') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}

/** Each trail writer emits fact_changed (the lock stage, content/cartridge.ts). */
export const trailUses = (c: Obj) =>
  plans(c).flatMap(([ref, p]) =>
    ['trail', 'hunts']
      .filter((f) => p[f])
      .map((f) => ['event', 'fact_changed', `.cartridge.populations${step(ref)}.${f}`]),
  ) as ['event', string, string][];
