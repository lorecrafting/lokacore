import type {
  MutationTarget,
  CharacterId,
  DeltaOp,
  DefinitionRef,
  EntityId,
  EncounterId,
  QuestInstanceId,
} from '../contracts.gen.ts';
import { key } from '../foundation/compose.ts';

// The State section each written MutationTarget kind lives in (the clock is State.clock).
const SECTIONS: Readonly<
  Record<
    string,
    | 'visited_rooms'
    | 'observed_npcs'
    | 'water'
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
    | 'characters'
    | 'encounters'
    | 'escorts'
    | 'patrols'
    | 'expeditions'
    | 'population_plans'
    | 'population_slots'
    | 'crows'
    | 'bleeds'
  >
> = {
  visit: 'visited_rooms',
  observation: 'observed_npcs',
  water: 'water',
  liquid: 'liquids',
  fuel: 'fuel',
  encounter: 'encounters',
  escort: 'escorts',
  patrol: 'patrols',
  expedition: 'expeditions',
  population_plan: 'population_plans',
  population_slot: 'population_slots',
  crow: 'crows',
  entity: 'created',
  character: 'characters',
  containment: 'containers',
  fact: 'facts',
  resource: 'resources',
  cooldown: 'cooldowns',
  barrier: 'barriers',
  quest: 'quests',
  job: 'jobs',
  bleed: 'bleeds',
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
      : t.kind === 'population_plan'
        ? key(t.plan)
        : t.kind === 'bleed'
          ? t.body_id
          : t.kind === 'containment' || t.kind === 'entity'
            ? t.entity_id
            : t.kind === 'character'
              ? t.character_id
              : t.kind === 'water'
                ? t.actor_id
                : t.kind === 'patrol' || t.kind === 'expedition'
                  ? t.quest_instance_id
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

/** A scheduled job as composition stores it (foundation/compose.ts job.schedule; 03 §13; 04 §5.4). */
export type JobRow = {
  readonly crow_member_id?: EntityId;
  readonly crow_generation?: number;
  readonly crow_phase?: 'acquire' | 'leg' | 'return';
  readonly water_generation?: number;
  readonly water_body_id?: EntityId;
  readonly job: DefinitionRef;
  readonly due_time: number;
  readonly status: 'pending' | 'completed' | 'cancelled';
  readonly encounter_id?: EncounterId;
  readonly quest_instance_id?: QuestInstanceId;
  readonly actor_id?: CharacterId;
  readonly bleed_body_id?: EntityId;
  readonly bleed_generation?: number;
  readonly sight?: Extract<DeltaOp, { op: 'job.schedule' }>['sight'];
};
