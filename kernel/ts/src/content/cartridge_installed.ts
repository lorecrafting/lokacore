// Host compatibility is checked after artifact semantics and references.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

/** What the installed kernel and app implement (05 §3, §6); the host supplies it. */
export interface Installed {
  kernel_api: string;
  capabilities: Readonly<Record<string, readonly number[]>>;
  content_schema: number;
  rule_ir: number;
  client_features: readonly string[];
}

// MAJOR.MINOR as digit strings without leading zeros: longer is larger, then lexical.
export function apiCmp(a: string, b: string): number {
  const [x, y] = [a.split('.'), b.split('.')];
  for (let i = 0; i < 2; i++) {
    const d = x[i].length - y[i].length || (x[i] < y[i] ? -1 : x[i] > y[i] ? 1 : 0);
    if (d) return d;
  }
  return 0;
}

export function installedStage(c: Obj, installed: Installed): Diagnostic[] {
  const req = c.manifest.requires;
  const out: Diagnostic[] = [];
  for (const [key, v] of Object.entries(c.lock.capabilities as Record<string, number>))
    if (!(Object.hasOwn(installed.capabilities, key) && installed.capabilities[key].includes(v)))
      out.push(
        diag('CAPABILITY_NOT_INSTALLED', `.cartridge.lock.capabilities${step(key)}`, {
          capability: `${key}@${v}`,
        }),
      );
  // One private world: a fact is read at its one scope, player or instance (mechanics/fact.ts).
  for (const [ref, f] of Object.entries(c.facts as Obj))
    if (new Set(f.scopes).size !== 1 || !['player', 'instance'].includes(f.scopes[0]))
      out.push(diag('FACT_SCOPE_UNSUPPORTED', `.cartridge.facts${step(ref)}.scopes`));
  const api = installed.kernel_api;
  if (apiCmp(api, req.kernel_api.at_least) < 0 || apiCmp(api, req.kernel_api.below) >= 0)
    out.push(
      diag('KERNEL_API_UNSUPPORTED', '.cartridge.manifest.requires.kernel_api', { installed: api }),
    );
  for (const field of ['content_schema', 'rule_ir'] as const)
    if (req[field] !== installed[field])
      out.push(
        diag('PINNED_VERSION_UNSUPPORTED', `.cartridge.manifest.requires.${field}`, {
          field,
          declared: req[field],
          supported: installed[field],
        }),
      );
  (req.client_features as string[]).forEach((feature, i) => {
    if (!installed.client_features.includes(feature))
      out.push(
        diag('CLIENT_FEATURE_UNSUPPORTED', `.cartridge.manifest.requires.client_features[${i}]`, {
          feature,
        }),
      );
  });
  return out;
}
