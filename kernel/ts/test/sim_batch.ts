// Two disjoint fresh seed ranges, of the corpus or of one cartridge's pass; only aggregate
// coverage crosses the worker boundary.
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { ROOT } from '../play/obs.ts';
import type { Command, DecisionResult } from '../src/contracts.gen.ts';
import { cartridgeFile, KERNEL, report, simulate, type Kernel } from './sim.ts';

type Summary = {
  count: number;
  steps: number;
  lengths: number[];
  codes: Set<string>;
  seen: Set<string>;
  rooms: Set<string>; // where sequences end
  changed: Set<string>; // action keys accepted with a change (pass-1 check 4)
  silent: Set<string>; // of those, the ones accepted with a change and no narration line
};
// A single-cartridge pass: its fixture (from the repository root) and the seeds left out.
type Pass = { cartridge?: string; skip?: number[] };

function summarize(seeds: Iterable<number>, { cartridge, skip = [] }: Pass = {}): Summary {
  const only = cartridge ? [{ ...cartridgeFile(ROOT + cartridge), path: cartridge }] : undefined;
  const summary: Summary = {
    count: 0,
    steps: 0,
    lengths: Array<number>(8).fill(0),
    codes: new Set(),
    seen: new Set(),
    rooms: new Set(),
    changed: new Set(),
    silent: new Set(),
  };
  // The step the host commits: its receipt's narration is what narration.ts shows.
  const kernel: Kernel = {
    ...KERNEL,
    step: (...a) => {
      const r = KERNEL.step(...a);
      const key = changeKey(a[1], r.decision);
      if (key) summary.changed.add(key);
      if (key && !(r.decision as { narration?: unknown[] }).narration?.length)
        summary.silent.add(key);
      return r;
    },
  };
  for (const seed of seeds) {
    if (skip.includes(seed)) continue;
    const o = simulate(seed, kernel, only);
    if (o.failure) throw new Error(report(o));
    summary.count++;
    summary.steps += o.commands.length;
    summary.lengths[(o.commands.length - 1) >> 3]! += 1;
    for (const c of o.codes) summary.codes.add(c);
    summary.seen.add(o.loaded.cartridge.manifest.id);
    for (const c of o.commands) summary.seen.add(c.payload.type);
    summary.rooms.add(o.end.rooms[o.end.state.containers[o.end.body]!]!.key);
  }
  return summary;
}

function result(worker: Worker): Promise<Summary> {
  return new Promise((resolve, reject) => {
    let summary: Summary | undefined;
    worker.once('message', (value: Summary) => (summary = value));
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0 || !summary)
        reject(new Error(`simulation worker exited ${code} without results`));
      else resolve(summary);
    });
  });
}

export async function fresh(
  first: number,
  count: number,
  regressions: number[],
  pass: Pass = {},
): Promise<Summary> {
  const summary = summarize(regressions, pass);
  const half = Math.ceil(count / 2);
  const workers = [
    { first, count: half },
    { first: first + half, count: count - half },
  ].map((range) => new Worker(new URL(import.meta.url), { workerData: { ...range, pass } }));
  try {
    const summaries = await Promise.all(workers.map(result));
    for (const s of summaries) {
      summary.count += s.count;
      summary.steps += s.steps;
      s.lengths.forEach((n, i) => (summary.lengths[i]! += n));
      for (const c of s.codes) summary.codes.add(c);
      for (const c of s.seen) summary.seen.add(c);
      for (const r of s.rooms) summary.rooms.add(r);
      for (const k of s.changed) summary.changed.add(k);
      for (const k of s.silent) summary.silent.add(k);
    }
    return summary;
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

/** A step's action key (a recipe's key, else the command type) when it commits a change. */
export function changeKey(command: Command, d: DecisionResult): string | undefined {
  const p = command.payload as { type: string; action?: string };
  // A recipe key is prefixed, so a recipe named like a pinned verb never hides behind that pin.
  const key = p.action ? `${p.type}:${p.action}` : p.type;
  return d.kind === 'accepted' && d.delta.ops.length ? key : undefined;
}

// Action keys meant to commit a change with no narration line, each with its reason (pass-1 check 4).
export const SILENT: Record<string, string> = {
  close:
    'the closed lid is its own line on the page; same as pinned open (loka-kgd.185, loka-x6t.121)',
};

/** Check 4's findings: a new silent key, and a pinned one now narrated (remove its pin). */
export function unnarrated(s: Pick<Summary, 'changed' | 'silent'>, pinned: string[]): string[] {
  return [
    ...[...s.silent]
      .filter((k) => !pinned.includes(k) && !Object.hasOwn(SILENT, k))
      .map((k) => `${k}: commits a change with no narration line`),
    ...pinned
      .filter((k) => s.changed.has(k) && !s.silent.has(k))
      .map((k) => `${k}: narrated now; remove it from the baseline`),
  ].sort();
}

if (!isMainThread) {
  const { first, count, pass } = workerData as { first: number; count: number; pass: Pass };
  parentPort!.postMessage(
    summarize(
      Array.from({ length: count }, (_, i) => first + i),
      pass,
    ),
  );
}
