// The dialogue hub (docs/system/mechanics.md dialogue@1, loka-x6t.5) over real SQLite: an answer
// resolves its row and opens a fresh pending row of the same sitting in one commit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, entity, genesis, ref } from '../../../kernel/ts/test/transport_fixture.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

const configure = (c: any) => {
  c.entry = ref('room', 'ferry_landing');
};
const release = { bundle: bundle(configure), fresh: genesis(configure) };

function atElspeth(path: string) {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, release.bundle);
  const host = { kernel_version: p.host.kernel_version, newId: p.host.newId };
  const open = () => {
    const s = openStory(
      p.db,
      [{ fresh: release.fresh, content_hash: release.bundle.sha256 }],
      host,
    );
    assert.equal(s.kind, 'open');
    if (s.kind !== 'open') throw new Error('save did not open');
    return s;
  };
  const story = open();
  let n = 0;
  const invocation = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `abcdabcd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: story.world().character,
    action_key,
    target_ids,
    input,
  });
  for (const i of [
    invocation('choose_ancestry', [], { ancestry: 'road_born' }),
    invocation('elspeth', [entity(story.world(), 'npc', 'elspeth')]),
  ]) {
    const r = story.invoke(i as never);
    assert.equal(r.kind === 'saved' && (r.decision as { kind: string }).kind, 'accepted');
  }
  return { ...p, story, open, invocation };
}

const pending = (w: ReturnType<ReturnType<typeof atElspeth>['story']['world']>) =>
  Object.entries(w.state.choices ?? {}).filter(([, c]) => c.status === 'pending');

// Breaks: a failed or acknowledgement-lost hub answer COMMIT leaves the answer half-applied (the
// old row resolved without a reopened one) or, on retry, mints a second hub row; or a cold reopen
// loses the open conversation or rejects its reopened row.
test('real SQLite hub answer survives failed and lost COMMIT, replay and cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-hub-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const [kind, choice_id] of [
    ['failed', 'directions'],
    ['lost', 'directions'],
    ['failed', 'accept'],
    ['lost', 'accept'],
  ] as const) {
    const p = atElspeth(join(dir, `${kind}-${choice_id}.db`));
    const [[talked]] = pending(p.story.world());
    const answer = p.invocation('choose', [], { continuation_id: talked, choice_id });
    if (kind === 'failed')
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    p.fault.kind = kind;
    p.fault.armed = true;
    assert.equal(p.story.invoke(answer as never).kind, 'pending', kind);
    assert.deepEqual(
      pending(p.story.world()).map(([id]) => id),
      [talked],
      kind,
    );
    p.fault.reads = false;
    const settled = p.story.invoke(answer as never);
    assert.equal(settled.kind, 'saved', kind);
    if (settled.kind !== 'saved') continue;
    assert.equal(settled.replay, kind === 'lost', kind);
    const opened = (settled.decision as any).delta.ops.find((o: any) => o.op === 'choice.open');
    const world = p.story.world();
    assert.deepEqual(
      pending(world).map(([id]) => id),
      [opened.continuation_id],
      kind,
    );
    assert.equal(world.state.choices![talked]!.status, 'resolved', kind);
    assert.equal(Object.keys(world.state.choices!).length, 2, kind);
    // An exact retry replays the receipt; it neither answers twice nor opens a third row.
    const again = p.story.invoke(answer as never);
    assert.equal(again.kind === 'saved' && again.replay, true, kind);
    assert.equal(Object.keys(p.story.world().state.choices!).length, 2, kind);

    const reopened = p.open();
    assert.equal(gameView(reopened.world()).choice?.continuation_id, opened.continuation_id, kind);
    const send = (action_key: string, input: object) => {
      const i = { ...p.invocation(action_key, [], input), actor_id: reopened.world().character };
      const r = reopened.invoke(i as never);
      assert.equal(r.kind === 'saved' && (r.decision as { kind: string }).kind, 'accepted', kind);
    };
    send('choose', { continuation_id: opened.continuation_id, choice_id: 'inn' });
    send('close_choice', { continuation_id: pending(reopened.world())[0]![0] });
    assert.equal(gameView(reopened.world()).choice, undefined, kind);
  }
});
