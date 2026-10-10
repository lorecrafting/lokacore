// The loader's quest checks (quest@1; quest.schema.json QuestDefinition; 06 §2, §8 references
// exist), twin of lib/loka/content/quests.ex: each quest's key is no registered command's,
// action's or recipe's (DUPLICATE_DEFINITION: its offer is an ActionSet identity), its title and
// its offer's label (the offer is optional) and every journal text have catalog entries; a
// post_activation_event objective names an item of this cartridge. Its policies are walked with every other policy
// (content/cartridge_refs.ts nodes).
import { patrol } from './cartridge_patrol.ts';
import { expedition } from './cartridge_expedition.ts';
import { CAPABILITY_OWNERS, type Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function quests(c: Obj, { named, text }: Checks): Diagnostic[] {
  const taken = new Set([
    ...Object.keys(CAPABILITY_OWNERS.command),
    ...[...Object.values(c.actions as Obj), ...Object.values(c.recipes ?? {})].map((d) => d.key),
  ]);
  const out: Diagnostic[] = [];
  for (const [ref, q] of Object.entries((c.quests ?? {}) as Obj)) {
    const at = `.cartridge.quests${step(ref)}`;
    out.push(...patrol(c, q, at, { named, text } as Checks));
    out.push(...expedition(c, q, at, { named, text } as Checks));
    if (taken.has(q.key)) out.push(diag('DUPLICATE_DEFINITION', at));
    text(q, ['title'], at);
    if (q.offer) text(q.offer, ['label'], `${at}.offer`);
    if (q.journal) {
      for (const [i, v] of (q.journal.active_variants ?? []).entries())
        text(v, ['text'], `${at}.journal.active_variants[${i}]`);
      text(
        q.journal,
        ['active', 'objectives_met', 'resolved', 'failed', 'abandoned'],
        `${at}.journal`,
      );
      if (q.journal.outcomes)
        text(q.journal.outcomes, Object.keys(q.journal.outcomes), `${at}.journal.outcomes`);
      out.push(...hints(c, q.journal.hints, `${at}.journal.hints`, text));
    }
    if (q.objective.item_acquired)
      named(q.objective.item_acquired, 'item', `${at}.objective.item_acquired`);
    if (q.deadline) out.push(...deadline(c, q.deadline, `${at}.deadline`, named));
  }
  // Toolbox row W24: a reaction on quest_failed needs kernel_api 1.46 (as G3's status_ triggers).
  const failed = Object.values((c.reactions ?? {}) as Obj).some(
    (r) => r.on.event === 'quest_failed',
  );
  if (failed && apiCmp(c.manifest.requires.kernel_api.at_least, '1.46') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}

// Toolbox row W24: a deadline is legacy (S2: at, fact, trust_fact and trust_amount, no after) or
// generic (exactly one of after or at, no legacy field, kernel_api 1.46); any other shape is
// SCHEMA_VIOLATION invalid_value at the deadline.
function deadline(c: Obj, d: Obj, at: string, named: Checks['named']): Diagnostic[] {
  const legacy = ['fact', 'trust_fact', 'trust_amount'].filter((f) => f in d).length;
  if (legacy === 3 && 'at' in d && !('after' in d)) {
    named(d.fact, 'fact', `${at}.fact`);
    named(d.trust_fact, 'fact', `${at}.trust_fact`);
    return [];
  }
  if (legacy || 'after' in d === 'at' in d)
    return [diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' })];
  return apiCmp(c.manifest.requires.kernel_api.at_least, '1.46') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}

// Toolbox row W23: each stage's hints resolve, their minutes strictly ascend, real minutes need the
// real_elapsed time policy (INVALID_TIME_POLICY) and hints need kernel_api 1.46. An empty hints
// object is too_few_items (the schema subset has no minProperties).
function hints(c: Obj, h: Obj | undefined, at: string, text: Checks['text']): Diagnostic[] {
  if (!h) return [];
  const out: Diagnostic[] = [];
  if (!Object.keys(h).length) out.push(diag('SCHEMA_VIOLATION', at, { error: 'too_few_items' }));
  for (const [stage, list] of Object.entries(h as Record<string, Obj[]>)) {
    list.forEach((x, i) => text(x, ['text'], `${at}.${stage}[${i}]`));
    if (list.some((x, i) => i > 0 && x.after <= list[i - 1]!.after))
      out.push(diag('SCHEMA_VIOLATION', `${at}.${stage}`, { error: 'invalid_value' }));
  }
  if (c.manifest.time_policy?.profile !== 'real_elapsed') out.push(diag('INVALID_TIME_POLICY', at));
  if (apiCmp(c.manifest.requires.kernel_api.at_least, '1.46') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}

// Policy roots join the existing shared walk for ownership, references and typed comparisons.
export function questPolicies(c: Obj): [Obj, string][] {
  return Object.entries((c.quests ?? {}) as Obj).flatMap(([ref, q]) => {
    const at = `.cartridge.quests${step(ref)}`;
    return [
      ...['offer', 'objective']
        .filter((f) => q[f]?.policy)
        .map((f): [Obj, string] => [q[f].policy.root, `${at}.${f}.policy.root`]),
      ...(q.journal?.active_variants ?? []).map((v: Obj, i: number): [Obj, string] => [
        v.when.root,
        `${at}.journal.active_variants[${i}].when.root`,
      ]),
    ];
  });
}

export function featureApi(c: Obj): Diagnostic[] {
  const debt =
    Object.values((c.quests ?? {}) as Obj).some((q) => q.deadline?.fact) ||
    Object.values((c.npcs ?? {}) as Obj).some((n) => n.resource_starts) ||
    Object.values((c.dialogues ?? {}) as Obj).some((d) =>
      Object.values(d.choices as Obj).some(
        (o) => o.payment || o.availability || (o.receive && o.accept),
      ),
    );
  const riddles =
    Object.values((c.dialogues ?? {}) as Obj).some((d) => d.riddle) ||
    Object.values((c.quests ?? {}) as Obj).some((q) => q.journal?.active_variants);
  const transfers =
    Object.values((c.items ?? {}) as Obj).some((d) => Object.hasOwn(d, 'give_allowed')) ||
    Object.values((c.dialogues ?? {}) as Obj).some(
      (d) => !d.quest && Object.values(d.choices as Obj).some((o) => o.receive),
    );
  const minimum = Object.values((c.quests ?? {}) as Obj).some((q) => q.patrol)
    ? 22
    : debt
      ? 14
      : Object.hasOwn(c.manifest.requires.capabilities, 'escort')
        ? 11
        : transfers
          ? 10
          : riddles
            ? 9
            : 0;
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  return minimum > 0 && (major < 1 || (major === 1 && minor < minimum))
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}
