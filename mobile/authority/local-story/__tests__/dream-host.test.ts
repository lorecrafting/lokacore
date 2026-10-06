// Real authority fixture for B9, with operation-based faults supplied by elapsedHost.
import assert from 'node:assert/strict';
import { bundle, fresh, entity, ref } from '../../../../kernel/ts/test/dream_fixture.ts';
import { gameView } from '../../../../kernel/ts/src/index.ts';
import { openStory } from '../authority.ts';
import { elapsedHost } from './elapsed-host.test.ts';
export { bundle as dreamBundle } from '../../../../kernel/ts/test/dream_fixture.ts';

export function dreamHost(path = ':memory:', change: (c: any) => void = () => {}) {
  const b = bundle(change),
    initial = fresh(change),
    releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b),
    n = 0;
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw Error('dream save');
    return s;
  };
  let story = open();
  const attempt = (action_key: string, input: object = {}, target_ids: string[] = []) => ({
    invocation_id: `dddddddd-4444-4555-8666-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const invoke = (action_key: string, input: object = {}, targets: string[] = []) => {
    const i = attempt(action_key, input, targets),
      r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  return {
    initial,
    b,
    releases,
    attempt,
    invoke,
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
    dream: () => gameView(story.world()).notices!.find((n) => n.bed)!.dream!,
    reopen() {
      if (path !== ':memory:') {
        p.sql.close();
        p = elapsedHost(path, { wall: 10000, mono: 0 }, b);
      }
      story = open();
    },
    start() {
      invoke('rent_lantern_room', { service: ref('service', 'lantern_room'), quoted_price: 3 }, [
        entity(initial, 'npc', 'maud'),
      ]);
      invoke('move', { direction: 'up' });
      invoke('rest');
    },
    next() {
      const d = this.dream();
      return invoke(d.action!.action_key, { scene: d.scene, line: d.index });
    },
    choose(branch = 'follow_fox') {
      const d = this.dream(),
        c = d.choice!,
        o = c.choices.find((o) => o.choice_id === branch)!;
      return invoke(o.action_key!, {
        continuation_id: c.continuation_id,
        choice_id: branch,
        dream: o.dream,
      });
    },
    refuse: () => openStory(p.db, releases, p.host),
  };
}
