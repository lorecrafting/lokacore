// Real SQLite helper: the practical-skills fragment plus an adit east of the mine (a move spends 1 mv).
import assert from 'node:assert/strict';
import {
  sampler,
  practical,
  prefix,
  ref,
} from '../../../../kernel/ts/test/practical_skills_fixture.ts';
import { gameView } from '../../../../kernel/ts/src/index.ts';
import { decode } from '../../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './elapsed-host.test.ts';
import { openStory } from '../authority.ts';
// The adit shifts every entity id, so ids come from this host's own genesis.
const adit = (stat: number, pennies: number, mv: number) => (c: any) => {
  practical(stat, pennies, mv)(c);
  c.rooms[`${prefix}:room/mine`].exits = { east: { to: ref('room', 'adit') } };
  c.rooms[`${prefix}:room/adit`] = {
    key: 'adit',
    title: 'room.mine.title', // KAT text: the authority holds no display text
    description: 'item.stick.description',
    exits: { west: { to: ref('room', 'mine') } },
  };
};
const genesis = sampler.genesis(adit(10, 20, 100)),
  ids = genesis.entityIds;
export const patch = Object.keys(genesis.details)[0]!; // the seam, the only detail
export const id = (kind: string, k: string) => ids[`${prefix}:${kind}/${k}`]!;
export function practicalHost(stat = 10, pennies = 20, path = ':memory:', mv = 100) {
  const change = adit(stat, pennies, mv);
  const bundle = sampler.bundle(change),
    fresh = sampler.genesis(change);
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
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
  const learn = (teacher = 'miner', skill = 'mining') => {
    invoke(`${teacher}_${skill}`, [id('npc', teacher)]);
    return invocation('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id: 'learn',
    });
  };
  return {
    ...a,
    fresh,
    text: (decode(bundle.canonical) as any).text as Record<string, string>,
    releases,
    invocation,
    invoke,
    learn,
    reopen,
    story: () => story,
    world: () => story.world(),
    view: () => gameView(story.world()),
  };
}
