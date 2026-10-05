import assert from 'node:assert/strict';
import { bundle, fresh, entity } from '../../../../kernel/ts/test/reward_storage_fixture.ts';
import { gameView } from '../../../../kernel/ts/src/index.ts';
import { openStory } from '../authority.ts';
import { elapsedHost } from './elapsed-host.test.ts';

export { bundle, fresh, entity };
export const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
let ordinal = 5000;
export function rewardHost(path = ':memory:') {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('controlled reward save');
  const invocation = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `bbbbbbbb-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  const invoke = (action: string, ids: string[] = [], input: object = {}) => {
    const result = story.invoke(invocation(action, ids, input));
    assert.equal(result.kind, 'saved', JSON.stringify(result));
    if (result.kind === 'saved')
      assert.equal((result.decision as { kind: string }).kind, 'accepted', JSON.stringify(result));
    return result;
  };
  const answer = (id: string) =>
    invoke('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id: id,
    });
  return { ...p, story, invocation, invoke, answer };
}
export function killFive(p: ReturnType<typeof rewardHost>) {
  for (const n of [1, 2, 3, 4, 5]) {
    p.invoke('attack', [entity(fresh, 'npc', `cellar_rat_${n}`)]);
    const from = p.story.world().state.clock;
    const r = p.story.elapsed({ expected_run_id: p.story.runId(), from, until: from + 150 });
    assert.equal(r.kind, 'saved');
    if (r.kind === 'saved')
      assert.equal((r.decision as { kind: string }).kind, 'accepted', JSON.stringify(r));
  }
}
export function offer(p: ReturnType<typeof rewardHost>) {
  p.invoke('move', [], { direction: 'up' });
  p.invoke('maud_offer', [entity(fresh, 'npc', 'maud')]);
  p.answer('accept');
  p.invoke('maud_turn_in', [entity(fresh, 'npc', 'maud')]);
}
