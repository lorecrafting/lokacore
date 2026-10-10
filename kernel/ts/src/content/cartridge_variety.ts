// variety@1 at the cartridge trust boundary (toolbox row W7): alternates is owned by variety@1,
// every key of alternates and every alternate is a text catalog key, and alternates or a
// visited_count leaf need kernel_api 1.45.
// ponytail: a repeated alternate is not refused (no uniqueItems in either validator); it only
// weights that line. Add a check if a cartridge ever needs strictly equal odds enforced.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function variety(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (c.alternates && !c.lock.capabilities.variety)
    out.push(
      diag('UNDECLARED_CAPABILITY', '.cartridge.alternates', { capability: 'variety' }, [
        'variety@1',
      ]),
    );
  const known = (key: string, path: string) => {
    if (!Object.hasOwn(c.text ?? {}, key))
      out.push(diag('UNRESOLVED_REFERENCE', path, { target: key }));
  };
  for (const [key, more] of Object.entries((c.alternates ?? {}) as Obj)) {
    const at = `.cartridge.alternates${step(key)}`;
    known(key, at);
    (more as string[]).forEach((k, i) => known(k, `${at}[${i}]`));
  }
  const used = c.alternates || nodes(c).some(([p]) => p.op === 'visited_count');
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.45') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
