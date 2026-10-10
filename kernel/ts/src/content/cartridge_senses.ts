// Toolbox row G6 at the cartridge trust boundary: every declared cue as a definition part (its
// owner sense_cue@1, its text key, its `when` condition), and the kernel_api 1.48 floor for a cue
// or a cue_perceived leaf. Twin of lib/loka/content/cues.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

/** Each cue of a room, detail, item (and its fuel source), NPC, status or recipe outcome. */
export function cueParts(c: Obj): [string, Obj, string][] {
  const out: [string, Obj, string][] = [];
  const add = (d: Obj | undefined, at: string) =>
    (d?.cues ?? []).forEach((q: Obj, i: number) => out.push(['cue', q, `${at}.cues[${i}]`]));
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    add(r, `.cartridge.rooms${step(ref)}`);
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj))
      add(d, `.cartridge.rooms${step(ref)}.details${step(key)}`);
  }
  for (const kind of ['npcs', 'items'])
    for (const [ref, e] of Object.entries((c[kind] ?? {}) as Obj)) {
      add(e, `.cartridge.${kind}${step(ref)}`);
      add(e.fuel, `.cartridge.${kind}${step(ref)}.fuel`);
    }
  for (const [ref, s] of Object.entries((c.statuses ?? {}) as Obj))
    add(s, `.cartridge.statuses${step(ref)}`);
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj))
    for (const [name, o] of Object.entries(r.outcomes as Obj))
      add(o, `.cartridge.recipes${step(ref)}.outcomes.${name}`);
  return out;
}

export function senses(c: Obj): Diagnostic[] {
  const used = cueParts(c).length > 0 || nodes(c).some(([p]) => p.op === 'cue_perceived');
  return used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.48') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}
