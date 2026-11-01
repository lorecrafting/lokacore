// The shape of the balancing reports, free of node and the kernel so the author panel can compile
// against it. `fights`, `pools` and `levels` are annotated with these types, so `tsc -p play` holds
// the reports to them and the panel reads the real shape, not a copy of it.
export type Section<T> = { report: T } | { why: string };

export type PoolsReport = {
  seeds: number;
  days: number;
  hours_played: number | null;
  pools: {
    pool: string;
    maximum: number;
    start: number;
    end: number;
    lowest: number;
    bands: { band: string; seeds: number; hour: number }[];
    empty: { seeds: number; hour: number } | null;
  }[];
};

export type LevelRows =
  | {
      level: number;
      experience: number;
      step: number;
      points: number;
      kills: { npc: string; experience: number; needed: number | null }[];
    }[]
  | null;

export type Cell = { level: number; build: string } & (
  | { refused: string }
  | {
      n: number;
      wins: number;
      deaths: number;
      fleds: number;
      timeouts: number;
      unborn?: number;
      rounds?: { median: number; min: number; max: number };
      hp_left?: { median: number; min: number; max: number };
    }
);

export type Target = {
  target: string;
  rating: { first_win_level: number | null; first_win_build: string | null };
  cells: Cell[];
};

export type FightsReport = { seeds: number; rounds: number; targets: Target[] };

/** What the watcher's GET /numbers answers; a report that could not run says why. */
export type Numbers = {
  hash: string;
  pacing: Section<{ pools: PoolsReport; levels: LevelRows }>;
  fights: Section<FightsReport>;
};

// What the writer reads, here so the tab and bin/loka sim say one thing and a test can hold it. The
// matrix's own percents and rating count unborn runs as lost fights, so these do not read them.
export const FIGHT_LIMITS =
  'Each fight is alone: allies removed, starting gear, no consumables or spells.';

export const NO_ROOMS = 'This cartridge has no rooms, so there is nothing to play and no numbers.';

export const hours = (n: number | null) =>
  n === null ? 'no hours' : `${n} ${n === 1 ? 'hour' : 'hours'}`;

type Ran = Exclude<Cell, { refused: string }>;
const fought = (c: Ran) => c.n - (c.unborn ?? 0);
const NOTHING = ['', '', '', '', ''];

/** A no-build row: level, win, death, fled, no end, rounds, hp left. */
export function cellRow(c: Cell): string[] {
  if ('refused' in c) return [`level ${c.level}`, `refused: ${c.refused}`, ...NOTHING];
  const n = fought(c);
  if (!n) return [`level ${c.level}`, `no fight: ${c.unborn} of ${c.n} unborn`, ...NOTHING];
  const rate = (k: number) => `${((k * 100) / n).toFixed(2)}%`;
  return [
    c.unborn ? `level ${c.level} (${c.unborn} unborn)` : `level ${c.level}`,
    rate(c.wins),
    rate(c.deaths),
    rate(c.fleds),
    String(c.timeouts),
    c.rounds ? String(c.rounds.median) : 'no win',
    c.hp_left ? String(c.hp_left.median) : 'no win',
  ];
}

/** One target's result, in level then build order; it says so when nothing was measured. */
export function verdict({ cells }: Pick<Target, 'cells'>): string {
  const ran = cells.filter((c): c is Ran => !('refused' in c));
  if (!ran.length) {
    const codes = cells.flatMap((c) => ('refused' in c ? c.refused : []));
    return `Refused (${[...new Set(codes)].join(', ')}): no fight was measured.`;
  }
  const total = ran.reduce((sum, c) => sum + c.n, 0);
  const left = ran.reduce((sum, c) => sum + (c.unborn ?? 0), 0);
  if (left === total) return `No fight happened: no member was born in ${total} runs.`;
  const first = ran.find((c) => fought(c) && c.wins * 2 >= fought(c));
  const head = first
    ? `Wins half from level ${first.level} (build ${first.build}).`
    : 'No level wins half with any build.';
  return left ? `${head} ${left} of ${total} runs left out: no member born.` : head;
}
