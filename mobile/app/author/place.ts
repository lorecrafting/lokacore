// Keep my place (docs/system/cartridge.md#author-preview): the author preview records the inputs
// the session saved under the artifact hash and, after a reload into a different artifact, sends
// them again through the normal command path. Targets are kept as definition refs because entity
// ids shift when an edit adds or removes an entity. Nothing here writes state directly.
import type { EntityId, GameView, Intent, Reply } from '../../packages/game-view/session.ts';

export type Step = { intent: Intent } | { advance: number }; // advance: dev-clock milliseconds
export type Place = { hash: string; steps: Step[] };
type Ids = Readonly<Record<string, string>>; // definition ref -> entity id
export type Replayable = {
  view: () => { view: Pick<GameView, 'choice'>; token: string };
  invoke: (intent: Intent) => Reply;
  entityIds: () => Ids;
};
export type Outcome = { done: number; failed?: string };
type Pulsed = { pulse: (mode: 'active' | 'drain') => { kind: string } };

/** After the dev clock moved: credit the elapsed time now, so the next replayed input is not refused as catching up. */
export function caughtUp(game: Pulsed) {
  game.pulse('active'); // a drain never captures the clocks (elapsed.ts pulse); an active pulse does
  let rounds = 0;
  while (rounds++ < 1000 && game.pulse('drain').kind === 'catching_up');
}

const isRef = (target: string) => target.includes('@');

/** The intent with each defined target named by its ref; a runtime-born entity keeps its id. */
export const asRefs = (intent: Intent, ids: Ids): Intent => ({
  ...intent,
  target_ids: intent.target_ids.map(
    (id) => (Object.keys(ids).find((ref) => ids[ref] === id) ?? id) as EntityId,
  ),
});

const describe = (reply: Reply) => {
  if (reply.kind !== 'saved') return reply.kind;
  const d = reply.decision;
  return d.kind === 'rejected'
    ? `rejected ${d.error.code}`
    : d.kind === 'fault'
      ? `fault ${d.code}`
      : d.kind;
};

/** Sends the steps in order; the first the session does not save and accept stops the replay, named. */
export function replay(steps: Step[], game: Replayable, advance: (ms: number) => void): Outcome {
  for (const [i, step] of steps.entries()) {
    if ('advance' in step) {
      advance(step.advance);
      continue;
    }
    const ids = game.entityIds();
    const name = `step ${i + 1} (${[step.intent.action_key, ...step.intent.target_ids].join(' ')})`;
    const missing = step.intent.target_ids.find((t) => isRef(t) && !(t in ids));
    if (missing) return { done: i, failed: `${name}: no ${missing} in this cartridge` };
    const { view, token } = game.view();
    // A choice names its continuation, which this run issued afresh.
    const input =
      step.intent.input.continuation_id && view.choice
        ? { ...step.intent.input, continuation_id: view.choice.continuation_id }
        : step.intent.input;
    const reply = game.invoke({
      ...step.intent,
      target_ids: step.intent.target_ids.map((t) => (ids[t] ?? t) as EntityId),
      input,
      view_freshness_token: token,
    });
    if (reply.kind !== 'saved' || reply.decision.kind !== 'accepted')
      return { done: i, failed: `${name}: ${describe(reply)}` };
  }
  return { done: steps.length };
}
