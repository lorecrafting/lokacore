import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export const skillSpec = (key: string) => ({
  key: `skill_${key}`,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: `Skill ${key}'s acquisition (skills@1): only skills@1 writes it.`,
});

export function skills(c: Obj, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bad = (at: string) => out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  for (const [ref, s] of Object.entries((c.skills ?? {}) as Obj)) {
    const at = `.cartridge.skills${step(ref)}`;
    checks.text(s, ['label', 'requirement'], at);
    if (s.key.length > 58) bad(`${at}.key`);
    for (const capability of ['skills', 'policy', 'fact'])
      if (c.lock.capabilities[capability] !== 1)
        out.push(diag('UNDECLARED_CAPABILITY', at, { capability }, [`${capability}@1`]));
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    const at = `.cartridge.items${step(ref)}`;
    if (i.weapon) {
      checks.named(i.weapon.skill, 'skill', `${at}.weapon.skill`);
      if (i.slot !== 'wield' || i.weapon.attack.damage_min > i.weapon.attack.damage_max)
        bad(`${at}.weapon`);
    }
    if (i.block_chance !== undefined && i.slot !== 'off_hand') bad(`${at}.block_chance`);
  }
  const combat = c.world?.combat;
  if (combat?.dodge) {
    checks.named(combat.dodge.skill, 'skill', '.cartridge.world.combat.dodge.skill');
    if (!combat.narration.dodge) bad('.cartridge.world.combat.narration.dodge');
  }
  if (
    Object.values((c.items ?? {}) as Obj).some((i) => i.block_chance !== undefined) &&
    !combat?.narration.block
  )
    bad('.cartridge.world.combat.narration.block');
  if (Object.keys(c.skills ?? {}).length) {
    const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < 18))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
  }
  return out;
}

export function lesson(o: Obj, d: Obj, at: string, c: Obj, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [i, s] of (o.sequence ?? []).entries())
    if (s.op === 'skill.acquire') checks.named(s.skill, 'skill', `${at}.sequence[${i}].skill`);
  const p = o.lesson_payment;
  if (!p) {
    if ((o.sequence ?? []).some((s: Obj) => s.op === 'skill.acquire'))
      out.push(diag('SCHEMA_VIOLATION', `${at}.lesson_payment`, { error: 'missing_property' }));
    return out;
  }
  checks.named(p.resource, 'resource', `${at}.lesson_payment.resource`);
  const role = d.roles[p.to];
  const teacher = role?.role === 'npc' && c.npcs?.[refString(role.npc)];
  if (
    !teacher ||
    refString(role.npc) !== refString(d.npc) ||
    teacher.resource_starts?.[p.resource.key] === undefined ||
    o.payment ||
    (o.sequence ?? []).filter((s: Obj) => s.op === 'skill.acquire').length !== 1
  )
    out.push(diag('SCHEMA_VIOLATION', `${at}.lesson_payment`, { error: 'invalid_value' }));
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
