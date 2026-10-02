// The loader's dialogue checks (dialogue@1; dialogue.schema.json DialogueDefinition; 06 §8
// references exist, §17, §33), twin of lib/loka/content/dialogues.ex: what each dialogue uses, for
// the lock stage (cartridge.ts): its own kind and each fact.assign's fact_changed (and each story
// point its story_point_reached); and its references: its key is no registered command's,
// action's, recipe's or quest's
// (DUPLICATE_DEFINITION: its talk is an ActionSet identity), its speaker no other dialogue's
// (DUPLICATE_DEFINITION at npc: a talk names only its target, so one dialogue per NPC), its
// prompt, labels and narrations have catalog entries, its speaker, roles and quest name an NPC,
// item or quest of this cartridge, its speaker is one of its npc roles, no role is named actor
// (the actor is always a participant: DUPLICATE_DEFINITION), it has a choice (the subset has no
// minProperties: SCHEMA_VIOLATION too_few_items), each hand_over gives an item role to an npc
// role, and each fact.assign names a fact of it with a value of its type. Its policy is walked
// with every other policy (cartridge_refs.ts nodes). Each story point (cartridge.schema.json
// StoryPointDefinition; 23 §3) has an outcome (SCHEMA_VIOLATION too_few_items), and each
// outcome's trigger names a dialogue of this cartridge and one of its choices, a site no other
// outcome names (DUPLICATE_DEFINITION), in a dialogue that resolves a quest, so its choice is
// made once (OUTCOME_MISMATCH).
import {
  CAPABILITY_OWNERS,
  type DefinitionRef,
  type Diagnostic,
  type FactValue,
} from './contracts.gen.ts';
import { diag, step, type checkers, type Obj } from './cartridge_refs.ts';
import { same } from './compose.ts';
import { refString } from './decision.ts';

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.dialogues ?? {}) as Obj).map(([ref, d]) => [
    d,
    `.cartridge.dialogues${step(ref)}`,
  ]);

/** Each owner reference of each dialogue and story point: [registry field, name, path]. */
export const uses = (c: Obj) =>
  [
    ...each(c).flatMap(([d, at]) => [
      ['definition', 'dialogue', at],
      ...Object.entries(d.choices as Obj).flatMap(([id, o]) =>
        (o.sequence ?? []).map((_: Obj, i: number) => [
          'event',
          'fact_changed',
          `${at}.choices${step(id)}.sequence[${i}].op`,
        ]),
      ),
    ]),
    ...Object.keys((c.story_points ?? {}) as Obj).map((ref) => [
      'event',
      'story_point_reached',
      `.cartridge.story_points${step(ref)}`,
    ]),
  ] as ['definition' | 'event', string, string][];

type Checks = ReturnType<typeof checkers>;

export function dialogues(c: Obj, checks: Checks): Diagnostic[] {
  const { named, text } = checks;
  const taken = new Set([
    ...Object.keys(CAPABILITY_OWNERS.command),
    ...[c.actions, c.recipes ?? {}, c.quests ?? {}].flatMap(Object.values).map((d: Obj) => d.key),
  ]);
  const out: Diagnostic[] = [];
  const speakers = each(c).map(([d]) => refString(d.npc as DefinitionRef));
  for (const [d, at] of each(c)) {
    if (taken.has(d.key)) out.push(diag('DUPLICATE_DEFINITION', at));
    const speaker = refString(d.npc as DefinitionRef);
    if (speakers.filter((s) => s === speaker).length > 1)
      out.push(diag('DUPLICATE_DEFINITION', `${at}.npc`));
    text(d, ['prompt'], at);
    named(d.npc, 'npc', `${at}.npc`);
    if (d.quest) named(d.quest, 'quest', `${at}.quest`);
    const roles = d.roles as Obj;
    for (const [name, r] of Object.entries(roles)) {
      if (name === 'actor') out.push(diag('DUPLICATE_DEFINITION', `${at}.roles.actor`));
      named(r[r.role], r.role, `${at}.roles${step(name)}.${r.role}`);
    }
    if (!Object.values(roles).some((r) => r.role === 'npc' && same(r.npc, d.npc)))
      out.push(
        diag('UNRESOLVED_REFERENCE', `${at}.npc`, { target: refString(d.npc as DefinitionRef) }),
      );
    if (!Object.keys(d.choices).length)
      out.push(diag('SCHEMA_VIOLATION', `${at}.choices`, { error: 'too_few_items' }));
    for (const [id, o] of Object.entries(d.choices as Obj))
      out.push(...choice(o, `${at}.choices${step(id)}`, roles, checks));
  }
  return [...out, ...storyPoints(c, named)];
}

function storyPoints(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  const site = (t: Obj) => `${refString(t.dialogue as DefinitionRef)} ${t.choice}`;
  const all = Object.entries((c.story_points ?? {}) as Obj);
  const sites = all.flatMap(([, p]) => Object.values(p.outcomes as Obj).map(site));
  for (const [ref, p] of all) {
    const at = `.cartridge.story_points${step(ref)}`;
    if (!Object.keys(p.outcomes).length)
      out.push(diag('SCHEMA_VIOLATION', `${at}.outcomes`, { error: 'too_few_items' }));
    for (const [name, t] of Object.entries(p.outcomes as Obj)) {
      const path = `${at}.outcomes${step(name)}`;
      named(t.dialogue, 'dialogue', `${path}.dialogue`);
      if (sites.filter((s) => s === site(t)).length > 1)
        out.push(diag('DUPLICATE_DEFINITION', path));
      const d = (c.dialogues ?? {})[refString(t.dialogue as DefinitionRef)];
      if (d && !Object.hasOwn(d.choices, t.choice))
        out.push(diag('UNRESOLVED_REFERENCE', `${path}.choice`, { target: t.choice }));
      if (d && !d.quest) out.push(diag('OUTCOME_MISMATCH', path));
    }
  }
  return out;
}

// One option's texts, fact.assign steps and hand_over (an item role to an npc role).
function choice(o: Obj, path: string, roles: Obj, { named, typedValue, text }: Checks) {
  text(o, ['label', 'narration'], path);
  (o.sequence ?? []).forEach((s: Obj, i: number) => {
    named(s.fact, 'fact', `${path}.sequence[${i}].fact`);
    typedValue(s.fact, s.value, `${path}.sequence[${i}].value`);
  });
  const h = o.hand_over;
  const wrong = (field: string, role: string) =>
    h && !(Object.hasOwn(roles, h[field]) && roles[h[field]].role === role);
  return (['item', 'to'] as const)
    .filter((field) => wrong(field, field === 'to' ? 'npc' : 'item'))
    .map((field) =>
      diag('UNRESOLVED_REFERENCE', `${path}.hand_over.${field}`, { target: h[field] }),
    );
}
