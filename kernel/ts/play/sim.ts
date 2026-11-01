// `bin/loka sim <cartridge dir> [--seeds N] [--days D]`: the balancing numbers of a cartridge source,
// compiled to a temp dir, never written back (docs/system/cartridge.md#author-preview). Each pool
// over game hours under the measured-flows worker, the XP per level and the fight matrix.
// `--artifact <file>` prints the pools and levels as JSON for the author panel.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { units } from '../src/mechanics/calendar.ts';
import { refString } from '../src/runtime/decision.ts';
import { gameView } from '../src/runtime/world.ts';
import { artifactBytes, compiled } from './compiled.ts';
import { fights } from './fight.ts';
import { flows, median, type Observe, type Policy } from './flows.ts';
import {
  FIGHT_LIMITS,
  hours,
  NO_ROOMS,
  verdict,
  type LevelRows,
  type PoolsReport,
} from './numbers.ts';

type Seen = {
  maximum: number;
  start: number;
  end: number;
  lowest: number;
  bands: Record<string, number>; // band -> the game hour first seen in
  empty: number | null;
};

type Run = { start: number; last: number; pools: Record<string, Seen> };

/** Each seed's sightings of the player's GameView, under `flows`' policy. */
function watch(c: Cartridge, opts: { seeds: number; days: number; policy?: Policy }) {
  const runs: Record<number, Run> = {};
  const { hour } = units(c);
  const see = (seed: number, w: Parameters<Observe>[0]) => {
    const run = (runs[seed] ??= { start: w.state.clock, last: 0, pools: {} });
    const at = Math.floor((w.state.clock - run.start) / hour);
    run.last = at;
    for (const r of gameView(w).resources ?? []) {
      const p = (run.pools[refString(r.resource)] ??= {
        maximum: r.maximum,
        start: r.current,
        end: r.current,
        lowest: r.current,
        bands: {},
        empty: null,
      });
      p.end = r.current;
      p.lowest = Math.min(p.lowest, r.current);
      p.bands[r.band] ??= at;
      if (r.current <= 0) p.empty ??= at;
    }
  };
  flows(c, {
    ...opts,
    observe: (before, _p, { decision, world }, { seed }) => {
      if (!runs[seed]) see(seed, before);
      if (decision.kind === 'accepted') see(seed, world);
    },
  });
  return Object.values(runs);
}

const row = (pool: string, seen: Seen[]): PoolsReport['pools'][number] => {
  const emptied = seen.flatMap((p) => p.empty ?? []);
  const named = [...new Set(seen.flatMap((p) => Object.keys(p.bands)))];
  return {
    pool,
    maximum: Math.max(...seen.map((p) => p.maximum)),
    start: median(seen.map((p) => p.start)),
    end: median(seen.map((p) => p.end)),
    lowest: Math.min(...seen.map((p) => p.lowest)),
    bands: named
      .map((band) => {
        const hours = seen.flatMap((p) => p.bands[band] ?? []);
        return { band, seeds: hours.length, hour: median(hours) };
      })
      .sort((a, b) => a.hour - b.hour),
    empty: emptied.length ? { seeds: emptied.length, hour: median(emptied) } : null,
  };
};

/** Each pool over game hours, medians across the seeds that saw it. */
export function pools(
  c: Cartridge,
  opts: { seeds: number; days: number; policy?: Policy },
): PoolsReport {
  const all = watch(c, opts);
  const names = [...new Set(all.flatMap((r) => Object.keys(r.pools)))].sort();
  return {
    seeds: opts.seeds,
    days: opts.days,
    hours_played: all.length ? median(all.map((r) => r.last)) : null,
    pools: names.map((pool) =>
      row(
        pool,
        all.flatMap((r) => r.pools[pool] ?? []),
      ),
    ),
  };
}

/** XP per level and the kills of each foe that pay for it; null with no levelling. */
export function levels(c: Cartridge): LevelRows {
  const l = c.world?.levelling;
  if (!l) return null;
  return l.thresholds.map((total, i) => {
    const step = total - (l.thresholds[i - 1] ?? 0);
    return {
      level: i + 2,
      experience: total,
      step,
      points: l.points_per_level,
      // Kills only: experience.grant pays XP too, at no count this can read. A 0 XP foe pays for nothing.
      kills: (l.kills ?? []).map((k) => ({
        npc: refString(k.npc),
        experience: k.experience,
        needed: k.experience > 0 ? Math.ceil(step / k.experience) : null,
      })),
    };
  });
}

const FLAGS = 'usage: bin/loka sim <cartridge dir> [--seeds N] [--days D]';

function table(c: Cartridge, p: PoolsReport, l: LevelRows) {
  const out = [
    `pools: ${p.seeds} seeds of ${p.days} game days, median ${hours(p.hours_played)} played`,
  ];
  if (!p.pools.length) out.push('  no pools in the view');
  for (const r of p.pools) {
    const bands = r.bands.map((b) => `${b.band} h${b.hour} (${b.seeds}/${p.seeds})`).join(', ');
    const empty = r.empty
      ? `empty h${r.empty.hour} (${r.empty.seeds}/${p.seeds})`
      : `never empty in the ${hours(p.hours_played)} played`;
    out.push(
      `  ${r.pool}: ${r.start} to ${r.end}, lowest ${r.lowest}, max ${r.maximum}; ${empty}; ${bands}`,
    );
  }
  out.push('levels:');
  if (!l) out.push('  no levelling in this cartridge');
  for (const r of l ?? []) {
    const kills = r.kills.map((k) => `${k.npc} x${k.needed ?? ' (no XP)'}`).join(', ');
    out.push(
      `  ${r.level}: ${r.experience} XP (+${r.step}), +${r.points} points; ${kills || 'no kill pays XP'}`,
    );
  }
  out.push(`fights: ${p.seeds} seeds. ${FIGHT_LIMITS}`);
  console.log(out.join('\n'));
  const { targets } = fights(c, { seeds: p.seeds });
  if (!targets.length) console.log('  no armed foes');
  for (const t of targets) console.log(`  ${t.target}: ${verdict(t)}`);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: number) => {
    const i = args.indexOf(name);
    if (i < 0) return fallback;
    return Number(args.splice(i, 2)[1]);
  };
  const [seeds, days] = [flag('--seeds', 8), flag('--days', 3)];
  const artifact = args[0] === '--artifact' ? args[1] : undefined;
  const source = artifact ? undefined : args[0];
  const shape = args.length === (args[0] === '--artifact' ? 2 : 1);
  if (!shape || ![seeds, days].every((x) => Number.isInteger(x) && x > 0)) {
    console.error(FLAGS);
    process.exit(2);
  }
  const built = source ? compiled(resolve(source)) : undefined;
  if (typeof built === 'string') {
    console.error(`not compiled: ${built}`);
    process.exit(1);
  }
  const loaded = loadCartridge(built ? artifactBytes(built) : readFileSync(artifact!), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  const c = loaded.cartridge as Cartridge;
  if (!c.rooms) {
    console.error(NO_ROOMS);
    process.exit(1);
  }
  const p = pools(c, { seeds, days });
  const l = levels(c);
  if (artifact) console.log(encode({ pools: p, levels: l } as unknown as Json));
  else table(c, p, l);
}
