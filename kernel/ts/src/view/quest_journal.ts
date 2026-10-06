// Current chapter and player quest journal projections.
import type { ChapterView, QuestView, Key } from '../contracts.gen.ts';
import { refString, type World, type Steps } from '../runtime/decision.ts';
import * as patrol from '../mechanics/patrol/shared.ts';
import { definition } from '../mechanics/dialogue/shared.ts';
import { questOf } from '../mechanics/lookups.ts';
import { value } from '../mechanics/fact.ts';
import { holds } from '../mechanics/policy.ts';
import { holdsNow } from '../mechanics/quest/lifecycle.ts';
import { cmp } from '../foundation/validate.ts';

export function chapter(world: World): ChapterView | undefined {
  const chapters = world.cartridge.chapters;
  if (!chapters) return;
  let index = 0;
  for (let i = 1; i < chapters.length; i++) {
    const c = chapters[i]!;
    const outcomes = world.cartridge.story_points![refString(c.story_point!)].outcomes;
    const counted = c.outcome
      ? [[c.outcome, outcomes[c.outcome]!] as const]
      : Object.entries(outcomes);
    if (
      counted.some(([outcome, t]) => {
        if ('scene' in t) {
          const marker = {
            ...c.story_point!,
            kind: 'fact' as const,
            key: `story_point_${c.story_point!.key}` as Key,
          };
          return value(world, world.character, marker) === outcome;
        }
        const d = definition(world, t.dialogue);
        const q = questOf(world, world.character, d.quest!)?.[1];
        return q?.state === 'resolved' && q.outcome === t.choice;
      })
    )
      index = i;
  }
  return { index, title: chapters[index]!.title };
}

export function journal(world: World, steps: Steps): QuestView[] {
  return Object.entries(world.state.quests ?? {})
    .filter(([, { scope: s }]) => s.kind === 'player' && s.character_id === world.character)
    .map(([id, q]) => {
      const progress = patrolProgress(world, id, steps);
      const d = world.cartridge.quests![refString(q.quest)];
      const shown = { ...progress, quest: q.quest, state: q.state, title: d.title };
      const j = d.journal;
      if (!j) return shown;
      const variant =
        q.state === 'active'
          ? j.active_variants?.find((v) => holds(world, world.character, v.when.root))?.text
          : undefined;
      const journal =
        q.state === 'active'
          ? (variant ??
            (holdsNow(world, world.character, q.quest, { n: 0 }) ? j.objectives_met : j.active))
          : q.state === 'objectives_complete'
            ? j.objectives_met
            : ((q.outcome && j.outcomes?.[q.outcome]) ?? j[q.state]);
      return { ...shown, journal };
    })
    .sort((a, b) => cmp(refString(a.quest), refString(b.quest)));
}

function patrolProgress(world: World, id: string, steps: Steps) {
  const found = world.state.patrols?.[id];
  const walked = found && patrol.route(world, found, steps);
  const progress =
    walked && found
      ? {
          patrol: {
            leader_id: found.npc_id,
            leader_name: world.entities[found.npc_id].short,
            room_title: world.rooms[walked.here].title,
            next_title: world.rooms[walked.there].title,
            room: walked.settings.route[found.cursor],
            next_room: walked.settings.route[walked.next],
            direction: found.status === 'awaiting' ? walked.pending_direction : walked.direction,
            credit: found.credit.length,
            required: walked.settings.required,
            status: found.status,
          },
        }
      : {};
  return progress;
}
