// Current chapter and player quest journal projections.
import type {
  ChapterView,
  QuestDefinition,
  QuestJournal,
  QuestView,
  Key,
} from '../contracts.gen.ts';
import { refString, type QuestRow, type World, type Steps } from '../runtime/decision.ts';
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
      const expedition = expeditionProgress(world, id);
      const d = world.cartridge.quests![refString(q.quest)];
      const left = remaining(world, id, q, d.deadline);
      const shown = {
        ...progress,
        ...expedition,
        quest: q.quest,
        state: q.state,
        title: d.title,
        ...(left !== undefined && { remaining: left }),
      };
      const j = d.journal;
      if (!j) return shown;
      const variant =
        q.state === 'active'
          ? j.active_variants?.find((v) => holds(world, world.character, v.when.root))?.text
          : undefined;
      const failed = expedition.expedition?.status === 'failed';
      const met =
        q.state === 'objectives_complete' ||
        (q.state === 'active' &&
          !failed &&
          !variant &&
          holdsNow(world, world.character, q.quest, { n: 0 }));
      const journal = failed
        ? j.failed
        : met
          ? j.objectives_met
          : q.state === 'active'
            ? (variant ?? j.active)
            : ((q.outcome && j.outcomes?.[q.outcome]) ?? j[q.state]);
      const h = !failed && hint(world, q, j.hints?.[met ? 'objectives_met' : 'active']);
      return { ...shown, journal, ...(h && { hint: h }) };
    })
    .sort((a, b) => cmp(refString(a.quest), refString(b.quest)));
}

// Toolbox row W23: the last hint of the shown stage whose real minutes since started_at have passed
// (after x 60 x the time policy's rate in logical time); none once closed or without started_at.
// ponytail: a current_state objective met without a transition times its objectives_met hints from
// the stage's start (activation); stamp a met time when an author needs them from the met moment.
function hint(world: World, q: QuestRow, hints: NonNullable<QuestJournal['hints']>['active'] = []) {
  const rate = world.cartridge.manifest.time_policy?.rate;
  if (q.started_at === undefined || !rate || !OPEN.includes(q.state)) return;
  return hints.filter((x) => x.after * 60 * rate <= world.state.clock - q.started_at!).pop()?.text;
}
const OPEN = ['active', 'objectives_complete'];

// Toolbox row W24: logical time until the open instance's pending generic deadline job is due
// (legacy deadlines show none, so Chapter 1 views keep their bytes).
function remaining(world: World, id: string, q: QuestRow, d: QuestDefinition['deadline']) {
  if (!d || d.fact || !OPEN.includes(q.state)) return;
  const job = Object.values(world.state.jobs ?? {}).find(
    (j) => j.quest_instance_id === id && j.status === 'pending',
  );
  return job && Math.max(0, job.due_time - world.state.clock);
}

function expeditionProgress(world: World, id: string) {
  const row = world.state.expeditions?.[id];
  const quest = world.state.quests?.[id];
  const spec = quest && world.cartridge.quests?.[refString(quest.quest)]?.expedition;
  if (!row || !spec) return {};
  const next = row.status === 'active' ? spec.route[row.cursor] : undefined;
  return {
    expedition: {
      quest_instance_id: row.quest_instance_id,
      attempt_id: row.attempt_id,
      cursor: row.cursor,
      required: spec.route.length,
      sheltered: row.sheltered,
      status: row.status,
      ...(next && {
        next_room: next.to,
        next_title: world.rooms[world.roomIds[refString(next.to)]].title,
        ...(world.state.containers[row.body_id] === world.roomIds[refString(next.from)] && {
          direction: next.direction,
        }),
      }),
    },
  };
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
