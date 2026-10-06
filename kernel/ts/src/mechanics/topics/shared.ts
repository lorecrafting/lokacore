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
