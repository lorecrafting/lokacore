// Toolbox row 43b at the cartridge trust boundary (twin of lib/loka/content/mounts.ex):
// world.mount needs kernel_api 1.108 and names a bool pair fact (per_subject, scopes ["player"]);
// an NPC's mount needs world.mount and an authored NPC, never a spawn template.
import type { Diagnostic } from '../contracts.gen.ts';
import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

export function mounts(c: Obj, named: Checks['named']): Diagnostic[] {
  const riding = c.world?.mount?.riding;
  const bad = (at: string) => diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' });
  const out = Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    n.mount && (!riding || n.spawn_template) ? [bad(`.cartridge.npcs${step(ref)}.mount`)] : [],
  );
  if (!riding) return out;
  const at = '.cartridge.world.mount.riding';
  if (apiCmp(c.manifest.requires.kernel_api.at_least, '1.108') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  named(riding, 'fact', at);
  const f = c.facts?.[refString(riding)];
  if (f && !(f.value_type.type === 'bool' && f.per_subject && same(f.scopes, ['player'])))
    out.push(bad(at));
  return out;
}
