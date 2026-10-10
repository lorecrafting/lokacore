// The loader's recipe checks (action_recipe@1; action.schema.json ActionRecipe), twin of
// lib/loka/content/recipes.ex, and each room's action contribution.
import { CAPABILITY_OWNERS, type Diagnostic } from '../contracts.gen.ts';
import { apiCmp } from './cartridge_installed.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

/** Toolbox row W23: the FactSpec the compiler adds for a recipe's tip (recipes.ex tip_spec). */
export const tipSpec = (key: string) => ({
  key: `seen_tip_${key}`,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: `Recipe ${key}'s tip was shown (action_recipe@1): only that recipe writes it.`,
});

// Each recipe's key is no action's and no registered command's (DUPLICATE_DEFINITION: one key is
// one ActionSet identity) and its check's key no other recipe's or dialogue choice's check's (one
// check DefinitionRef),
// its target names a room of this cartridge and a detail of that room,
// it has a failure outcome exactly when it has a check (OUTCOME_MISMATCH), its threshold check,
// costs and resource.adjust steps name resources of it, each outcome's fact.assign names a fact
// of it, its label and narrations have catalog entries and each narration participant but the
// actor names an NPC or item of it, as its role says; each key of
// a room's action contribution names an engine verb (a registered command), an action or a
// recipe of this cartridge (UNRESOLVED_REFERENCE, data {target}: the detail or action key).
export function recipes(c: Obj, { named, typedValue, text }: Checks): Diagnostic[] {
  const out: Diagnostic[] = tips(c, text);
  const taken = new Set([
    ...reservedCommands(c),
    ...Object.values(c.actions as Obj).map((a) => a.key),
  ]);
  const checks = checkKeys(c);
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
  return [...out, ...contributions(c), ...attributes(c, { named, text, typedValue })];
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

function attributes(c: Obj, { named }: Checks) {
  const out: Diagnostic[] = [];
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj)) {
    const at = `.cartridge.recipes${step(ref)}`;
    if (r.check?.attribute) named(r.check.attribute, 'attribute', `${at}.check.attribute`);
    if (r.check?.kind === 'opposed') out.push(...opposed(c, r, at, named));
  }
  return out;
}

// Toolbox rows 5 and G5: an opposed check names a skill of this cartridge (its attribute is
// checked with attribute_threshold's) and its target detail declares a rating, unless (row G3) it
// names an NPC instance of this cartridge that declares the check's attribute.
function opposed(c: Obj, r: Obj, at: string, named: Checks['named']): Diagnostic[] {
  if (r.check.skill) named(r.check.skill, 'skill', `${at}.check.skill`);
  if (r.check.npc) return rater(c, r.check, `${at}.check`, named);
  const detail = c.rooms[refString(r.target.room)]?.details?.[r.target.detail];
  return detail && detail.rating === undefined
    ? [diag('SCHEMA_VIOLATION', `${at}.check`, { error: 'invalid_value' })]
    : [];
}

/** Row G3: an opposed check's npc names an NPC instance of this cartridge declaring its attribute. */
export function rater(c: Obj, check: Obj, at: string, named: Checks['named']): Diagnostic[] {
  const npc = c.npcs?.[refString(check.npc)];
  named(check.npc, 'npc', `${at}.npc`);
  return npc &&
    (npc.spawn_template ||
      !npc.attributes?.some((a: Obj) => refString(a.attribute) === refString(check.attribute)))
    ? [diag('SCHEMA_VIOLATION', `${at}.npc`, { error: 'invalid_value' })]
    : [];
}

/** Every check key of the cartridge: each recipe's and each dialogue choice's, with repeats. */
export const checkKeys = (c: Obj): string[] => [
  ...Object.values((c.recipes ?? {}) as Obj).flatMap((r) => (r.check ? [r.check.key] : [])),
  ...Object.values((c.dialogues ?? {}) as Obj).flatMap((d) =>
    Object.values(d.choices as Obj).flatMap((o) => (o.check ? [o.check.key] : [])),
  ),
];

function reservedCommands(c: Obj): string[] {
  return Object.keys(CAPABILITY_OWNERS.command).filter(
    (key) =>
      !['where', 'knock'].includes(key) ||
      apiCmp(c.manifest.requires.kernel_api.at_least, '1.37') >= 0,
  );
}

// Toolbox row W23: a recipe's tip resolves and needs kernel_api 1.46 (a tipped key over 55
// characters fails the schema at its seen_tip_ FactSpec).
function tips(c: Obj, text: Checks['text']): Diagnostic[] {
  const tipped = Object.entries((c.recipes ?? {}) as Obj).filter(([, r]) => r.tip);
  const out: Diagnostic[] = [];
  for (const [ref, r] of tipped) text(r, ['tip'], `.cartridge.recipes${step(ref)}`);
  if (tipped.length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.46') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}

/** A tip's seen_tip_<key> assignment uses fact_changed (the lock stage, content/cartridge.ts). */
export const tipUses = (c: Obj) =>
  Object.entries((c.recipes ?? {}) as Obj)
    .filter(([, r]) => r.tip)
    .map(([ref]) => ['event', 'fact_changed', `.cartridge.recipes${step(ref)}.tip`]) as [
    'event',
    string,
    string,
  ][];
