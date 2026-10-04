// The loader's recipe checks (action_recipe@1; action.schema.json ActionRecipe), twin of
// lib/loka/content/recipes.ex, and each room's action contribution.
import { CAPABILITY_OWNERS, type Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

// Each recipe's key is no action's and no registered command's (DUPLICATE_DEFINITION: one key is
// one ActionSet identity) and its check's key no other recipe's check's (one check DefinitionRef),
// its target names a room of this cartridge and a detail of that room,
// it has a failure outcome exactly when it has a check (OUTCOME_MISMATCH), its threshold check,
// costs and resource.adjust steps name resources of it, each outcome's fact.assign names a fact
// of it, its label and narrations have catalog entries and each narration participant but the
// actor names an NPC or item of it, as its role says; each key of
// a room's action contribution names an engine verb (a registered command), an action or a
// recipe of this cartridge (UNRESOLVED_REFERENCE, data {target}: the detail or action key).
export function recipes(c: Obj, { named, typedValue, text }: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const taken = new Set([
    ...Object.keys(CAPABILITY_OWNERS.command),
    ...Object.values(c.actions as Obj).map((a) => a.key),
  ]);
  const checks = Object.values((c.recipes ?? {}) as Obj).map((r) => r.check?.key);
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj)) {
    const at = `.cartridge.recipes${step(ref)}`;
    if (taken.has(r.key)) out.push(diag('DUPLICATE_DEFINITION', at));
    if (r.check && checks.filter((k) => k === r.check.key).length > 1)
      out.push(diag('DUPLICATE_DEFINITION', `${at}.check`));
    const { room, detail } = r.target;
    const there = c.rooms[refString(room)]; // this cartridge's room, as named() requires
    if (!there) named(room, 'room', `${at}.target.room`);
    else if (!Object.hasOwn(there.details ?? {}, detail))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.target.detail`, { target: detail }));
    if (!r.check !== !r.outcomes.failure) out.push(diag('OUTCOME_MISMATCH', `${at}.outcomes`));
    if (r.check?.kind === 'threshold') named(r.check.resource, 'resource', `${at}.check.resource`);
    (r.costs ?? []).forEach((k: Obj, i: number) =>
      named(k.resource, 'resource', `${at}.costs[${i}].resource`),
    );
    for (const [name, o] of Object.entries(r.outcomes as Obj)) {
      const path = `${at}.outcomes.${name}`;
      o.sequence.forEach((s: Obj, i: number) => {
        if (s.op === 'resource.adjust')
          named(s.resource, 'resource', `${path}.sequence[${i}].resource`);
        if (s.op !== 'fact.assign') return;
        named(s.fact, 'fact', `${path}.sequence[${i}].fact`);
        typedValue(s.fact, s.value, `${path}.sequence[${i}].value`);
      });
      text(o.narration, ['actor', 'observers'], `${path}.narration`);
      for (const [n, p] of Object.entries((o.narration.participants ?? {}) as Obj))
        if (p.role !== 'actor')
          named(p[p.role], p.role, `${path}.narration.participants${step(n)}.${p.role}`);
    }
    text(r, ['label'], at);
  }
  return [...out, ...contributions(c)];
}

// Each key of a room's action contribution names a registered command, an action, a recipe, a
// quest (its offer) or a dialogue (its talk).
function contributions(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const defs: Obj[] = [c.actions, c.recipes ?? {}, c.quests ?? {}, c.dialogues ?? {}].flatMap(
    Object.values,
  );
  const keys = new Set([...Object.keys(CAPABILITY_OWNERS.command), ...defs.map((d) => d.key)]);
  for (const [ref, r] of Object.entries(c.rooms as Obj))
    (r.actions ?? []).forEach((a: Obj, i: number) =>
      a.actions.forEach((k: string, j: number) => {
        if (!keys.has(k))
          out.push(
            diag(
              'UNRESOLVED_REFERENCE',
              `.cartridge.rooms${step(ref)}.actions[${i}].actions[${j}]`,
              { target: k },
            ),
          );
      }),
    );
  return out;
}
