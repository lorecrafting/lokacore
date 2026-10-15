// Toolbox row FD2 at the cartridge trust boundary: a room's or detail's asides and the
// skill_compare leaf need kernel_api 1.91, and each aside's text has a catalog entry. Twin of
// lib/loka/content/voices.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { asideParts, diag, nodes, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function voices(c: Obj): Diagnostic[] {
  const parts = asideParts(c);
  const out = parts.flatMap(([a, at]) =>
    c.text && !Object.hasOwn(c.text, a.text)
      ? [diag('UNRESOLVED_REFERENCE', `${at}.text`, { target: a.text })]
      : [],
  );
  const used = parts.length > 0 || nodes(c).some(([n]) => n.op === 'skill_compare');
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.91') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
