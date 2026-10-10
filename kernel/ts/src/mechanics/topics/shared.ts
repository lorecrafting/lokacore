import type { CharacterId, DefinitionRef } from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';
import { key } from '../../foundation/compose.ts';
import { assigned, value, scopeOf, type Assigned } from '../fact.ts';
import { KernelError } from '../../foundation/error.ts';
import { cmp } from '../../foundation/validate.ts';

export function grant(world: World, actor: CharacterId, run: Assigned, topic: DefinitionRef) {
  const definition = world.cartridge.topics?.[refString(topic)];
  if (!definition) throw new KernelError('precondition_failed');
  const at = key({
    kind: 'fact',
    fact: definition.fact,
    scope: scopeOf(world, actor, definition.fact),
  });
  const known = run.facts[at] ?? value(world, actor, definition.fact);
  if (typeof known !== 'boolean') throw new KernelError('precondition_failed');
  return known ? run : assigned(world, actor, run, { fact: definition.fact, value: true });
}

export function knownTopics(world: World, actor: CharacterId) {
  return Object.values(world.cartridge.topics ?? {})
    .sort((a, b) => cmp(a.key, b.key))
    .flatMap((d) =>
      value(world, actor, d.fact) === true
        ? [
            {
              topic: {
                cartridge_id: world.cartridge.manifest.id,
                cartridge_version: world.cartridge.manifest.version,
                kind: 'topic',
                key: d.key,
              } as DefinitionRef,
              label: d.label,
            },
          ]
        : [],
    );
}

// Toolbox row 46: the topics plus each deduction (a recipe whose policy is an all requiring two or
// more topics' facts true and whose success assigns another topic's fact true) while the actor
// knows those topics and not that one; the recipe's other policy items show on its own action.
// Absent when none, so a cartridge opts in by content.
export function lore(world: World, actor: CharacterId) {
  const topics = Object.values(world.cartridge.topics ?? {});
  const topicOf = (fact: DefinitionRef) =>
    topics.find((t) => refString(t.fact) === refString(fact));
  const known = (fact: DefinitionRef) => value(world, actor, fact) === true;
  const deductions = Object.values(world.cartridge.recipes ?? {})
    .sort((a, b) => cmp(a.key, b.key))
    .flatMap((r) => {
      const root = r.policy.root;
      const from = [
        ...new Set(
          (root.op === 'all' ? root.items : []).flatMap((p) =>
            p.op === 'fact_compare' && p.equals === true ? (topicOf(p.fact) ?? []) : [],
          ),
        ),
      ];
      const grants = r.outcomes.success.sequence.find(
        (s) => s.op === 'fact.assign' && s.value === true && topicOf(s.fact),
      );
      return from.length >= 2 &&
        grants?.op === 'fact.assign' &&
        from.every((t) => known(t.fact)) &&
        !known(grants.fact)
        ? [{ action: r.key, label: r.label, from: from.map((t) => t.label) }]
        : [];
    });
  return {
    topics: knownTopics(world, actor),
    ...(deductions.length > 0 && { deductions }),
  };
}
