// Property (loka-mm5v): for every compiled cartridge with an entry room, three game days advanced
// as one long wait end in the same state as the same span advanced hour by hour. Breaks: a job,
// reaction or schedule that runs at the wait's end instead of its due time, or reads the wait-end
// clock, so one long wait and hourly play disagree. Normalised away: job rows and ids differ by
// design (mechanics.md:694, one row completes, no row per crossed hour), so pending jobs compare
// without ids, and ids derived from them (spawned entities, occurrences) by what spawned them.
// Not reachable here: the root-delivery limit (mechanics.md:3050) needs a root command's own
// delayed rule, and an advance has no root event; the same bullet's self-retriggering fault is hit
// by no stock cartridge (every one compares). Job-run delayed rules (raid_sampler's aftershock)
// sit behind the clock_hour exception below; raid.test.ts pins them.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { units } from '../src/mechanics/calendar.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

// One BEAM compiles every cartridge (as tags.test.ts compiles one).
const scratch = mkdtempSync(join(tmpdir(), 'loka-longwait-property-'));
const artifacts = new Map<string, Uint8Array>();
try {
  const script = `for d <- File.ls!("cartridges"), File.dir?(Path.join("cartridges", d)) do
    {:ok, b, _} = Loka.Content.compile(Path.join("cartridges", d))
    File.write!(Path.join(${JSON.stringify(scratch)}, d), b)
  end`;
  execFileSync('mix', ['run', '--no-start', '-e', script], { cwd: root, stdio: 'pipe' });
  for (const f of readdirSync(scratch).sort()) artifacts.set(f, readFileSync(join(scratch, f)));
} finally {
  rmSync(scratch, { recursive: true });
}

let seq = 0;
const uuid = (p: string) => `${p}-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

// Advance to `until`, ending each advance at the next multiple of `chunk`.
function advance(w: World, until: number, chunk: number): World | { fault: string } {
  while (w.state.clock < until) {
    const from = w.state.clock;
    const to = Math.min(until, from - (from % chunk) + chunk);
    const run_id = uuid('aaaaaaaa');
    const r =
      w.cartridge.manifest.time_policy?.profile === 'real_elapsed'
        ? stepElapsed(
            w,
            {
              id: elapsedCommandId(run_id as never, w.context, from, to),
              world_context_id: w.context,
              payload: { type: 'elapsed', actor_id: w.character, run_id, from, until: to },
            } as never,
            seq,
          )
        : step(
            w,
            {
              id: uuid('bbbbbbbb'),
              world_context_id: w.context,
              payload: { type: 'wait', actor_id: w.character, until: to },
            } as never,
            seq,
          );
    if (r.decision.kind !== 'accepted') return { fault: encode(r.decision) };
    w = r.world;
  }
  return w;
}

type Spawned = {
  definition: { key: string };
  origin?: { by?: { key: string }; slot?: number; generation?: number; role?: string };
};

// The state as canonical JSON with job ids dropped, only pending jobs kept, and every spawned id
// replaced by the spawner, slot, generation and role that made it (spawn ids derive from job ids).
function normal(w: World): Record<string, string> {
  const s = JSON.parse(encode(w.state as never), (k, v) =>
    k === 'job_id' || k === 'occurrence_id' ? undefined : v,
  );
  s.jobs = Object.values(s.jobs ?? {})
    .filter((j: any) => j.status === 'pending')
    .map((j) => encode(j as never))
    .sort();
  let text = encode(s);
  const labels = new Set<string>();
  for (const [id, e] of Object.entries((s.created ?? {}) as Record<string, Spawned>)) {
    const o = e.origin ?? {};
    const label = `${e.definition.key}/${o.by?.key}/${o.slot}/${o.generation}/${o.role}`;
    assert.ok(!labels.has(label), `two spawned entities share ${label}`);
    labels.add(label);
    text = text.split(id).join(label);
  }
  const out = JSON.parse(text);
  return Object.fromEntries(Object.keys(out).map((k) => [k, encode(out[k])]));
}

const fact = (w: World, key: string) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => JSON.parse(k).fact.key === key)?.[1];

// Documented differences: each asserts the documented behaviour instead of equality.
const EXCEPTIONS: Record<
  string,
  (hourly: World | { fault: string }, long: World | { fault: string }) => void
> = {
  // mechanics.md:1956 (status Known limit): a refresh whose new end is at or before the advance
  // end faults precondition_failed; `soaked` is refreshed every hour by four reactions.
  toolbox_showcase: (hourly, long) => {
    assert.ok(!('fault' in hourly), encode(hourly as never));
    assert.match((long as { fault: string }).fault, /precondition_failed/);
  },
  // Same limit, any re-apply in one advance: the guard's poison ticks re-apply `fury` (end +600)
  // inside each hour; the long wait re-applies `poison` (end +300) on the guard's next 07:00.
  npc_status_sampler: (hourly, long) => {
    assert.match((hourly as { fault: string }).fault, /precondition_failed.*"key":"fury"/);
    assert.match((long as { fault: string }).fault, /precondition_failed.*"key":"poison"/);
  },
  // Same limit: Maud enters the yard each 07:00 and `bruised` (end +10 hours) is re-applied on the
  // second day of the long wait; each hourly advance ends before it would expire.
  variants_sampler: (hourly, long) => {
    assert.ok(!('fault' in hourly), encode(hourly as never));
    assert.match((long as { fault: string }).fault, /precondition_failed.*"key":"bruised"/);
  },
  // mechanics.md:2138 (clock_hour): one settlement crossing many hour boundaries fires once, at the
  // wait end, so `raid` fires at 3000 (full moon) and not at 1000, and `calm` never sees a new moon.
  raid_sampler: (hourly, long) => {
    assert.ok(!('fault' in hourly) && !('fault' in long));
    assert.deepEqual(
      [fact(hourly as World, 'raided_at'), fact(long as World, 'raided_at')],
      [3000, 3000],
    );
    assert.deepEqual(
      [fact(hourly as World, 'aftermaths'), fact(long as World, 'aftermaths')],
      [1, undefined],
    );
  },
};

for (const [file, bytes] of artifacts) {
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, `${file}: ${JSON.stringify(loaded).slice(0, 300)}`);
  const c = loaded.cartridge as Cartridge;
  // ashmere_hello is a text-only greeting with no entry room, so it has no world to advance.
  if (!c.entry) continue;
  test(`${file}: one long wait equals hourly steps`, () => {
    let w0 = newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
    const ancestry = Object.keys(c.ancestries ?? {})[0];
    if (ancestry) {
      const r = step(
        w0,
        {
          id: uuid('cccccccc'),
          world_context_id: w0.context,
          payload: { type: 'choose_ancestry', actor_id: w0.character, ancestry },
        } as never,
        seq,
      );
      assert.equal(r.decision.kind, 'accepted');
      w0 = r.world;
    }
    const { hour, day } = units(c);
    const until = w0.state.clock + day * 3;
    const hourly = advance(w0, until, hour);
    const long = advance(w0, until, Number.MAX_SAFE_INTEGER);

    if (EXCEPTIONS[file]) return EXCEPTIONS[file](hourly, long);
    assert.ok(!('fault' in hourly), `hourly: ${(hourly as { fault: string }).fault}`);
    assert.ok(!('fault' in long), `long: ${(long as { fault: string }).fault}`);
    const a = normal(hourly),
      b = normal(long);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      assert.equal(b[k], a[k], `section ${k}`);
  });
}
