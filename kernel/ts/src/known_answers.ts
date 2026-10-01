// Runs invocation known answers through the actual adapter (invocation.ts) and step, on any host
// (Node, Hermes): portable code, no host API (pre-release-proof.md, Evidence required; ADR-074
// §3). Each step's result is compared as canonical bytes; a mismatch reports both results and
// the canonical state before and after the step, not just hashes.
import { encode, type Json } from './canonical.ts';
import type { World } from './decision.ts';
import { identify, resolve } from './invocation.ts';
import { step } from './world.ts';

export type Case = {
  readonly name: string;
  readonly scope: string;
  readonly steps: readonly { readonly invocation: unknown; readonly result: Json }[];
};

/**
 * One invocation from `world`: identified, resolved and stepped (as the commit at `revision`), as
 * far as each gets.
 */
export function attempt(world: World, scope: string, value: unknown, revision: number) {
  const id = identify(scope, world.character, value);
  if (id.kind !== 'identified') return { world, result: id as Json };
  const { command_id } = id;
  const command = resolve(world, id);
  const s = 'kind' in command ? { world, decision: command } : step(world, command, revision);
  const d = s.decision;
  const decision =
    d.kind === 'accepted'
      ? { kind: d.kind, outcome: d.outcome }
      : { kind: d.kind, code: d.kind === 'rejected' ? d.error.code : d.code };
  const payload = 'kind' in command ? {} : { payload: command.payload };
  return {
    world: s.world,
    result: { command_id, ...payload, decision } as never as Json,
  };
}

/** Every mismatch of `cases`, each case from `world`; empty when all match. */
export function run(world: World, cases: readonly Case[]): string[] {
  return cases.flatMap((c) => {
    let [w, revision] = [world, 0];
    return c.steps.flatMap((s, n) => {
      const before = w;
      const got = attempt(w, c.scope, s.invocation, revision + 1);
      if (got.world !== w) revision++;
      w = got.world;
      const [want, have] = [encode(s.result), encode(got.result)];
      if (want === have) return [];
      const state = (x: World) => encode(x.state as never);
      return [
        `${c.name} step ${n}\nexpected ${want}\nactual   ${have}\n` +
          `state before ${state(before)}\nstate after  ${state(w)}`,
      ];
    });
  });
}

/**
 * Every row of protocol/fixtures/intent_digest.json whose invocation, identified for its own
 * actor, does not give the pinned intent digest; empty when all match.
 */
export function digests(
  rows: readonly { invocation: { actor_id: string }; intent_digest: string }[],
) {
  return rows.flatMap((r) => {
    const id = identify('', r.invocation.actor_id as never, r.invocation);
    const got = id.kind === 'identified' ? id.intent_digest : encode(id as never);
    return got === r.intent_digest
      ? []
      : [`${encode(r.invocation as never)}\nexpected ${r.intent_digest}\nactual   ${got}`];
  });
}
