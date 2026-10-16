// Built rooms S1 at the cartridge trust boundary (twin of lib/loka/content/construction.ex): a
// room's site names no direction the room has an exit in (SITE_EXIT_CONFLICT) and only blueprints
// of this cartridge; a site or world.construction needs construction@1; a blueprint, a site or
// world.construction, or (S4) a status_active leaf with subject room, needs kernel_api 1.99, (S5) a
// raze service 1.102. Blueprint
// text, tags, variants and the enter lock are checked with every other part (cartridge_refs.ts).
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, nodes, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function construction(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const sites = Object.entries((c.rooms ?? {}) as Obj).filter(([, r]) => r.site);
  // A site or world.construction needs construction@1 (a blueprint is owned through the registry).
  const gate = (at: string) => {
    if (c.lock.capabilities.construction !== 1)
      out.push(
        diag('UNDECLARED_CAPABILITY', at, { capability: 'construction' }, ['construction@1']),
      );
  };
  if (c.world?.construction) gate('.cartridge.world.construction');
  for (const [ref, r] of sites) {
    const at = `.cartridge.rooms${step(ref)}.site`;
    gate(at);
    r.site.directions.forEach((d: string, i: number) => {
      if (r.exits?.[d]) out.push(diag('SITE_EXIT_CONFLICT', `${at}.directions[${i}]`));
    });
    r.site.blueprints.forEach((b: Obj, i: number) => {
      const target = refString(b as DefinitionRef);
      if (!Object.hasOwn(c.blueprints ?? {}, target))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.blueprints[${i}]`, { target }));
    });
  }
  out.push(...statusRefs(c));
  const used =
    sites.length > 0 ||
    Object.keys(c.blueprints ?? {}).length > 0 ||
    !!c.world?.construction ||
    nodes(c).some(([p]) => p.op === 'status_active' && p.subject === 'room');
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.99') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  const razes = Object.values((c.services ?? {}) as Obj).some((s) => s.benefit?.kind === 'raze');
  if (razes && apiCmp(c.manifest.requires.kernel_api.at_least, '1.102') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return [...out, ...builds(c)];
}

// Built rooms S4: a blueprint's weathering and ruin name statuses of this cartridge.
function statusRefs(c: Obj): Diagnostic[] {
  return Object.entries((c.blueprints ?? {}) as Obj).flatMap(([ref, b]) =>
    ['weathering', 'ruin']
      .filter((f) => b[f] && !Object.hasOwn(c.statuses ?? {}, refString(b[f])))
      .map((f) =>
        diag('UNRESOLVED_REFERENCE', `.cartridge.blueprints${step(ref)}.${f}`, {
          target: refString(b[f]),
        }),
      ),
  );
}

/** Built rooms S6 (construction's tail): a recipe's build step sits in the success outcome of a
 * detail target whose room is a site listing its blueprint and direction, at most one per
 * sequence, with world.construction, the build refusal texts and kernel_api 1.102
 * (docs/system/cartridge.md Recipe build steps). The listed blueprint resolves and owns
 * construction@1 already (construction above). */
function builds(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bad = (at: string) => out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj))
    for (const [name, o] of Object.entries(r.outcomes as Obj)) {
      let seen = false;
      o.sequence.forEach((s: Obj, i: number) => {
        if (s.op !== 'build') return;
        const at = `.cartridge.recipes${step(ref)}.outcomes.${name}.sequence[${i}]`;
        const site = r.target.kind === 'detail' && c.rooms?.[refString(r.target.room)]?.site;
        if (seen || name !== 'success' || !site || !c.world?.construction) bad(`${at}.op`);
        seen = true;
        if (apiCmp(c.manifest.requires.kernel_api.at_least, '1.102') < 0)
          out.push(
            diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
          );
        for (const k of ['service.site_taken', 'service.construction_full'])
          if (!Object.hasOwn(c.text ?? {}, k))
            out.push(diag('UNRESOLVED_REFERENCE', `${at}.op`, { target: k }));
        if (!site) return;
        if (!site.blueprints.some((b: DefinitionRef) => refString(b) === refString(s.blueprint)))
          bad(`${at}.blueprint`);
        if (!site.directions.includes(s.direction)) bad(`${at}.direction`);
      });
    }
  return out;
}
