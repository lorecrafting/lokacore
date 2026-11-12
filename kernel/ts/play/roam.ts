// `bin/loka roam <cartridge dir> [--runs N] [--steps M] [--seed S]` (docs/design/story-tooling.md §2b
// W1): a random player over the real authority, many seeded times, reporting what no run reached,
// zero-hit first. A report for authors, not a check. A run that breaks an invariant is shrunk to the
// steps that still break it and written to `checkpoints/roam-<seed>.json`, which `bin/loka check` and
// R1's post-compile replay then guard on every compile.
//
// It drives *intents*, not kernel payloads, because a checkpoint is a `Step[]` of intents
// (mobile/app/author/place.ts) and this is where a found bug has to be replayable.
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { encode, hash, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import type { Step } from '../../../mobile/app/author/place.ts';
import type { Bundled } from '../../../mobile/authority/local-story/session.ts';
import { artifactBytes, compiled } from './compiled.ts';
import { marked } from './coverage.ts';
import { roamBytes, shrinkSteps } from './walk.ts';

// The CLI and the test both read the walk's verdict rules from here: roam.ts is this tool's public face.
export { verdictOf, type Verdict } from './walk.ts';

// A marker narrate key (`coverage.marked`), mapped back to its reaction by `ruleOf`.
/** `steps` again, keeping only those that still break it (greedy deletion, as sim.ts shrinks). A
 * refusal is not a break: replay reports one as `failed` with `refused` set, and a random player
 * meets refusals constantly — only a crash, a `fault` reply or a broken invariant is worth saving. */
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

/** A cartridge directory roamed: the report the CLI prints, with each break's steps (not written to
 * disk — the CLI does that). Exported for kernel/ts/test/roam.test.ts. */
export function roam(source: string, opts: { runs: number; steps: number; seed: number }) {
  const built = compiled(resolve(source));
  if (typeof built === 'string') throw new Error('not compiled: ' + built);
  const plain = loadCartridge(artifactBytes(built), INSTALLED);
  if (!plain.ok) throw new Error(JSON.stringify(plain.diagnostic));
  const cartridge = plain.cartridge as Cartridge;
  const { cartridge: markedCartridge } = marked(cartridge);
  const markedJson = markedCartridge as unknown as Json;
  const bytes: Bundled = { canonical: encode(markedJson), sha256: hash(markedJson) };
  const out = roamBytes(
    bytes,
    { cartridge, marked: markedCartridge },
    opts.seed,
    opts.runs,
    opts.steps,
  );
  return {
    ...out,
    bytes,
    cartridge: cartridge.manifest.id + '@' + cartridge.manifest.version,
    runs: opts.runs,
    steps: opts.steps,
    seed: opts.seed,
  };
}

/** Writes one checkpoint per break, shrunk, where `bin/loka check` already looks. An existing file of
 * that seed is the author's: kept. Exported so a test can drive the write path without a planted
 * kernel fault (the compiler rejects every malformed rule statically, so one cannot be planted). */
export function writeBreaks(source: string, out: ReturnType<typeof roam>): string[] {
  const written: string[] = [];
  for (const b of out.broke) {
    const path = join(source, 'checkpoints', `roam-${b.seed}.json`);
    if (existsSync(path)) continue;
    const steps = shrinkSteps(out.bytes, b.steps);
    writeFileSync(path, `${JSON.stringify({ steps }, null, 2)}\n`);
    written.push(path);
  }
  return written;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: number) => {
    const i = args.indexOf(name);
    if (i < 0) return fallback;
    return Number(args.splice(i, 2)[1]);
  };
  const [runs, steps, seed] = [flag('--runs', 10), flag('--steps', 150), flag('--seed', 1)];
  const source = args[0];
  const shape = args.length === 1 && [runs, steps, seed].every((x) => Number.isInteger(x) && x > 0);
  if (!source || !shape) {
    console.error(
      'usage: bin/loka roam <cartridge dir> [--runs N] [--steps M] [--seed S]\n' +
        '  The defaults (10 x 150) take about 40 s on the showcase; `view()` is most of each step.',
    );
    process.exit(2);
  }
  const at = resolve(source);
  let out: ReturnType<typeof roam>;
  try {
    out = roam(at, { runs, steps, seed });
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  writeBreaks(at, out);
  console.log(
    encode({
      cartridge: out.cartridge,
      runs,
      steps,
      seed,
      milliseconds: out.milliseconds,
      never_reached: out.never,
      reached: out.reached,
      broke: out.broke.map(({ steps: _s, bytes: _b, ...rest }) => rest),
    } as unknown as Json),
  );
}
