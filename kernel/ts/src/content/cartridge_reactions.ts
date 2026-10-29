// Only `uses` remains, for the lock stage (cartridge.ts lockStage, which slice B2 deletes); reactions.ex checks reactions.
import { step, type Obj } from './cartridge_refs.ts';

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.reactions ?? {}) as Obj).map(([ref, r]) => [
    r,
    `.cartridge.reactions${step(ref)}`,
  ]);

/** Each owner reference of each reaction: [registry field, name, path]. */
export const uses = (c: Obj) =>
  each(c).flatMap(([r, at]) => [
    ['definition', 'reaction', at],
    ['event', r.on.event, `${at}.on.event`],
    ...r.apply.flatMap((s: Obj, i: number) =>
      [
        'population.suppress',
        'experience.grant',
        'status.cure',
        'item.move',
        'population.spawn',
        'replenish.run',
        'narrate',
      ].includes(s.op)
        ? []
        : [
            [
              'event',
              s.op === 'quest.activate'
                ? 'quest_activated'
                : s.op === 'quest.resolve'
                  ? 'quest_resolved'
                  : s.op === 'barrier.set'
                    ? 'barrier_changed'
                    : s.op === 'npc.move'
                      ? 'entity_entered_room'
                      : 'fact_changed',
              `${at}.apply[${i}].op`,
            ],
          ],
    ),
  ]) as ['definition' | 'event', string, string][];
