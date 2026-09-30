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

/** One invocation from `world`: identified, resolved and stepped, as far as each gets. */
export function attempt(world: World, scope: string, value: unknown) {
  const id = identify(scope, world.character, value);
  if (id.kind !== 'identified') return { world, result: id as Json };
  const { command_id, intent_digest } = id;
  const command = resolve(world, id);
  const s = 'kind' in command ? { world, decision: command } : step(world, command);
  const d = s.decision;
  const decision =
    d.kind === 'accepted'
      ? { kind: d.kind, outcome: d.outcome }
      : { kind: d.kind, code: d.kind === 'rejected' ? d.error.code : d.code };
  const payload = 'kind' in command ? {} : { payload: command.payload };
  return {
    world: s.world,
    result: { command_id, intent_digest, ...payload, decision } as never as Json,
  };
}

/** Every mismatch of `cases`, each case from `world`; empty when all match. */
export function run(world: World, cases: readonly Case[]): string[] {
  return cases.flatMap((c) => {
    let w = world;
    return c.steps.flatMap((s, n) => {
      const before = w;
      const got = attempt(w, c.scope, s.invocation);
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
