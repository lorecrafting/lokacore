// Two disjoint fresh seed ranges; only aggregate coverage crosses the worker boundary.
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { report, simulate } from './sim.ts';

type Summary = {
  count: number;
  steps: number;
  lengths: number[];
  codes: Set<string>;
  seen: Set<string>;
};

function summarize(seeds: Iterable<number>): Summary {
  const summary: Summary = {
    count: 0,
    steps: 0,
    lengths: Array<number>(8).fill(0),
    codes: new Set(),
    seen: new Set(),
  };
  for (const seed of seeds) {
    const o = simulate(seed);
    if (o.failure) throw new Error(report(o));
    summary.count++;
    summary.steps += o.commands.length;
    summary.lengths[(o.commands.length - 1) >> 3]! += 1;
    for (const c of o.codes) summary.codes.add(c);
    summary.seen.add(o.loaded.cartridge.manifest.id);
    for (const c of o.commands) summary.seen.add(c.payload.type);
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

export async function fresh(first: number, count: number, regressions: number[]): Promise<Summary> {
  const summary = summarize(regressions);
  const half = Math.ceil(count / 2);
  const workers = [
    { first, count: half },
    { first: first + half, count: count - half },
  ].map((workerData) => new Worker(new URL(import.meta.url), { workerData }));
  try {
    const summaries = await Promise.all(workers.map(result));
    for (const s of summaries) {
      summary.count += s.count;
      summary.steps += s.steps;
      s.lengths.forEach((n, i) => (summary.lengths[i]! += n));
      for (const c of s.codes) summary.codes.add(c);
      for (const c of s.seen) summary.seen.add(c);
    }
    return summary;
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

if (!isMainThread) {
  const { first, count } = workerData as { first: number; count: number };
  parentPort!.postMessage(summarize(Array.from({ length: count }, (_, i) => first + i)));
}
