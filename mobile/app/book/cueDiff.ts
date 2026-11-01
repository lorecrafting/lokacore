// The pure diff of two GameViews into named cues (book-ui.md, Effects, sound and haptics; Queue).
import type { GameView, NarrationRecord } from '../../packages/game-view/session.ts';
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
    ...named('quest_on', quests('active', true), was.journal.length ? undefined : { first: true }),
  ];
};

// A blow dealt moves a band, or fells one of a pack; same encounter only (book-ui.md, Fight music).
function dealtCues(now: GameView, was: GameView): Cue[] {
  const [a, b] = [now.combat, was.combat];
  if (!a || !b || a.encounter_id !== b.encounter_id) return [];
  const foes = (c: typeof a) => c.active_opponents ?? [{ id: c.opponent_id, band: c.band }];
  const before = foes(b);
  const ids = foes(a)
    .filter((o) => before.some((p) => p.id === o.id && p.band !== o.band))
    .map((o) => o.id);
  return ids.length || foes(a).length < before.length ? [{ name: 'blow_dealt', ids }] : [];
}

const FIGHT_ENDS = (now: GameView, was: GameView) =>
  was.place.id !== now.place.id
    ? 'fled'
    : !now.entities.some((e) => e.id === was.combat!.opponent_id)
      ? 'fell'
      : 'quiet';

function combatCues(now: GameView, was: GameView, died: boolean) {
  const out: Cue[] = [];
  // Status ticks are silent (owner rule), so only a fall in combat beyond them is a blow (plan 3.3).
  // ponytail: the last tick of a status that just ended still thuds; the view no longer shows it.
  const loss = -moved(now, was, 'hp') - ticked(now, was);
  // A death restores hp before the view shows it, so the fatal blow is known from the fact alone.
  if ((loss > 0 || (died && was.combat)) && (now.combat || was.combat))
    out.push({ name: 'hp_loss', loss: Math.max(loss, 0) });
  if (died) return [...out, { name: 'death', fight: !!was.combat } as const];
  if (!was.combat && now.combat) out.push({ name: 'combat_open' });
  if (was.combat && !now.combat) out.push({ name: 'combat_close', end: FIGHT_ENDS(now, was) });
  return [...out, ...dealtCues(now, was)];
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
    ...named('pickup', got, {
      ...(pennies < 0 && { silent: true as const }),
      ...(!held.size && { first: true as const }),
    }),
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

// Only a press's own events (the record's), so a barrier the world moved is silent; the record tells them apart.
function deedCues(now: GameView, was: GameView, deed?: NarrationRecord): Cue[] {
  if (!deed) return [];
  const usable = (v: GameView) => v.exits.filter((e) => e.available).map((e) => e.direction);
  const newly = usable(now).some((d) => !usable(was).includes(d));
  return [
    ...(deed.missed ? [{ name: 'miss' } as const] : []),
    ...(deed.lever ? [{ name: 'lever' } as const] : []),
    ...(deed.opened && newly && now.place.id === was.place.id ? [{ name: 'latch' } as const] : []),
  ];
}

/** What changed from `was` to `now`, the story's first. No `was` (a first view, a catch-up) is silent. */
// A move by travel, on a plain page: its turn riffles (book-ui.md, Page life). A chapter card takes the page.
// A press that killed (a due job can) arrives by death, not by travel.
export const riffles = (command: string | undefined, was: GameView, now: GameView, died = false) =>
  !died &&
  command === 'expedition' &&
  was.place.id !== now.place.id &&
  !now.combat &&
  !now.scene &&
  (!now.chapter || was.chapter?.index === now.chapter.index);

export function cuesOf(
  now: GameView,
  was: GameView | undefined,
  died = false,
  deed?: NarrationRecord,
): Cue[] {
  if (!was) return [];
  const chapter = now.chapter && was.chapter?.index !== now.chapter.index;
  const level = was.levelling && (now.levelling?.level ?? 0) > was.levelling.level;
  const combat = combatCues(now, was, died);
  return [
    ...(chapter ? [{ name: 'chapter' } as const] : []),
    ...(level
      ? [{ name: 'level', ...(was.levelling!.level === 1 && { first: true as const }) } as const]
      : []),
    ...questCues(now, was),
    ...combat,
    ...deedCues(now, was, deed),
    ...skillCues(now, was),
    ...itemCues(now, was),
    ...statusCues(now, was),
    ...(was.place.id !== now.place.id ? [{ name: 'place' } as const] : []),
  ];
}
