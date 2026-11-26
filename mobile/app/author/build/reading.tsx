// The notebook's Tools readers (slice 6.2b): State, Why and Step, as the panel's reading.tsx and
// steptab.tsx. They read panel.tsx's state and trace (placeHooks) and ask the watcher's POST
// /__author/why; none changes the game. Numbers is numbers.tsx, drawn with the line helpers here.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import {
  changedFacts,
  changedQuests,
  looked,
  lookedLine,
  pairViews,
  type Paired,
  type Report as Stepped,
} from '../../../../kernel/ts/play/step.ts';
import type { Row as Told } from '../../../../kernel/ts/play/why_words.ts';
import { space, type } from '../../book/tokens.ts';
import { clockWords, type shown } from '../shown.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, row } from './roomedit.tsx';
import { act } from './sheet.tsx';

// Placeholders: the owner writes the words.
export const WORDS = {
  tabs: ['State', 'Why', 'Step'],
  noBook: 'No Book yet',
  room: 'Room',
  people: 'People',
  held: 'Held',
  pools: 'Pools',
  statuses: 'Statuses',
  clock: 'Clock',
  choice: (prompt: string) => `Choice: ${prompt}`,
  quests: 'Quests',
  facts: 'Facts',
  unset: 'unset',
  byDefault: ' (default)',
  whyHere: 'Why, in this room',
  noOffers: 'No actions or dialogues here.',
  answer: (ok: Told['ok']) => (ok === 'depends' ? 'depends on the target' : ok ? 'yes' : 'no'),
  firstStep: 'Take a step in the Book first.',
  offPast: (n: number) =>
    `Why is off past ${n} steps; jump to a checkpoint. The replay re-runs the whole path each step.`,
  step: (n: number, told?: Stepped) =>
    `Step ${n}${told ? ` · ${told.command} ${told.outcome}` : ''}`,
  asked: (ms: number, slow: boolean) => `asked in ${ms} ms${slow ? ' (slow)' : ''}`,
  factsChanged: (n: number) => `Facts changed (${n})`,
  questsChanged: (n: number) => `Quests changed (${n})`,
  rulesLooked: (n: number) => `Rules that looked (${n})`,
  none: 'none',
  noneMatched: 'none matched',
  asking: 'asking…',
};
const BUDGET = 400; // steps: past this the replay's cost is the story (the panel's steptab.tsx)
const SLOW_MS = 2000; // a report slower than this says slow; it is not hidden

/** panel.tsx's stateOf, the fields read here. */
export type State = {
  hash: string;
  steps: readonly unknown[];
  facts: { row: string; key: string; value?: unknown; set?: boolean }[];
  shown: ReturnType<typeof shown>;
};
/** What placeHooks hands in for the readers: the panel's state message and the game's trace. */
export type Reader = { state: () => State; game: { trace: () => string[] } };

type Tone = 'fg' | 'dim' | 'danger';
type Line = { text: string; tone?: Tone; head?: boolean; depth?: number };
export const head = (text: string): Line => ({ text, head: true });
export const dim = (text: string): Line => ({ text, tone: 'dim' });
export const danger = (text: string): Line => ({ text, tone: 'danger' });
export const draw = (rows: (Line | ReactNode)[]) =>
  rows.map((r, i) =>
    r && typeof r === 'object' && 'text' in r ? (
      <View
        key={`read ${i}`}
        style={{ ...row, paddingLeft: space.md * (1 + (r.depth ?? 0)) /* mutate-skip: layout */ }}
      >
        <Text
          style={
            r.head ? { ...type.label, color: ink('dim') } : { ...inRow, color: ink(r.tone ?? 'fg') }
          }
        >
          {r.text}
        </Text>
      </View>
    ) : (
      r
    ),
  );
const listed = (title: string, items: string[]) => [
  head(title),
  ...items.map((t) => ({ text: t })),
  ...(items.length ? [] : [dim(WORDS.none)]),
];
export const cols = (rows: string[][]) =>
  rows.map((r, i) => (i ? { text: r.join(' · ') } : dim(r.join(' · '))));

const ask = (sent: object) =>
  fetch('/__author/why', { method: 'POST', body: JSON.stringify(sent) }).then(async (r) => ({
    ok: r.ok,
    told: (await r.json()) as unknown,
  }));

/** The game as the view shows it now, then facts and quests as the kernel holds them. */
function stateRows({ shown, facts }: State) {
  return [
    head(WORDS.room),
    { text: shown.room },
    ...listed(WORDS.people, shown.people),
    ...listed(WORDS.held, shown.held),
    ...listed(
      WORDS.pools,
      shown.pools.map((p) => `${p.key} ${p.current}/${p.maximum} ${p.band}`),
    ),
    ...listed(
      WORDS.statuses,
      shown.statuses.map((s) => s.label),
    ),
    head(WORDS.clock),
    { text: clockWords(shown.clock) },
    ...(shown.choice ? listed(WORDS.choice(shown.choice.prompt), shown.choice.options) : []),
    ...listed(
      WORDS.quests,
      shown.quests.map((q) => `${q.quest} ${q.state}`),
    ),
    ...listed(
      WORDS.facts,
      facts.map(
        (f) =>
          `${f.key}: ${f.value === undefined ? WORDS.unset : `${JSON.stringify(f.value)}${f.set ? '' : WORDS.byDefault}`}`,
      ),
    ),
  ];
}

const toldLine = (l: Told) => ({
  text: `${WORDS.answer(l.ok)}: ${l.text}`,
  tone: l.ok === false ? ('danger' as const) : undefined,
  depth: l.depth,
});
let why: { at: string; key: string; lines?: Told[]; error?: string } | undefined;
/** Why an action or dialogue of this room is or is not on offer now (kernel/ts/play/why.ts). */
function whyRows(g: Reader, state: State) {
  const at = JSON.stringify(state);
  const told = why?.at === at ? why : undefined; // true of the world it was asked on, no other
  const pick = (on: 'action' | 'dialogue') => (key: string) =>
    act(
      key,
      () =>
        void Promise.resolve()
          .then(() => ask({ trace: g.game.trace(), [on]: key }))
          .then(
            (r) =>
              r.ok
                ? { at, key, lines: (r.told as { lines: Told[] }).lines }
                : { at, key, error: String(r.told) },
            (err: Error) => ({ at, key, error: err.message }),
          )
          .then((t) => ((why = t), known.redraw())),
      undefined,
      `${on} ${key}`,
      told?.key === key,
    );
  const { action, dialogue } = state.shown.offers;
  return [
    head(WORDS.whyHere),
    action.length || dialogue.length ? (
      <View key="offers" style={row}>
        {[...action.map(pick('action')), ...dialogue.map(pick('dialogue'))]}
      </View>
    ) : (
      dim(WORDS.noOffers)
    ),
    ...(told?.error ? [danger(told.error)] : []),
    ...(told?.lines ? [head(told.key), ...told.lines.map(toldLine)] : []),
  ];
}

let views: Paired = {};
let report: { at: string; told?: Stepped; ms?: number; error?: string } | undefined;
let asked = ''; // the step the report was asked for, once each
const atOf = (s: State) => `${s.hash}:${s.steps.length}`;
/** Folds the game's state into the before/after pair; tools.tsx `updated` calls it on every update. */
export function stepped(g: Reader | undefined) {
  const s = g?.state();
  if (!s) return;
  views = pairViews(views, atOf(s), { facts: s.facts, quests: s.shown.quests });
}
function askStep(g: Reader, at: string) {
  if (asked === at) return;
  asked = at;
  const began = performance.now();
  void Promise.resolve()
    .then(() => ask({ trace: g.game.trace() }))
    .then(
      (r) =>
        r.ok
          ? { at, told: r.told as Stepped, ms: Math.round(performance.now() - began) }
          : { at, error: String(r.told) },
      (err: Error) => ({ at, error: err.message }),
    )
    .then((t) => ((report = t), known.redraw()));
}
/** What the last step changed, and every rule whose trigger matched it. */
function stepRows(g: Reader, state: State) {
  const ordinal = state.steps.length;
  if (!ordinal) return [dim(WORDS.firstStep)];
  if (ordinal > BUDGET) return [dim(WORDS.offPast(BUDGET))];
  const at = atOf(state);
  askStep(g, at);
  const told = report?.at === at ? report : undefined;
  const value = (v: unknown) => (v === null || v === undefined ? WORDS.unset : JSON.stringify(v));
  const facts = changedFacts(views.before, views.after);
  const quests = changedQuests(views.before, views.after);
  const rules = looked(told?.told);
  return [
    head(WORDS.step(ordinal, told?.told)),
    ...(told?.error ? [danger(told.error)] : []),
    ...(told?.ms === undefined ? [] : [dim(WORDS.asked(told.ms, told.ms > SLOW_MS))]),
    head(WORDS.factsChanged(facts.length)),
    ...facts.map((f) => ({ text: `${f.key} ${value(f.from)} → ${value(f.to)}` })),
    ...(facts.length ? [] : [dim(WORDS.none)]),
    head(WORDS.questsChanged(quests.length)),
    ...quests.map((q) => ({ text: `${q.quest} ${q.from} → ${q.to}` })),
    ...(quests.length ? [] : [dim(WORDS.none)]),
    head(WORDS.rulesLooked(rules.length)),
    ...rules.map((x) => {
      const line = lookedLine(x);
      return {
        text: `${x.rule} ${line.text}`,
        tone: line.ok === false ? ('danger' as const) : undefined,
      };
    }),
    ...(rules.length ? [] : [dim(told?.told ? WORDS.noneMatched : WORDS.asking)]),
  ];
}

/** The rows of the reader named `tab` (a WORDS.tabs entry), for this game. */
export function readRows(tab: string, g: Reader | undefined) {
  const state = g?.state();
  if (!g || !state) return draw([dim(WORDS.noBook)]);
  const [, whyTab, stepTab] = WORDS.tabs;
  return draw(
    tab === whyTab ? whyRows(g, state) : tab === stepTab ? stepRows(g, state) : stateRows(state),
  );
}
