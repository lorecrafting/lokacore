// Real SQLite helper: original authored teachers and finite patch, controlled initial values.
import assert from 'node:assert/strict';
import { practicalBundle, ids } from '../../../../kernel/ts/test/practical_skills_fixture.ts';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  gameView,
  type Cartridge,
} from '../../../../kernel/ts/src/index.ts';
import { elapsedHost } from './elapsed-host.test.ts';
import { openStory } from '../authority.ts';
export { ids };
export function practicalHost(
  room = 'isle_hut',
  stat = 10,
  pennies = 20,
  path = ':memory:',
  mv = 100,
) {
  const bundle = practicalBundle(stat, room, pennies, mv);
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
  let story: Extract<ReturnType<typeof openStory>, { kind: 'open' }>;
  const reopen = () => {
    const opened = openStory(a.db, releases, a.host);
    assert.equal(opened.kind, 'open', JSON.stringify(opened));
    if (opened.kind !== 'open') throw new Error('open');
    story = opened;
  };
  reopen();
  let n = 0;
  const invocation = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  const invoke = (action_key: string, targets: string[] = [], input: object = {}) => {
    const i = invocation(action_key, targets, input),
      reply = story.invoke(i);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal((reply.decision as any).kind, 'accepted', JSON.stringify(reply));
    return i;
  };
  const learn = (teacher = 'sedge', skill = 'herbalism') => {
    invoke(`${teacher}_${skill}`, [ids[`npc/${teacher}`]]);
    return invocation('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id: 'learn',
    });
  };
  const toPatch = () => {
    invoke('move', [], { direction: 'west' });
    const transport = gameView(story.world()).notices!.find((n) => n.transport)!.transport!;
    invoke(transport.action.action_key, [...transport.action.target_ids!], {
      route: transport.route,
      quoted_fare: transport.fare,
    });
    for (const direction of ['east', 'south', 'south', 'west']) invoke('move', [], { direction });
  };
  return {
    ...a,
    fresh,
    releases,
    invocation,
    invoke,
    learn,
    toPatch,
    reopen,
    story: () => story,
    world: () => story.world(),
    view: () => gameView(story.world()),
  };
}
