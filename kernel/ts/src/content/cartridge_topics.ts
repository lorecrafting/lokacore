import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';

export function topics(c: Obj, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [],
    facts = new Set<string>();
  const checkFact = (fact: DefinitionRef, at: string) => {
    checks.named(fact, 'fact', at);
    const spec = c.facts[refString(fact)];
    if (
      spec &&
      (spec.value_type.type !== 'bool' ||
        spec.value_type.default !== false ||
        JSON.stringify(spec.scopes) !== '["player"]')
    )
      out.push(diag('FACT_TYPE_MISMATCH', at));
  };
  for (const [ref, d] of Object.entries((c.topics ?? {}) as Obj)) {
    const at = `.cartridge.topics${step(ref)}`;
    checks.text(d, ['label'], at);
    checkFact(d.fact, `${at}.fact`);
    const key = refString(d.fact);
    if (facts.has(key)) out.push(diag('DUPLICATE_DEFINITION', `${at}.fact`));
    facts.add(key);
  }
  for (const [ref, d] of Object.entries((c.dialogues ?? {}) as Obj))
    for (const [id, o] of Object.entries(d.choices as Obj))
      for (const [i, s] of (o.sequence ?? []).entries())
        if (s.op === 'topic.grant')
          checks.named(
            s.topic,
            'topic',
            `.cartridge.dialogues${step(ref)}.choices${step(id)}.sequence[${i}].topic`,
          );
  metadata(c, checks, checkFact, out);
  return out;
}

function metadata(
  c: Obj,
  checks: Checks,
  checkFact: (fact: DefinitionRef, at: string) => void,
  out: Diagnostic[],
) {
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj))
    if (n.perception)
      checkFact(n.perception.discovered, `.cartridge.npcs${step(ref)}.perception.discovered`);
  for (const [ref, room] of Object.entries(c.rooms as Obj))
    for (const [key, detail] of Object.entries((room.details ?? {}) as Obj))
      if (detail.perception)
        checks.text(
          detail.perception,
          ['title'],
          `.cartridge.rooms${step(ref)}.details${step(key)}.perception`,
        );
  for (const [ref, item] of Object.entries((c.items ?? {}) as Obj)) {
    if (!item.readable) continue;
    const at = `.cartridge.items${step(ref)}.readable`;
    if (item.readable.topic) checks.named(item.readable.topic, 'topic', `${at}.topic`);
    if (Number(c.manifest.requires.kernel_api.at_least.split('.')[1]) < 24)
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
  }
  if (usesB6(c) && Number(c.manifest.requires.kernel_api.at_least.split('.')[1]) < 21)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
}

function usesB6(c: Obj) {
  return (
    Object.keys(c.topics ?? {}).length > 0 ||
    Object.values((c.npcs ?? {}) as Obj).some((n) => n.perception) ||
    Object.values((c.rooms ?? {}) as Obj).some((r) =>
      Object.values((r.details ?? {}) as Obj).some((d) => d.perception),
    ) ||
    Object.values((c.dialogues ?? {}) as Obj).some((d) => d.riddle?.wrong_limit !== undefined) ||
    Object.values((c.recipes ?? {}) as Obj).some((r) => r.check?.kind === 'attribute_threshold')
  );
}
