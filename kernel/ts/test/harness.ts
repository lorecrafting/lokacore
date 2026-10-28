// The kernel tests' shared helpers: load an edited cartridge, send commands, run elapsed time.
// Expected values stay in each test; ids keep each file's own prefix because minted ids derive from them.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { INSTALLED, loadCartridge, step, stepElapsed } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import type {
  Command,
  CommandId,
  EntityId,
  StoryRunId,
  WorldContextId,
} from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { read } from './read.ts';

// Typed ids for literals, so a test needs no `as never`.
export const eid = (s: string) => s as EntityId;
export const ctx = (s: string) => s as WorldContextId;
export const cmd = (c: object) => c as Command;

/** Loads a clone of `base` after `edit`, under its own content hash. */
export function reload(base: object, edit: (c: any) => void = () => {}, installed = INSTALLED) {
  const c = structuredClone(base);
  edit(c);
  const canonical = encode(c as never);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    installed,
  );
}

/** reload's verdict: 'loaded', or the refusal's [code, path]. */
export function verdict(base: object, edit: (c: any) => void) {
  const r = reload(base, edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}

/** Loads a hash fixture's cartridge (`value`) after `edit`. */
export const load = (kat: string, edit?: (c: any) => void) => reload(read(kat).value, edit);

/** The `cartridge` of a built artifact's bytes. */
export const cartridgeOf = (artifact: Uint8Array) =>
  JSON.parse(new TextDecoder().decode(artifact)).cartridge;

/**
 * One file's command stream: ids `<prefix>-<n>` and revision n. `elapsed` mints its run ids from
 * `runPrefix` on the same counter; a test resets or rewinds it through `s.n`.
 */
export function commands(prefix: string, runPrefix = prefix) {
  const s = { n: 0, mint, send, play, elapsed };
  function mint(p: string) {
    return `${p}-${String(++s.n).padStart(12, '0')}`;
  }
  function send(w: World, payload: object) {
    const id = mint(prefix);
    return step(
      w,
      cmd({ id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } }),
      s.n,
    );
  }
  function play(w: World, payload: object) {
    const r = send(w, payload);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    return r.world;
  }
  /** Runs elapsed time to `until` in windows that end on multiples of `stride`; each must be accepted. */
  function elapsed(w: World, until: number, stride = Infinity) {
    while (w.state.clock < until) {
      const run_id = mint(runPrefix) as StoryRunId;
      const from = w.state.clock;
      const to = Math.min(until, from - (from % stride) + stride);
      const id = elapsedCommandId(run_id, w.context, from, to) as CommandId;
      const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until: to };
      const r = stepElapsed(w, cmd({ id, world_context_id: w.context, payload }), s.n);
      assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
      w = r.world;
    }
    return w;
  }
  return s;
}
