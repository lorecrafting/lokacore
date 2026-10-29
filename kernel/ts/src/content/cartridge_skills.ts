// Skill fact specs (skills@1) and the dialogue lesson and sequence checks cartridge_dialogues.ts uses.
import { diag, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export const skillSpec = (key: string) => ({
  key: `skill_${key}`,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: `Skill ${key}'s acquisition (skills@1): only skills@1 writes it.`,
});

/** Toolbox row 5: the reserved use count of a skill with growth (mechanics.md skill growth). */
export const usesSpec = (key: string, growth: number[]) => ({
  key: `uses_${key}`,
  version: 1,
  value_type: { type: 'int', default: 0, minimum: 0, maximum: growth.at(-1) },
  scopes: ['player'],
  meaning: `Skill ${key}'s use count (skills@1): only skills@1 writes it.`,
});

export function lesson(o: Obj, d: Obj, at: string, c: Obj, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [i, s] of (o.sequence ?? []).entries())
    if (s.op === 'skill.acquire') checks.named(s.skill, 'skill', `${at}.sequence[${i}].skill`);
  const p = o.lesson_payment;
  if (!p) {
    const grants = (o.sequence ?? []).filter((s: Obj) => s.op === 'skill.acquire');
    if (grants.length && (grants.length !== 1 || o.payment))
      out.push(diag('SCHEMA_VIOLATION', `${at}.lesson_payment`, { error: 'invalid_value' }));
    return out;
  }
  checks.named(p.resource, 'resource', `${at}.lesson_payment.resource`);
  const grants = (o.sequence ?? []).filter((s: Obj) => s.op === 'skill.acquire').length;
  const role = d.roles[p.to];
  const teacher = role?.role === 'npc' && c.npcs?.[refString(role.npc)];
  if (
    !teacher ||
    refString(role.npc) !== refString(d.npc) ||
    teacher.resource_starts?.[p.resource.key] === undefined ||
    o.payment ||
    grants > 1
  )
    out.push(diag('SCHEMA_VIOLATION', `${at}.lesson_payment`, { error: 'invalid_value' }));
  // Row 22b: a fee without a skill (a hire fee) needs kernel_api 1.75.
  if (!grants && apiCmp(c.manifest.requires.kernel_api.at_least, '1.75') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}

export function sequence(o: Obj, path: string, c: Obj, { named, typedValue, text }: Checks) {
  const out: Diagnostic[] = [];
  (o.sequence ?? []).forEach((s: Obj, i: number) => {
    if (s.op === 'topic.grant') {
      named(s.topic, 'topic', `${path}.sequence[${i}].topic`);
      return;
    }
    if (s.op === 'skill.acquire') {
      named(s.skill, 'skill', `${path}.sequence[${i}].skill`);
      return;
    }
    named(s.fact, 'fact', `${path}.sequence[${i}].fact`);
    if (s.op === 'fact.adjust') {
      const t = c.facts[refString(s.fact)]?.value_type;
      if (t && (t.type !== 'int' || t.minimum === undefined || t.maximum === undefined))
        out.push(diag('FACT_TYPE_MISMATCH', `${path}.sequence[${i}].fact`));
    } else typedValue(s.fact, s.value, `${path}.sequence[${i}].value`);
  });
  return out;
}
