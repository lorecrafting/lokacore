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
      win_pct: string;
      death_pct: string;
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
