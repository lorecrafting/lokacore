// The effects cue bus (book-ui.md, Effects, sound and haptics; Queue): a pure severity queue over
// the view diff's cues (cueDiff.ts), and a subscription for the effects to come.
import { useEffect, useRef } from 'react';
import type { GameView } from '../../packages/game-view/session.ts';
import { cuesOf, questCues } from './cueDiff.ts';
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
  // Fight music must hear every opening and close, so these never queue: useCues sends them straight.
  combat_open: { s: 1 },
  combat_close: { s: 1 },
  blow_dealt: { s: 2, sound: 'impact' },
  death: { s: 4 }, // the player's, from the receipt: its haptic and cut are playCue's
} satisfies Record<string, { s: 1 | 2 | 3 | 4; sound?: SoundName }>; // mutate-skip: a type

export type CueName = keyof typeof CUES;
/** `ids`: what the cue names (items, skills, quests, status labels). `silent`: effects, no sound. `wash: false`: the Flash limit. */
export type Cue = {
  name: CueName;
  ids?: string[];
  silent?: true;
  loss?: number;
  wash?: boolean;
  fight?: boolean; // death: in a fight
  end?: 'fell' | 'fled' | 'quiet'; // combat_close
  resumed?: true; // combat_open, combat_close: found on a first view, nothing happening now
  first?: true; // pickup, quest_on, level: the playthrough's first (book-ui.md, First times)
};

export const soundOf = (cue: Cue): SoundName | undefined =>
  cue.silent ? undefined : (CUES[cue.name] as { sound?: SoundName }).sound;

export { cuesOf };

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
    const { silent, ...rest } = out[i]!;
    const merged = { ...rest, ...(cue.first && { first: true as const }) };
    const ids = [...(rest.ids ?? []), ...(cue.ids ?? [])];
    out[i] = silent && cue.silent ? { ...merged, ids, silent } : { ...merged, ids };
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
function play(s: Queue, fired: Cue[], cue: Cue, now: number) {
  const wash = flashes && cue.name === 'hp_loss' && now - s.washed >= motion.flash.gap;
  if (wash) s.washed = now;
  s.playing = cue;
  s.until = now + BEAT;
  fired.push(cue.name === 'hp_loss' ? { ...cue, wash } : cue);
}

// A death waits for nothing (book-ui.md, Falling). It clears what is pending; a thud sounding plays on.
function fall(s: Queue, death: Cue, now: number) {
  const fired: Cue[] = [];
  const blow = s.held.filter((c) => c.name === 'hp_loss').at(-1); // the fatal one, not an older one
  s.held = [];
  s.card = false;
  s.playing = s.pending = undefined;
  s.heldUntil = -Infinity;
  if (blow) play(s, fired, blow, now);
  return [...fired, { ...death, wash: !!fired[0]?.wash }];
}

export function step(q: Queue, arriving: Cue[], now: number, turned = false) {
  const s: Queue = turned
    ? { ...q, card: false, playing: undefined, pending: undefined }
    : { ...q };
  s.merged = { ...q.merged };
  const fired: Cue[] = [];
  s.held = [...(turned ? [] : q.held), ...arriving];
  const death = s.held.find((c) => c.name === 'death');
  if (death) return { q: s, fired: fall(s, death, now) };
  if (turned) s.heldUntil = now + motion.quick.duration;
  if (now < s.heldUntil) return { q: s, fired };
  const cues = gathered(s.held);
  s.held = [];
  const chapter = cues.find((c) => c.name === 'chapter');
  if (s.card && now < s.until) return { q: s, fired };
  s.card = false;
  if (chapter) return { q: holdCard(s, now), fired: [chapter] };
  if (s.playing && s.until <= now) {
    const next = s.pending;
    s.playing = s.pending = undefined;
    if (next) play(s, fired, next, now);
  }
  for (const cue of cues) {
    const severity = CUES[cue.name].s;
    if (severity === 1) fired.push(cue);
    else if (severity === 3) {
      if (!s.playing) play(s, fired, cue, now);
      else if (!s.pending || s.pending.name === cue.name) s.pending = cue;
    } else fired.push(...small(s, cue, now));
  }
  return { q: s, fired };
}

let flashes = true;
/** The Flashes setting: off, no blow is a wash; the rest of the cue stays. */
export const flashesOn = (on: boolean) => void (flashes = on);

// Quests resolved since the Journal last opened; its gilt waits for the visit. Read off the views:
// the queue can drop the cue and a resume never sends it. A reload forgets them.
export const unreadResolved = new Set<string>();
const noteResolved = (now: GameView, was: GameView) =>
  questCues(now, was)
    .find((c) => c.name === 'quest_resolved')
    ?.ids?.forEach((id) => unreadResolved.add(id));

const listeners = new Set<(cue: Cue) => void>();
const send = (cue: Cue) => {
  for (const listener of listeners) listener(cue);
};
// One action, one paper sound (owner, 2026-10-31): a take's flick stands for its page turn.
const flicks = (cue: Cue) => cue.name === 'pickup' && !cue.silent;
export let curlEnds = -Infinity; // at the latest: a curl starts by the picture deadline
export const curlFor = (ms: number) => void (curlEnds = performance.now() + ms); // a riffle's length
export const onCue = (listener: (cue: Cue) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

// Feeds the queue from each new view and page turn. A first view is silent, and catch-up to its end:
// the first view after it diffs against nothing.
// Plays what arrived and says when to look again, if anything waits.
function deliver(
  queue: { current: Queue },
  cues: Cue[],
  turned: boolean,
  reduced: boolean,
  onTurn?: () => void,
) {
  // No curl to feel through under reduced motion, or for a chapter card, which does not curl in.
  if (turned && !reduced && !cues.some((cue) => cue.name === 'chapter'))
    curlEnds = performance.now() + motion.quick.duration + motion.turn.duration;
  const fight = (cue: Cue) => cue.name === 'combat_open' || cue.name === 'combat_close';
  for (const cue of cues.filter(fight)) send(cue);
  const { q, fired } = step(
    queue.current,
    cues.filter((cue) => !fight(cue)),
    performance.now(),
    turned,
  );
  queue.current = q;
  if (turned && !cues.some(flicks)) onTurn?.();
  for (const cue of fired) send(cue);
  // A timer can land a little early: it waits again rather than strand the pending cue.
  return q.held.length ? q.heldUntil : q.pending ? q.until : undefined;
}

// A fight found or gone on a first view is no event, but its music still follows it.
const foundFight = (view: GameView, fought: boolean): Cue[] =>
  !!view.combat !== fought
    ? [{ name: view.combat ? 'combat_open' : 'combat_close', resumed: true }]
    : [];

export function useCues(
  view: GameView,
  catchingUp: boolean,
  turn: number,
  resumes = 0,
  reduced = false,
  onTurn?: () => void,
  died?: string,
) {
  const queue = useRef(QUIET);
  const seen = useRef(turn);
  const back = useRef(resumes);
  const settled = useRef<GameView>(undefined);
  const last = useRef<GameView>(undefined);
  const fell = useRef(died);
  const fought = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const advance = (cues: Cue[], turned = false) => {
      const due = deliver(queue, cues, turned, reduced, onTurn);
      if (due !== undefined) timer = setTimeout(() => advance([]), due - performance.now());
    };
    if (last.current) noteResolved(view, last.current);
    last.current = view;
    // An absence is no event: what a resume settled, however fast, is heard as nothing.
    const away = catchingUp || resumes !== back.current;
    const was = away ? undefined : settled.current;
    const fresh = !!died && died !== fell.current;
    advance(
      [...(was ? [] : foundFight(view, fought.current)), ...cuesOf(view, was, fresh)],
      turn !== seen.current,
    );
    fell.current = died;
    fought.current = !!view.combat;
    seen.current = turn;
    back.current = resumes;
    settled.current = catchingUp ? undefined : view;
    return () => clearTimeout(timer);
  }, [view, catchingUp, turn, resumes, reduced, died]);
}
