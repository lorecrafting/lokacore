import type { MutationTarget } from '../contracts.gen.ts';
import { key } from '../foundation/compose.ts';

// The State section each written MutationTarget kind lives in (the clock is State.clock).
const SECTIONS: Readonly<
  Record<
    string,
    | 'liquids'
    | 'fuel'
    | 'containers'
    | 'facts'
    | 'resources'
    | 'cooldowns'
    | 'barriers'
    | 'quests'
    | 'jobs'
    | 'choices'
    | 'created'
    | 'encounters'
    | 'escorts'
  >
> = {
  liquid: 'liquids',
  fuel: 'fuel',
  encounter: 'encounters',
  escort: 'escorts',
  entity: 'created',
  containment: 'containers',
  fact: 'facts',
  resource: 'resources',
  cooldown: 'cooldowns',
  barrier: 'barriers',
  quest: 'quests',
  job: 'jobs',
  choice: 'choices',
};

/**
 * Where adopt() keeps a written MutationTarget: its State section and row (not the clock), as
 * foundation/compose.ts reads it: an entity's container by its id, a quest instance, job or continuation by
 * its id, else by canonical target text.
 */
export const row = (t: MutationTarget) =>
  SECTIONS[t.kind] &&
  ([
    SECTIONS[t.kind]!,
    t.kind === 'fuel' || t.kind === 'liquid'
      ? t.item_id
      : t.kind === 'containment' || t.kind === 'entity'
        ? t.entity_id
        : t.kind === 'escort'
          ? t.actor_id
          : t.kind === 'encounter'
            ? t.encounter_id
            : t.kind === 'quest'
              ? t.instance_id
              : t.kind === 'job'
                ? t.job_id
                : t.kind === 'choice'
                  ? t.continuation_id
                  : key(t),
  ] as const);
