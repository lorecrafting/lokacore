// Toolbox row W25 at the cartridge trust boundary: a wearing leaf or a clock_hour reaction needs
// kernel_api 1.46. Twin of lib/loka/content/exposure.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function exposure(c: Obj): Diagnostic[] {
  const used =
    nodes(c).some(([p]) => p.op === 'wearing') ||
    Object.values((c.reactions ?? {}) as Obj).some((r) => r.on.event === 'clock_hour');
  return used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.46') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}
