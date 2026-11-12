// What one seeded random walk reaches and whether it breaks (docs/design/story-tooling.md §2b W1),
// split from roam.ts to keep both files under the size limit.
import type { GameView } from '../src/contracts.gen.ts';
import { refString } from '../src/runtime/decision.ts';
import { gen } from '../test/sim.ts';
import {
  frozenClock,
  replay,
  type Replayable,
  type Step,
} from '../../../mobile/app/author/place.ts';
import { DatabaseSync } from 'node:sqlite';
import {
  KERNEL_ID,
  openGame,
  type Bundled,
} from '../../../mobile/authority/local-story/session.ts';
import type { Db } from '../../../mobile/authority/local-story/store.ts';
import { presses } from './press.ts';

/** A save in memory on the same SQLite the host uses (as check.ts). */
function memory(sql: DatabaseSync): Db {
  return {
    execSync: (q) => sql.exec(q),
    runSync: (q, ...p) => sql.prepare(q).run(...p),
    getFirstSync: <T>(q: string, ...p: (string | number | null)[]) =>
      (sql.prepare(q).get(...p) ?? null) as T | null,
    getAllSync: <T>(q: string, ...p: (string | number | null)[]) => sql.prepare(q).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
}

/** One game over a private in-memory save, closed by the caller. */
export function opened(bundled: Bundled) {
  const sql = new DatabaseSync(':memory:');
  let ids = 0;
  let moved = 0;
  const game = openGame(memory(sql), bundled, {
    kernel_version: `${KERNEL_ID}@${'0'.repeat(40)}`,
    newId: () => `aaaaaaaa-0000-4000-8000-${(++ids).toString().padStart(12, '0')}`, // mutate-skip: any unique id
    time: frozenClock(() => moved),
    dev: true,
  });
  return { game: game as Replayable & typeof game, move: (ms: number) => (moved += ms), sql };
}

const MARK = /^coverage\.m(\d+)$/;

/** What one seeded walk reached, and whether it broke. */
export type Run = {
  seed: number;
  steps: Step[];
  reactions: string[];
  choices: string[];
  quests: string[];
  scenes: string[];
  points: string[];
  broke?: { at: number; why: string };
};

/** What a verb that needs one of these can be given, from the page the player is on. */
const fillers = (view: GameView): Record<string, unknown[]> => ({
  word: (view.spell_words ?? []).map((w) => w.word).filter((w) => typeof w === 'string'),
  topic: (view.topics ?? []).map((t) => t.key).filter((t) => typeof t === 'string'),
  answer: [], // a riddle's answer is authored prose: no honest way to sample it
  attribute: Object.keys(view.attributes ?? {}),
  service: (view.entities ?? []).flatMap((e) => (e.services ?? []).map((sv) => sv.key)),
});

/** What a reply means to a random player: keep pressing (accepted), try another button (a refusal
 * costs nothing), or stop and keep the path (a fault or a crash is a bug found, and the steps up to it
 * are what `bin/loka check` then replays). */
export type Verdict = 'press' | 'skip' | 'break';
export function verdictOf(reply: { kind: string; decision?: { kind: string } }): Verdict {
  if (reply.kind !== 'saved') return 'skip'; // pending, refused, or a write that threw
  const kind = reply.decision?.kind;
  if (kind === 'accepted') return 'press';
  if (kind === 'fault') return 'break';
  return 'skip'; // rejected: the authority said no, which is not a bug
}

/** A fault's own words for the report, with the code the kernel named. */
function faultWhy(reply: { decision?: { code?: string } }): string {
  return `fault ${reply.decision?.code ?? 'unnamed'}`;
}

/** One seeded walk of `steps` presses; the marker keys and rows it reached, or the step it broke at. */
function walk(bundled: Bundled, seed: number, steps: number): Run {
  const g = gen(seed);
  const run: Run = {
    seed,
    steps: [],
    reactions: [],
    choices: [],
    quests: [],
    scenes: [],
    points: [],
  };
  const open = opened(bundled);
  const seen = {
    reactions: new Set<string>(),
    choices: new Set<string>(),
    quests: new Set<string>(),
    scenes: new Set<string>(),
    points: new Set<string>(),
  };
  try {
    for (let n = 0; n < steps; n++) if (!oneStep(run, open, seen, g)) break;
  } catch (e) {
    run.broke = { at: run.steps.length, why: (e as Error).message };
  } finally {
    open.sql.close();
  }
  return done(run, seen);
}

/** One step of the walk: press the first button the authority accepts, recording what it reached.
 * Returns false when the page offers nothing admitted, which ends the run. */
function oneStep(
  run: Run,
  open: ReturnType<typeof opened>,
  seen: Record<string, Set<string>>,
  g: Gen,
) {
  const { view } = open.game.view();
  if (view.scene) seen.scenes!.add(refString(view.scene.scene));
  const row = view.choice;
  for (const intent of presses(view, open.game, g)) {
    run.steps.push({ intent: intent as never });
    const reply = open.game.invoke(intent as never) as {
      decision?: { narration?: { key: string }[]; events: { payload: Record<string, unknown> }[] };
    };
    const verdict = verdictOf(reply as never);
    if (verdict === 'break') {
      run.broke = { at: run.steps.length - 1, why: faultWhy(reply as never) };
      return false;
    }
    if (verdict === 'skip') {
      run.steps.pop();
      continue;
    }
    record(open, seen, reply, row);
    return true;
  }
  return false;
}

/** What an accepted step reached, folded into the sets the report counts. */
function record(
  open: ReturnType<typeof opened>,
  seen: Record<string, Set<string>>,
  reply: {
    decision?: { narration?: { key: string }[]; events: { payload: Record<string, any> }[] };
  },
  row: { continuation_id: string } | undefined,
) {
  for (const said of reply.decision?.narration ?? [])
    if (MARK.test(said.key)) seen.reactions!.add(said.key);
  for (const { payload: p } of reply.decision?.events ?? []) {
    if (p.type === 'quest_resolved') seen.quests!.add(refString(p.quest));
    if (p.type === 'story_point_reached') seen.points!.add(refString(p.story_point));
    if (p.type !== 'choice_resolved' || row === undefined) continue;
    const dialogue = open.game.dialogueOf(row.continuation_id);
    if (dialogue !== undefined) seen.choices!.add(`${dialogue}#${p.choice_id}`);
  }
}

/** The run with what it saw folded in as sorted arrays. */
function done(run: Run, seen: Record<string, Set<string>>) {
  return {
    ...run,
    reactions: [...seen.reactions!],
    choices: [...seen.choices!],
    quests: [...seen.quests!],
    scenes: [...seen.scenes!],
    points: [...seen.points!],
  };
}

/** `steps` again, keeping only those that still break it (greedy deletion, as sim.ts shrinks). A
 * refusal is not a break: replay reports one as `failed` with `refused` set, and a random player
 * meets refusals constantly — only a crash, a `fault` reply or a broken invariant is worth saving. */
export function shrinkSteps(bytes: Bundled, steps: Step[]): Step[] {
  const fails = (s: Step[]) => {
    const open = opened(bytes);
    try {
      const out = replay(s, open.game, open.move, undefined);
      return out !== undefined;
    } finally {
      open.sql.close();
    }
  };
  let kept = [...steps];
  for (let i = kept.length - 1; i >= 0; i--) {
    const without = kept.filter((_, n) => n !== i);
    if (fails(without)) kept = without;
  }
  return kept;
}

/** Every seeded walk of one compiled cartridge, seeded `seed .. seed + runs - 1`. */
export function roamBytes(
  bytes: Bundled,
  content: { cartridge: Cartridge; marked: Cartridge },
  seed: number,
  runs: number,
  steps: number,
) {
  const started = Date.now();
  const walked = Array.from({ length: runs }, (_, i) => walk(bytes, seed + i, steps));
  const { never, choices, everyChoice } = gathered(walked, content);
  return {
    milliseconds: Date.now() - started,
    broke: walked
      .filter((r): r is Run & { broke: { at: number; why: string } } => r.broke !== undefined)
      .map((r) => ({ seed: r.seed, at: r.broke.at, why: r.broke.why, steps: r.steps })),
    never: {
      reactions: never,
      choices: everyChoice.filter((x) => !choices.includes(x)),
      quests: Object.keys(content.cartridge.quests ?? {})
        .filter((q) => !walked.some((r) => r.quests.includes(q)))
        .sort(),
      scenes: Object.keys(content.cartridge.scenes ?? {})
        .filter((sc) => !walked.some((r) => r.scenes.includes(sc)))
        .sort(),
      story_points: Object.keys(content.cartridge.story_points ?? {})
        .filter((sp) => !walked.some((r) => r.points.includes(sp)))
        .sort(),
    },
    reached: {
      reactions: tally(walked.flatMap((r) => r.reactions.map((k) => ruleOf(content, k)))),
      choices: tally(choices),
      quests: tally(walked.flatMap((r) => r.quests)),
      scenes: tally(walked.flatMap((r) => r.scenes)),
      story_points: tally(walked.flatMap((r) => r.points)),
    },
    runsWalked: walked,
  };
}

/** What no walk reached, and every row a walk did, from the walks' own records. */
function gathered(walked: Run[], content: { cartridge: Cartridge; marked: Cartridge }) {
  const hit = new Set(walked.flatMap((r) => r.reactions.map((k) => ruleOf(content, k) ?? '')));
  const never = Object.keys(content.cartridge.reactions ?? {})
    .filter((r) => !hit.has(r))
    .sort();
  const everyChoice = Object.entries(content.cartridge.dialogues ?? {})
    .flatMap(([d, def]) => Object.keys(def.choices).map((ch) => `${d}#${ch}`))
    .sort();
  const bare = new Map(
    Object.keys(content.cartridge.dialogues ?? {}).map((ref) => [ref.split('/').pop()!, ref]),
  );
  const choices = walked.flatMap((r) =>
    r.choices.map((c) => {
      const [d, ch] = c.split('#');
      return `${bare.get(d!) ?? d!}#${ch}`;
    }),
  );
  return { never, choices, everyChoice };
}

/** A marker key back to the reaction it marks, or the marker itself when no rule owns it. */
const ruleOf = (
  content: { cartridge: Cartridge; marked: Cartridge },
  key: string,
): string | undefined => {
  const i = Number(MARK.exec(key)?.[1] ?? NaN);
  return Object.keys(content.cartridge.reactions ?? {})[i];
};

/** How often each key was reached, in key order. */
function tally(keys: (string | undefined)[]) {
  const at: Record<string, number> = {};
  for (const k of keys) if (k !== undefined) at[k] = (at[k] ?? 0) + 1;
  return Object.fromEntries(Object.entries(at).sort(([a], [b]) => (a < b ? -1 : 1)));
}
