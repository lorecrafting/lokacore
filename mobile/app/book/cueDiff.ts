// The pure diff of two GameViews into named cues (book-ui.md, Effects, sound and haptics; Queue).
import type { GameView } from '../../packages/game-view/session.ts';
import type { Cue, CueName } from './cues.ts';

const amount = (v: GameView, key: string) =>
  v.resources?.find((r) => r.resource.key === key)?.current;
// A pool that only now appears, or just left the view, has not moved.
const moved = (now: GameView, was: GameView, key: string) =>
  (amount(now, key) ?? amount(was, key) ?? 0) - (amount(was, key) ?? amount(now, key) ?? 0);

type Ticking = { next_tick_at?: number; tick_every?: number };
const ticks = (was?: Ticking, now?: Ticking) =>
  was?.tick_every && was.next_tick_at !== undefined && now?.next_tick_at !== undefined
    ? (now.next_tick_at - was.next_tick_at) / was.tick_every
    : 0;
// HP the statuses took between two views; `per_tick` is signed, negative a loss (model.ts).
function ticked(now: GameView, was: GameView) {
  const same = now.bleeding?.generation === was.bleeding?.generation;
  const bled = (same ? ticks(was.bleeding, now.bleeding) : 0) * (was.bleeding?.hp_loss ?? 0);
  return (was.conditions ?? [])
    .filter((c) => c.resource === 'hp')
    .reduce(
      (sum, c) =>
        sum -
        (c.per_tick ?? 0) *
          ticks(
            c,
            now.conditions?.find((o) => o.label === c.label),
          ),
      bled,
    );
}

const named = (name: CueName, ids: string[], more?: Partial<Cue>): Cue[] =>
  ids.length ? [{ name, ids, ...more }] : [];

export const questCues = (now: GameView, was: GameView) => {
  const quests = (state: string, isNew = false) =>
    now.journal
      .filter((q) => {
        const old = was.journal.find((o) => o.quest.key === q.quest.key);
        return q.state === state && old?.state !== state && (!isNew || !old);
      })
      .map((q) => q.quest.key);
  return [
    ...named('quest_resolved', quests('resolved')),
    ...named('quest_fail', quests('failed')),
    ...named('quest_on', quests('active', true)),
  ];
};

function combatCues(now: GameView, was: GameView) {
  const out: Cue[] = [];
  // Status ticks are silent (owner rule), so only a fall in combat beyond them is a blow (plan 3.3).
  // ponytail: the last tick of a status that just ended still thuds; the view no longer shows it.
  const loss = -moved(now, was, 'hp') - ticked(now, was);
  if (loss > 0 && (now.combat || was.combat)) out.push({ name: 'hp_loss', loss });
  if (!was.combat && now.combat) out.push({ name: 'combat_open' });
  if (was.combat && !now.combat) out.push({ name: 'combat_close' });
  return out;
}

function skillCues(now: GameView, was: GameView) {
  const old = (key: string) => was.skills?.find((s) => s.skill.key === key);
  const skills = now.skills?.filter((s) => s.acquired) ?? [];
  const learned = skills.filter((s) => !old(s.skill.key)?.acquired);
  const up = skills.filter(
    (s) => old(s.skill.key)?.acquired && (s.level ?? 0) > (old(s.skill.key)?.level ?? 0),
  );
  return [
    ...named(
      'skill_learned',
      learned.map((s) => s.skill.key),
    ),
    ...named(
      'skill_up',
      up.map((s) => s.skill.key),
    ),
  ];
}

// A worn item taken off is no pickup; a buy is one sound, the coin (the item still pops).
function itemCues(now: GameView, was: GameView): Cue[] {
  const held = new Set([
    ...was.inventory.map((e) => e.id),
    ...(was.equipment ?? []).flatMap((s) => s.item?.id ?? []),
  ]);
  const got = now.inventory.filter((e) => !held.has(e.id)).map((e) => e.id);
  const pennies = moved(now, was, 'pennies');
  return [
    ...named('pickup', got, pennies < 0 ? { silent: true } : undefined),
    ...(pennies ? [{ name: 'coin' } as const] : []),
  ];
}

function statusCues(now: GameView, was: GameView) {
  const labels = (v: GameView) => [
    ...(v.conditions ?? []).map((c) => c.label),
    ...(v.bleeding ? [v.bleeding.label] : []),
  ];
  // A permanent status has no arrival effect (book-ui.md, Status icon); a bleed always has one.
  const permanent = (now.conditions ?? [])
    .filter((c) => c.ends_at === undefined)
    .map((c) => c.label);
  const arrived = labels(now).filter((l) => !labels(was).includes(l) && !permanent.includes(l));
  const hurts = [
    ...(now.conditions ?? []).filter((c) => c.kind === 'debuff').map((c) => c.label),
    ...(now.bleeding ? [now.bleeding.label] : []),
  ];
  return [
    ...named(
      'status_in',
      arrived,
      arrived.some((l) => hurts.includes(l)) ? undefined : { silent: true },
    ),
    ...named(
      'status_out',
      labels(was).filter((l) => !labels(now).includes(l)),
    ),
  ];
}

/** What changed from `was` to `now`, the story's first. No `was` (a first view, a catch-up) is silent. */
export function cuesOf(now: GameView, was: GameView | undefined): Cue[] {
  if (!was) return [];
  const chapter = now.chapter && was.chapter?.index !== now.chapter.index;
  const level = was.levelling && (now.levelling?.level ?? 0) > was.levelling.level;
  return [
    ...(chapter ? [{ name: 'chapter' } as const] : []),
    ...(level ? [{ name: 'level' } as const] : []),
    ...questCues(now, was),
    ...combatCues(now, was),
    ...skillCues(now, was),
    ...itemCues(now, was),
    ...statusCues(now, was),
    ...(was.place.id !== now.place.id ? [{ name: 'place' } as const] : []),
  ];
}
