export { entity, onlyFood } from '../../../../kernel/ts/test/food_fixture.ts';
import assert from 'node:assert/strict';
import { bundle, fresh } from '../../../../kernel/ts/test/food_fixture.ts';
import { openStory } from '../authority.ts';
import { elapsedHost } from './elapsed-host.test.ts';

export function foodHost(
  path: string,
  change: (c: any) => void = () => {},
  kernel_version?: string,
) {
  const b = bundle(change),
    initial = fresh(change),
    releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b, kernel_version),
    n = 0;
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw new Error('food save');
    return s;
  };
  let story = open();
  const attempt = (action_key: string, targets: string[] = [], input = {}) => ({
    invocation_id: `dddddddd-6666-4555-8666-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids: targets,
    input,
  });
  return {
    initial,
    b,
    releases,
    attempt,
    invoke(action: string, targets: string[] = [], input = {}) {
      const i = attempt(action, targets, input),
        r = story.invoke(i);
      assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
      return i;
    },
    get story() {
      return story;
    },
    get sql() {
      return p.sql;
    },
    get db() {
      return p.db;
    },
    get host() {
      return p.host;
    },
    get fault() {
      return p.fault;
    },
    get game() {
      return p.game;
    },
    get clock() {
      return p.clock;
    },
    reopen() {
      p.sql.close();
      p = elapsedHost(path, { wall: p.clock.wall, mono: p.clock.mono }, b, kernel_version);
      story = open();
    },
    refuse: () => openStory(p.db, releases, p.host),
  };
}
