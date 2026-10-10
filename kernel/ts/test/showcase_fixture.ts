// The toolbox showcase (cartridges/toolbox_showcase, docs/SHOWCASE.md) from its pinned compiled
// answer, and the play helpers its district walkthroughs share. test/loka/content_showcase_test.exs
// holds the source to the same bytes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/toolbox_showcase_hash.json', import.meta.url),
    'utf8',
  ),
) as { canonical: string; sha256: string };
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const fresh = (context: string) => newWorld(content, context as never, [1, 2, 3, 4]);
export const ref = (kind: string, key: string) => `toolbox_showcase@0.0.1:${kind}/${key}`;
export const id = (w: World, kind: string, key: string) => w.entityIds[ref(kind, key)]!;
/** The id of the detail with this key in the player's room. */
export function detail(w: World, key: string) {
  const here = w.state.containers[w.body];
  const found = Object.keys(w.details).find(
    (k) => w.details[k].key === key && w.details[k].room === here,
  );
  assert.ok(found, `no detail ${key} here`);
  return found;
}
export const pool = (w: World, key: string) => level(w, w.body, resourceRef(w, key));
export const labels = (w: World) => gameView(w).conditions?.map((c) => c.label as string) ?? [];
export const attribute = (w: World, key: string) =>
  gameView(w).attributes?.find((a) => a.attribute.key === key)?.value;

let n = 0;
/** One player command; the decision and the world after it (unchanged when refused). */
export function act(w: World, p: object) {
  n += 1;
  const r = step(
    w,
    {
      id: `5ca5e000-5555-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  const narration = r.decision.kind === 'accepted' ? (r.decision.narration ?? []) : [];
  return { decision: r.decision, world: r.world, lines: narration.map((l) => l.key as string) };
}
/** An accepted command's world and narration keys. */
export function play(w: World, p: object) {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
export const go = (w: World, direction: string) => play(w, { type: 'move', direction });
export const take = (w: World, item: string) =>
  play(w, { type: 'take', item_id: id(w, 'item', item) }).world;
export const perform = (w: World, action: string) => play(w, { type: 'perform', action });
/** The refusal code of a command the rules must refuse. */
export function refused(w: World, p: object) {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'rejected', JSON.stringify(r.decision));
  return (r.decision as unknown as { error: { code: string } }).error.code;
}

/**
 * As the host (mobile/authority/local-story/elapsed.ts): elapsed steps to `target`, stopping at each
 * pending job but the calendar job; every narration key on the way. One call spans at most one
 * day (loka-j2mo).
 */
export function wait(w: World, target: number) {
  assert.ok(target - w.state.clock <= DAY, 'a wait spans at most one day');
  const lines: string[] = [];
  while (w.state.clock < target) {
    const until = Object.values(w.state.jobs ?? {})
      .filter(
        (j) => j.status === 'pending' && j.job.kind !== 'calendar' && j.due_time > w.state.clock,
      )
      .reduce((t, j) => Math.min(t, j.due_time), target);
    n += 1;
    const run_id = 'aaaaaaaa-0000-4000-8000-00000000005c';
    const r = stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
        world_context_id: w.context,
        payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
      } as never,
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    if (r.decision.kind === 'accepted')
      lines.push(...(r.decision.narration ?? []).map((l) => l.key as string));
    w = r.world;
  }
  return { world: w, lines };
}
