// The local Story authority (07 §8; 03 §§14-15; ADR-072): the world in memory, one SQLite
// save, and 03 §14's admission order. invoke is synchronous on one connection, so commands run
// one at a time, as WorldInstance serializes them online (07 §8).
import type { Json } from '../../../kernel/ts/src/canonical.ts';
import type { DecisionResult, ErrorCode } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { identify, INTENT_DIGEST_VERSION, resolve } from '../../../kernel/ts/src/invocation.ts';
import { step } from '../../../kernel/ts/src/world.ts';
import { commit, load, receipt, type Db } from './store.ts';

/** A committed outcome, new or replayed (03 §14): the decision and the revision it left. */
export type Saved = { kind: 'saved'; replay: boolean; revision: number; decision: Json };

export type Reply =
  | Exclude<ReturnType<typeof identify>, { kind: 'identified' }>
  | { kind: 'conflict' }
  | { kind: 'fault'; code: ErrorCode }
  | Saved;

/**
 * The story saved in `db` (or `fresh`, saved at revision 0) for the lineage/character scope
 * `scope`, trusted from the host; its actor is the world's character. `invoke` takes one
 * ActionInvocation: malformed or another actor's gets no receipt; a known invocation replays its
 * receipt (altered intent is a conflict) before anything is resolved against the current world;
 * a NEW one is resolved, decided once and committed before it is adopted. A fault discards its
 * proposal and gets no receipt (ADR-075 §4; 04 §5.2 step 7). A failed commit throws, with memory
 * and storage unchanged.
 */
export function openStory(db: Db, fresh: World, scope: string) {
  let { world, revision } = load(db, fresh);
  return {
    world: () => world,
    invoke(value: unknown): Reply {
      const id = identify(scope, world.character, value);
      if (id.kind !== 'identified') return id;
      const { invocation: i, command_id, intent_digest } = id;
      const old = receipt(db, scope, i.invocation_id);
      if (old) {
        if (old.intent_digest !== intent_digest) return { kind: 'conflict' };
        return { kind: 'saved', replay: true, revision: old.revision, decision: old.response };
      }
      const command = resolve(world, id);
      const next: { world: World; decision: DecisionResult } =
        'kind' in command ? { world, decision: command } : step(world, command);
      const d = next.decision;
      if (d.kind === 'fault') return { kind: 'fault', code: d.code };
      // ponytail: no rule emits effects yet; the outbox (03 §16) comes with the first that does.
      if (d.kind === 'accepted' && d.effects.length) throw new Error('effect outbox not built');
      const at = d.kind === 'accepted' ? revision + 1 : revision;
      commit(db, next.world, d, {
        scope,
        invocation_id: i.invocation_id,
        command_id,
        actor_id: i.actor_id,
        intent_digest_version: INTENT_DIGEST_VERSION,
        intent_digest,
        command: 'kind' in command ? null : (command as never),
        revision: at,
        response: d as never,
      });
      [world, revision] = [next.world, at];
      return { kind: 'saved', replay: false, revision, decision: d as never };
    },
  };
}
