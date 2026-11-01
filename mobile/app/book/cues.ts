// size: allow 305, the bus reads as one: cue table, view diff, severity queue, subscription
// The effects cue bus (book-ui.md, Effects, sound and haptics; Queue): a pure diff of two GameViews
// into named cues, a pure severity queue over them, and a subscription for the effects to come.
import { useEffect, useRef } from 'react';
import type { GameView } from '../../packages/game-view/session.ts';
import type { SoundName } from './sound';
import { mix, motion, sound } from './tokens.ts';

// Each cue's severity (S1 free, S2 coalesced, S3 one playing and one pending, S4 clears) and sound; the
// haptic is that sound's (tokens.ts). No sound: book-ui.md Event sounds names none for these.
const CUES = {
  pickup: { s: 2, sound: 'pickup' },
  coin: { s: 2, sound: 'coin' },
  hp_loss: { s: 3, sound: 'blow' },
  status_in: { s: 2, sound: 'tick' }, // only when it hurts (statusCues)
  status_out: { s: 1 },
  quest_on: { s: 2, sound: 'questGained' },
  quest_resolved: { s: 3, sound: 'questDone' },
  quest_fail: { s: 2, sound: 'questFailed' },
  level: { s: 3, sound: 'level' },
  skill_learned: { s: 2, sound: 'skillNew' },
  skill_up: { s: 2, sound: 'skillUp' },
  chapter: { s: 4, sound: 'chapter' },
  place: { s: 1 },
  combat_open: { s: 3 },
  combat_close: { s: 3 },
} satisfies Record<string, { s: 1 | 2 | 3 | 4; sound?: SoundName }>; // mutate-skip: a type

export type CueName = keyof typeof CUES;
/** `ids`: what the cue names (items, skills, quests, status labels). `silent`: effects, no sound. `wash: false`: the Flash limit. */
export type Cue = { name: CueName; ids?: string[]; silent?: true; loss?: number; wash?: boolean };

export const soundOf = (cue: Cue): SoundName | undefined =>
  cue.silent ? undefined : (CUES[cue.name] as { sound?: SoundName }).sound;

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

const questCues = (now: GameView, was: GameView) => {
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

export type Queue = {
  card?: boolean; // an S4 holds the queue until `until` or the page turning away
  playing?: Cue;
  until: number; // when `playing` or the card ends
  pending?: Cue;
  merged: Record<string, number>; // when each S2 last fired
  toned: number; // when skill_up last sounded
  washed: number; // when an hp_loss last washed
  held: Cue[]; // the arriving page's, until its picture deadline
  heldUntil: number;
};
// mutate-skip: until is unread before a play or card sets it
export const QUIET: Queue = {
  until: 0,
  merged: {},
  toned: -Infinity,
  washed: -Infinity,
  held: [],
  heldUntil: -Infinity,
};

// An S3 holds for the severity's 500 ms budget, which the blow wash fills.
const BEAT = motion.flash.duration + motion.flash.out;
// An S2: coalesced by key; a cue already fired gains no ids, so effects read the first view's.
// skill_up past its limit keeps its gilt and loses its tone.
function small(s: Queue, cue: Cue, now: number): Cue[] {
  const key = cue.silent ? `${cue.name} silent` : cue.name; // a silent one never swallows a heard one
  if (now - (s.merged[key] ?? -Infinity) < mix.coalesce) return [];
  s.merged[key] = now;
  if (cue.name !== 'skill_up') return [cue];
  if (now - s.toned < sound.skillUp.gap) return [{ ...cue, silent: true }];
  s.toned = now;
  return [cue];
}

// Cues of one small key waiting together are one cue, with all their ids, silent only if all are.
const gathered = (cues: Cue[]) =>
  cues.reduce<Cue[]>((out, cue) => {
    const i = CUES[cue.name].s === 2 ? out.findIndex((o) => o.name === cue.name) : -1;
    if (i < 0) return [...out, cue];
    const { silent, ...first } = out[i]!;
    const ids = [...(first.ids ?? []), ...(cue.ids ?? [])];
    out[i] = silent && cue.silent ? { ...first, ids, silent } : { ...first, ids };
    return out;
  }, []);

const holdCard = (q: Queue, now: number): Queue => ({
  ...q,
  card: true,
  playing: undefined,
  pending: undefined,
  until: now + motion.card.duration,
});

/**
 * One moment of the queue: `turned` cancels the leaving page's effects, and the arriving page's cues
 * wait for its picture deadline (book-ui.md, Queue).
 * A later S3 of another key than the pending one is dropped; the diff lists the story's first.
 */
export function step(q: Queue, arriving: Cue[], now: number, turned = false) {
  const s: Queue = turned
    ? { ...q, card: false, playing: undefined, pending: undefined }
    : { ...q };
  s.merged = { ...q.merged };
  const fired: Cue[] = [];
  s.held = [...(turned ? [] : q.held), ...arriving];
  if (turned) s.heldUntil = now + motion.quick.duration;
  if (now < s.heldUntil) return { q: s, fired };
  const cues = gathered(s.held);
  s.held = [];
  const chapter = cues.find((c) => CUES[c.name].s === 4);
  if (s.card && now < s.until) return { q: s, fired };
  s.card = false;
  if (chapter) return { q: holdCard(s, now), fired: [chapter] };
  const play = (cue: Cue) => {
    const wash = flashes && cue.name === 'hp_loss' && now - s.washed >= motion.flash.gap;
    if (wash) s.washed = now;
    s.playing = cue;
    s.until = now + BEAT;
    fired.push(cue.name === 'hp_loss' ? { ...cue, wash } : cue);
  };
  if (s.playing && s.until <= now) {
    const next = s.pending;
    s.playing = s.pending = undefined;
    if (next) play(next);
  }
  for (const cue of cues) {
    const severity = CUES[cue.name].s;
    if (severity === 1) fired.push(cue);
    else if (severity === 3) {
      if (!s.playing) play(cue);
      else if (!s.pending || s.pending.name === cue.name) s.pending = cue;
    } else fired.push(...small(s, cue, now));
  }
  return { q: s, fired };
}

let flashes = true;
/** The Flashes setting: off, no blow is a wash; the rest of the cue stays. */
export const flashesOn = (on: boolean) => void (flashes = on);

const listeners = new Set<(cue: Cue) => void>();
export let curlEnds = -Infinity; // at the latest: a curl starts by the picture deadline
export const onCue = (listener: (cue: Cue) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

// Feeds the queue from each new view and page turn. A first view is silent, and catch-up to its end:
// the first view after it diffs against nothing.
export function useCues(view: GameView, catchingUp: boolean, turn: number, resumes = 0) {
  const queue = useRef(QUIET);
  const seen = useRef(turn);
  const back = useRef(resumes);
  const settled = useRef<GameView>(undefined);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const advance = (cues: Cue[], turned = false) => {
      if (turned) curlEnds = performance.now() + motion.quick.duration + motion.turn.duration;
      const { q, fired } = step(queue.current, cues, performance.now(), turned);
      queue.current = q;
      for (const cue of fired) for (const listener of listeners) listener(cue);
      // A timer can land a little early: it waits again rather than strand the pending cue.
      const due = q.held.length ? q.heldUntil : q.pending ? q.until : undefined;
      if (due !== undefined) timer = setTimeout(() => advance([]), due - performance.now());
    };
    // An absence is no event: what a resume settled, however fast, is heard as nothing.
    const away = catchingUp || resumes !== back.current;
    advance(cuesOf(view, away ? undefined : settled.current), turn !== seen.current);
    seen.current = turn;
    back.current = resumes;
    settled.current = catchingUp ? undefined : view;
    return () => clearTimeout(timer);
  }, [view, catchingUp, turn, resumes]);
}
